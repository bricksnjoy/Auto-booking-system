"use client";

import { useLinkStatus } from "next/link";

/**
 * Put inside a Link: a small spinner while the page it opens is loading, so
 * the click shows it was taken even when the server is slow to answer.
 */
export function Pending({ light = false }: { light?: boolean }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span aria-hidden="true"
      className={`ml-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 align-[-2px] ${
        light ? "border-white/40 border-t-white" : "border-[var(--border)] border-t-[var(--brand)]"
      }`} />
  );
}
