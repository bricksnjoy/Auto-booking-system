"use client";

import Link from "next/link";

export function PrintToolbar({ back, filename }: { back: string; filename: string }) {
  return (
    <div className="mx-auto mb-4 flex w-[210mm] max-w-full items-center justify-between px-2 print:hidden">
      <Link href={back} className="text-sm text-[#5b6675] hover:underline">← Back</Link>
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-[#5b6675] sm:inline">
          Choose “Save as PDF” in the print dialog to save {filename}.pdf
        </span>
        <button type="button"
          onClick={() => {
            // the browser suggests the page title as the PDF's file name
            document.title = filename;
            window.print();
          }}
          className="rounded-lg bg-[#0b1f3a] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          Print / Save PDF
        </button>
      </div>
    </div>
  );
}
