"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { extractBill, extractionAvailable } from "@/lib/extract-bill";

type Result = { error?: string; ok?: boolean; id?: string };

const MAX_BYTES = 20 * 1024 * 1024;

/** Upload a bill, store it, then try to read it automatically. */
export async function uploadBillScan(_prev: unknown, formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a bill image or PDF first." };
  if (file.size > MAX_BYTES) return { error: "File is larger than 20MB." };

  const projectId = String(formData.get("project_id") ?? "") || null;
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("bills")
    .upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: false });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  const { data: scan, error: insErr } = await supabase
    .from("bill_scans")
    .insert({
      storage_path: path,
      original_filename: file.name,
      mime_type: file.type || "image/jpeg",
      size_bytes: file.size,
      status: extractionAvailable() ? "processing" : "needs_review",
      project_id: projectId,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (insErr || !scan) return { error: `Could not record the upload: ${insErr?.message}` };

  if (extractionAvailable()) {
    try {
      const read = await extractBill(bytes, file.type || "image/jpeg");

      await supabase
        .from("bill_scans")
        .update({
          status: "extracted",
          shop_name: read.shop_name || null,
          item_description: read.item_summary || null,
          bill_no: read.bill_no || null,
          bill_date: read.bill_date || null,
          currency: read.currency || "GBP",
          amount: read.subtotal || 0,
          tax_amount: read.tax_amount || 0,
          total_amount: read.total_amount || 0,
          confidence: read.confidence ?? null,
          extracted_raw: read,
          extraction_error: null,
        })
        .eq("id", scan.id);

      if (read.line_items?.length) {
        await supabase.from("bill_scan_lines").insert(
          read.line_items.map((l, i) => ({
            scan_id: scan.id,
            description: l.description || "Item",
            quantity: l.quantity || 1,
            unit_price: l.unit_price || 0,
            line_total: l.line_total || 0,
            sort_order: i,
          })),
        );
      }
    } catch (e) {
      await supabase
        .from("bill_scans")
        .update({
          status: "failed",
          extraction_error: e instanceof Error ? e.message : "Unknown extraction error",
        })
        .eq("id", scan.id);
    }
  }

  revalidatePath("/bill-scans");
  redirect(`/bill-scans/${scan.id}`);
}

/** Re-run the reader on a scan that failed or was read badly. */
export async function retryExtraction(scanId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: scan } = await supabase
    .from("bill_scans")
    .select("id, storage_path, mime_type")
    .eq("id", scanId)
    .single();
  if (!scan) return { error: "Scan not found." };
  if (!extractionAvailable()) return { error: "Auto-reading is not configured on this server." };

  await supabase.from("bill_scans").update({ status: "processing" }).eq("id", scanId);

  const { data: file, error: dlErr } = await supabase.storage.from("bills").download(scan.storage_path);
  if (dlErr || !file) {
    await supabase.from("bill_scans").update({ status: "failed", extraction_error: "Could not read the stored file." }).eq("id", scanId);
    return { error: "Could not read the stored file." };
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const read = await extractBill(bytes, scan.mime_type ?? "image/jpeg");

    await supabase.from("bill_scans").update({
      status: "extracted",
      shop_name: read.shop_name || null,
      item_description: read.item_summary || null,
      bill_no: read.bill_no || null,
      bill_date: read.bill_date || null,
      currency: read.currency || "GBP",
      amount: read.subtotal || 0,
      tax_amount: read.tax_amount || 0,
      total_amount: read.total_amount || 0,
      confidence: read.confidence ?? null,
      extracted_raw: read,
      extraction_error: null,
    }).eq("id", scanId);

    await supabase.from("bill_scan_lines").delete().eq("scan_id", scanId);
    if (read.line_items?.length) {
      await supabase.from("bill_scan_lines").insert(
        read.line_items.map((l, i) => ({
          scan_id: scanId,
          description: l.description || "Item",
          quantity: l.quantity || 1,
          unit_price: l.unit_price || 0,
          line_total: l.line_total || 0,
          sort_order: i,
        })),
      );
    }
  } catch (e) {
    await supabase.from("bill_scans").update({
      status: "failed",
      extraction_error: e instanceof Error ? e.message : "Unknown extraction error",
    }).eq("id", scanId);
    return { error: "Re-reading failed." };
  }

  revalidatePath(`/bill-scans/${scanId}`);
  return { ok: true };
}

/**
 * Save hand-corrected fields. Works before confirmation and after —
 * a confirmed scan keeps its linked bill in sync.
 */
