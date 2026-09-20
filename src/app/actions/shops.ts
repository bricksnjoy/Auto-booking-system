"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ShopResult = {
  error?: string;
  ok?: boolean;
  id?: string;
  name?: string;
};

const text = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/** TINs are written with spaces and in lower case as often as not. */
const tidyTin = (t: string | null) => (t ? t.replace(/\s+/g, "").toUpperCase() : null);

const fields = (fd: FormData) => ({
  tin: tidyTin(text(fd, "tin")),
  trade: text(fd, "trade"),
  contact_name: text(fd, "contact_name"),
  phone: text(fd, "phone"),
  email: text(fd, "email"),
  address: text(fd, "address"),
  notes: text(fd, "notes"),
});

export async function addShop(_prev: unknown, fd: FormData): Promise<ShopResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const name = text(fd, "name");
  if (!name) return { error: "Enter the shop name." };

  const { data: existing } = await supabase
    .from("vendors")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existing) return { error: `${name} is already on the list.` };

  const { data, error } = await supabase
    .from("vendors")
    .insert({ name, kind: "supplier", is_approved: true, ...fields(fd) })
    .select("id, name")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/shops");
  revalidatePath("/gst");
  return { ok: true, id: data.id, name: data.name };
}

export async function updateShop(_prev: unknown, fd: FormData): Promise<ShopResult> {
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Missing shop." };

  const name = text(fd, "name");
  if (!name) return { error: "Enter the shop name." };

  const { error } = await supabase
    .from("vendors")
    .update({ name, ...fields(fd) })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/shops");
  revalidatePath("/gst");
  return { ok: true, id, name };
}

/** Only ever called for a shop with no bills against it. */
export async function deleteShop(id: string): Promise<ShopResult> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("bills")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", id);
  if (count) return { error: "That shop has bills against it, so it cannot be removed." };

  const { error } = await supabase.from("vendors").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/shops");
  return { ok: true };
}
