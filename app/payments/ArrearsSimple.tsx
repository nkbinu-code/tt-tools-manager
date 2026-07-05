import { Archive } from "lucide-react";

type ArrearsSimpleProps = {
  shopWiseArrears: any[];
  yearWiseArrears: any[];
  arrears: any[];
};

function money(value: any) {
  return `₹${Number(value || 0).toFixed(0)}`;
}

export default function ArrearsSimple({
  shopWiseArrears,
  yearWiseArrears,
  arrears,
}: ArrearsSimpleProps) {
  const total = arrears.reduce(
    (sum, row) => sum + Number(row.arrears_amount || 0),
    0
  );

  return (
    <section className="modern-card">
      <div className="section-header">
        <div>
          <h2>Arrears</h2>
          <p>Long pending balances moved out from normal customer balance.</p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            border: "1px solid #fed7aa",
            background: "#fff7ed",
            borderRadius: 18,
            padding: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Archive size={20} />
            <strong>Total Arrears</strong>
          </div>
          <div style={{ fontSize: 30, fontWeight: 950, marginTop: 8 }}>
            {money(total)}
          </div>
        </div>

        {shopWiseArrears.map((row) => (
          <div
            key={row.shop}
            style={{
              border: "1px solid #dbeafe",
              background: "#ffffff",
              borderRadius: 18,
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 900 }}>{row.shop}</div>
            <div style={{ fontSize: 24, fontWeight: 950, marginTop: 8 }}>
              {money(row.amount)}
            </div>
          </div>
        ))}
      </div>

      <details style={{ marginBottom: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 950, fontSize: 18 }}>
          Year-wise Arrears
        </summary>

        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {yearWiseArrears.map((row: any) => (
            <div
              key={row.year}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: "12px 14px",
                fontWeight: 900,
              }}
            >
              <span>{row.year}</span>
              <span>{money(row.amount)}</span>
            </div>
          ))}

          {yearWiseArrears.length === 0 && <p>No arrears found</p>}
        </div>
      </details>

      <details>
        <summary style={{ cursor: "pointer", fontWeight: 950, fontSize: 18 }}>
          Customer Arrears History
        </summary>

        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {arrears.map((row, index) => (
            <div
              key={`${row.id || "arrears"}-${index}`}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 14,
                background: "#ffffff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 950, fontSize: 17 }}>
                    {row.customer_name || "Customer"}
                  </div>
                  <div style={{ color: "#64748b", fontWeight: 800 }}>
                    {row.mobile || "-"} • {row.shop || "-"}
                  </div>
                </div>

                <div style={{ fontSize: 22, fontWeight: 950 }}>
                  {money(row.arrears_amount)}
                </div>
              </div>

              <div style={{ marginTop: 10, lineHeight: 1.6 }}>
                <div><strong>Date:</strong> {row.moved_date || "-"}</div>
                {row.reason && <div><strong>Reason:</strong> {row.reason}</div>}
                {row.remarks && <div><strong>Remarks:</strong> {row.remarks}</div>}
              </div>
            </div>
          ))}

          {arrears.length === 0 && <p>No arrears found</p>}
        </div>
      </details>
    </section>
  );
}
