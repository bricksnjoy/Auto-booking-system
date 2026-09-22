import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { money, num, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Pnl {
  id: string;
  code: string;
  project_name: string;
  client_name: string | null;
  status: string;
  value: number;
  variation: number;
  gst: number;
  exp: number;
  profit: number;
}

interface Split {
  project_id: string;
  share_name: string;
  share_kind: "investors" | "company" | "person";
  pct: number;
  sort_order: number;
  share_amount: number;
}

export default async function PnlPage() {
  const supabase = await createClient();
  const [{ data: pnlData }, { data: splitData }, { data: company }] = await Promise.all([
    supabase.from("project_pnl").select("*").order("code"),
    supabase.from("project_profit_split").select("*").order("sort_order"),
    supabase.from("company").select("gst_registered").eq("id", true).maybeSingle(),
  ]);

  // Until the company is registered, no GST is collected on a contract and
  // none is recoverable on a bill. Showing a column of it would be stating a
  // liability and a claim that do not exist.
  const showGst = company?.gst_registered ?? false;

  const rows = (pnlData ?? []) as Pnl[];
  const splits = (splitData ?? []) as Split[];

  // one column per share, in the order the scheme lists them
  const shareOrder = new Map<string, { kind: Split["share_kind"]; sort: number; total: number }>();
  for (const s of splits) {
    const e = shareOrder.get(s.share_name) ?? { kind: s.share_kind, sort: s.sort_order, total: 0 };
    e.total += num(s.share_amount);
    e.sort = Math.min(e.sort, s.sort_order);
    shareOrder.set(s.share_name, e);
  }
  const shares = [...shareOrder.entries()]
    .sort((a, b) => a[1].sort - b[1].sort || b[1].total - a[1].total)
    .map(([name, v]) => ({ name, kind: v.kind }));

  // project -> share name -> split
  const byProject = new Map<string, Map<string, Split>>();
  for (const s of splits) {
    if (!byProject.has(s.project_id)) byProject.set(s.project_id, new Map());
    byProject.get(s.project_id)!.set(s.share_name, s);
  }

  const t = {
    value: rows.reduce((a, r) => a + num(r.value), 0),
    variation: rows.reduce((a, r) => a + num(r.variation), 0),
    gst: rows.reduce((a, r) => a + num(r.gst), 0),
    exp: rows.reduce((a, r) => a + num(r.exp), 0),
    profit: rows.reduce((a, r) => a + num(r.profit), 0),
  };
  const shareTotalOf = (name: string) =>
    rows.reduce((a, r) => a + num(byProject.get(r.id)?.get(name)?.share_amount), 0);
  // the company's own portion is not paid out, so it is shown apart
  const retainedTotal = shares
    .filter((s) => s.kind === "company")
    .reduce((a, s) => a + shareTotalOf(s.name), 0);
  const paidOut = shares
    .filter((s) => s.kind !== "company")
    .reduce((a, s) => a + shareTotalOf(s.name), 0);

  return (
    <div>
      <PageHeader
        title="Project P&amp;L"
        subtitle={
          showGst
            ? "Value, variation, GST, expenditure and profit — with each investor's share"
            : "Value, variation, expenditure and profit — with each investor's share"
        }
      />

      <div className={`mb-6 grid gap-4 sm:grid-cols-2 ${
        showGst ? "xl:grid-cols-5" : "xl:grid-cols-4"
      }`}>
        <Stat label="Project value" value={money(t.value)} hint={`+ ${money(t.variation)} variation`} />
        {showGst && (
          <Stat label="GST" value={money(t.gst)} hint="Collected for MIRA, not deducted" />
        )}
        <Stat label="Expenditure" value={money(t.exp)} tone="bad" />
        <Stat label="Profit" value={money(t.profit)} tone={t.profit >= 0 ? "good" : "bad"} />
        <Stat
          label="Retained"
          value={money(retainedTotal)}
          hint={`${money(paidOut)} shared out`}
        />
      </div>

      <Card>
        <CardHeader
          title="Per project"
          subtitle={
            showGst
              ? "Profit = (Value + Variation) − EXP. GST is reported but not deducted."
              : "Profit = (Value + Variation) − EXP."
          }
        />
        {rows.length === 0 ? (
          <Empty message="No projects yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Project</Th>
                <Th right>Project Value</Th>
                <Th right>Variation</Th>
                {showGst && <Th right>GST</Th>}
                <Th right>EXP</Th>
                <Th right>Profit</Th>
                {shares.map((sh) => (
                  <Th key={sh.name} right>{sh.name}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const mine = byProject.get(r.id);
                const profit = num(r.profit);
                return (
                  <tr key={r.id} className="hover:bg-[var(--hover)]">
                    <Td>
                      <Link href={`/projects/${r.id}`} className="font-medium hover:underline">
                        {r.project_name}
                      </Link>
                      <span className="block text-xs text-[var(--muted)]">
                        <span className="font-mono">{r.code}</span>
                        {r.client_name ? ` · ${r.client_name}` : ""}
                      </span>
                    </Td>
                    <Td right>{money(r.value)}</Td>
                    <Td right className={num(r.variation) ? "text-[var(--accent)]" : "text-[var(--muted)]"}>
                      {num(r.variation) ? money(r.variation) : "—"}
                    </Td>
                    {showGst && (
                      <Td right className="text-[var(--muted)]">{money(r.gst)}</Td>
                    )}
                    <Td right className="text-red-700">{money(r.exp)}</Td>
                    <Td right className={`font-medium ${profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {money(profit)}
                    </Td>
                    {shares.map((sh) => {
                      const s = mine?.get(sh.name);
                      return (
                        <Td key={sh.name} right>
                          {s ? (
                            <>
                              {money(s.share_amount)}
                              <span className="block text-[10px] text-[var(--muted)]">
                                {num(s.pct).toFixed(2)}%
                              </span>
                            </>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </Td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--hover)] font-semibold">
                <Td>Total</Td>
                <Td right>{money(t.value)}</Td>
                <Td right>{money(t.variation)}</Td>
                {showGst && <Td right>{money(t.gst)}</Td>}
                <Td right>{money(t.exp)}</Td>
                <Td right className={t.profit >= 0 ? "text-emerald-700" : "text-red-700"}>
                  {money(t.profit)}
                </Td>
                {shares.map((sh) => (
                  <Td key={sh.name} right>{money(shareTotalOf(sh.name))}</Td>
                ))}
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>

      {shares.length > 0 && (
        <Card className="mt-4">
          <CardHeader
            title="Profit share totals"
            subtitle="Across every project, at the percentages currently set"
          />
          <Table>
            <thead>
              <tr><Th>Share</Th><Th right>Share of profit</Th><Th right>% of total</Th></tr>
            </thead>
            <tbody>
              {shares.map((sh) => {
                const total = shareTotalOf(sh.name);
                return (
                  <tr key={sh.name}>
                    <Td className="font-medium">
                      {sh.name}
                      {sh.kind === "company" && (
                        <span className="ml-2 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-normal text-[var(--brand)]">
                          retained
                        </span>
                      )}
                    </Td>
                    <Td right>{money(total)}</Td>
                    <Td right className="text-[var(--muted)]">
                      {t.profit > 0 ? pct((total / t.profit) * 100, 1) : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
