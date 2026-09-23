import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { signingKit } from "@/lib/branding";
import { AddSignatory, SignatoryCard, StampCard } from "./signing-cards";

export const dynamic = "force-dynamic";

export default async function SignaturesPage() {
  const supabase = await createClient();
  const kit = await signingKit(supabase);

  return (
    <div>
      <div className="mb-2">
        <Link href="/quotations" className="text-xs text-[var(--muted)] hover:underline">← Quotations</Link>
      </div>
      <PageHeader
        title="Signatures & stamp"
        subtitle="Upload the company stamp once and each director's signature — then pick who signs each quotation or invoice"
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <StampCard stampUrl={kit.stampUrl} />
        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            {kit.signatories.map((s) => (
              <SignatoryCard key={s.id} signatory={s} stampUrl={kit.stampUrl} />
            ))}
          </div>
          <div className="mt-4">
            <AddSignatory />
          </div>
        </div>
      </div>
    </div>
  );
}
