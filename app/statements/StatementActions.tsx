"use client";

import { Download, Printer, Share2 } from "lucide-react";

type Props = {
  onPrint: () => void;
};

export default function StatementActions({ onPrint }: Props) {
  return (
    <div
      className="tt-no-print"
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
        marginBottom: 18,
        flexWrap: "wrap",
      }}
    >
      <button type="button" className="btn-blue" onClick={onPrint}>
        <Printer size={18} />
        {" "}Print
      </button>

      <button type="button" className="btn-gray" disabled>
        <Download size={18} />
        {" "}PDF
      </button>

      <button type="button" className="btn-gray" disabled>
        <Share2 size={18} />
        {" "}Share
      </button>
    </div>
  );
}
