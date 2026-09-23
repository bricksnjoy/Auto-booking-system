import type { createClient } from "@/lib/supabase/server";
import type { Material, Part, Role, Settings } from "@/lib/estimator";

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** The boards, fittings, part recipes and defaults the estimator works from. */
export async function estimatorData(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ data: m }, { data: p }, { data: s }] = await Promise.all([
    supabase.from("cabinet_materials").select("*").eq("active", true).order("sort_order").order("name"),
    supabase.from("cabinet_parts").select("*").order("sort_order").order("name"),
    supabase.from("estimator_settings").select("*").eq("id", true).maybeSingle(),
  ]);
  const materials: Material[] = (m ?? []).map((x) => ({
    id: x.id,
    kind: x.kind,
    name: x.name,
    length_ft: n(x.length_ft),
    width_ft: n(x.width_ft),
    thickness_mm: n(x.thickness_mm),
    unit: x.unit,
    price: Number(x.price),
  }));
  const parts: Part[] = (p ?? []).map((x) => ({
    id: x.id,
    cabinet: x.cabinet,
    name: x.name,
    role: x.role as Role,
    material_id: x.material_id,
    width_in: n(x.width_in),
    height_in: n(x.height_in),
    qty: Number(x.qty),
  }));
  const num = (k: string, fallback: number) => Number((s as Record<string, unknown> | null)?.[k] ?? fallback);
  const settings: Settings = {
    bottom_module_in: num("bottom_module_in", 24),
    top_module_in: num("top_module_in", 24),
    bottom_depth_in: num("bottom_depth_in", 24),
    top_depth_in: num("top_depth_in", 16),
    waste_pct: num("waste_pct", 0),
    labour_per_ft: num("labour_per_ft", 0),
    margin_pct: num("margin_pct", 0),
    bottom_height_in: num("bottom_height_in", 35.43),
    top_height_in: num("top_height_in", 35.43),
    top_gap_in: num("top_gap_in", 24),
    kerf_in: num("kerf_in", 0),
    cabinet_min_in: num("cabinet_min_in", 12),
    cabinet_max_in: num("cabinet_max_in", 36),
    single_door_max_in: num("single_door_max_in", 18),
    leg_height_in: num("leg_height_in", 4),
    door_gap_in: num("door_gap_in", 0.08),
    runner_clearance_in: num("runner_clearance_in", 0.5),
    shelf_setback_in: num("shelf_setback_in", 1),
    tile_trim_in: num("tile_trim_in", 1),
  };
  return { materials, parts, settings };
}
