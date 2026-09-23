import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { estimatorData } from "@/lib/estimator-data";
import { MaterialsCard, RecipeCard, SettingsCard } from "./setup-cards";

export const dynamic = "force-dynamic";

export default async function EstimatorSetupPage() {
  const supabase = await createClient();
  const { materials, parts, settings } = await estimatorData(supabase);

  return (
    <div>
      <div className="mb-2">
        <Link href="/estimator" className="text-xs text-[var(--muted)] hover:underline">← Cabinet estimator</Link>
      </div>
      <PageHeader
        title="Estimator setup"
        subtitle="Boards and prices, what each part is and what it is cut from — sizes come from the walls on each estimate"
      />

      <div className="space-y-6">
        <MaterialsCard materials={materials} />
        <div className="grid gap-6 2xl:grid-cols-2">
          <RecipeCard cabinet="bottom" title="Bottom cabinets"
            subtitle="Boards along the run are cut as long as the sheet allows; partitions and shelves per cabinet"
            parts={parts.filter((p) => p.cabinet === "bottom")} materials={materials} />
          <RecipeCard cabinet="top" title="Top cabinets"
            subtitle="The same, for the cabinets on the wall"
            parts={parts.filter((p) => p.cabinet === "top")} materials={materials} />
          <RecipeCard cabinet="door" title="Each door"
            subtitle="Sized to its cabinet: one door up to the single-door width, two above it"
            parts={parts.filter((p) => p.cabinet === "door")} materials={materials} />
          <RecipeCard cabinet="drawer" title="Each drawer"
            subtitle="Fronts share the cabinet's height; the box is sized to the clear width and the longest runner that fits"
            parts={parts.filter((p) => p.cabinet === "drawer")} materials={materials} />
        </div>
        <SettingsCard settings={settings} />
      </div>
    </div>
  );
}
