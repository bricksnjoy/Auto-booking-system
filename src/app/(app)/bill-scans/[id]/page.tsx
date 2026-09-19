import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Badge, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";
import { ScanEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function ScanReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: scan } = await supabase
    .from("bill_scans")
    .select("*, bills(id, bill_no, status)")
    .eq("id", id)
    .maybeSingle();

  if (!scan) notFound();

  const [{ data: lines }, { data: projects }, { data: vendors }, { data: categories }, preview] =
    await Promise.all([
      supabase.from("bill_scan_lines").select("*").eq("scan_id", id).order("sort_order"),
      supabase.from("projects").select("id, code, name").order("code"),
      supabase.from("vendors").select("id, name").order("name"),
      supabase.from("cost_categories").select("id, name").order("sort_order"),
      supabase.storage.from("bills").createSignedUrl(scan.storage_path, 60 * 30),
    ]);

  const imageUrl = preview.data?.signedUrl ?? null;
  const isPdf = scan.mime_type === "application/pdf";
  const linked = scan.bills as unknown as { id: string; bill_no: string; status: string } | null;
  const confidence = scan.confidence === null ? null : num(scan.confidence);

  return (
    <div>
      <div className="mb-2">
        <Link href="/bill-scans" className="text-xs text-[var(--muted)] hover:underline">
          ← Bill scanning
        </Link>
      </div>
      <PageHeader
        title={scan.bill_no || scan.original_filename || "Bill review"}
        subtitle={
          scan.status === "confirmed"
            ? "Confirmed — still fully editable, changes flow through to the bill"
            : "Check what was read, correct anything wrong, then confirm"
        }
        action={
          <div className="flex items-center gap-2">
            {confidence !== null && (
              <span className={`text-xs ${confidence < 60 ? "text-amber-700" : "text-[var(--muted)]"}`}>
                {confidence.toFixed(0)}% confident
              </span>
            )}
            <Badge value={scan.status} />
          </div>
        }
      />

      {scan.status === "failed" && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">Couldn&apos;t read this one automatically.</p>
          <p className="mt-0.5 text-xs">{scan.extraction_error ?? "Unknown error."} You can still type the details in below, or try reading it again.</p>
        </div>
      )}

      {confidence !== null && confidence < 60 && scan.status !== "confirmed" && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Low confidence reading — please check every field against the image before confirming.
        </div>
      )}

      {scan.extracted_raw && (scan.extracted_raw as { notes?: string }).notes && (
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
          <span className="font-medium">Reader note: </span>
          <span className="text-[var(--muted)]">{(scan.extracted_raw as { notes?: string }).notes}</span>
        </div>
      )}

      {linked && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Posted as bill{" "}
          <Link href="/bills" className="font-medium underline">{linked.bill_no}</Link>{" "}
          ({linked.status.replace(/_/g, " ")}). Edits here update that bill too.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader title="Original" subtitle={scan.original_filename ?? undefined} />
          <div className="p-4">
            {!imageUrl ? (
              <Empty message="Preview unavailable." />
            ) : isPdf ? (
              <div className="space-y-3">
                <object data={imageUrl} type="application/pdf" className="h-[560px] w-full rounded-lg border border-[var(--border)]">
                  <p className="p-4 text-sm text-[var(--muted)]">PDF preview not supported here.</p>
                </object>
                <a href={imageUrl} target="_blank" rel="noreferrer"
                  className="block text-center text-xs font-medium text-[var(--brand)] hover:underline">
                  Open the PDF in a new tab →
                </a>
              </div>
            ) : (
              <a href={imageUrl} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Uploaded bill"
                  className="w-full rounded-lg border border-[var(--border)] object-contain" />
              </a>
            )}
            <dl className="mt-4 space-y-1.5 text-xs text-[var(--muted)]">
              <div className="flex justify-between"><dt>Uploaded</dt><dd>{date(scan.created_at)}</dd></div>
              {scan.confirmed_at && (
                <div className="flex justify-between"><dt>Confirmed</dt><dd>{date(scan.confirmed_at)}</dd></div>
              )}
              {scan.manually_edited && (
                <div className="flex justify-between"><dt>Hand-corrected</dt><dd>Yes</dd></div>
              )}
            </dl>
          </div>
        </Card>

        <div className="xl:col-span-3">
          <ScanEditor
            scan={{
              id: scan.id,
              status: scan.status,
              shop_name: scan.shop_name,
              item_description: scan.item_description,
              bill_no: scan.bill_no,
              bill_date: scan.bill_date,
              currency: scan.currency,
              amount: num(scan.amount),
              tax_amount: num(scan.tax_amount),
              total_amount: num(scan.total_amount),
              project_id: scan.project_id,
              vendor_id: scan.vendor_id,
              category_id: scan.category_id,
              confirmed: scan.status === "confirmed",
            }}
            lines={(lines ?? []).map((l) => ({
              id: l.id,
              description: l.description,
              quantity: num(l.quantity),
              unit_price: num(l.unit_price),
              line_total: num(l.line_total),
            }))}
            projects={projects ?? []}
            vendors={vendors ?? []}
            categories={categories ?? []}
          />
        </div>
      </div>
    </div>
  );
}
