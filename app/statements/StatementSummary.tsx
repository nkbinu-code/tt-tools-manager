"use client";

type StatementSummaryProps = {
  totalRent: number;
  paid: number;
  discount: number;
  balance: number;
};

function money(value: any) {
  return `₹${Number(value || 0).toFixed(0)}`;
}

export default function StatementSummary({
  totalRent,
  paid,
  discount,
  balance,
}: StatementSummaryProps) {
  return (
    <div style={wrap}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Business</th>
            <th style={thStyle}>Received</th>
            <th style={thStyle}>Discount</th>
            <th style={thStyle}>Balance</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td style={tdStyle}>{money(totalRent)}</td>
            <td style={tdStyle}>{money(paid)}</td>
            <td style={tdStyle}>{money(discount)}</td>
            <td style={balanceCell}>{money(balance)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const wrap: any = {
  marginTop: 24,
  border: "1px solid #bfdbfe",
  borderRadius: 16,
  overflow: "hidden",
  background: "#ffffff",
};

const tableStyle: any = {
  width: "100%",
  borderCollapse: "collapse",
  textAlign: "center",
};

const thStyle: any = {
  background: "#0057ff",
  color: "#ffffff",
  fontSize: 17,
  fontWeight: 950,
  padding: "14px 10px",
  borderRight: "1px solid rgba(255,255,255,0.28)",
  whiteSpace: "nowrap",
};

const tdStyle: any = {
  fontSize: 22,
  fontWeight: 950,
  color: "#0f172a",
  padding: "16px 10px",
  borderTop: "1px solid #e5e7eb",
  borderRight: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
};

const balanceCell: any = {
  ...tdStyle,
  color: "#0057ff",
};
