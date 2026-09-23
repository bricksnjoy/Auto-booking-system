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
        subtitle="Boards and their prices, what goes into each 2ft module, and what a door or drawer takes"
      />

      <div className="space-y-6">
        <MaterialsCard materials={materials} />
        <div className="grid gap-6 2xl:grid-cols-2">
          <RecipeCard cabinet="bottom" title="Bottom cabinet — one module"
            subtitle={`Parts for ${settings.bottom_module_in}in (${settings.bottom_module_in / 12}ft) of bottom cabinet`}
            parts={parts.filter((p) => p.cabinet === "bottom")} materials={materials} />
          <RecipeCard cabinet="top" title="Top cabinet — one module"
            subtitle={`Parts for ${settings.top_module_in}in (${settings.top_module_in / 12}ft) of top cabinet`}
            parts={parts.filter((p) => p.cabinet === "top")} materials={materials} />
          <RecipeCard cabinet="door" title="Each door"
            subtitle="The panel takes the door size entered on the estimate"
            parts={parts.filter((p) => p.cabinet === "door")} materials={materials} />
          <RecipeCard cabinet="drawer" title="Each drawer"
            subtitle="The front takes the size entered on the estimate; the box is the extra wood a drawer needs"
            parts={parts.filter((p) => p.cabinet === "drawer")} materials={materials} />
        </div>
        <SettingsCard settings={settings} />
      </div>
    </div>
  );
}
