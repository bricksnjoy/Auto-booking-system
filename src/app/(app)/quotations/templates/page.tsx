import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { toTemplate, type DocKind } from "@/lib/documents";
import { createTemplate } from "@/app/actions/documents";
import { MakeDefault } from "./template-buttons";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("document_templates")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at");
  const templates = (data ?? []).map(toTemplate);

  return (
    <div>
      <div className="mb-2">
        <Link href="/quotations" className="text-xs text-[var(--muted)] hover:underline">← Quotations</Link>
      </div>
      <PageHeader
        title="Templates"
        subtitle="How quotations and invoices look — set the header, body and tail once, and every new one follows it"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {(["quotation", "invoice"] as DocKind[]).map((kind) => {
          const list = templates.filter((t) => t.kind === kind);
          return (
            <Card key={kind}>
              <CardHeader
                title={kind === "quotation" ? "Quotation templates" : "Invoice templates"}
                subtitle={kind === "quotation" ? "Used when you create a quotation" : "Used when a won quotation is invoiced"}
                action={
                  <form action={createTemplate.bind(null, kind)}>
                    <button type="submit" className="text-xs font-medium text-[var(--brand)] hover:underline">
                      + New template
                    </button>
                  </form>
                }
              />
              <ul className="divide-y divide-[var(--border)]">
                {list.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div>
                      <Link href={`/quotations/templates/${t.id}`}
                        className="text-sm font-medium hover:text-[var(--brand)] hover:underline">
                        {t.name}
                      </Link>
                      <p className="text-xs text-[var(--muted)]">
                        {t.header.title} · numbers like {t.header.number_prefix.replaceAll("{YYYY}", "2026").replaceAll("{YY}", "26")}
                        {"1".padStart(t.header.number_pad || 0, "0")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {t.is_default ? (
                        <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-medium text-[var(--brand)]">
                          Default
                        </span>
                      ) : (
                        <MakeDefault id={t.id} />
                      )}
                      <Link href={`/quotations/templates/${t.id}`}
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--hover)]">
                        Edit
                      </Link>
                    </div>
                  </li>
                ))}
                {list.length === 0 && (
                  <li className="px-5 py-8 text-center text-sm text-[var(--muted)]">No templates yet.</li>
                )}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
