import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Table, Th, Td, Empty } from "@/components/ui";
import { pct } from "@/lib/format";
import { extractionAvailable } from "@/lib/extract-bill";
import { SettingsForm } from "./form";

export const dynamic = "force-dynamic";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: categories }, { data: me }] = await Promise.all([
    supabase.from("company_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("cost_categories").select("*").order("sort_order"),
    supabase.auth.getUser().then(async ({ data }) =>
      data.user
        ? supabase.from("profiles").select("role").eq("id", data.user.id).single()
        : { data: null },
    ),
  ]);

  const isAdmin = (me as { data?: { role?: string } } | null)?.data?.role === "admin";

  return (
    <div>
      <PageHeader title="Settings" subtitle="Company details, tax defaults and document numbering" />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Company details"
            subtitle={isAdmin ? "Used on invoices, quotations and purchase orders" : "Only an admin can change these"}
          />
          <div className="px-5 py-4">
            <SettingsForm settings={settings ?? null} canEdit={isAdmin} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Defaults in use" />
            <dl className="space-y-3 px-5 py-4 text-sm">
              {[
                ["Currency", settings?.currency ?? "GBP"],
                ["Tax rate", pct(settings?.tax_rate ?? 20, 1)],
                ["Retention", pct(settings?.default_retention_pct ?? 5, 1)],
                ["Payment terms", `${settings?.default_payment_terms_days ?? 30} days`],
                ["Fiscal year starts", MONTHS[(settings?.fiscal_year_start ?? 4) - 1]],
                ["Invoice prefix", settings?.invoice_prefix ?? "INV"],
                ["PO prefix", settings?.po_prefix ?? "PO"],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">{k}</dt>
                  <dd className="font-medium">{v as string}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Bill auto-reading" />
            <div className="px-5 py-4 text-sm">
              <p className={extractionAvailable() ? "text-emerald-700" : "text-amber-700"}>
                {extractionAvailable() ? "Enabled" : "Not configured"}
              </p>
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                {extractionAvailable()
                  ? "Uploaded bills are read automatically, then held for your confirmation."
                  : "Set ANTHROPIC_API_KEY in the deployment environment to switch on automatic reading of uploaded bills. Manual entry works either way."}
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Cost categories" subtitle="Used to code bills, budgets and expenses" />
            {!categories?.length ? <Empty message="No categories." /> : (
              <Table>
                <thead><tr><Th>Category</Th></tr></thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id}><Td className="text-sm">{c.name}</Td></tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
