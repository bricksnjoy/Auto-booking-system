import type { createClient } from "@/lib/supabase/server";
import type { TemplateTail } from "@/lib/documents";

/** Short-lived links to a template's stamp and signature, which live in a private bucket. */
export async function brandingUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tail: Pick<TemplateTail, "stamp_path" | "signature_path">,
) {
  const paths = [tail.stamp_path, tail.signature_path].filter(Boolean);
  if (!paths.length) return { stampUrl: null, signatureUrl: null };
  const { data } = await supabase.storage.from("branding").createSignedUrls(paths, 60 * 60);
  const url = (p: string) => (p ? data?.find((d) => d.path === p)?.signedUrl ?? null : null);
  return { stampUrl: url(tail.stamp_path), signatureUrl: url(tail.signature_path) };
}
