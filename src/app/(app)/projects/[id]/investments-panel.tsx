"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";
import {
  addInvestment,
  addReinvestment,
  deleteInvestment,
  type InvestmentResult,
} from "@/app/actions/investments";

export interface InvestmentRow {
  id: string;
  name: string;
  source_type: "investor" | "capital_pool" | "external_loan";
  investor_id: string | null;
  amount: number;
  funded_on: string | null;
}

interface DirectoryEntry {
  id: string;
  name: string;
}

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";
const tiny = "mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]";

export function InvestmentsPanel({
  projectId,
  rows,
  directory,
  availableCapital,
}: {
  projectId: string;
  rows: InvestmentRow[];
  directory: DirectoryEntry[];
  /** company capital not yet reinvested, for the reinvestment flow */
  availableCapital: number;
}) {
  const [mode, setMode] = useState<null | "investor" | "reinvest">(null);

  // an investment counts only investor + reinvestment money, not ad-hoc loans
  const invested = rows.reduce((s, r) => s + num(r.amount), 0);

  return (
    <Card>
      <CardHeader
        title="Investments"
        subtitle={
          rows.length
            ? `${rows.length} · ${money(invested)} into this project`
            : "Who put money into this project"
        }
        action={
          <div className="flex gap-3">
            <button type="button" onClick={() => setMode("reinvest")}
              className="text-xs font-medium text-[var(--brand)] hover:underline">
              + Reinvest from pool
            </button>
            <button type="button" onClick={() => setMode("investor")}
              className="text-xs font-medium text-[var(--brand)] hover:underline">
              + Add investor
            </button>
          </div>
        }
      />

      {mode === "investor" && (
        <AddInvestor projectId={projectId} directory={directory} onDone={() => setMode(null)} />
      )}
      {mode === "reinvest" && (
        <AddReinvestment projectId={projectId} available={availableCapital} onDone={() => setMode(null)} />
      )}

      {rows.length === 0 ? (
        <Empty message="No investments yet. Add an investor or reinvest company capital." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Source</Th><Th right>Date</Th>
              <Th right>Amount</Th><Th right>Share</Th><Th right>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-[var(--hover)]">
                <Td className="font-medium">
                  {r.source_type === "investor" && r.investor_id ? (
                    <Link href={`/investors/${r.investor_id}`}
                      className="hover:text-[var(--brand)] hover:underline">
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                  {r.source_type === "capital_pool" && (
                    <span className="ml-2 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-normal text-[var(--brand)]">
                      reinvestment
                    </span>
                  )}
                </Td>
                <Td right className="text-xs text-[var(--muted)]">{date(r.funded_on)}</Td>
                <Td right className="font-medium">{money(num(r.amount))}</Td>
                <Td right className="text-[var(--muted)]">
                  {invested > 0 ? `${((num(r.amount) / invested) * 100).toFixed(1)}%` : "—"}
                </Td>
                <Td right>
                  <button type="button" onClick={() => deleteInvestment(r.id, projectId)}
                    className="text-xs text-[var(--muted)] hover:text-red-700">
                    Remove
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--hover)] font-semibold">
              <Td>Total</Td><Td>{""}</Td>
              <Td right>{money(invested)}</Td>
              <Td right>{invested > 0 ? "100%" : "—"}</Td>
              <Td>{""}</Td>
            </tr>
          </tfoot>
        </Table>
      )}

      <p className="border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--muted)]">
        Investments and reinvestments show up under Project Financing too — they are the same
        records, so the repayment split stays accurate.
      </p>
    </Card>
  );
}

