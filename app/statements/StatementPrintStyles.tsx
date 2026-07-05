"use client";

export default function StatementPrintStyles() {
  return (
    <style jsx global>{`
      @media print {
        @page {
          size: A4;
          margin: 10mm;
        }

        html,
        body {
          background: white !important;
        }

        body * {
          visibility: hidden !important;
        }

        .tt-print-area,
        .tt-print-area * {
          visibility: visible !important;
        }

        .tt-print-area {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          overflow: visible !important;
          background: white !important;
        }

        .tt-no-print {
          display: none !important;
        }

        .modern-card {
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
          background: white !important;
        }

        .table-wrap {
          overflow: visible !important;
        }

        table {
          page-break-inside: auto;
        }

        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }

        thead {
          display: table-header-group;
        }

        tfoot {
          display: table-footer-group;
        }
      }
    `}</style>
  );
}
