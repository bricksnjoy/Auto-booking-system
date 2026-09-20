"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ClientResult = {
  error?: string;
  ok?: boolean;
  /** id of the client just created, so a caller can select it */
  id?: string;
  name?: string;
};

const text = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

export async function addClient(_prev: unknown, fd: FormData): Promise<ClientResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const name = text(fd, "name");
  if (!name) return { error: "Enter the client name." };

  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existing) return { error: `${name} is already on the list.` };

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name,
      type: "company",
      address: text(fd, "address"),
      phone: text(fd, "phone"),
      email: text(fd, "email"),
      is_active: true,
      created_by: user.id,
    })
    .select("id, name")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/clients");
  revalidatePath("/projects");
  return { ok: true, id: data.id, name: data.name };
}

export async function updateClient(_prev: unknown, fd: FormData): Promise<ClientResult> {
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Missing client." };

  const name = text(fd, "name");
  if (!name) return { error: "Enter the client name." };

  const { error } = await supabase
    .from("clients")
    .update({
      name,
      address: text(fd, "address"),
      phone: text(fd, "phone"),
      email: text(fd, "email"),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/clients");
  revalidatePath("/projects");
  return { ok: true, id };
}

export async function deleteClient(id: string) {
  const supabase = await createClient();
  // projects.client_id is ON DELETE SET NULL, so a project outlives its client
  await supabase.from("clients").delete().eq("id", id);
  revalidatePath("/clients");
  revalidatePath("/projects");
}
