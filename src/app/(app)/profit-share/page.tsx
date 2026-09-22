import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import type { ProfitShare } from "@/app/actions/profit-share";
import { SharesForm } from "./shares-form";

export const dynamic = "force-dynamic";

export default async function ProfitSharePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profit_shares")
    .select("*")
    .eq("active", true)
    .order("sort_order");

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Profit share"
        subtitle="Set once here, applied to every project's profit"
      />
      <SharesForm shares={(data ?? []) as ProfitShare[]} />

      <div className="mt-6 max-w-2xl space-y-2 text-sm text-[var(--muted)]">
        <p>
          <span className="font-medium text-[var(--text)]">Investors</span> is a pool: it
          divides between whoever backed that particular project, in proportion to what each
          put in. A project with no investors keeps the share unallocated rather than
          redistributing it.
        </p>
        <p>
          Changing these percentages affects projects not yet completed. Anything already
          accrued to the internal account keeps the split it was accrued under, because it is
          money someone is already owed.
        </p>
      </div>
    </div>
  );
}
