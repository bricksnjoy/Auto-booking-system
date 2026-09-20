"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "./projects";

const text = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const number = (fd: FormData, k: string) => {
  const n = Number(String(fd.get(k) ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const int = (fd: FormData, k: string) => {
  const n = parseInt(String(fd.get(k) ?? "").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

const today = () => new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* Variations                                                          */
/* ------------------------------------------------------------------ */

export async function addVariation(_prev: unknown, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  const projectId = String(fd.get("project_id") ?? "");
  if (!projectId) return { error: "Missing project." };

  const description = text(fd, "description");
  if (!description) return { error: "Describe the variation." };

  // next reference for this project: VO-001, VO-002, ...
  const { count } = await supabase
    .from("variations")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  const ref = `VO-${String((count ?? 0) + 1).padStart(3, "0")}`;

  const { error } = await supabase.from("variations").insert({
    project_id: projectId,
    ref,
    title: description.slice(0, 120),
    description,
    // approved on entry: a variation is only recorded once the client agrees it,
    // and only approved variations count toward the project value
    status: "approved",
    cost_impact: number(fd, "cost_impact"),
    time_impact_days: int(fd, "time_impact_days"),
    raised_date: text(fd, "raised_date") ?? today(),
    approved_date: text(fd, "raised_date") ?? today(),
  });

  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/pnl");
  revalidatePath("/projects");
  revalidatePath("/");
  return { ok: true };
}

/** Used directly as a form action, so it takes FormData alone. */
export async function updateVariation(fd: FormData): Promise<void> {
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  const projectId = String(fd.get("project_id") ?? "");
  if (!id) return;

  const description = text(fd, "description");
  const { error } = await supabase
    .from("variations")
    .update({
      description,
      title: (description ?? "Variation").slice(0, 120),
      cost_impact: number(fd, "cost_impact"),
      time_impact_days: int(fd, "time_impact_days"),
      raised_date: text(fd, "raised_date"),
    })
    .eq("id", id);

  if (error) return;
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/pnl");
  revalidatePath("/projects");
}

export async function deleteVariation(id: string, projectId: string) {
  const supabase = await createClient();
  await supabase.from("variations").delete().eq("id", id);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/pnl");
  revalidatePath("/projects");
}

/* ------------------------------------------------------------------ */
/* Bills                                                               */
/* ------------------------------------------------------------------ */

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Record a bill against a project. A photo is optional but usual — it is
 * stored in the private "bills" bucket and the path kept on the row, so the
 * original is always available behind the figure.
 */
export async function addBill(_prev: unknown, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const projectId = String(fd.get("project_id") ?? "");
  if (!projectId) return { error: "Missing project." };

  const shop = text(fd, "shop");
  if (!shop) return { error: "Enter the shop or supplier name." };

  const total = number(fd, "total");
  if (total <= 0) return { error: "Enter the bill total." };

  const gst = number(fd, "tax_amount");
  const net = number(fd, "subtotal") || total - gst;

  // photo -> private storage
  let attachmentPath: string | null = null;
  const file = fd.get("photo");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return { error: "That image is larger than 20MB." };
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const path = `${projectId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from("bills")
      .upload(path, bytes, { contentType: file.type || "image/jpeg" });
    if (upErr) return { error: `Could not save the photo: ${upErr.message}` };
    attachmentPath = path;
  }

  // match the shop to a vendor, creating one the first time it appears
  let vendorId: string | null = null;
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .ilike("name", shop)
    .maybeSingle();
  if (vendor) {
    vendorId = vendor.id;
  } else {
    const { data: created } = await supabase
      .from("vendors")
      .insert({ name: shop, kind: "supplier", is_approved: true })
      .select("id")
      .single();
    vendorId = created?.id ?? null;
  }

  const { count } = await supabase
    .from("bills")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { error } = await supabase.from("bills").insert({
    bill_no: text(fd, "bill_no") ?? `B-${String((count ?? 0) + 1).padStart(3, "0")}`,
    vendor_id: vendorId,
    project_id: projectId,
    category_id: text(fd, "category_id"),
    status: "paid",
    issue_date: text(fd, "issue_date") ?? today(),
    subtotal: net,
    tax_amount: gst,
    total,
    description: text(fd, "description") ?? shop,
    attachment_path: attachmentPath,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/pnl");
  revalidatePath("/projects");
  revalidatePath("/");
  return { ok: true };
}

/** Used directly as a form action, so it takes FormData alone. */
export async function updateBill(fd: FormData): Promise<void> {
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  const projectId = String(fd.get("project_id") ?? "");
  if (!id) return;

  const total = number(fd, "total");
  const gst = number(fd, "tax_amount");

  const { error } = await supabase
    .from("bills")
    .update({
      description: text(fd, "description"),
      issue_date: text(fd, "issue_date"),
      subtotal: number(fd, "subtotal") || total - gst,
      tax_amount: gst,
      total,
    })
    .eq("id", id);

  if (error) return;
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/pnl");
  revalidatePath("/projects");
}

export async function deleteBill(id: string, projectId: string) {
  const supabase = await createClient();
  const { data: bill } = await supabase
    .from("bills")
    .select("attachment_path")
    .eq("id", id)
    .maybeSingle();

  await supabase.from("bills").delete().eq("id", id);
  if (bill?.attachment_path) {
    await supabase.storage.from("bills").remove([bill.attachment_path]);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/pnl");
  revalidatePath("/projects");
}
