import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

/**
 * What we try to read off a photographed bill. Every field is a best effort —
 * the entry form lets a human correct any of it before the bill is saved, and
 * after.
 */
const BillSchema = z.object({
  shop_name: z.string().describe("Trading name of the shop or supplier printed on the bill"),
  supplier_tin: z
    .string()
    .describe(
      "Supplier's Taxpayer Identification Number, often printed as TIN or GST number, e.g. 1000000GST501. Empty string if not shown.",
    ),
  invoice_number: z.string().describe("Invoice, bill or receipt number. Empty string if absent."),
  invoice_date: z.string().describe("Date on the bill as YYYY-MM-DD. Empty string if unreadable."),
  currency: z.string().describe("ISO currency code, e.g. MVR, USD"),
  subtotal: z.number().describe("Amount before tax. 0 if not shown separately."),
  gst_rate: z
    .number()
    .describe("GST rate charged, as a number: 0, 6, 8 or 12. Use 0 when no GST is shown."),
  gst_amount: z.number().describe("GST/VAT charged. 0 if none."),
  total: z.number().describe("Grand total actually payable, including GST"),
  item_summary: z
    .string()
    .describe("Short description of what was bought, e.g. 'Cement, sand and rebar'"),
  expense_class: z
    .enum(["revenue", "capital"])
    .describe(
      "capital for plant, equipment, tools or anything lasting beyond the job; revenue for consumed materials, hire and services",
    ),
  confidence: z
    .number()
    .describe("0-100: confidence in this reading. Low if the photo is blurred, skewed or cropped."),
  notes: z.string().describe("Anything ambiguous a human should check. Empty string if all clear."),
});

export type ExtractedBill = z.infer<typeof BillSchema>;

const SYSTEM = `You read construction supplier bills and receipts for a Maldivian back-office system.

Extract exactly what is printed. Rules:
- Never invent a value. If a field is not legible or not present, use an empty string for text and 0 for numbers.
- Amounts are numbers only — strip currency symbols and thousands separators.
- total is what was actually paid, including GST. subtotal excludes GST.
- The Maldives general GST rate is 8% (it was 6% before 2023, so older bills show 6%). Read the rate printed on the bill; if only an amount is shown, infer it from amount ÷ subtotal and round to 0, 6, 8 or 12.
- The supplier TIN is often near the shop name or in the footer, formatted like 1000000GST501.
- Set confidence honestly: below 60 if the image is blurry, skewed, cropped or handwritten.
- Put anything a human should double-check into notes.`;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/** True when the server is configured to read bills automatically. */
export function extractionAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function extractBill(
  fileBytes: Buffer,
  mimeType: string,
): Promise<ExtractedBill> {
  if (!extractionAvailable()) {
    throw new Error(
      "Auto-reading is not configured. Set ANTHROPIC_API_KEY to switch it on, or type the bill in by hand.",
    );
  }

  const client = new Anthropic();
  const data = fileBytes.toString("base64");

  const source =
    mimeType === "application/pdf"
      ? ({
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data },
        })
      : ({
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: (IMAGE_TYPES.includes(mimeType)
              ? mimeType
              : "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data,
          },
        });

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 8000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: zodOutputFormat(BillSchema),
    },
    messages: [
      {
        role: "user",
        content: [source, { type: "text", text: "Read this bill and extract its details." }],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The reader declined to process this document.");
  }

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Could not read a bill out of this image.");
  return parsed;
}
