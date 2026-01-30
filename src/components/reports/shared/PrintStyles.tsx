/**
 * Print Styles Component
 * Shared print optimization styles for all reports
 */

export default function PrintStyles() {
  return (
    <style>{`
      @media print {
        /* Page setup */
        @page {
          margin: 0.5in;
          size: letter;
        }

        /* Ensure colors print correctly */
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        /* Page breaks */
        .page-break {
          page-break-after: always;
          break-after: page;
        }

        .page-break-before {
          page-break-before: always;
          break-before: page;
        }

        .avoid-break {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        /* Hide non-printable elements */
        .no-print,
        .print\\:hidden {
          display: none !important;
        }

        /* Show print-only elements */
        .print\\:block {
          display: block !important;
        }

        /* Adjust padding for print */
        .print\\:p-0 {
          padding: 0 !important;
        }

        .print\\:p-4 {
          padding: 1rem !important;
        }

        /* Remove shadows and rounded corners for cleaner print */
        .print\\:shadow-none {
          box-shadow: none !important;
        }

        .print\\:rounded-none {
          border-radius: 0 !important;
        }

        /* Ensure backgrounds print */
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* Fix gradient backgrounds */
        .bg-gradient-to-r,
        .bg-gradient-to-br,
        .bg-gradient-to-b {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* Reduce margins for content density */
        .print\\:m-0 {
          margin: 0 !important;
        }

        /* Text adjustments for print readability */
        body {
          font-size: 11pt;
          line-height: 1.4;
        }

        h1 {
          font-size: 24pt !important;
        }

        h2 {
          font-size: 18pt !important;
        }

        h3 {
          font-size: 14pt !important;
        }

        /* Table adjustments */
        table {
          page-break-inside: avoid;
        }

        thead {
          display: table-header-group;
        }

        tr {
          page-break-inside: avoid;
        }

        /* Link handling */
        a[href]:after {
          content: none !important;
        }

        /* SVG scaling */
        svg {
          max-width: 100% !important;
          height: auto !important;
        }
      }

      /* Print preview mode */
      @media screen {
        .print-preview {
          max-width: 8.5in;
          margin: 0 auto;
          padding: 0.5in;
          background: white;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
      }
    `}</style>
  );
}

/**
 * Page wrapper component for multi-page reports
 */
export function ReportPage({
  children,
  pageNumber,
  totalPages,
  showFooter = true
}: {
  children: React.ReactNode;
  pageNumber?: number;
  totalPages?: number;
  showFooter?: boolean;
}) {
  return (
    <div className="page-break-after min-h-screen bg-white">
      <div className="h-full flex flex-col">
        <div className="flex-1">
          {children}
        </div>
        {showFooter && pageNumber && totalPages && (
          <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100">
            Page {pageNumber} of {totalPages} • SafeStreets Professional Analysis
          </footer>
        )}
      </div>
    </div>
  );
}

/**
 * Section wrapper to prevent page breaks within
 */
export function AvoidBreak({ children }: { children: React.ReactNode }) {
  return <div className="avoid-break">{children}</div>;
}
