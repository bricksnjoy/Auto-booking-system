"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PersonResult = { error?: string; ok?: boolean; id?: string };

const text = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

const ROLES = ["director", "shareholder", "employee", "other"] as const;

/**
 * Which pool member this person is, if any. "new" puts them into the pool as a
 * member of their own — how a new shareholder comes to hold part of it.
 */
async function resolvePoolMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fd: FormData,
  name: string,
): Promise<{ id: string | null; error?: string }> {
  const choice = String(fd.get("pool_member") ?? "");
  if (!choice) return { id: null };
  if (choice !== "new") return { id: choice };

  const { data: existing } = await supabase
    .from("capital_pool_members")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existing) return { id: existing.id };

  const { count } = await supabase
    .from("capital_pool_members")
    .select("id", { count: "exact", head: true });
  const { data, error } = await supabase
    .from("capital_pool_members")
    .insert({ name, kind: "person", sort_order: (count ?? 0) + 1 })
    .select("id")
    .single();
  if (error) return { id: null, error: error.message };
  return { id: data.id };
}

function fields(fd: FormData) {
  const role = String(fd.get("role") ?? "employee");
  return {
    role: (ROLES as readonly string[]).includes(role) ? role : "employee",
    title: text(fd, "title"),
    phone: text(fd, "phone"),
    email: text(fd, "email"),
    joined_on: text(fd, "joined_on"),
    notes: text(fd, "notes"),
  };
}

const refresh = () => {
  revalidatePath("/people");
  revalidatePath("/salaries");
  revalidatePath("/capital-pool");
};

export async function addPerson(_prev: unknown, fd: FormData): Promise<PersonResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const name = text(fd, "name");
  if (!name) return { error: "Enter the person's name." };

  const member = await resolvePoolMember(supabase, fd, name);
  if (member.error) return { error: member.error };

  const { data, error } = await supabase
    .from("people")
    .insert({ name, ...fields(fd), pool_member_id: member.id })
    .select("id")
    .single();
  if (error) return { error: error.message };

  refresh();
  return { ok: true, id: data.id };
}

export async function updatePerson(_prev: unknown, fd: FormData): Promise<PersonResult> {
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Missing person." };
  const name = text(fd, "name");
  if (!name) return { error: "Enter the person's name." };

  const member = await resolvePoolMember(supabase, fd, name);
  if (member.error) return { error: member.error };

  const { error } = await supabase
    .from("people")
    .update({ name, ...fields(fd), pool_member_id: member.id, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  refresh();
  return { ok: true, id };
}

/** Someone who has been paid is kept on record; they are marked inactive instead. */
export async function removePerson(id: string): Promise<PersonResult> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("salary_payments")
    .select("id", { count: "exact", head: true })
    .eq("person_id", id);

  const { error } = count
    ? await supabase.from("people").update({ active: false }).eq("id", id)
    : await supabase.from("people").delete().eq("id", id);
  if (error) return { error: error.message };

  refresh();
  return { ok: true };
}
