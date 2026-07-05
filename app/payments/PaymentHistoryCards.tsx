import { Download, ReceiptText } from "lucide-react";

type PaymentHistoryCardsProps = {
  payments: any[];
  onDownload: () => void;
};

function money(value: any) {
  return `₹${Number(value || 0).toFixed(0)}`;
}

function showDate(value: any) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB");
}

export default function PaymentHistoryCards({
  payments,
  onDownload,
}: PaymentHistoryCardsProps) {
  const totalReceived = payments.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );

  const totalDiscount = payments.reduce(
    (sum, row) => sum + Number(row.discount || 0),
    0
  );

  return (
    <section className="modern-card">
      <div className="section-header">
        <div>
          <h2>Payment History</h2>
          <p>Selected month payment records</p>
        </div>

        <button className="btn-blue" type="button" onClick={onDownload}>
          <Download size={16} /> Download
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            border: "1px solid #dbeafe",
            borderRadius: 16,
            padding: 14,
            background: "#f8fbff",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>
            RECEIVED
          </div>
          <div style={{ fontSize: 24, fontWeight: 950, color: "#0f172a" }}>
            {money(totalReceived)}
          </div>
        </div>

        <div
          style={{
            border: "1px solid #dbeafe",
            borderRadius: 16,
            padding: 14,
            background: "#f8fbff",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>
            DISCOUNT
          </div>
          <div style={{ fontSize: 24, fontWeight: 950, color: "#0f172a" }}>
            {money(totalDiscount)}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {payments.map((payment, index) => (
          <div
            key={`${payment.id || "payment"}-${index}`}
            style={{
              border: "1px solid #dbeafe",
              borderRadius: 18,
              padding: 16,
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
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 14,
                    background: "#eff6ff",
                    display: "grid",
                    placeItems: "center",
                    color: "#0057ff",
                  }}
                >
                  <ReceiptText size={18} />
                </div>

                <div>
                  <div style={{ fontSize: 17, fontWeight: 950, color: "#0f172a" }}>
                    {payment.customer_name || "Customer"}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>
                    {payment.mobile || "-"} • {payment.shop || "-"}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>
                    {showDate(payment.payment_date)} • {payment.mode || payment.payment_mode || "-"}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 950, color: "#16a34a" }}>
                  {money(payment.amount)}
                </div>
                {Number(payment.discount || 0) > 0 && (
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#f97316" }}>
                    Discount {money(payment.discount)}
                  </div>
                )}
              </div>
            </div>

            {payment.remarks && (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "#f8fafc",
                  color: "#475569",
                  fontWeight: 700,
                }}
              >
                {payment.remarks}
              </div>
            )}
          </div>
        ))}

        {payments.length === 0 && (
          <div
            style={{
              border: "1px dashed #bfdbfe",
              borderRadius: 18,
              padding: 22,
              textAlign: "center",
              fontWeight: 900,
              color: "#64748b",
              background: "#f8fbff",
            }}
          >
            No payments found
          </div>
        )}
      </div>
    </section>
  );
}
