"use client";

import { Package } from "lucide-react";
import { calcRentalAmount, countDays, rowToolName } from "../calculations";

type Props = {
  rentals: any[];
};

function formatDate(date: any) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString("en-GB");
}

function rentalDate(row: any) {
  return row.start_date || row.date || row.rental_date || row.created_at || "";
}

function rowQty(row: any) {
  return Number(row.qty || row.quantity || row.total_qty || 1);
}

function rowRent(row: any) {
  return Number(row.unit_price || row.daily_rent || row.rent || row.rate || 0);
}

function money(value: any) {
  return `₹${Number(value || 0).toFixed(0)}`;
}

export default function StatementRentalTable({ rentals }: Props) {
  const total = rentals.reduce((sum, row) => sum + calcRentalAmount(row), 0);

  return (
    <div style={sectionWrap}>
      <div style={sectionHeader}>
        <div style={sectionTitleLeft}>
          <span style={iconBox}>
            <Package size={22} />
          </span>
          <div>
            <h2 style={title}>Rental Details</h2>
            <p style={subtitle}>Tools rented by the selected customer</p>
          </div>
        </div>

        <div style={totalPill}>Total Rent: {money(total)}</div>
      </div>

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={{ ...th, width: 54, textAlign: "center" }}>#</th>
              <th style={th}>Date</th>
              <th style={th}>Item</th>
              <th style={{ ...th, textAlign: "right" }}>Qty</th>
              <th style={{ ...th, textAlign: "right" }}>Rent</th>
              <th style={{ ...th, textAlign: "right" }}>Days</th>
              <th style={{ ...th, textAlign: "right" }}>Amount</th>
            </tr>
          </thead>

          <tbody>
            {rentals.map((r, i) => {
              const days = countDays(
                r.start_date || r.date || r.rental_date,
                r.end_date || r.return_date,
                r.avoid_sundays !== false
              );

              return (
                <tr key={r.id || i}>
                  <td style={{ ...td, textAlign: "center", fontWeight: 900 }}>{i + 1}</td>
                  <td style={td}>{formatDate(rentalDate(r))}</td>
                  <td style={{ ...td, fontWeight: 950, color: "#0f172a" }}>
                    {rowToolName(r) || "-"}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>{rowQty(r)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{money(rowRent(r))}</td>
                  <td style={{ ...td, textAlign: "right" }}>{days}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 950, color: "#0057ff" }}>
                    {money(calcRentalAmount(r))}
                  </td>
                </tr>
              );
            })}

            {rentals.length === 0 && (
              <tr>
                <td style={emptyTd} colSpan={7}>
                  No rental details found for this period
                </td>
              </tr>
            )}
          </tbody>

          {rentals.length > 0 && (
            <tfoot>
              <tr>
                <td style={totalLabel} colSpan={6}>
                  Total
                </td>
                <td style={totalValue}>{money(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

const sectionWrap: any = {
  border: "1px solid #dbeafe",
  borderRadius: 20,
  overflow: "hidden",
  background: "#ffffff",
  marginBottom: 22,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
};

const sectionHeader: any = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  padding: "18px 20px",
  background: "linear-gradient(135deg, #f8fbff 0%, #ffffff 100%)",
  borderBottom: "1px solid #dbeafe",
  flexWrap: "wrap",
};

const sectionTitleLeft: any = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const iconBox: any = {
  width: 48,
  height: 48,
  borderRadius: 14,
  background: "#eff6ff",
  color: "#0057ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const title: any = {
  margin: 0,
  fontSize: 23,
  fontWeight: 950,
  color: "#0f172a",
};

const subtitle: any = {
  margin: "3px 0 0",
  color: "#64748b",
  fontWeight: 750,
};

const totalPill: any = {
  padding: "10px 16px",
  borderRadius: 999,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#0057ff",
  fontWeight: 950,
};

const tableWrap: any = {
  overflowX: "auto",
};

const table: any = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 760,
};

const th: any = {
  background: "#0057ff",
  color: "white",
  padding: "13px 12px",
  fontSize: 15,
  fontWeight: 950,
  textAlign: "left",
  whiteSpace: "nowrap",
};

const td: any = {
  padding: "13px 12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#334155",
  fontWeight: 750,
  fontSize: 15,
  verticalAlign: "top",
};

const emptyTd: any = {
  padding: 22,
  textAlign: "center",
  color: "#64748b",
  fontWeight: 850,
};

const totalLabel: any = {
  padding: "14px 12px",
  textAlign: "right",
  fontWeight: 950,
  background: "#f8fbff",
  borderTop: "2px solid #bfdbfe",
};

const totalValue: any = {
  padding: "14px 12px",
  textAlign: "right",
  fontWeight: 950,
  color: "#0057ff",
  background: "#f8fbff",
  borderTop: "2px solid #bfdbfe",
};
