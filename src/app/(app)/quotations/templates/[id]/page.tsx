import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toTemplate } from "@/lib/documents";
import { brandingUrls } from "@/lib/branding";
import { TemplateEditor } from "./template-editor";

export const dynamic = "force-dynamic";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("document_templates").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const template = toTemplate(data);
  const urls = await brandingUrls(supabase, template.tail);

  return (
    <div>
      <div className="mb-2">
        <Link href="/quotations/templates" className="text-xs text-[var(--muted)] hover:underline">
          ← Templates
        </Link>
      </div>
      <TemplateEditor template={template} stampUrl={urls.stampUrl} signatureUrl={urls.signatureUrl} />
    </div>
  );
}
