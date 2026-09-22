import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Entry {
  id: string;
  project_id: string | null;
  share_name: string;
  share_kind: "investors" | "company" | "person";
  pct_snapshot: number | null;
  entry_type: "accrual" | "settlement" | "adjustment";
  amount: number;
  entry_date: string;
  source: "completed" | "payment_received" | "manual";
  note: string | null;
  projects: { id: string; name: string; code: string } | null;
}

export default async function InternalAccountPage() {
  const supabase = await createClient();
  const [{ data: entryData }, { data: awaiting }] = await Promise.all([
    supabase
      .from("internal_account_entries")
      .select("*, projects(id, name, code)")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name, code, completed_at, payment_received_at")
      .not("completed_at", "is", null)
      .is("payment_received_at", null),
  ]);

  const entries = (entryData ?? []) as unknown as Entry[];

  // what is owed: accruals raised, less anything settled against them
  const outstanding = entries.reduce((s, e) => s + num(e.amount), 0);
  const accrued = entries
    .filter((e) => e.entry_type === "accrual")
    .reduce((s, e) => s + num(e.amount), 0);
  const settled = entries
    .filter((e) => e.entry_type === "settlement")
    .reduce((s, e) => s - num(e.amount), 0);

  // per share, so each person can see their own position
  const byShare = new Map<string, { kind: Entry["share_kind"]; balance: number; accrued: number }>();
  for (const e of entries) {
    const row = byShare.get(e.share_name) ?? { kind: e.share_kind, balance: 0, accrued: 0 };
    row.balance += num(e.amount);
    if (e.entry_type === "accrual") row.accrued += num(e.amount);
    byShare.set(e.share_name, row);
  }
  const shares = [...byShare].sort((a, b) => b[1].balance - a[1].balance);

  const oldest = awaiting?.reduce<string | null>(
    (o, p) => (!o || (p.completed_at && p.completed_at < o) ? p.completed_at : o),
    null,
  );
  const waitingDays = oldest
    ? Math.floor((Date.now() - new Date(oldest).getTime()) / 86_400_000)
    : 0;

  return (
    <div>
      <PageHeader
        title="Internal account"
        subtitle="Profit earned on finished work, before the client has paid"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Outstanding"
          value={money(outstanding)}
          tone={outstanding > 0 ? "warn" : "default"}
          hint="Accrued and not yet settled"
        />
        <Stat label="Accrued to date" value={money(accrued)} />
        <Stat label="Settled" value={money(settled)} tone="good" />
        <Stat
          label="Awaiting payment"
          value={String(awaiting?.length ?? 0)}
          hint={
            waitingDays
              ? `Oldest finished ${waitingDays} day${waitingDays === 1 ? "" : "s"} ago`
              : "Nothing outstanding"
          }
        />
      </div>

      <p className="mb-6 max-w-3xl text-sm text-[var(--muted)]">
        This is not cash. A share is owed from the day a project is marked completed, and the
        money usually arrives months later — what is held in the bank is a separate figure.
      </p>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Balances" subtitle="Owed to each share" />
          {shares.length === 0 ? (
            <Empty message="Nothing accrued yet. Mark a project completed and its profit share lands here." />
          ) : (
            <Table>
              <thead>
                <tr><Th>Share</Th><Th right>Accrued</Th><Th right>Outstanding</Th></tr>
              </thead>
              <tbody>
                {shares.map(([name, v]) => (
                  <tr key={name} className="hover:bg-[var(--hover)]">
                    <Td className="font-medium">
                      {name}
                      {v.kind === "company" && (
                        <span className="ml-2 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-normal text-[var(--brand)]">
                          retained
                        </span>
                      )}
                    </Td>
                    <Td right className="text-[var(--muted)]">{money(v.accrued)}</Td>
                    <Td right className={v.balance > 0 ? "font-medium text-amber-700" : ""}>
                      {money(v.balance)}
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--hover)] font-semibold">
                  <Td>Total</Td>
                  <Td right>{money(accrued)}</Td>
                  <Td right>{money(outstanding)}</Td>
                </tr>
              </tfoot>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Finished, not yet paid"
            subtitle="Work done and invoiced against nothing received"
          />
          {!awaiting?.length ? (
            <Empty message="Every completed project has been paid for." />
          ) : (
            <ul className="divide-y divide-[var(--border)] text-sm">
              {awaiting.map((p) => {
                const days = p.completed_at
                  ? Math.floor((Date.now() - new Date(p.completed_at).getTime()) / 86_400_000)
                  : 0;
                return (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <Link href={`/projects/${p.id}`}
                      className="min-w-0 flex-1 truncate font-medium hover:text-[var(--brand)] hover:underline">
                      {p.name}
                    </Link>
                    <span className="shrink-0 text-xs text-[var(--muted)]">
                      completed {date(p.completed_at)}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                      days > 90 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
                    }`}>
                      {days}d
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Ledger" subtitle="Every accrual and settlement, newest first" />
        {entries.length === 0 ? (
          <Empty message="No entries yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th><Th>Project</Th><Th>Share</Th><Th>Entry</Th>
                <Th right>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-[var(--hover)]">
                  <Td className="text-xs">{date(e.entry_date)}</Td>
                  <Td>
                    {e.projects ? (
                      <Link href={`/projects/${e.projects.id}`}
                        className="hover:text-[var(--brand)] hover:underline">
                        {e.projects.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    {e.share_name}
                    {e.pct_snapshot !== null && (
                      <span className="ml-2 text-xs text-[var(--muted)]">
                        {num(e.pct_snapshot).toFixed(2)}%
                      </span>
                    )}
                  </Td>
                  <Td className="text-xs text-[var(--muted)]">
                    {e.entry_type === "accrual"
                      ? "Accrued on completion"
                      : e.entry_type === "settlement"
                        ? "Settled on payment"
                        : "Adjustment"}
                  </Td>
                  <Td right className={num(e.amount) < 0 ? "text-emerald-700" : ""}>
                    {money(e.amount)}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--hover)] font-semibold">
                <Td>Outstanding</Td><Td>{""}</Td><Td>{""}</Td><Td>{""}</Td>
                <Td right>{money(outstanding)}</Td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>
    </div>
  );
}
