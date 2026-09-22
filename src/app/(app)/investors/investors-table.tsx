"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Table, Th, Td } from "@/components/ui";
import { money } from "@/lib/format";
import { InvestorModal, type InvestorValues } from "@/components/investor-modal";
import { deleteInvestor } from "@/app/actions/investors";

export interface InvestorRow extends InvestorValues {
  id: string;
  name: string;
  projects: number;
  invested: number;
}

export function InvestorsTable({ rows }: { rows: InvestorRow[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<InvestorRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function remove(id: string) {
    const r = await deleteInvestor(id);
    setNotice(r.error ?? null);
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-end gap-3">
        {notice && <p className="text-xs text-red-700">{notice}</p>}
        <button type="button" onClick={() => setAdding(true)}
          className="inline-flex items-center justify-center rounded-lg bg-[var(--brand)] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)]">
          + Add investor
        </button>
      </div>

      <Card>
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-[var(--muted)]">
              No investors yet. Add one here, or when recording an investment on a project.
            </p>
            <button type="button" onClick={() => setAdding(true)}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-[var(--brand)] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)]">
              + Add investor
            </button>
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Investor</Th><Th>Phone</Th><Th>Email</Th>
                <Th right>Projects</Th><Th right>Invested</Th><Th right>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="hover:bg-[var(--hover)]">
                  <Td className="font-medium">
                    <Link href={`/investors/${i.id}`} className="hover:text-[var(--brand)] hover:underline">
                      {i.name}
                    </Link>
                  </Td>
                  <Td className="text-xs text-[var(--muted)]">{i.phone ?? "—"}</Td>
                  <Td className="text-xs text-[var(--muted)]">{i.email ?? "—"}</Td>
                  <Td right>{i.projects || "—"}</Td>
                  <Td right className="font-medium">{i.invested ? money(i.invested) : "—"}</Td>
                  <Td right>
                    <button type="button" onClick={() => setEditing(i)}
                      className="text-xs text-[var(--muted)] hover:text-[var(--brand)] hover:underline">
                      Edit
                    </button>
                    {i.projects === 0 && (
                      <button type="button" onClick={() => remove(i.id)}
                        className="ml-2 text-xs text-[var(--muted)] hover:text-red-700">
                        Remove
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <InvestorModal open={adding} onClose={() => setAdding(false)} />
      <InvestorModal open={editing !== null} onClose={() => setEditing(null)}
        values={editing ?? undefined} key={editing?.id ?? "none"} />
    </>
  );
}
