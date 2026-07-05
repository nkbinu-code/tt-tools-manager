"use client";

import { BadgeIndianRupee } from "lucide-react";

type PaymentsHeroProps = {
  shop: string;
  month: string;
};

function monthLabel(value: string) {
  if (!value) return "-";
  const [year, month] = value.split("-");
  if (!year || !month) return value;

  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export default function PaymentsHero({ shop, month }: PaymentsHeroProps) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0057ff 0%, #003fb8 100%)",
        color: "white",
        borderRadius: 26,
        padding: "28px 30px",
        marginBottom: 24,
        boxShadow: "0 18px 45px rgba(0, 87, 255, 0.22)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 22,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            background: "rgba(255,255,255,0.16)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
          }}
        >
          <BadgeIndianRupee size={42} />
        </div>

        <div>
          <div
            style={{
              fontSize: "clamp(30px, 4vw, 46px)",
              fontWeight: 950,
              lineHeight: 1,
              letterSpacing: "-0.04em",
            }}
          >
            Payments
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 19,
              fontWeight: 750,
              opacity: 0.92,
            }}
          >
            Receive customer payments quickly and clearly.
          </div>
        </div>
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.22)",
          borderRadius: 20,
          padding: "16px 20px",
          minWidth: 260,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.85 }}>
          CURRENT VIEW
        </div>

        <div style={{ marginTop: 8, fontSize: 18, fontWeight: 950 }}>
          🏪 {shop || "All Shops"}
        </div>

        <div style={{ marginTop: 4, fontSize: 18, fontWeight: 950 }}>
          📅 {monthLabel(month)}
        </div>
      </div>
    </div>
  );
}
