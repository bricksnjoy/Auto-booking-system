import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { parseQuarter } from "@/lib/quarters";

/**
 * Download the input-tax schedule as .xlsx, laid out exactly like the MIRA
 * template: same columns in the same order, same header wording, so a filled
 * sheet can go straight into the filing without rearranging anything.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Not signed in", { status: 401 });

  const periodKey = request.nextUrl.searchParams.get("period") ?? "all";
  const quarter = periodKey === "all" ? null : parseQuarter(periodKey);

  let query = supabase
    .from("gst_input_schedule")
    .select("*")
    .order("invoice_date", { ascending: true });

  if (quarter) {
    query = query.gte("invoice_date", quarter.start).lte("invoice_date", quarter.end);
  }

  const { data, error } = await query;
  if (error) return new NextResponse(error.message, { status: 500 });
  const rows = data ?? [];

  const wb = new ExcelJS.Workbook();
  wb.creator = "Spruce & Co";
  wb.created = new Date();
  const ws = wb.addWorksheet(quarter ? quarter.key : "Input Tax Schedule");

  ws.columns = [
    { header: "#", key: "n", width: 6 },
    { header: "Supplier TIN", key: "tin", width: 18 },
    { header: "Supplier Name", key: "name", width: 32 },
    { header: "Supplier Invoice Number", key: "inv", width: 22 },
    { header: "Invoice Date", key: "date", width: 14 },
    { header: "Invoice Total (excluding GST)", key: "net", width: 26 },
    { header: "GST Charged at 6%", key: "g6", width: 18 },
    { header: "GST Charged at 8%", key: "g8", width: 18 },
    { header: "GST Charged at 12%", key: "g12", width: 18 },
    { header: "Your Taxable Activity Number", key: "tan", width: 26 },
    { header: "Revenue / Capital", key: "cls", width: 18 },
  ];

  // header row, styled like the template: bold rust-coloured text, wrapped,
  // centred, boxed
  const head = ws.getRow(1);
  head.height = 34;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFC55A11" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF9E9E9E" } },
      left: { style: "thin", color: { argb: "FF9E9E9E" } },
      bottom: { style: "thin", color: { argb: "FF9E9E9E" } },
      right: { style: "thin", color: { argb: "FF9E9E9E" } },
    };
  });

  rows.forEach((r, i) => {
    const row = ws.addRow({
      n: i + 1,
      tin: r.supplier_tin ?? "",
      name: r.supplier_name ?? "",
      inv: r.supplier_invoice_number ?? "",
      date: r.invoice_date ? new Date(r.invoice_date) : null,
      net: Number(r.invoice_total_excl_gst ?? 0),
      g6: Number(r.gst_at_6 ?? 0),
      g8: Number(r.gst_at_8 ?? 0),
      g12: Number(r.gst_at_12 ?? 0),
      tan: r.taxable_activity_no ?? "",
      cls: r.expense_class === "capital" ? "Capital" : "Revenue",
    });
    row.getCell("date").numFmt = "dd/mm/yyyy";
    ["net", "g6", "g8", "g12"].forEach((k) => {
      row.getCell(k).numFmt = "#,##0.00";
    });
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "hair", color: { argb: "FFD0D0D0" } },
        left: { style: "hair", color: { argb: "FFD0D0D0" } },
        bottom: { style: "hair", color: { argb: "FFD0D0D0" } },
        right: { style: "hair", color: { argb: "FFD0D0D0" } },
      };
    });
  });

  // totals under the numeric columns
  if (rows.length > 0) {
    const totals = ws.addRow({
      name: "Total",
      net: rows.reduce((s, r) => s + Number(r.invoice_total_excl_gst ?? 0), 0),
      g6: rows.reduce((s, r) => s + Number(r.gst_at_6 ?? 0), 0),
      g8: rows.reduce((s, r) => s + Number(r.gst_at_8 ?? 0), 0),
      g12: rows.reduce((s, r) => s + Number(r.gst_at_12 ?? 0), 0),
    });
    totals.font = { bold: true };
    ["net", "g6", "g8", "g12"].forEach((k) => {
      totals.getCell(k).numFmt = "#,##0.00";
    });
  }

  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const name = `GST-Input-Schedule-${quarter ? quarter.key : "all"}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
