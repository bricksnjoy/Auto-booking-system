"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLES, type EstimateInput, type EstimateResult, type FrontKind, type Group, type Role } from "@/lib/estimator";

export type EstimatorResult = { error?: string; ok?: boolean };

const refresh = () => revalidatePath("/estimator", "layout");

const num = (fd: FormData, k: string) => {
  const raw = String(fd.get(k) ?? "").trim();
  if (!raw) return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
};

async function user(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user: u },
  } = await supabase.auth.getUser();
  return u;
}

/** A board (bought by the sheet) or an accessory (bought by the piece or foot). */
export async function saveMaterial(_prev: unknown, fd: FormData): Promise<EstimatorResult> {
  const supabase = await createClient();
  if (!(await user(supabase))) return { error: "Not signed in." };
  const id = String(fd.get("id") ?? "");
  const kind = String(fd.get("kind") ?? "board") === "accessory" ? "accessory" : "board";
  const name = String(fd.get("name") ?? "").trim();
  const price = num(fd, "price");
  if (!name) return { error: "Name it." };
  if (price === null || price < 0) return { error: "Enter its price." };

  const row =
    kind === "board"
      ? {
          kind,
          name,
          price,
          length_ft: num(fd, "length_ft"),
          width_ft: num(fd, "width_ft"),
          thickness_mm: num(fd, "thickness_mm"),
          unit: null,
        }
      : { kind, name, price, unit: String(fd.get("unit") ?? "").trim() || "pc", length_ft: null, width_ft: null, thickness_mm: null };
  if (kind === "board" && (!row.length_ft || !row.width_ft)) return { error: "Enter the sheet's length and width in feet." };

  const { error } = id
    ? await supabase.from("cabinet_materials").update(row).eq("id", id)
    : await supabase.from("cabinet_materials").insert({ ...row, sort_order: 50 });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function removeMaterial(id: string): Promise<EstimatorResult> {
  const supabase = await createClient();
  const { count } = await supabase.from("cabinet_parts").select("id", { count: "exact", head: true }).eq("material_id", id);
  if (count) return { error: `${count} part${count === 1 ? " uses" : "s use"} this — change or remove ${count === 1 ? "it" : "them"} first.` };
  const { error } = await supabase.from("cabinet_materials").update({ active: false }).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

/** One part of a recipe: what it is (its role), what it is cut from, and the role's parameters. */
export async function savePart(_prev: unknown, fd: FormData): Promise<EstimatorResult> {
  const supabase = await createClient();
  if (!(await user(supabase))) return { error: "Not signed in." };
  const id = String(fd.get("id") ?? "");
  const cabinet = String(fd.get("cabinet") ?? "");
  const name = String(fd.get("name") ?? "").trim();
  const role = String(fd.get("role") ?? "") as Role;
  const materialId = String(fd.get("material_id") ?? "");
  const qty = num(fd, "qty");
  if (!["bottom", "top", "door", "drawer"].includes(cabinet)) return { error: "Unknown recipe." };
  if (!ROLES[role] || !ROLES[role].on.includes(cabinet as Group | FrontKind)) return { error: "Choose what the part is." };
  if (!name) return { error: "Name the part." };
  if (!materialId) return { error: "Choose what it is made of." };
  if (qty === null || qty <= 0) return { error: "Enter how many." };

  const { data: material } = await supabase.from("cabinet_materials").select("kind").eq("id", materialId).maybeSingle();
  const sheetRoles: Role[] = ["base", "top_board", "side", "rail", "shelf", "back", "worktop", "backsplash", "pelmet",
    "door", "drawer_front", "drawer_side", "drawer_back", "drawer_bottom", "piece"];
  if (material && sheetRoles.includes(role) !== (material.kind === "board")) {
    return { error: sheetRoles.includes(role) ? "This part is cut from a board, tile or slab." : "This part is bought by the piece or length — choose a fitting." };
  }

  const row = {
    cabinet,
    name,
    role,
    material_id: materialId,
    qty,
    width_in: num(fd, "width_in"),
    height_in: num(fd, "height_in"),
  };
  const { error } = id
    ? await supabase.from("cabinet_parts").update(row).eq("id", id)
    : await supabase.from("cabinet_parts").insert({ ...row, sort_order: 50 });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function deletePart(id: string): Promise<EstimatorResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("cabinet_parts").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function saveSettings(_prev: unknown, fd: FormData): Promise<EstimatorResult> {
  const supabase = await createClient();
  if (!(await user(supabase))) return { error: "Not signed in." };
  const keys = [
    "bottom_module_in", "top_module_in", "bottom_depth_in", "top_depth_in", "waste_pct", "labour_per_ft", "margin_pct",
    "bottom_height_in", "top_height_in", "top_gap_in", "kerf_in", "cabinet_min_in", "cabinet_max_in",
    "single_door_max_in", "leg_height_in", "door_gap_in", "runner_clearance_in", "shelf_setback_in", "tile_trim_in",
  ];
  const row: Record<string, number> = {};
  for (const k of keys) {
    const v = num(fd, k);
    if (v === null || v < 0) return { error: "Every setting needs a number of 0 or more." };
    row[k] = v;
  }
  if (!row.bottom_module_in || !row.top_module_in) return { error: "Set the cabinet width to aim for." };
  if (row.cabinet_min_in > row.cabinet_max_in) return { error: "The narrowest cabinet cannot be wider than the widest." };
  const { error } = await supabase.from("estimator_settings").update(row).eq("id", true);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

/** Keep an estimate — and, if asked, carry it straight into a new quotation. */
export async function saveEstimate(_prev: unknown, fd: FormData): Promise<EstimatorResult> {
  const supabase = await createClient();
  const u = await user(supabase);
  if (!u) return { error: "Not signed in." };
  let body: { name: string; project_id: string | null; inputs: EstimateInput; result: EstimateResult };
  try {
    body = JSON.parse(String(fd.get("payload") ?? ""));
  } catch {
    return { error: "Nothing to save." };
  }
  if (!body.name?.trim()) return { error: "Give the estimate a name — the client or the kitchen." };
  if (!body.result?.groups?.length) return { error: "Choose a shape and enter the wall lengths first." };
  // keep what the quotation and list need; the drawings are rebuilt from the inputs
  const { groups, boards, accessories, cutList, length_ft, materials_cost, accessories_cost, labour, cost, margin, price, notes, warnings } = body.result;
  const result = { groups, boards, accessories, cutList, length_ft, materials_cost, accessories_cost, labour, cost, margin, price, notes, warnings };

  const projectId = body.project_id || null;
  let clientId: string | null = null;
  if (projectId) {
    const { data: p } = await supabase.from("projects").select("client_id").eq("id", projectId).maybeSingle();
    clientId = p?.client_id ?? null;
  }

  const { data, error } = await supabase
    .from("cabinet_estimates")
    .insert({
      name: body.name.trim(),
      project_id: projectId,
      client_id: clientId,
      inputs: body.inputs,
      result,
      total: body.result.price,
      created_by: u.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  refresh();
  if (String(fd.get("then") ?? "") === "quote") redirect(`/quotations/new?estimate=${data.id}`);
  return { ok: true };
}

export async function deleteEstimate(id: string): Promise<EstimatorResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("cabinet_estimates").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}
