import type { createClient } from "@/lib/supabase/server";
import { toTemplate } from "@/lib/documents";
import { signingKit } from "@/lib/branding";
import type { ClientOption, ProjectOption } from "./quotation-form";

/** Everything the quotation form offers: templates, projects and clients. */
export async function formData(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ data: t }, { data: projects }, { data: clients }, kit] = await Promise.all([
    supabase
      .from("document_templates")
      .select("*")
      .eq("kind", "quotation")
      .order("is_default", { ascending: false })
      .order("created_at"),
    supabase.from("projects").select("id, code, name, client_id").order("code", { ascending: false }),
    supabase.from("clients").select("id, name, phone, address").order("name"),
    signingKit(supabase),
  ]);
  const templates = (t ?? []).map(toTemplate);
  return {
    templates,
    kit,
    projects: (projects ?? []) as ProjectOption[],
    clients: (clients ?? []) as ClientOption[],
  };
}