export async function saveScan(_prev: unknown, formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing scan id." };

  const numeric = (k: string) => {
    const raw = String(formData.get(k) ?? "").replace(/[^0-9.-]/g, "");
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  };
  const text = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };

  const patch = {
    shop_name: text("shop_name"),
    item_description: text("item_description"),
    bill_no: text("bill_no"),
    bill_date: text("bill_date"),
    currency: String(formData.get("currency") ?? "GBP").trim() || "GBP",
    amount: numeric("amount"),
    tax_amount: numeric("tax_amount"),
    total_amount: numeric("total_amount"),
    project_id: text("project_id"),
    category_id: text("category_id"),
    vendor_id: text("vendor_id"),
    manually_edited: true,
  };

  const { data: scan, error } = await supabase
    .from("bill_scans")
    .update(patch)
    .eq("id", id)
    .select("id, status, bill_id")
    .single();

  if (error) return { error: error.message };

  // already confirmed? push the correction through to the real bill too
  if (scan?.bill_id) {
    await supabase
      .from("bills")
      .update({
        vendor_id: patch.vendor_id,
        project_id: patch.project_id,
        category_id: patch.category_id,
        issue_date: patch.bill_date ?? undefined,
        subtotal: patch.amount,
        tax_amount: patch.tax_amount,
        total: patch.total_amount,
        description: patch.item_description,
      })
      .eq("id", scan.bill_id);
  }

  revalidatePath(`/bill-scans/${id}`);
  revalidatePath("/bills");
  return { ok: true };
}

/** Save an edited line item. */
export async function saveScanLine(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const lineId = String(formData.get("line_id") ?? "");
  const scanId = String(formData.get("scan_id") ?? "");
  if (!lineId) return;

  const n = (k: string) => Number(String(formData.get(k) ?? "0").replace(/[^0-9.-]/g, "")) || 0;
  const quantity = n("quantity");
  const unitPrice = n("unit_price");

  const { error } = await supabase
    .from("bill_scan_lines")
    .update({
      description: String(formData.get("description") ?? "").trim() || "Item",
      quantity,
      unit_price: unitPrice,
      line_total: n("line_total") || quantity * unitPrice,
    })
    .eq("id", lineId);

  if (error) return;
  await supabase.from("bill_scans").update({ manually_edited: true }).eq("id", scanId);
  revalidatePath(`/bill-scans/${scanId}`);
}

export async function deleteScanLine(lineId: string, scanId: string) {
  const supabase = await createClient();
  await supabase.from("bill_scan_lines").delete().eq("id", lineId);
  revalidatePath(`/bill-scans/${scanId}`);
}

export async function addScanLine(scanId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("bill_scan_lines")
    .select("id", { count: "exact", head: true })
    .eq("scan_id", scanId);
  await supabase.from("bill_scan_lines").insert({
    scan_id: scanId,
    description: "New item",
    quantity: 1,
    unit_price: 0,
    line_total: 0,
    sort_order: count ?? 0,
  });
  revalidatePath(`/bill-scans/${scanId}`);
}

/**
 * Confirm a scan: create (or refresh) the real bill it represents.
 * The scan stays editable afterwards — saveScan keeps the bill in step.
 */
export async function confirmScan(_prev: unknown, formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const id = String(formData.get("id") ?? "");
  const { data: scan } = await supabase.from("bill_scans").select("*").eq("id", id).single();
  if (!scan) return { error: "Scan not found." };
  if (!scan.total_amount || Number(scan.total_amount) <= 0) {
    return { error: "Set a total greater than zero before confirming." };
  }

  let billId = scan.bill_id as string | null;

  if (!billId) {
    const billNo =
      scan.bill_no?.trim() ||
      `SCAN-${new Date().toISOString().slice(0, 10)}-${String(id).slice(0, 6)}`;

    const { data: bill, error } = await supabase
      .from("bills")
      .insert({
        bill_no: billNo,
        vendor_id: scan.vendor_id,
        project_id: scan.project_id,
        category_id: scan.category_id,
        status: "awaiting_approval",
        issue_date: scan.bill_date ?? new Date().toISOString().slice(0, 10),
        subtotal: scan.amount ?? 0,
        tax_amount: scan.tax_amount ?? 0,
        total: scan.total_amount ?? 0,
        description: scan.item_description,
        attachment_path: scan.storage_path,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) return { error: `Could not create the bill: ${error.message}` };
    billId = bill.id;
  }

  await supabase
    .from("bill_scans")
    .update({ status: "confirmed", bill_id: billId, confirmed_by: user.id, confirmed_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath(`/bill-scans/${id}`);
  revalidatePath("/bills");
  return { ok: true };
}

/** Undo a confirmation so the scan can be reworked. */
export async function unconfirmScan(scanId: string) {
  const supabase = await createClient();
  await supabase
    .from("bill_scans")
    .update({ status: "needs_review", confirmed_by: null, confirmed_at: null })
    .eq("id", scanId);
  revalidatePath(`/bill-scans/${scanId}`);
}
