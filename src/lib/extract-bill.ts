import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

/**
 * What we try to read off a bill photo or PDF. Every field is a best effort —
 * the review screen lets a human correct any of it before (and after) confirming.
 */
const BillSchema = z.object({
  shop_name: z.string().describe("Trading name of the shop, supplier or merchant on the bill"),
  bill_no: z.string().describe("Invoice, bill or receipt number. Empty string if absent."),
  bill_date: z.string().describe("Date on the bill as YYYY-MM-DD. Empty string if unreadable."),
  currency: z.string().describe("ISO currency code, e.g. GBP, USD, PKR, AED"),
  subtotal: z.number().describe("Net amount before tax. 0 if not shown."),
  tax_amount: z.number().describe("VAT/GST/sales tax. 0 if not shown."),
  total_amount: z.number().describe("Grand total actually payable"),
  item_summary: z.string().describe("Short description of what was bought, e.g. 'Cement, sand and rebar'"),
  line_items: z
    .array(
      z.object({
        description: z.string().describe("Product or service name as printed"),
        quantity: z.number().describe("Quantity; 1 if not stated"),
        unit_price: z.number().describe("Price per unit; 0 if not stated"),
        line_total: z.number().describe("Total for this line"),
      }),
    )
    .describe("Every product line readable on the bill"),
  confidence: z
    .number()
    .describe("0-100: how confident you are in this reading overall. Low if the image is blurred or cropped."),
  notes: z.string().describe("Anything ambiguous a human should check. Empty string if all clear."),
});

export type ExtractedBill = z.infer<typeof BillSchema>;

const SYSTEM = `You read construction supplier bills, receipts and invoices for a back-office system.

Extract exactly what is printed. Rules:
- Never invent a value. If a field is not legible or not present, use an empty string for text and 0 for numbers.
- Amounts are numbers only — strip currency symbols and thousands separators.
- total_amount is what was actually paid or is payable, including tax.
- If the bill shows a tax/VAT/GST line, put it in tax_amount and the pre-tax figure in subtotal.
- Capture every product line you can read, even handwritten ones.
- Set confidence honestly: below 60 if the image is blurry, cropped, or you had to guess.
- Put anything a human should double-check into notes.`;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/** True when the server is configured to auto-read bills. */
export function extractionAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function extractBill(
  fileBytes: Buffer,
  mimeType: string,
): Promise<ExtractedBill> {
  if (!extractionAvailable()) {
    throw new Error(
      "Auto-reading is not configured. Set ANTHROPIC_API_KEY to enable it, or enter the bill by hand.",
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
  if (!parsed) throw new Error("Could not parse a bill out of this file.");
  return parsed;
}
