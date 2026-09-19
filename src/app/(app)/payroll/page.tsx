import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const supabase = await createClient();
  const [{ data: runs }, { data: payslips }] = await Promise.all([
    supabase.from("payroll_runs").select("*").order("period_end", { ascending: false }),
    supabase.from("payslips")
      .select("*, employees(employee_no, full_name), payroll_runs(ref, period_end, status), projects(code)")
      .order("created_at", { ascending: false }).limit(100),
  ]);

  const runList = runs ?? [];
  const slips = payslips ?? [];
  const paid = runList.filter((r) => r.status === "paid");
  const pending = runList.filter((r) => ["draft", "approved"].includes(r.status));
  const latest = runList[0];

  return (
    <div>
      <PageHeader title="Payroll" subtitle="Pay runs, payslips and labour cost by project" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pay runs" value={String(runList.length)} hint={`${paid.length} paid`} />
        <Stat label="Latest run" value={latest ? money(latest.net_total) : "—"}
          hint={latest ? `${latest.ref} · ${date(latest.period_end)}` : undefined} />
        <Stat label="Awaiting payment" value={money(pending.reduce((s, r) => s + num(r.net_total), 0))}
          hint={`${pending.length} runs`} tone={pending.length ? "warn" : "good"} />
        <Stat label="Paid year to date" value={money(paid.reduce((s, r) => s + num(r.net_total), 0))} />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Pay runs" />
          {runList.length === 0 ? <Empty message="No pay runs yet." /> : (
            <Table>
              <thead><tr>
                <Th>Ref</Th><Th>Period</Th><Th>Status</Th>
                <Th right>Gross</Th><Th right>Deductions</Th><Th right>Net</Th><Th right>Paid</Th>
              </tr></thead>
              <tbody>
                {runList.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--hover)]">
                    <Td className="font-mono text-xs font-medium">{r.ref}</Td>
                    <Td className="text-xs">{date(r.period_start)} → {date(r.period_end)}</Td>
                    <Td><Badge value={r.status} /></Td>
                    <Td right>{money(r.gross_total)}</Td>
                    <Td right className="text-[var(--muted)]">{money(r.deductions_total)}</Td>
                    <Td right className="font-medium">{money(r.net_total)}</Td>
                    <Td right className="text-xs">{date(r.paid_date)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Payslips" subtitle="Most recent 100" />
          {slips.length === 0 ? <Empty message="No payslips." /> : (
            <Table>
              <thead><tr>
                <Th>Employee</Th><Th>Run</Th><Th>Project</Th>
                <Th right>Days</Th><Th right>OT hrs</Th><Th right>Gross</Th>
                <Th right>Deductions</Th><Th right>Net</Th>
              </tr></thead>
              <tbody>
                {slips.map((s) => {
                  const emp = s.employees as unknown as { employee_no: string; full_name: string } | null;
                  const run = s.payroll_runs as unknown as { ref: string } | null;
                  const proj = s.projects as unknown as { code: string } | null;
                  return (
                    <tr key={s.id} className="hover:bg-[var(--hover)]">
                      <Td>
                        <span className="text-sm">{emp?.full_name ?? "—"}</span>
                        <span className="block font-mono text-xs text-[var(--muted)]">{emp?.employee_no}</span>
                      </Td>
                      <Td className="font-mono text-xs">{run?.ref ?? "—"}</Td>
                      <Td className="font-mono text-xs text-[var(--muted)]">{proj?.code ?? "—"}</Td>
                      <Td right>{num(s.days_worked).toFixed(0)}</Td>
                      <Td right className={num(s.overtime_hours) ? "text-amber-700" : "text-[var(--muted)]"}>
                        {num(s.overtime_hours) ? num(s.overtime_hours).toFixed(1) : "—"}
                      </Td>
                      <Td right>{money(s.gross_pay)}</Td>
                      <Td right className="text-[var(--muted)]">
                        {money(num(s.tax_deduction) + num(s.other_deductions))}
                      </Td>
                      <Td right className="font-medium">{money(s.net_pay)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
