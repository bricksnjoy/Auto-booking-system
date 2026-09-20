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

const READ_PROMPT = "Read this bill and extract its details.";

/** Whichever reader the server is set up for, in order of preference. */
export function reader(): "claude" | "gemini" | null {
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
  return null;
}

/** True when the server is configured to read bills automatically. */
export function extractionAvailable() {
  return reader() !== null;
}

export async function extractBill(
  fileBytes: Buffer,
  mimeType: string,
): Promise<ExtractedBill> {
  const which = reader();
  if (!which) {
    throw new Error(
      "Auto-reading is not configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY to switch it on, or type the bill in by hand.",
    );
  }
  return which === "claude"
    ? withClaude(fileBytes, mimeType)
    : withGemini(fileBytes, mimeType);
}

async function withClaude(fileBytes: Buffer, mimeType: string): Promise<ExtractedBill> {
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
        content: [source, { type: "text", text: READ_PROMPT }],
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

/**
 * Gemini instead, for anyone running on its free tier. Same schema and the
 * same prompt, so a bill reads the same whichever key is set — note that on
 * Google's free tier the bills submitted may be used to improve their models,
 * which the paid tier and Anthropic both exclude.
 */
async function withGemini(fileBytes: Buffer, mimeType: string): Promise<ExtractedBill> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
  });

  const res = await ai.models
    .generateContent({
        model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType:
                    mimeType === "application/pdf" || IMAGE_TYPES.includes(mimeType)
                      ? mimeType
                      : "image/jpeg",
                  data: fileBytes.toString("base64"),
                },
              },
              { text: READ_PROMPT },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(BillSchema),
          temperature: 0,
        },
      })
    // Google's errors arrive as a JSON blob, which is no use on screen
    .catch((e: unknown) => {
      throw new Error(googleMessage(e));
    });

  const text = res.text;
  if (!text) throw new Error("Could not read a bill out of this image.");

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("The reader returned something that was not a bill.");
  }

  const parsed = BillSchema.safeParse(json);
  if (!parsed.success) throw new Error("Could not read a bill out of this image.");
  return parsed.data;
}

/** Pull the human-readable part out of a Google API error. */
function googleMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const match = raw.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const msg = match ? match[1].replace(/\\"/g, '"') : raw;
  if (/quota|rate limit|RESOURCE_EXHAUSTED/i.test(msg)) {
    return "Google's free tier is rate limited — wait a moment and read this bill again.";
  }
  if (/API key|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) {
    return "The Gemini key was rejected. Check GEMINI_API_KEY in Vercel.";
  }
  return msg.slice(0, 300);
}
