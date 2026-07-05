"use client";

type StatementPaymentTableProps = {
  payments: any[];
  formatDate: (date: any) => string;
};

function money(value: any) {
  return `₹${Number(value || 0).toFixed(0)}`;
}

export default function StatementPaymentTable({
  payments,
  formatDate,
}: StatementPaymentTableProps) {
  const totalPaid = payments.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );

  const totalDiscount = payments.reduce(
    (sum, p) => sum + Number(p.discount || 0),
    0
  );

  return (
    <div style={{ marginTop: 22 }}>
      <div
        style={{
          display: "inline-block",
          background: "#0057ff",
          color: "white",
          fontWeight: 950,
          fontSize: 16,
          padding: "8px 16px",
          borderRadius: "10px 10px 0 0",
          letterSpacing: "0.02em",
        }}
      >
        PAYMENT DETAILS
      </div>

      <div
        style={{
          border: "1px solid #bfdbfe",
          borderRadius: "0 14px 14px 14px",
          overflow: "hidden",
          background: "white",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 15,
          }}
        >
          <thead>
            <tr style={{ background: "#eff6ff" }}>
              <th style={th}>#</th>
              <th style={th}>Date</th>
              <th style={th}>Mode</th>
              <th style={th}>Paid</th>
              <th style={th}>Discount</th>
              <th style={th}>Remarks</th>
            </tr>
          </thead>

          <tbody>
            {payments.map((p, index) => (
              <tr key={p.id || index}>
                <td style={tdCenter}>{index + 1}</td>
                <td style={tdCenter}>{formatDate(p.payment_date || p.date || p.created_at)}</td>
                <td style={tdCenter}>{p.mode || p.payment_mode || "-"}</td>
                <td style={tdAmount}>{money(p.amount)}</td>
                <td style={tdAmount}>{money(p.discount)}</td>
                <td style={td}>{p.remarks || "-"}</td>
              </tr>
            ))}

            {payments.length === 0 && (
              <tr>
                <td style={tdCenter} colSpan={6}>
                  No payment details found for this period
                </td>
              </tr>
            )}

            <tr style={{ background: "#f8fbff", fontWeight: 950 }}>
              <td style={td} colSpan={3}>
                Total
              </td>
              <td style={tdAmount}>{money(totalPaid)}</td>
              <td style={tdAmount}>{money(totalDiscount)}</td>
              <td style={td}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: any = {
  padding: "11px 10px",
  border: "1px solid #bfdbfe",
  color: "#0f172a",
  fontWeight: 950,
  textAlign: "center",
  whiteSpace: "nowrap",
};

const td: any = {
  padding: "10px",
  border: "1px solid #dbeafe",
  color: "#0f172a",
};

const tdCenter: any = {
  ...td,
  textAlign: "center",
};

const tdAmount: any = {
  ...td,
  textAlign: "right",
  fontWeight: 950,
  whiteSpace: "nowrap",
};
