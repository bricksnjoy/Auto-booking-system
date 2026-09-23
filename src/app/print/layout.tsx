/**
 * A bare page for printing: no sidebar or header, just the A4 sheet. The
 * browser's print dialog saves it as a PDF.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#e9ecf0] py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          /* a hair under A4, so rounding never spills a blank second page */
          .doc-sheet { box-shadow: none !important; min-height: 296mm !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      {children}
    </div>
  );
}
