"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, Table, Th, Td } from "@/components/ui";
import { money } from "@/lib/format";
import { addPerson, updatePerson, removePerson, type PersonResult } from "@/app/actions/people";

export type Role = "director" | "shareholder" | "employee" | "other";

export interface PersonRow {
  id: string;
  name: string;
  role: Role;
  title: string | null;
  phone: string | null;
  email: string | null;
  joined_on: string | null;
  notes: string | null;
  active: boolean;
  pool_member_id: string | null;
  pool_balance: number | null;
  salary: number | null;
}

export interface MemberOption {
  id: string;
  name: string;
}

const ROLE_LABEL: Record<Role, string> = {
  director: "Director",
  shareholder: "Shareholder",
  employee: "Employee",
  other: "Other",
};

const ROLE_TONE: Record<Role, string> = {
  director: "bg-[var(--brand-soft)] text-[var(--brand)]",
  shareholder: "bg-indigo-50 text-indigo-700",
  employee: "bg-emerald-50 text-emerald-700",
  other: "bg-slate-100 text-slate-600",
};

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";
const label = "mb-1.5 block text-sm font-medium";

export function PeopleTable({ rows, members }: { rows: PersonRow[]; members: MemberOption[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PersonRow | null>(null);
  const [filter, setFilter] = useState<Role | "all">("all");

  const shown = rows.filter((r) => filter === "all" || r.role === filter);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "director", "shareholder", "employee", "other"] as const).map((r) => (
          <button key={r} type="button" onClick={() => setFilter(r)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === r
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--hover)]"
            }`}>
            {r === "all" ? "Everyone" : `${ROLE_LABEL[r]}s`}
          </button>
        ))}
        <button type="button" onClick={() => setAdding(true)}
          className="ml-auto rounded-lg bg-[var(--brand)] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)]">
          + Add person
        </button>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th><Th>Role</Th><Th>Contact</Th>
              <Th right>In capital pool</Th><Th right>Monthly salary</Th><Th right>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><Td colSpan={6} className="py-10 text-center text-[var(--muted)]">Nobody here yet.</Td></tr>
            )}
            {shown.map((p) => (
              <tr key={p.id} className={`hover:bg-[var(--hover)] ${p.active ? "" : "opacity-50"}`}>
                <Td className="font-medium">
                  {p.name}
                  {p.title && <span className="block text-xs font-normal text-[var(--muted)]">{p.title}</span>}
                </Td>
                <Td>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_TONE[p.role]}`}>
                    {ROLE_LABEL[p.role]}
                  </span>
                  {!p.active && <span className="ml-2 text-xs text-[var(--muted)]">inactive</span>}
                </Td>
                <Td className="text-xs text-[var(--muted)]">
                  {p.phone && <span className="block">{p.phone}</span>}
                  {p.email && <span className="block">{p.email}</span>}
                  {!p.phone && !p.email && "—"}
                </Td>
                <Td right>
                  {p.pool_member_id ? (
                    <Link href="/capital-pool" className="hover:text-[var(--brand)] hover:underline">
                      {money(p.pool_balance ?? 0)}
                    </Link>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">not in pool</span>
                  )}
                </Td>
                <Td right>
                  {p.salary ? (
                    <Link href="/salaries" className="hover:text-[var(--brand)] hover:underline">
                      {money(p.salary)}
                    </Link>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">—</span>
                  )}
                </Td>
                <Td right>
                  <button type="button" onClick={() => setEditing(p)}
                    className="text-xs text-[var(--muted)] hover:text-[var(--brand)] hover:underline">
                    Edit
                  </button>
                  {p.active && (
                    <button type="button" onClick={() => removePerson(p.id)}
                      className="ml-2 text-xs text-[var(--muted)] hover:text-red-700">
                      Remove
                    </button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {adding && <PersonModal members={members} onClose={() => setAdding(false)} />}
      {editing && (
        <PersonModal key={editing.id} members={members} values={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function PersonModal({
  members,
  values,
  onClose,
}: {
  members: MemberOption[];
  values?: PersonRow;
  onClose: () => void;
}) {
  const editing = Boolean(values?.id);
  const [state, action, pending] = useActionState(
    editing ? updatePerson : addPerson,
    null as PersonResult | null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState<Role>(values?.role ?? "employee");

  useEffect(() => {
    if (state?.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={editing ? "Edit person" : "Add person"}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--field)] shadow-[0_24px_60px_-20px_rgba(13,27,42,0.4)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-sm font-semibold">{editing ? "Edit person" : "Add person"}</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="text-[var(--muted)] transition-colors hover:text-[var(--text)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form ref={formRef} action={action} className="space-y-4 px-5 py-5">
          {values?.id && <input type="hidden" name="id" value={values.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="p-name" className={label}>Name</label>
              <input id="p-name" name="name" required autoFocus defaultValue={values?.name ?? ""}
                className={input} />
            </div>
            <div>
              <label htmlFor="p-role" className={label}>Role</label>
              <select id="p-role" name="role" value={role}
                onChange={(e) => setRole(e.target.value as Role)} className={input}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="p-title" className={label}>Title</label>
              <input id="p-title" name="title" defaultValue={values?.title ?? ""} className={input}
                placeholder={role === "employee" ? "Site supervisor" : "Director"} />
            </div>
            <div>
              <label htmlFor="p-joined" className={label}>Joined</label>
              <input id="p-joined" name="joined_on" type="date" defaultValue={values?.joined_on ?? ""}
                className={input} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="p-phone" className={label}>Phone</label>
              <input id="p-phone" name="phone" type="tel" defaultValue={values?.phone ?? ""}
                className={input} placeholder="+960 000 0000" />
            </div>
            <div>
              <label htmlFor="p-email" className={label}>Email</label>
              <input id="p-email" name="email" type="email" defaultValue={values?.email ?? ""}
                className={input} />
            </div>
          </div>

          {role !== "employee" ? (
            <div>
              <label htmlFor="p-pool" className={label}>Capital pool</label>
              <select id="p-pool" name="pool_member" defaultValue={values?.pool_member_id ?? ""}
                className={input}>
                <option value="">Not in the pool</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>Holds a share as {m.name}</option>
                ))}
                <option value="new">+ Add them to the pool as a new member</option>
              </select>
              <p className="mt-1 text-xs text-[var(--muted)]">
                A salary draws on this share, and only up to what is in it.
              </p>
            </div>
          ) : (
            <p className="rounded-lg bg-[var(--hover)] px-3 py-2 text-xs text-[var(--muted)]">
              Employees are paid from the company&apos;s money in the pool.
            </p>
          )}

          <div>
            <label htmlFor="p-notes" className={label}>Notes</label>
            <textarea id="p-notes" name="notes" rows={2} defaultValue={values?.notes ?? ""}
              className={input} />
          </div>

          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={pending}
              className="rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60">
              {pending ? "Saving…" : editing ? "Save changes" : "Add person"}
            </button>
            <button type="button" onClick={onClose} className="text-sm text-[var(--muted)] hover:underline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
