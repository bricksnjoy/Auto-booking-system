"use client";

import { useState } from "react";
import { Card, Table, Th, Td } from "@/components/ui";
import { money, date } from "@/lib/format";
import { ShopModal, type ShopValues } from "@/components/shop-modal";
import { deleteShop } from "@/app/actions/shops";

export interface ShopRow extends ShopValues {
  id: string;
  name: string;
  bills: number;
  spend: number;
  gst: number;
  last_bill: string | null;
}

export function ShopsTable({ rows }: { rows: ShopRow[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ShopRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function remove(id: string) {
    const r = await deleteShop(id);
    setNotice(r.error ?? null);
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-end gap-3">
        {notice && <p className="text-xs text-red-700">{notice}</p>}
        <button type="button" onClick={() => setAdding(true)}
          className="inline-flex items-center justify-center rounded-lg bg-[var(--brand)] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)]">
          + Add new shop
        </button>
      </div>

      <Card>
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-[var(--muted)]">
              No shops yet. They also add themselves as you photograph bills.
            </p>
            <button type="button" onClick={() => setAdding(true)}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-[var(--brand)] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)]">
              + Add new shop
            </button>
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Shop</Th><Th>TIN</Th><Th>Contact</Th>
                <Th right>Bills</Th><Th right>Spend</Th><Th right>GST</Th>
                <Th right>Last bill</Th><Th right>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-[var(--hover)]">
                  <Td className="font-medium">
                    {s.name}
                    {s.trade && (
                      <span className="block text-xs font-normal text-[var(--muted)]">
                        {s.trade}
                      </span>
                    )}
                  </Td>
                  <Td className="font-mono text-xs">
                    {s.tin ?? (
                      // a claim cannot be filed without one, so its absence is
                      // worth seeing at a glance rather than reading as blank
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">
                        missing
                      </span>
                    )}
                  </Td>
                  <Td className="text-xs text-[var(--muted)]">
                    {s.contact_name || s.phone || s.email ? (
                      <>
                        {s.contact_name && <span className="block">{s.contact_name}</span>}
                        {s.phone && <span className="block">{s.phone}</span>}
                        {s.email && <span className="block">{s.email}</span>}
                      </>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td right>{s.bills || "—"}</Td>
                  <Td right>{s.spend ? money(s.spend) : "—"}</Td>
                  <Td right>{s.gst ? money(s.gst) : "—"}</Td>
                  <Td right className="text-xs text-[var(--muted)]">
                    {s.last_bill ? date(s.last_bill) : "—"}
                  </Td>
                  <Td right>
                    <button type="button" onClick={() => setEditing(s)}
                      className="text-xs text-[var(--muted)] hover:text-[var(--brand)] hover:underline">
                      Edit
                    </button>
                    {s.bills === 0 && (
                      <button type="button" onClick={() => remove(s.id)}
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

      <ShopModal open={adding} onClose={() => setAdding(false)} />
      <ShopModal open={editing !== null} onClose={() => setEditing(null)}
        values={editing ?? undefined} key={editing?.id ?? "none"} />
    </>
  );
}
