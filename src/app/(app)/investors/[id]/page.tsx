import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num, pct, titleize } from "@/lib/format";
import type { InvestorPosition } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvestorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: investor } = await supabase
    .from("investors")
    .select("*, profiles:relationship_owner_id(full_name)")
    .eq("id", id)
    .maybeSingle();

  if (!investor) notFound();

  const { data: positions } = await supabase
    .from("investor_positions")
    .select("*")
    .eq("investor_id", id);

  const pos = (positions ?? []) as InvestorPosition[];
  const commitmentIds = pos.map((p) => p.commitment_id);

  const [{ data: draws }, { data: dists }] = await Promise.all([
    commitmentIds.length
      ? supabase.from("drawdowns").select("*").in("commitment_id", commitmentIds).order("received_date", { ascending: false })
      : Promise.resolve({ data: [] }),
    commitmentIds.length
      ? supabase.from("distributions").select("*").in("commitment_id", commitmentIds).order("paid_date", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const committed = pos.reduce((s, p) => s + num(p.committed_amount), 0);
  const funded = pos.reduce((s, p) => s + num(p.funded_amount), 0);
  const profit = pos.reduce((s, p) => s + num(p.profit_paid), 0);
  const atRisk = pos.reduce((s, p) => s + num(p.capital_at_risk), 0);
  const owner = investor.profiles as unknown as { full_name: string } | null;

  const projectByCommitment = new Map(pos.map((p) => [p.commitment_id, p]));

  return (
    <div>
      <div className="mb-2">
        <Link href="/investors" className="text-xs text-[var(--muted)] hover:underline">
          ← Investors
        </Link>
      </div>
      <PageHeader
        title={investor.name}
        subtitle={`${titleize(investor.type)} · relationship owner ${owner?.full_name ?? "unassigned"}`}
        action={<Badge value={investor.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Committed" value={money(committed)} hint={`${pos.length} commitments`} />
        <Stat label="Capital funded" value={money(funded)} hint={`${money(committed - funded)} outstanding`} />
        <Stat label="Profit paid" value={money(profit)} tone="good" />
        <Stat label="Capital at risk" value={money(atRisk)} hint="Funded less principal returned" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Positions" subtitle="Commitments by project and round" />
          {pos.length === 0 ? (
            <Empty message="No commitments yet." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Project</Th>
                  <Th>Round</Th>
                  <Th>Status</Th>
                  <Th right>Committed</Th>
                  <Th right>Funded</Th>
                  <Th right>Returned</Th>
                </tr>
              </thead>
              <tbody>
                {pos.map((p) => (
                  <tr key={p.commitment_id}>
                    <Td>
                      <Link href={`/projects/${p.project_id}`} className="font-medium hover:underline">
                        {p.project_name}
                      </Link>
                      <span className="block font-mono text-xs text-[var(--muted)]">{p.project_code}</span>
                    </Td>
                    <Td>
                      <Link href={`/funding/${p.round_id}`} className="hover:underline">
                        {p.round_name}
                      </Link>
                    </Td>
                    <Td><Badge value={p.status} /></Td>
                    <Td right>{money(p.committed_amount)}</Td>
                    <Td right>{money(p.funded_amount)}</Td>
                    <Td right>{money(p.distributed_amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Contact & KYC" />
          <dl className="space-y-3 px-5 py-4 text-sm">
            {[
              ["Contact", investor.contact_name],
              ["Email", investor.email],
              ["Phone", investor.phone],
              ["Address", [investor.address, investor.city, investor.country].filter(Boolean).join(", ")],
              ["Tax number", investor.tax_number],
              ["KYC verified", investor.kyc_verified_at ? date(investor.kyc_verified_at) : null],
              ["Source", investor.source],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">{label}</dt>
                <dd className="text-right">{(value as string) || "—"}</dd>
              </div>
            ))}
          </dl>
          {investor.notes && (
            <p className="border-t border-[var(--border)] px-5 py-4 text-sm text-[var(--muted)]">
              {investor.notes}
            </p>
          )}
        </Card>

        <Card>
          <CardHeader title="Capital received" subtitle="Drawdowns from this investor" />
          {!draws?.length ? (
            <Empty message="No drawdowns recorded." />
          ) : (
            <Table>
              <thead>
                <tr><Th>Date</Th><Th>Project</Th><Th right>Amount</Th></tr>
              </thead>
              <tbody>
                {draws.map((d) => (
                  <tr key={d.id}>
                    <Td className="text-xs">{date(d.received_date)}</Td>
                    <Td className="text-xs">{projectByCommitment.get(d.commitment_id)?.project_code ?? "—"}</Td>
                    <Td right>{money(d.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Distributions" subtitle="Principal and profit paid back" />
          {!dists?.length ? (
            <Empty message="No distributions yet." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th><Th>Project</Th><Th right>Principal</Th>
                  <Th right>Profit</Th><Th right>Total</Th>
                </tr>
              </thead>
              <tbody>
                {dists.map((d) => (
                  <tr key={d.id}>
                    <Td className="text-xs">{date(d.paid_date)}</Td>
                    <Td className="text-xs">{projectByCommitment.get(d.commitment_id)?.project_code ?? "—"}</Td>
                    <Td right>{money(d.principal_amount)}</Td>
                    <Td right className="text-emerald-700">{money(d.profit_amount)}</Td>
                    <Td right className="font-medium">{money(d.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
