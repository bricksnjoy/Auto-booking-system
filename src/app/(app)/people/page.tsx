import { createClient } from "@/lib/supabase/server";
import { PageHeader, Stat } from "@/components/ui";
import { money, num } from "@/lib/format";
import { poolPosition } from "@/lib/pool";
import { PeopleTable, type PersonRow, type Role } from "./people-table";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const supabase = await createClient();
  const [{ data: people }, { data: plans }, pos] = await Promise.all([
    supabase
      .from("people")
      .select("id, name, role, title, phone, email, joined_on, notes, active, pool_member_id")
      .order("active", { ascending: false })
      .order("name"),
    supabase.from("salary_plans").select("person_id, monthly_amount").eq("active", true),
    poolPosition(supabase),
  ]);

  const salaryBy = new Map<string, number>();
  for (const p of plans ?? []) {
    salaryBy.set(p.person_id, num(salaryBy.get(p.person_id)) + num(p.monthly_amount));
  }
  const balanceBy = new Map(pos.members.map((m) => [m.id, m.balance]));

  const rows: PersonRow[] = (people ?? []).map((p) => ({
    ...p,
    role: p.role as Role,
    pool_balance: p.pool_member_id ? balanceBy.get(p.pool_member_id) ?? 0 : null,
    salary: salaryBy.get(p.id) ?? null,
  }));

  const active = rows.filter((r) => r.active);
  const count = (r: Role) => active.filter((p) => p.role === r).length;
  const payroll = active.reduce((s, p) => s + num(p.salary), 0);

  return (
    <div>
      <PageHeader title="People" subtitle="Directors, shareholders and staff" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Directors" value={String(count("director"))} />
        <Stat label="Shareholders" value={String(count("shareholder"))} />
        <Stat label="Employees" value={String(count("employee"))} />
        <Stat label="Monthly salaries" value={money(payroll)} hint="Across active plans" />
      </div>
      <PeopleTable rows={rows} members={pos.members.map((m) => ({ id: m.id, name: m.name }))} />
    </div>
  );
}
