"use client";

type Props = {
  statementType?: string;
};

function todayText() {
  return new Date().toLocaleDateString("en-GB");
}

function statementLabel(type?: string) {
  if (type === "rent") return "Rental Statement";
  if (type === "payment") return "Payment Statement";
  return "Customer Statement";
}

export default function StatementHeader({ statementType }: Props) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
        color: "#0f172a",
        padding: "32px 24px 26px",
        borderBottom: "5px solid #0057ff",
        textAlign: "center",
      }}
    >
      <img
        src="/branding/logo.png"
        alt="Tried & True Rent a Tool"
        style={{
          width: 190,
          maxWidth: "72%",
          height: "auto",
          objectFit: "contain",
          display: "block",
          margin: "0 auto 12px",
        }}
      />

      <div
        style={{
          fontSize: "clamp(26px, 4vw, 36px)",
          fontWeight: 950,
          letterSpacing: "0.03em",
          lineHeight: 1.12,
          color: "#0f172a",
        }}
      >
        TRIED & TRUE RENT A TOOL
      </div>

      <div
        style={{
          fontSize: "clamp(21px, 3vw, 28px)",
          fontWeight: 950,
          color: "#0057ff",
          marginTop: 8,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
        }}
      >
        CUSTOMER STATEMENT
      </div>

      <div
        style={{
          margin: "17px auto 0",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          flexWrap: "wrap",
          padding: "9px 18px",
          borderRadius: 999,
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          color: "#334155",
          fontWeight: 900,
          fontSize: 15,
        }}
      >
        <span>Date: {todayText()}</span>
        <span style={{ color: "#94a3b8" }}>•</span>
        <span>{statementLabel(statementType)}</span>
      </div>
    </div>
  );
}
