import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const LOCKED =
  "This project is completed and paid, so it is locked. Undo the payment first to change anything.";

/**
 * A project that is finished and paid for is closed: its profit has been
 * shared out and the pool has been credited, so a later edit to a bill or an
 * investment would quietly make those figures wrong. Every change is refused
 * on the server — hiding the buttons alone would not stop it.
 */
export async function isLocked(supabase: Supabase, projectId: string | null | undefined) {
  if (!projectId) return false;
  const { data } = await supabase
    .from("projects")
    .select("completed_at, payment_received_at")
    .eq("id", projectId)
    .maybeSingle();
  return Boolean(data?.completed_at && data?.payment_received_at);
}

/** The project a row belongs to, for actions that are handed only the row. */
export async function projectOf(
  supabase: Supabase,
  table: "bills" | "variations" | "project_financing_sources",
  id: string,
) {
  const { data } = await supabase.from(table).select("project_id").eq("id", id).maybeSingle();
  return (data?.project_id as string | undefined) ?? null;
}
