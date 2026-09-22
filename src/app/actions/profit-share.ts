"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ShareKind = "investors" | "company" | "person";

export interface ProfitShare {
  id: string;
  name: string;
  kind: ShareKind;
  pct: number;
  sort_order: number;
  active: boolean;
  note: string | null;
}

export type ShareResult = { error?: string; ok?: boolean };

/**
 * Save the whole scheme at once. Percentages only mean anything as a set —
 * editing them one at a time would leave the total wrong in between, and a
 * profit split that does not add to 100 is a silent error nobody notices
 * until someone is paid short.
 */
export async function saveProfitShares(_prev: unknown, fd: FormData): Promise<ShareResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const count = Number(fd.get("count") ?? 0);
  const rows: { id: string; name: string; kind: ShareKind; pct: number; sort_order: number }[] = [];

  for (let i = 0; i < count; i++) {
    const name = String(fd.get(`name_${i}`) ?? "").trim();
    if (!name) continue;
    const pct = Number(String(fd.get(`pct_${i}`) ?? "0").replace(/[^0-9.]/g, ""));
    rows.push({
      id: String(fd.get(`id_${i}`) ?? ""),
      name,
      kind: (String(fd.get(`kind_${i}`) ?? "person") as ShareKind) ?? "person",
      pct: Number.isFinite(pct) ? pct : 0,
      sort_order: i + 1,
    });
  }

  if (rows.length === 0) return { error: "Keep at least one share." };

  const total = rows.reduce((s, r) => s + r.pct, 0);
  if (Math.abs(total - 100) > 0.001) {
    return { error: `The shares add up to ${total.toFixed(2)}%. They have to make 100%.` };
  }

  // rows the person removed from the form
  const keep = rows.map((r) => r.id).filter(Boolean);
  const { data: existing } = await supabase.from("profit_shares").select("id");
  const remove = (existing ?? []).map((r) => r.id).filter((id) => !keep.includes(id));
  if (remove.length) await supabase.from("profit_shares").delete().in("id", remove);

  for (const r of rows) {
    const values = {
      name: r.name,
      kind: r.kind,
      pct: r.pct,
      sort_order: r.sort_order,
      active: true,
      updated_at: new Date().toISOString(),
    };
    const { error } = r.id
      ? await supabase.from("profit_shares").update(values).eq("id", r.id)
      : await supabase.from("profit_shares").insert(values);
    if (error) return { error: error.message };
  }

  revalidatePath("/profit-share");
  revalidatePath("/pnl");
  revalidatePath("/internal");
  revalidatePath("/projects", "layout");
  return { ok: true };
}
