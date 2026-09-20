"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractBill, extractionAvailable } from "@/lib/extract-bill";
import type { VendorCandidate, VendorConfirm } from "./project-items";

export type ExtractResult = {
  error?: string;
  /** null when auto-reading is switched off, so the caller falls back to typing */
  fields?: {
    shop: string;
    supplier_tin: string;
    bill_no: string;
    issue_date: string;
    subtotal: number;
    gst_rate: number;
    tax_amount: number;
    total: number;
    description: string;
    expense_class: "revenue" | "capital";
    confidence: number;
    notes: string;
  };
};

/** Read a photographed bill and hand the fields back for checking. */
export async function readBillPhoto(_prev: unknown, fd: FormData): Promise<ExtractResult> {
  if (!extractionAvailable()) {
    return { error: "No reader key is set on this server, so the bill was read on your device instead." };
  }

  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first." };
  if (file.size > 20 * 1024 * 1024) return { error: "That image is larger than 20MB." };

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const read = await extractBill(bytes, file.type || "image/jpeg");
    return {
      fields: {
        shop: read.shop_name ?? "",
        supplier_tin: read.supplier_tin ?? "",
        bill_no: read.invoice_number ?? "",
        issue_date: read.invoice_date ?? "",
        subtotal: read.subtotal ?? 0,
        gst_rate: read.gst_rate ?? 8,
        tax_amount: read.gst_amount ?? 0,
        total: read.total ?? 0,
        description: read.item_summary ?? "",
        expense_class: read.expense_class ?? "revenue",
        confidence: read.confidence ?? 0,
        notes: read.notes ?? "",
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read that image." };
  }
}

export type VendorCheck = {
  error?: string;
  /** resolved cleanly — use this shop */
  vendorId?: string | null;
  /** needs a human answer before the bill can be staged */
  confirm?: VendorConfirm;
};

/**
 * Settle which shop a bill belongs to before it joins the list, so a misread
 * name is caught while the photo is still on screen rather than at filing.
 */
export async function checkVendor(shop: string, tin: string | null): Promise<VendorCheck> {
  const supabase = await createClient();
  if (!shop.trim()) return { error: "Enter the shop name." };

  const { data } = await supabase.rpc("find_similar_vendors", {
    p_name: shop,
    p_tin: tin,
  });
  const candidates = (data ?? []) as VendorCandidate[];
  const exact = candidates.find((c) => c.match_kind === "exact");
  const norm = (t: string | null) => (t ? t.replace(/\s/g, "").toUpperCase() : null);

  if (exact) {
    if (tin && exact.tin && norm(exact.tin) !== norm(tin)) {
      return {
        confirm: {
          kind: "tin_mismatch",
          entered_name: shop,
          entered_tin: tin,
          candidates: [exact],
        },
      };
    }
    return { vendorId: exact.id };
  }

  if (candidates.length > 0) {
    return {
      confirm: {
        kind: candidates.some((c) => c.match_kind === "tin_match") ? "tin_match" : "similar_name",
        entered_name: shop,
        entered_tin: tin,
        candidates,
      },
    };
  }

  // nothing like it on file, so it is genuinely new — created on save
  return { vendorId: null };
}

export type SaveResult = { error?: string; saved?: number };

const n = (fd: FormData, k: string) => {
  const v = Number(String(fd.get(k) ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(v) ? v : 0;
};
const t = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/**
 * Save a batch of staged bills in one go: uploads each photo, creates any
 * shop that is new, then inserts the rows.
 */
export async function saveBills(_prev: unknown, fd: FormData): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const projectId = String(fd.get("project_id") ?? "");
  if (!projectId) return { error: "Missing project." };

  const count = Number(fd.get("count") ?? 0);
  if (!count) return { error: "Nothing to save." };

  const { count: existing } = await supabase
    .from("bills")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  let seq = existing ?? 0;
  const today = new Date().toISOString().slice(0, 10);
  const rows: Record<string, unknown>[] = [];

  for (let i = 0; i < count; i++) {
    const p = (k: string) => `${k}_${i}`;
    const shop = t(fd, p("shop"));
    if (!shop) continue;

    const total = n(fd, p("total"));
    const gst = n(fd, p("tax_amount"));
    const net = n(fd, p("subtotal")) || total - gst;
    const tin = t(fd, p("supplier_tin"));

    // shop: confirmed id from staging, or create it now
    let vendorId = t(fd, p("vendor_id"));
    if (vendorId) {
      if (tin) {
        const { data: v } = await supabase.from("vendors").select("tin").eq("id", vendorId).maybeSingle();
        if (v && !v.tin) await supabase.from("vendors").update({ tin }).eq("id", vendorId);
      }
    } else {
      const { data: created } = await supabase
        .from("vendors")
        .insert({ name: shop, kind: "supplier", is_approved: true, tin })
        .select("id")
        .single();
      vendorId = created?.id ?? null;
    }

    // photo
    let attachmentPath: string | null = null;
    const file = fd.get(p("photo"));
    if (file instanceof File && file.size > 0) {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${projectId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await supabase.storage
        .from("bills")
        .upload(path, bytes, { contentType: file.type || "image/jpeg" });
      if (upErr) return { error: `Could not save a photo: ${upErr.message}` };
      attachmentPath = path;
    }

    seq += 1;
    rows.push({
      bill_no: t(fd, p("bill_no")) ?? `B-${String(seq).padStart(3, "0")}`,
      vendor_id: vendorId,
      project_id: projectId,
      category_id: t(fd, p("category_id")),
      status: "paid",
      issue_date: t(fd, p("issue_date")) ?? today,
      subtotal: net,
      tax_amount: gst,
      total,
      description: t(fd, p("description")) ?? shop,
      gst_rate: n(fd, p("gst_rate")),
      taxable_activity_no: t(fd, p("taxable_activity_no")),
      expense_class: t(fd, p("expense_class")) ?? "revenue",
      attachment_path: attachmentPath,
      created_by: user.id,
    });
  }

  if (rows.length === 0) return { error: "Nothing to save." };

  const { error } = await supabase.from("bills").insert(rows);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/pnl");
  revalidatePath("/projects");
  revalidatePath("/gst");
  revalidatePath("/");
  return { saved: rows.length };
}
