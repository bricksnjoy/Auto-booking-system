import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { addDays } from "@/lib/documents";
import { QuotationForm } from "../quotation-form";
import { formData } from "../form-data";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: projectId } = await searchParams;
  const supabase = await createClient();
  const { templates, branding, projects, clients } = await formData(supabase);
  const template = templates[0];
  const today = new Date().toISOString().slice(0, 10);

  // started from a project: it arrives already addressed to that project's client
  const project = projects.find((p) => p.id === projectId);
  const client = clients.find((c) => c.id === project?.client_id);

  return (
    <div>
      <div className="mb-2">
        <Link href={project ? `/projects/${project.id}` : "/quotations"} className="text-xs text-[var(--muted)] hover:underline">
          ← {project ? project.name : "Quotations"}
        </Link>
      </div>
      <PageHeader title="New quotation" subtitle="It gets its number when saved" />
      {!template ? (
        <p className="text-sm text-[var(--muted)]">
          Set up a quotation template first, under <Link href="/quotations/templates" className="underline">Templates</Link>.
        </p>
      ) : (
        <QuotationForm templates={templates} projects={projects} clients={clients} branding={branding} number={null}
          initial={{
            template_id: template.id,
            project_id: project?.id ?? null,
            client_id: client?.id ?? null,
            to_name: client?.name ?? "",
            to_details: client ? [client.phone, client.address].filter(Boolean).join("\n") : "",
            title: project?.name ?? "",
            issue_date: today,
            valid_until: template.body.valid_days ? addDays(today, template.body.valid_days) : null,
            duration: "",
            tax_rate: template.body.tax_rate,
            terms: template.tail.terms,
            notes: "",
            items: [{ title: "", description: "", unit: "Nos", qty: 1, rate: 0 }],
          }} />
      )}
    </div>
  );
}
