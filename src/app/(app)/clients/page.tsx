import { createClient } from "@/lib/supabase/server";
import { PageHeader, Stat } from "@/components/ui";
import { money, num } from "@/lib/format";
import { ClientsTable, type ClientRow } from "./clients-table";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = await createClient();
  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("id, name, address, phone, email").order("name"),
    supabase.from("projects").select("client_id, contract_value"),
  ]);

  const byClient = new Map<string, { projects: number; value: number }>();
  for (const p of projects ?? []) {
    if (!p.client_id) continue;
    const row = byClient.get(p.client_id) ?? { projects: 0, value: 0 };
    row.projects += 1;
    row.value += num(p.contract_value);
    byClient.set(p.client_id, row);
  }

  const rows: ClientRow[] = (clients ?? []).map((c) => ({
    ...c,
    projects: byClient.get(c.id)?.projects ?? 0,
    value: byClient.get(c.id)?.value ?? 0,
  }));

  const withWork = rows.filter((r) => r.projects > 0).length;

  return (
    <div>
      <PageHeader title="Clients" subtitle="Who Spruce & Co builds for" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Clients" value={String(rows.length)} hint={`${withWork} with projects`} />
        <Stat
          label="Total project value"
          value={money(rows.reduce((s, r) => s + r.value, 0))}
        />
        <Stat
          label="Projects"
          value={String(rows.reduce((s, r) => s + r.projects, 0))}
        />
      </div>

      <ClientsTable rows={rows} />
    </div>
  );
}
