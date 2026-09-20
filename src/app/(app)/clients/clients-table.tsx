"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Table, Th, Td } from "@/components/ui";
import { money } from "@/lib/format";
import { ClientModal, type ClientValues } from "@/components/client-modal";
import { deleteClient } from "@/app/actions/clients";

export interface ClientRow extends ClientValues {
  id: string;
  name: string;
  projects: number;
  value: number;
}

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);

  return (
    <>
      <div className="mb-6 flex justify-end">
        <button type="button" onClick={() => setAdding(true)}
          className="inline-flex items-center justify-center rounded-lg bg-[var(--brand)] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)]">
          + Add new client
        </button>
      </div>

      <Card>
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-[var(--muted)]">No clients yet.</p>
            <button type="button" onClick={() => setAdding(true)}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-[var(--brand)] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)]">
              + Add new client
            </button>
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Client</Th><Th>Address</Th><Th>Phone</Th><Th>Mail</Th>
                <Th right>Projects</Th><Th right>Value</Th><Th right>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--hover)]">
                  <Td className="font-medium">{c.name}</Td>
                  <Td className="max-w-xs text-xs text-[var(--muted)]">{c.address ?? "—"}</Td>
                  <Td className="text-xs text-[var(--muted)]">{c.phone ?? "—"}</Td>
                  <Td className="text-xs text-[var(--muted)]">{c.email ?? "—"}</Td>
                  <Td right>{c.projects || "—"}</Td>
                  <Td right>{c.value ? money(c.value) : "—"}</Td>
                  <Td right>
                    <button type="button" onClick={() => setEditing(c)}
                      className="text-xs text-[var(--muted)] hover:text-[var(--brand)] hover:underline">
                      Edit
                    </button>
                    {c.projects === 0 && (
                      <button type="button" onClick={() => deleteClient(c.id)}
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

      <p className="mt-3 text-xs text-[var(--muted)]">
        A client with projects against it cannot be removed — edit it instead.{" "}
        <Link href="/projects" className="hover:underline">See projects →</Link>
      </p>

      <ClientModal open={adding} onClose={() => setAdding(false)} />
      <ClientModal
        key={editing?.id ?? "none"}
        open={editing !== null}
        onClose={() => setEditing(null)}
        values={editing ?? undefined}
      />
    </>
  );
}
