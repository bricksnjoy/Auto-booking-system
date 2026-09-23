import type { createClient } from "@/lib/supabase/server";
import type { Material, Part, Settings } from "@/lib/estimator";

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** The boards, accessories, module recipes and defaults the estimator works from. */
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
    material_id: x.material_id,
    width_in: n(x.width_in),
    height_in: n(x.height_in),
    qty: Number(x.qty),
    per_shelf: x.per_shelf,
    front_panel: x.front_panel,
  }));
  const settings: Settings = {
    bottom_module_in: Number(s?.bottom_module_in ?? 24),
    top_module_in: Number(s?.top_module_in ?? 24),
    bottom_depth_in: Number(s?.bottom_depth_in ?? 24),
    top_depth_in: Number(s?.top_depth_in ?? 16),
    waste_pct: Number(s?.waste_pct ?? 10),
    labour_per_ft: Number(s?.labour_per_ft ?? 0),
    margin_pct: Number(s?.margin_pct ?? 0),
    bottom_height_in: Number(s?.bottom_height_in ?? 34),
    top_height_in: Number(s?.top_height_in ?? 30),
    top_gap_in: Number(s?.top_gap_in ?? 20),
    kerf_in: Number(s?.kerf_in ?? 0),
  };
  return { materials, parts, settings };
}
