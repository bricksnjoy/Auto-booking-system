import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TendersPage() {
  const supabase = await createClient();
  const { data: tenders } = await supabase
    .from("tenders")
    .select("*, clients(name), profiles:owner_id(full_name)")
    .order("submission_date", { ascending: false, nullsFirst: false });

  const list = tenders ?? [];
  const live = list.filter((t) => ["identified", "preparing", "submitted", "shortlisted"].includes(t.status));
  const won = list.filter((t) => t.status === "won");
  const lost = list.filter((t) => t.status === "lost");
  const decided = won.length + lost.length;
  const winRate = decided > 0 ? (won.length / decided) * 100 : 0;
  const weighted = live.reduce((s, t) => s + num(t.bid_amount) * (num(t.win_probability) / 100), 0);

  const stages = ["identified", "preparing", "submitted", "shortlisted"] as const;

  return (
    <div>
      <PageHeader title="Tenders & bids" subtitle="What's out there, what's in, and what we won" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Live bids" value={String(live.length)} hint={money(live.reduce((s, t) => s + num(t.bid_amount), 0))} />
        <Stat label="Weighted pipeline" value={money(weighted)} hint="Bid value × win probability" />
        <Stat label="Win rate" value={pct(winRate, 0)} hint={`${won.length} won of ${decided} decided`}
          tone={winRate >= 50 ? "good" : winRate > 0 ? "warn" : "default"} />
        <Stat label="Won value" value={money(won.reduce((s, t) => s + num(t.bid_amount), 0))} tone="good" />
      </div>

      <Card className="mb-4">
        <CardHeader title="Pipeline" subtitle="Bids by stage" />
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-4">
          {stages.map((stage) => {
            const inStage = list.filter((t) => t.status === stage);
            return (
              <div key={stage} className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-xs font-medium capitalize text-[var(--muted)]">{stage}</p>
                <p className="mt-1 text-xl font-semibold">{inStage.length}</p>
                <p className="text-xs text-[var(--muted)]">{money(inStage.reduce((s, t) => s + num(t.bid_amount), 0))}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        {list.length === 0 ? <Empty message="No tenders tracked yet." /> : (
          <Table>
            <thead><tr>
              <Th>Ref</Th><Th>Title</Th><Th>Client</Th><Th>Status</Th><Th>Owner</Th>
              <Th right>Bid</Th><Th right>Win %</Th><Th right>Submitted</Th><Th right>Decision</Th>
            </tr></thead>
            <tbody>
              {list.map((t) => {
                const client = t.clients as unknown as { name: string } | null;
                const owner = t.profiles as unknown as { full_name: string } | null;
                return (
                  <tr key={t.id} className="hover:bg-[var(--bg)]">
                    <Td className="font-mono text-xs">{t.ref}</Td>
                    <Td className="font-medium">{t.title}</Td>
                    <Td>{client?.name ?? "—"}</Td>
                    <Td><Badge value={t.status} /></Td>
                    <Td className="text-xs text-[var(--muted)]">{owner?.full_name ?? "—"}</Td>
                    <Td right>{money(t.bid_amount)}</Td>
                    <Td right className="text-xs">{t.win_probability !== null ? `${t.win_probability}%` : "—"}</Td>
                    <Td right className="text-xs">{date(t.submission_date)}</Td>
                    <Td right className="text-xs">{date(t.decision_date)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
