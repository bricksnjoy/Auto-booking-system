import type { DocLine, TemplateBody, TemplateHeader, TemplateTail } from "@/lib/documents";
import { round2 } from "@/lib/documents";

const n2 = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const shortDate = (d: string | null | undefined) =>
  d
    ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
        .format(new Date(`${d}T00:00:00Z`))
    : "";

export interface SheetData {
  kind: "quotation" | "invoice";
  number: string;
  /** on an invoice, the quotation it was raised from */
  quotationNumber?: string | null;
  date: string | null;
  /** valid until, on a quotation; due by, on an invoice */
  untilDate?: string | null;
  /** how long the job takes — 13 days */
  duration?: string | null;
  toName: string;
  toDetails?: string | null;
  title?: string | null;
  lines: DocLine[];
  taxRate: number;
  terms: string;
  /** e.g. "30%" — printed beside the amount column when an invoice charges part of the quote */
  portionLabel?: string | null;
}

/**
 * A quotation or invoice as the client sees it, on an A4 sheet, laid out the
 * way Spruce & Co's quotations already look. It is plain markup with no
 * state, so the same sheet serves the preview, the template editor and the
 * printed copy.
 */
export function DocumentSheet({
  header,
  body,
  tail,
  data,
  stampUrl,
  signatureUrl,
}: {
  header: TemplateHeader;
  body: TemplateBody;
  tail: TemplateTail;
  data: SheetData;
  /** signed links to the stored stamp and signature images */
  stampUrl?: string | null;
  signatureUrl?: string | null;
}) {
  const subtotal = round2(data.lines.reduce((s, l) => s + l.amount, 0));
  const tax = round2((subtotal * data.taxRate) / 100);
  const total = round2(subtotal + tax);
  const terms = (data.terms ?? "").split("\n").map((t) => t.trim()).filter(Boolean);
  const accent = header.accent || "#0b1f3a";
  const cols = body.show_unit ? 6 : 5;

  const facts: [string, string][] = [
    [data.kind === "invoice" ? "Invoice Date :" : "Quote Date :", shortDate(data.date)],
  ];
  if (data.kind === "invoice" && data.quotationNumber) facts.push(["Quote# :", data.quotationNumber]);
  if (data.untilDate) facts.push([data.kind === "invoice" ? "Due Date :" : "Valid Until :", shortDate(data.untilDate)]);
  if (body.show_duration && data.duration) facts.push(["Duration :", data.duration]);

  return (
    <div className="doc-sheet mx-auto flex min-h-[297mm] w-[210mm] max-w-full flex-col bg-white px-[14mm] pb-[12mm] pt-[12mm] font-[family-name:var(--font-poppins)] text-[10.5px] leading-snug text-[#1b2330] shadow-[0_2px_18px_rgba(13,27,42,0.12)]">
      {/* header: our mark on the left, what this is on the right */}
      <div className="flex items-start justify-between gap-6">
        <div className="w-40 text-center">
          {header.show_logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo-mark.png" alt="" className="mx-auto h-[68px] w-[68px] object-contain" />
          )}
          <p className="mt-1 font-[family-name:var(--font-fallback-serif)] text-[14px] font-bold leading-none"
            style={{ color: accent }}>
            {header.company_name}
          </p>
          {header.company_sub && <p className="mt-0.5 text-[8px] tracking-wide">{header.company_sub}</p>}
        </div>
        <div className="text-right">
          <p className="text-[34px] font-normal leading-none tracking-wide" style={{ color: accent }}>
            {header.title}
          </p>
          <p className="mt-1 text-[11px] font-semibold">
            {header.number_label} {data.number}
          </p>
        </div>
      </div>

      <div className="mt-6 pl-[3mm] text-[11.5px] leading-[1.35]">
        {header.address && <p className="whitespace-pre-line">{header.address}</p>}
        {header.tin && <p>TIN: {header.tin}</p>}
      </div>

      {/* who it is for, and the dates */}
      <div className="mt-8 flex items-end justify-between gap-6">
        <div>
          <p className="text-[12px]">{body.to_label}</p>
          <p className="mt-1 text-[9.5px] font-semibold">{data.toName}</p>
          {data.toDetails && <p className="whitespace-pre-line text-[9.5px]">{data.toDetails}</p>}
        </div>
        <table className="text-[12px]">
          <tbody>
            {facts.map(([k, v]) => (
              <tr key={k}>
                <td className="py-1 pr-10 text-right">{k}</td>
                <td className="py-1 text-right text-[11px]">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {body.intro && <p className="mt-4 whitespace-pre-line">{body.intro}</p>}

      {/* the work */}
      <table className="mt-5 w-full border-collapse text-[9px]">
        <thead>
          <tr className="text-white" style={{ background: accent }}>
            <th className="w-12 py-3 font-semibold">#</th>
            <th className="border-l border-white/30 px-2 py-3 text-left font-semibold">{body.col_description}</th>
            {body.show_unit && <th className="w-16 border-l border-white/30 py-3 font-semibold">{body.col_unit}</th>}
            <th className="w-16 border-l border-white/30 px-2 py-3 text-right font-semibold">{body.col_qty}</th>
            <th className="w-[74px] border-l border-white/30 px-2 py-3 text-right font-semibold">{body.col_rate}</th>
            <th className="w-[100px] border-l border-white/30 px-2 py-3 text-right font-semibold">
              {body.col_total}
              {data.portionLabel ? ` ${data.portionLabel}` : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.title && (
            <tr className="[&>td]:border-b [&>td]:border-[#c9ced6]">
              <td />
              <td colSpan={cols - 1} className="px-2 py-2.5 font-semibold">{data.title}</td>
            </tr>
          )}
          {data.lines.length === 0 && (
            <tr className="[&>td]:border-b [&>td]:border-[#c9ced6]">
              <td colSpan={cols} className="py-6 text-center text-[#8a93a0]">No lines yet</td>
            </tr>
          )}
          {data.lines.map((l, i) => (
            <tr key={i} className="align-top [&>td]:border-b [&>td]:border-[#c9ced6]">
              <td className="py-3 text-center">{i + 1}</td>
              <td className="px-2 py-3">
                {l.title}
                {l.title && l.description ? " _ " : ""}
                {l.description && <span className="whitespace-pre-line">{l.description}</span>}
              </td>
              {body.show_unit && <td className="py-3 text-center">{l.unit}</td>}
              <td className="px-2 py-3 text-right">{n2(l.qty)}</td>
              <td className="px-2 py-3 text-right">{n2(l.rate)}</td>
              <td className="px-2 py-3 text-right">{n2(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-3 w-[62mm] text-[11px]">
        <div className="flex justify-between px-3 py-1">
          <span>Sub Total</span>
          <span>{n2(subtotal)}</span>
        </div>
        {data.taxRate > 0 && (
          <div className="flex justify-between px-3 py-1">
            <span>{body.tax_label} ({data.taxRate}%)</span>
            <span>{n2(tax)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between px-3 py-3 text-[9.5px] font-semibold text-white"
          style={{ background: accent }}>
          <span className="w-1/2 text-right">Total</span>
          <span>MVR{n2(total)}</span>
        </div>
      </div>

      {/* the tail */}
      {(terms.length > 0 || tail.closing_note) && (
        <div className="mt-10 text-[8.5px] leading-[1.45]">
          {terms.length > 0 && (
            <>
              <p className="mb-0.5 text-[12px]">Terms &amp; Conditions</p>
              {terms.map((t, i) => (
                <p key={i}>- {t}</p>
              ))}
            </>
          )}
          {tail.closing_note && <p className="mt-3 whitespace-pre-line">{tail.closing_note}</p>}
        </div>
      )}

      {tail.bank_details && (
        <div className="mt-3 text-[8.5px]">
          <p className="font-semibold">Bank details</p>
          <p className="whitespace-pre-line">{tail.bank_details}</p>
        </div>
      )}

      <div className="mt-6 flex items-end justify-between gap-6">
        <div>
          {(stampUrl || signatureUrl) && (
            <div className="relative h-[34mm] w-[62mm]">
              {stampUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stampUrl} alt="Company stamp" className="absolute left-0 top-0 h-[34mm] w-[34mm] object-contain" />
              )}
              {signatureUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signatureUrl} alt="Signature"
                  className="absolute bottom-[3mm] left-[22mm] h-[20mm] w-[38mm] object-contain" />
              )}
            </div>
          )}
          {tail.signatory_name && <p className="text-[11.5px]">{tail.signatory_name}</p>}
          {tail.signatory_title && <p className="text-[11.5px]">{tail.signatory_title}</p>}
        </div>
        {tail.show_client_signature && (
          <div className="w-56 text-[10px]">
            <p className="border-b border-dotted border-[#8a93a0] pb-8 text-center text-[#8a93a0]">Signature</p>
            <p className="mt-1 text-center">On Behalf of the Client</p>
            <p className="mt-1 font-semibold">Name:</p>
            <p className="font-semibold">ID:</p>
          </div>
        )}
      </div>

      {tail.footer_text && (
        <div className="mt-auto pt-6">
          <p className="py-3 text-center text-[8.5px] text-white/85" style={{ background: accent }}>
            {tail.footer_text}
          </p>
        </div>
      )}
    </div>
  );
}
