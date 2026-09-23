import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";
import { poolPosition } from "@/lib/pool";
import {
  addMonths,
  monthLabel,
  monthStart,
  monthsCovered,
  payableNow,
  planCovers,
} from "@/lib/salaries";
import { NewPlanButton, PayAllButton, PayButton, StopPlan, UndoPayment } from "./salary-controls";

export const dynamic = "force-dynamic";

export default async function SalariesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: m } = await searchParams;
  const month = monthStart(m && /^\d{4}-\d{2}/.test(m) ? m : new Date());

  const supabase = await createClient();
  const [pos, { data: plans }, { data: payments }, { data: people }] = await Promise.all([
    poolPosition(supabase),
    supabase
      .from("salary_plans")
      .select("id, person_id, monthly_amount, paid_from_member_id, start_month, months, active, ended_at, people(name, role)")
      .order("active", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("salary_payments")
      .select("id, plan_id, person_id, month, amount, paid_on, people(name)")
      .order("month", { ascending: false })
      .order("paid_on", { ascending: false }),
    supabase
      .from("people")
      .select("id, name, role, pool_member_id")
      .eq("active", true)
      .order("name"),
  ]);

  const memberBy = new Map(pos.members.map((mm) => [mm.id, mm]));
  const paidByPlan = new Map<string, number>();
  const paidThisMonth = new Map<string, { id: string; amount: number }>();
  for (const p of payments ?? []) {
    paidByPlan.set(p.plan_id, num(paidByPlan.get(p.plan_id)) + num(p.amount));
    if (p.month === month) paidThisMonth.set(p.plan_id, { id: p.id, amount: num(p.amount) });
  }

  // this month's run: who is covered, what can go out, and why not if nothing
  let freeCash = pos.available;
  const run = (plans ?? [])
    .filter((p) =>
      paidThisMonth.has(p.id) ||
      planCovers({ ...p, monthly_amount: num(p.monthly_amount) }, month),
    )
    .map((p) => {
      const person = p.people as unknown as { name: string; role: string } | null;
      const member = memberBy.get(p.paid_from_member_id);
      const paid = paidThisMonth.get(p.id);
      const due = paid
        ? null
        : payableNow(num(p.monthly_amount), member?.balance ?? 0, freeCash);
      if (due) freeCash -= due.amount;
      return { plan: p, person, member, paid, due };
    });

  const dueTotal = run.reduce((s, r) => s + (r.due?.amount ?? 0), 0);
  const paidTotal = run.reduce((s, r) => s + (r.paid?.amount ?? 0), 0);
  const monthly = (plans ?? []).filter((p) => p.active).reduce((s, p) => s + num(p.monthly_amount), 0);

  return (
    <div>
      <PageHeader
        title="Salaries"
        subtitle="Monthly pay, drawn from each person's share of the capital pool"
        action={
          <NewPlanButton
            people={(people ?? []).map((p) => ({ ...p, role: p.role as string }))}
            members={pos.members.map((mm) => ({ id: mm.id, name: mm.name, kind: mm.kind, balance: mm.balance }))}
            month={month}
          />
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Monthly salaries" value={money(monthly)} hint="Across active plans" />
        <Stat label={`Due in ${monthLabel(month)}`} value={money(dueTotal)} tone={dueTotal ? "warn" : "default"} />
        <Stat label={`Paid in ${monthLabel(month)}`} value={money(paidTotal)} tone="good" />
        <Stat label="Free in the pool" value={money(pos.available)} hint="Cash not tied up in projects" />
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <Link href={`/salaries?month=${addMonths(month, -1).slice(0, 7)}`}
              className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm hover:bg-[var(--hover)]"
              aria-label="Previous month">‹</Link>
            <h2 className="text-sm font-semibold">{monthLabel(month)}</h2>
            <Link href={`/salaries?month=${addMonths(month, 1).slice(0, 7)}`}
              className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm hover:bg-[var(--hover)]"
              aria-label="Next month">›</Link>
          </div>
          <PayAllButton month={month} total={dueTotal} />
        </div>
        {run.length === 0 ? (
          <Empty message="Nobody is due a salary this month." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Person</Th><Th>Paid from</Th><Th right>Share left</Th>
                <Th right>Monthly</Th><Th right>This month</Th>
              </tr>
            </thead>
            <tbody>
              {run.map(({ plan, person, member, paid, due }) => (
                <tr key={plan.id} className="hover:bg-[var(--hover)]">
                  <Td className="font-medium">{person?.name ?? "—"}</Td>
                  <Td className="text-xs text-[var(--muted)]">{member?.name ?? "—"}&apos;s share</Td>
                  <Td right>{money(member?.balance ?? 0)}</Td>
                  <Td right className="text-[var(--muted)]">{money(num(plan.monthly_amount))}</Td>
                  <Td right>
                    {paid ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-sm font-medium text-emerald-700">Paid {money(paid.amount)}</span>
                        <UndoPayment id={paid.id} />
                      </span>
                    ) : due && due.amount > 0 ? (
                      <span className="inline-flex flex-col items-end gap-1">
                        <PayButton planId={plan.id} month={month} amount={due.amount} />
                        {due.reason && <span className="text-[10px] text-amber-800">{due.reason}</span>}
                      </span>
                    ) : (
                      <span className="text-xs text-red-700">{due?.reason}</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mb-6">
        <CardHeader title="Salary plans" subtitle="Each one stops by itself when its term ends or the share runs out" />
        {!plans?.length ? (
          <Empty message="No salaries set up yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Person</Th><Th>Paid from</Th><Th right>Monthly</Th><Th>Term</Th>
                <Th right>Paid so far</Th><Th right>Months left</Th><Th right>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const person = p.people as unknown as { name: string } | null;
                const member = memberBy.get(p.paid_from_member_id);
                const left = p.active
                  ? p.months
                    ? Math.min(
                        Math.max(
                          p.months -
                            (payments ?? []).filter((x) => x.plan_id === p.id).length,
                          0,
                        ),
                        monthsCovered(member?.balance ?? 0, num(p.monthly_amount)),
                      )
                    : monthsCovered(member?.balance ?? 0, num(p.monthly_amount))
                  : 0;
                return (
                  <tr key={p.id} className={`hover:bg-[var(--hover)] ${p.active ? "" : "opacity-50"}`}>
                    <Td className="font-medium">{person?.name ?? "—"}</Td>
                    <Td className="text-xs text-[var(--muted)]">{member?.name ?? "—"}&apos;s share</Td>
                    <Td right>{money(num(p.monthly_amount))}</Td>
                    <Td className="text-xs text-[var(--muted)]">
                      from {monthLabel(p.start_month)} ·{" "}
                      {p.months ? `${p.months} months` : "until share runs out"}
                    </Td>
                    <Td right>{money(paidByPlan.get(p.id) ?? 0)}</Td>
                    <Td right>{p.active ? left : <span className="text-xs">ended {date(p.ended_at)}</span>}</Td>
                    <Td right>{p.active && <StopPlan id={p.id} />}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Payments" subtitle="Every salary paid, newest first" />
        {!payments?.length ? (
          <Empty message="Nothing paid yet." />
        ) : (
          <Table>
            <thead>
              <tr><Th>Month</Th><Th>Person</Th><Th right>Paid on</Th><Th right>Amount</Th></tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-[var(--hover)]">
                  <Td>{monthLabel(p.month)}</Td>
                  <Td className="font-medium">{(p.people as unknown as { name: string } | null)?.name ?? "—"}</Td>
                  <Td right className="text-xs text-[var(--muted)]">{date(p.paid_on)}</Td>
                  <Td right className="font-medium">{money(num(p.amount))}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
