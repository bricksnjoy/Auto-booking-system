import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";
import { poolPosition } from "@/lib/pool";
import { monthLabel, monthStart } from "@/lib/salaries";

export const dynamic = "force-dynamic";

type Source = "project" | "salary" | "withdrawal";

interface Line {
  on: string;
  month: string;
  source: Source;
  what: string;
  projectId: string | null;
  amount: number;
}

const SOURCE_LABEL: Record<Source, string> = {
  project: "From a project",
  salary: "Salary",
  withdrawal: "Pool withdrawal",
};

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: person } = await supabase
    .from("people")
    .select("id, name, role, title, phone, email, pool_member_id, active")
    .eq("id", id)
    .maybeSingle();
  if (!person) notFound();

  const memberId = person.pool_member_id as string | null;

  const [{ data: salaries }, { data: shares }, { data: withdrawals }, pos] = await Promise.all([
    supabase
      .from("salary_payments")
      .select("id, month, amount, paid_on")
      .eq("person_id", id)
      .order("month", { ascending: false }),
    // their own profit shares, with what they chose and when the client paid
    memberId
      ? supabase
          .from("internal_account_entries")
          .select("share_name, share_kind, amount, disposition, projects(id, name, payment_received_at)")
          .eq("pool_member_id", memberId)
          .eq("entry_type", "accrual")
      : Promise.resolve({ data: [] as never[] }),
    // money taken out of the pool by hand, not as salary
    memberId
      ? supabase
          .from("capital_pool_entries")
          .select("id, amount, entry_date, note")
          .eq("member_id", memberId)
          .eq("entry_type", "withdrawal")
          .eq("origin", "manual")
      : Promise.resolve({ data: [] as never[] }),
    poolPosition(supabase),
  ]);

  const lines: Line[] = [];
  let keptFromProjects = 0;
  let owedFromProjects = 0;

  for (const s of shares ?? []) {
    const p = s.projects as unknown as { id: string; name: string; payment_received_at: string | null } | null;
    const amount = num(s.amount);
    // the pool's earnings always go back into the pool; only their own share is theirs to take
    const ownShare = s.share_kind === "person" || s.share_kind === "company";
    if (!ownShare) {
      keptFromProjects += amount;
      continue;
    }
    if (s.disposition === "retain") {
      keptFromProjects += amount;
      continue;
    }
    if (!p?.payment_received_at) {
      owedFromProjects += amount;
      continue;
    }
    const on = p.payment_received_at.slice(0, 10);
    lines.push({
      on,
      month: monthStart(on),
      source: "project",
      what: `Profit share · ${p.name}`,
      projectId: p.id,
      amount,
    });
  }

  for (const s of salaries ?? []) {
    lines.push({
      on: s.paid_on,
      month: s.month,
      source: "salary",
      what: `Salary for ${monthLabel(s.month)}`,
      projectId: null,
      amount: num(s.amount),
    });
  }

  for (const w of withdrawals ?? []) {
    lines.push({
      on: w.entry_date,
      month: monthStart(w.entry_date),
      source: "withdrawal",
      what: w.note ? `Taken from the pool · ${w.note}` : "Taken from the pool",
      projectId: null,
      amount: -num(w.amount),
    });
  }

  lines.sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : 0));

  const total = (src?: Source) =>
    lines.filter((l) => !src || l.source === src).reduce((s, l) => s + l.amount, 0);

  // month by month, newest first
  const months = new Map<string, Record<Source, number>>();
  for (const l of lines) {
    const row = months.get(l.month) ?? { project: 0, salary: 0, withdrawal: 0 };
    row[l.source] += l.amount;
    months.set(l.month, row);
  }
  const byMonth = [...months].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  const member = memberId ? pos.members.find((m) => m.id === memberId) : undefined;

  return (
    <div>
      <PageHeader
        title={person.name}
        subtitle={[person.title, person.phone, person.email].filter(Boolean).join(" · ") || "Person"}
      />

      <p className="mb-6 text-sm">
        <Link href="/people" className="text-[var(--muted)] hover:text-[var(--brand)] hover:underline">
          ← All people
        </Link>
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Taken in total" value={money(total())} />
        <Stat label="From projects" value={money(total("project"))}
          hint={owedFromProjects > 0.005 ? `${money(owedFromProjects)} more once clients pay` : undefined} />
        <Stat label="As salary" value={money(total("salary"))}
          hint={total("withdrawal") ? `+ ${money(total("withdrawal"))} withdrawn` : undefined} />
        <Stat label="In the capital pool"
          value={member ? money(member.balance) : "—"}
          hint={member
            ? `${money(member.free)} free${member.invested ? ` · ${money(member.invested)} invested` : ""}`
            : "Not in the pool"} />
      </div>

      {keptFromProjects > 0.005 && (
        <p className="mb-6 text-sm text-[var(--muted)]">
          {money(keptFromProjects)} of what they earned on projects was kept in the capital pool rather
          than taken.
        </p>
      )}

      <Card className="mb-6">
        <CardHeader title="By month" subtitle="What they took each month, and where it came from" />
        {byMonth.length === 0 ? (
          <Empty message="Nothing taken yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Month</Th><Th right>From projects</Th><Th right>Salary</Th>
                <Th right>Pool withdrawals</Th><Th right>Total</Th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map(([m, v]) => (
                <tr key={m} className="hover:bg-[var(--hover)]">
                  <Td className="font-medium">{monthLabel(m)}</Td>
                  <Td right className="text-[var(--muted)]">{v.project ? money(v.project) : "—"}</Td>
                  <Td right className="text-[var(--muted)]">{v.salary ? money(v.salary) : "—"}</Td>
                  <Td right className="text-[var(--muted)]">{v.withdrawal ? money(v.withdrawal) : "—"}</Td>
                  <Td right className="font-medium">{money(v.project + v.salary + v.withdrawal)}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--hover)] font-semibold">
                <Td>Total</Td>
                <Td right>{money(total("project"))}</Td>
                <Td right>{money(total("salary"))}</Td>
                <Td right>{money(total("withdrawal"))}</Td>
                <Td right>{money(total())}</Td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Every payment" subtitle="Newest first" />
        {lines.length === 0 ? (
          <Empty message="Nothing taken yet." />
        ) : (
          <Table>
            <thead>
              <tr><Th>Date</Th><Th>Source</Th><Th>What</Th><Th right>Amount</Th></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={`${l.on}-${i}`} className="hover:bg-[var(--hover)]">
                  <Td className="text-xs">{date(l.on)}</Td>
                  <Td>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      l.source === "project"
                        ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                        : l.source === "salary"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                    }`}>
                      {SOURCE_LABEL[l.source]}
                    </span>
                  </Td>
                  <Td>
                    {l.projectId ? (
                      <Link href={`/projects/${l.projectId}`} className="hover:text-[var(--brand)] hover:underline">
                        {l.what}
                      </Link>
                    ) : (
                      l.what
                    )}
                  </Td>
                  <Td right className="font-medium">{money(l.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
