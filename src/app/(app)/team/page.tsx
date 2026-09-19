import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { date, initials } from "@/lib/format";

export const dynamic = "force-dynamic";

const ROLE_RIGHTS: { role: string; rights: string }[] = [
  { role: "admin", rights: "Everything, including deleting records, managing users and company settings." },
  { role: "manager", rights: "Create and edit across projects, site, procurement and people. No payroll or permits." },
  { role: "finance", rights: "Create and edit finance, procurement and capital. Sees payroll and permits. No site diaries." },
  { role: "viewer", rights: "Read-only across everything they can see. Cannot create or change records." },
];

export default async function TeamPage() {
  const supabase = await createClient();
  const [{ data: profiles }, { data: audit }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("audit_log")
      .select("*, profiles:actor_id(full_name)")
      .order("created_at", { ascending: false }).limit(20),
  ]);

  const list = profiles ?? [];
  const byRole = (r: string) => list.filter((p) => p.role === r).length;

  return (
    <div>
      <PageHeader title="Users & roles" subtitle="Who can sign in, and what each role is allowed to do" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Users" value={String(list.length)} hint={`${list.filter((p) => p.is_active).length} active`} />
        <Stat label="Admins" value={String(byRole("admin"))} />
        <Stat label="Managers" value={String(byRole("manager"))} />
        <Stat label="Finance & viewers" value={String(byRole("finance") + byRole("viewer"))} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Users" />
          {list.length === 0 ? <Empty message="No users yet." /> : (
            <Table>
              <thead><tr>
                <Th>Name</Th><Th>Email</Th><Th>Job title</Th><Th>Role</Th><Th right>Active</Th>
              </tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--hover)]">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-xs font-semibold text-[var(--brand)]">
                          {initials(p.full_name || p.email)}
                        </span>
                        <span className="font-medium">{p.full_name || "—"}</span>
                      </div>
                    </Td>
                    <Td className="text-xs text-[var(--muted)]">{p.email}</Td>
                    <Td className="text-xs">{p.job_title ?? "—"}</Td>
                    <Td><Badge value={p.role} /></Td>
                    <Td right className="text-xs">{p.is_active ? "Yes" : "No"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <p className="border-t border-[var(--border)] px-5 py-2.5 text-xs text-[var(--muted)]">
            New users are invited from Supabase Auth and land as viewers. An admin raises their role from there.
          </p>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="What each role can do" />
            <ul className="divide-y divide-[var(--border)]">
              {ROLE_RIGHTS.map((r) => (
                <li key={r.role} className="px-5 py-3">
                  <Badge value={r.role} />
                  <p className="mt-1.5 text-xs text-[var(--muted)]">{r.rights}</p>
                </li>
              ))}
            </ul>
            <p className="border-t border-[var(--border)] px-5 py-2.5 text-xs text-[var(--muted)]">
              These rules are enforced by row-level security in the database, not just in the sidebar.
            </p>
          </Card>

          <Card>
            <CardHeader title="Recent activity" />
            {!audit?.length ? <Empty message="No activity logged." /> : (
              <ul className="divide-y divide-[var(--border)]">
                {audit.map((a) => {
                  const who = a.profiles as unknown as { full_name: string } | null;
                  return (
                    <li key={a.id} className="px-5 py-2.5">
                      <p className="text-sm">
                        <span className="font-medium">{who?.full_name ?? "System"}</span>{" "}
                        <span className="text-[var(--muted)]">{a.action} {a.entity}</span>
                      </p>
                      <p className="text-xs text-[var(--muted)]">{date(a.created_at)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
