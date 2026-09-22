"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type InvestmentResult = { error?: string; ok?: boolean };

const number = (fd: FormData, k: string) => {
  const n = Number(String(fd.get(k) ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const text = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

const refresh = (projectId: string) => {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/financing");
  revalidatePath("/investors");
};

/**
 * Record what an investor put into a project. It is stored as a financing
 * source — the same rows the repayment split reads — so an investment is never
 * a second copy that can drift from the financing figures.
 *
 * The investor is either picked from the directory, or created here in the same
 * step and then linked.
 */
export async function addInvestment(_prev: unknown, fd: FormData): Promise<InvestmentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const projectId = String(fd.get("project_id") ?? "");
  if (!projectId) return { error: "Missing project." };

  const amount = number(fd, "amount");
  if (amount <= 0) return { error: "Enter the amount invested." };

  let investorId = String(fd.get("investor_id") ?? "").trim() || null;
  const newName = text(fd, "new_name");

  // create-and-link in one action when the investor is not on file yet
  if (!investorId && newName) {
    const { data: existing } = await supabase
      .from("investors")
      .select("id")
      .ilike("name", newName)
      .maybeSingle();
    if (existing) {
      investorId = existing.id;
    } else {
      const { data, error } = await supabase
        .from("investors")
        .insert({
          name: newName,
          phone: text(fd, "new_phone"),
          email: text(fd, "new_email"),
          status: "active",
        })
        .select("id")
        .single();
      if (error) return { error: error.message };
      investorId = data.id;
    }
  }

  if (!investorId) return { error: "Pick an investor or add a new one." };

  const { data: investor } = await supabase
    .from("investors")
    .select("name")
    .eq("id", investorId)
    .single();

  const { count } = await supabase
    .from("project_financing_sources")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { error } = await supabase.from("project_financing_sources").insert({
    project_id: projectId,
    name: investor?.name ?? "Investor",
    source_type: "investor",
    investor_id: investorId,
    amount,
    funded_on: text(fd, "funded_on") ?? new Date().toISOString().slice(0, 10),
    sort_order: (count ?? 0) + 1,
  });
  if (error) return { error: error.message };

  refresh(projectId);
  return { ok: true };
}

/**
 * Money the company puts back into a project from its own capital. Recorded as
 * a capital-pool financing source, so it shares in repayment like any other,
 * and it draws down the company's available capital.
 */
export async function addReinvestment(_prev: unknown, fd: FormData): Promise<InvestmentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const projectId = String(fd.get("project_id") ?? "");
  if (!projectId) return { error: "Missing project." };
  const amount = number(fd, "amount");
  if (amount <= 0) return { error: "Enter the amount reinvested." };

  const { count } = await supabase
    .from("project_financing_sources")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { error } = await supabase.from("project_financing_sources").insert({
    project_id: projectId,
    name: "Reinvestment — Company Capital",
    source_type: "capital_pool",
    amount,
    funded_on: text(fd, "funded_on") ?? new Date().toISOString().slice(0, 10),
    sort_order: (count ?? 0) + 1,
  });
  if (error) return { error: error.message };

  refresh(projectId);
  return { ok: true };
}

export async function deleteInvestment(id: string, projectId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("project_financing_sources").delete().eq("id", id);
  refresh(projectId);
}
