"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveCompanySettings(_prev: unknown, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "Only an admin can change company settings." };

  const text = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const number = (k: string, fallback: number) => {
    const n = Number(String(formData.get(k) ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : fallback;
  };

  const { error } = await supabase
    .from("company_settings")
    .update({
      company_name: text("company_name") ?? "Spruce & Co",
      legal_name: text("legal_name"),
      registration_no: text("registration_no"),
      tax_number: text("tax_number"),
      address: text("address"),
      city: text("city"),
      country: text("country"),
      phone: text("phone"),
      email: text("email"),
      website: text("website"),
      currency: text("currency") ?? "GBP",
      tax_rate: number("tax_rate", 20),
      fiscal_year_start: number("fiscal_year_start", 4),
      default_retention_pct: number("default_retention_pct", 5),
      default_payment_terms_days: number("default_payment_terms_days", 30),
      invoice_prefix: text("invoice_prefix") ?? "INV",
      po_prefix: text("po_prefix") ?? "PO",
    })
    .eq("id", 1);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