function AddInvestor({
  projectId,
  directory,
  onDone,
}: {
  projectId: string;
  directory: DirectoryEntry[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(addInvestment, null as InvestmentResult | null);
  const formRef = useRef<HTMLFormElement>(null);
  const [picked, setPicked] = useState<DirectoryEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const matches = query.trim()
    ? directory.filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : directory.slice(0, 6);

  const step2 = picked || creating;

  return (
    <form ref={formRef} action={action} className="space-y-3 border-b border-[var(--border)] px-5 py-4">
      <input type="hidden" name="project_id" value={projectId} />

      {/* step 1 — choose an investor, or make one */}
      {!step2 && (
        <div>
          <label className={tiny}>Find an investor</label>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            className={input} placeholder="Search the directory by name" autoFocus />
          <div className="mt-2 flex flex-wrap gap-2">
            {matches.map((d) => (
              <button key={d.id} type="button" onClick={() => setPicked(d)}
                className="rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-1.5 text-sm transition-colors hover:bg-[var(--hover)]">
                {d.name}
              </button>
            ))}
            <button type="button" onClick={() => setCreating(true)}
              className="rounded-lg border border-dashed border-[var(--brand)] px-3 py-1.5 text-sm font-medium text-[var(--brand)] transition-colors hover:bg-[var(--brand-soft)]">
              + Add new investor
            </button>
          </div>
          {directory.length === 0 && (
            <p className="mt-2 text-xs text-[var(--muted)]">
              The directory is empty — add the first investor.
            </p>
          )}
        </div>
      )}

      {/* new investor's details, saved to the directory in the same action */}
      {creating && !picked && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={tiny}>New investor name</label>
            <input name="new_name" required className={input} placeholder="Full name" autoFocus />
          </div>
          <div>
            <label className={tiny}>Phone</label>
            <input name="new_phone" className={input} placeholder="+960 000 0000" />
          </div>
          <div>
            <label className={tiny}>Email</label>
            <input name="new_email" type="email" className={input} placeholder="name@example.mv" />
          </div>
        </div>
      )}

      {picked && (
        <input type="hidden" name="investor_id" value={picked.id} />
      )}

      {/* step 2 — amount and date */}
      {step2 && (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--muted)]">Investing:</span>
            <span className="font-medium">{picked ? picked.name : "New investor"}</span>
            <button type="button"
              onClick={() => { setPicked(null); setCreating(false); }}
              className="text-xs text-[var(--muted)] hover:underline">change</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={tiny}>Amount invested</label>
              <input name="amount" type="number" step="0.01" required className={input} autoFocus={Boolean(picked)} />
            </div>
            <div>
              <label className={tiny}>Date</label>
              <input name="funded_on" type="date"
                defaultValue={new Date().toISOString().slice(0, 10)} className={input} />
            </div>
          </div>
        </>
      )}

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      )}

      <div className="flex items-center gap-3">
        {step2 && (
          <button type="submit" disabled={pending}
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60">
            {pending ? "Saving…" : "Save investment"}
          </button>
        )}
        <button type="button" onClick={onDone}
          className="text-sm text-[var(--muted)] hover:underline">Cancel</button>
      </div>
    </form>
  );
}

function AddReinvestment({
  projectId,
  available,
  onDone,
}: {
  projectId: string;
  available: number;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(addReinvestment, null as InvestmentResult | null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3 border-b border-[var(--border)] px-5 py-4">
      <input type="hidden" name="project_id" value={projectId} />
      <p className="text-sm">
        <span className="text-[var(--muted)]">Capital pool available:</span>{" "}
        <span className={`font-medium ${available > 0 ? "text-emerald-700" : "text-[var(--muted)]"}`}>
          {money(available)}
        </span>
      </p>
      <p className="text-xs text-[var(--muted)]">
        The pool invests like any other backer. Its share of the investors&apos; profit is divided
        among its members by how much of the pool each holds today.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={tiny}>Amount reinvested</label>
          <input name="amount" type="number" step="0.01" required className={input} autoFocus />
        </div>
        <div>
          <label className={tiny}>Date</label>
          <input name="funded_on" type="date"
            defaultValue={new Date().toISOString().slice(0, 10)} className={input} />
        </div>
      </div>
      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60">
          {pending ? "Saving…" : "Reinvest from pool"}
        </button>
        <button type="button" onClick={onDone}
          className="text-sm text-[var(--muted)] hover:underline">Cancel</button>
      </div>
    </form>
  );
}
