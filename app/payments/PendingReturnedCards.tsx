"use client";

import { Wrench } from "lucide-react";

type Props = {
  rows: any[];
  onReceive: (row: any) => void;
};

function money(value: any) {
  return `₹${Number(value || 0).toFixed(0)}`;
}

export default function PendingReturnedCards({ rows, onReceive }: Props) {
  return (
    <section className="modern-card">
      <div className="section-header">
        <div>
          <h2>Returned - Payment Pending</h2>
          <p>Returned tools that still need payment collection.</p>
        </div>
      </div>

      {rows.length === 0 && (
        <div
          style={{
            border: "1px dashed #cbd5e1",
            borderRadius: 18,
            padding: 18,
            color: "#64748b",
            fontWeight: 800,
            background: "#f8fafc",
          }}
        >
          No returned pending rentals found.
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((row, index) => (
            <div
              key={`${row.rental_id || row.id || "returned"}-${index}`}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 18,
                padding: 14,
                background: "#ffffff",
                boxShadow: "0 8px 22px rgba(15, 23, 42, 0.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 18, fontWeight: 950, color: "#0f172a" }}>
                    {row.customer_name || "Customer"}
                  </div>
                  <div style={{ color: "#64748b", fontWeight: 850, marginTop: 4 }}>
                    📞 {row.mobile || "-"} • 🏪 {row.shop || "-"}
                  </div>
                </div>

                <div
                  style={{
                    background: "#ffedd5",
                    color: "#c2410c",
                    borderRadius: 999,
                    padding: "8px 12px",
                    fontWeight: 950,
                  }}
                >
                  Due {money(row.balance)}
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 950 }}>
                    <Wrench size={17} /> {row.tool_name || "Tool"}
                  </div>
                  <div style={{ color: "#64748b", fontWeight: 800, marginTop: 6 }}>
                    Returned: {row.return_date || row.end_date || "-"}
                  </div>
                  <div style={{ color: "#64748b", fontWeight: 800, marginTop: 4 }}>
                    Amount {money(row.amount)} • Paid {money(row.paid)} • Discount {money(row.discount)}
                  </div>
                </div>

                <button className="btn-blue" type="button" onClick={() => onReceive(row)}>
                  Receive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
