"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type InvestorResult = { error?: string; ok?: boolean; id?: string; name?: string };

const text = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/** Add to the global directory, so the same investor links across projects. */
export async function addInvestor(_prev: unknown, fd: FormData): Promise<InvestorResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const name = text(fd, "name");
  if (!name) return { error: "Enter the investor's name." };

  const { data: existing } = await supabase
    .from("investors")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existing) return { error: `${name} is already in the directory.` };

  const { data, error } = await supabase
    .from("investors")
    .insert({ name, phone: text(fd, "phone"), email: text(fd, "email"), status: "active" })
    .select("id, name")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/investors");
  return { ok: true, id: data.id, name: data.name };
}

export async function updateInvestor(_prev: unknown, fd: FormData): Promise<InvestorResult> {
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Missing investor." };
  const name = text(fd, "name");
  if (!name) return { error: "Enter the investor's name." };

  const { error } = await supabase
    .from("investors")
    .update({ name, phone: text(fd, "phone"), email: text(fd, "email") })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/investors");
  revalidatePath("/investors/" + id);
  return { ok: true, id, name };
}

export async function deleteInvestor(id: string): Promise<InvestorResult> {
  const supabase = await createClient();

  // an investor who has put money into a project is not deleted from under it
  const { count } = await supabase
    .from("project_financing_sources")
    .select("id", { count: "exact", head: true })
    .eq("investor_id", id);
  if (count) return { error: "This investor has investments recorded, so cannot be removed." };

  const { error } = await supabase.from("investors").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/investors");
  return { ok: true };
}
