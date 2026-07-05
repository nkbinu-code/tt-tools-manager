"use client";

import { useMemo, useState } from "react";

type CustomerBalanceSummaryProps = {
  rows: any[];
  shop: string;
  selectedMobile: string;
  onSelectCustomer: (mobile: string) => void;
  onReceivePayment: (row: any) => void;
};

function money(value: any) {
  return `₹${Number(value || 0).toFixed(0)}`;
}

export default function CustomerBalanceSummary({
  rows,
  shop,
  selectedMobile,
  onSelectCustomer,
  onReceivePayment,
}: CustomerBalanceSummaryProps) {
  const [search, setSearch] = useState("");

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (rows || [])
      .filter((row) => Number(row.balance || 0) > 0)
      .filter((row) => shop === "All Shops" || row.shop === shop || row.branch === shop)
      .filter((row) => {
        if (!q) return true;

        const customer = String(row.customer_name || row.name || "").toLowerCase();
        const mobile = String(row.mobile || "").toLowerCase();
        const rowShop = String(row.shop || row.branch || "").toLowerCase();

        return customer.includes(q) || mobile.includes(q) || rowShop.includes(q);
      })
      .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
      .slice(0, 10);
  }, [rows, shop, search]);

  const totalBalance = visibleRows.reduce(
    (sum, row) => sum + Number(row.balance || 0),
    0
  );

  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid #dbeafe",
        borderRadius: 22,
        padding: 18,
        marginBottom: 18,
        boxShadow: "0 12px 35px rgba(15, 23, 42, 0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: "#0f172a" }}>Customer Balance Summary</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontWeight: 700 }}>
            Search customer and receive payment quickly.
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>
            Showing Balance
          </div>
          <div style={{ fontSize: 24, fontWeight: 950, color: "#dc2626" }}>
            {money(totalBalance)}
          </div>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search customer, mobile or shop..."
        style={{
          width: "100%",
          marginBottom: 14,
          borderRadius: 14,
          border: "1px solid #cbd5e1",
          padding: "13px 14px",
          fontWeight: 800,
        }}
      />

      <div style={{ display: "grid", gap: 10 }}>
        {visibleRows.map((row, index) => {
          const mobile = String(row.mobile || "").trim();
          const isSelected = selectedMobile && selectedMobile === mobile;

          return (
            <div
              key={`${mobile || row.id || "customer"}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 0.8fr 0.8fr auto",
                gap: 12,
                alignItems: "center",
                border: isSelected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                borderRadius: 16,
                padding: 14,
                background: isSelected ? "#eff6ff" : "#ffffff",
              }}
            >
              <div>
                <div style={{ fontWeight: 950, color: "#0f172a", fontSize: 16 }}>
                  {row.customer_name || row.name || "Customer"}
                </div>
                <div style={{ color: "#64748b", fontWeight: 800, fontSize: 13 }}>
                  {mobile || "-"} • {row.shop || row.branch || "-"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 900 }}>
                  Business
                </div>
                <div style={{ fontWeight: 950 }}>{money(row.total_business || row.business || row.amount)}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 900 }}>
                  Balance
                </div>
                <div style={{ fontWeight: 950, color: "#dc2626" }}>{money(row.balance)}</div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button className="btn-gray" type="button" onClick={() => onSelectCustomer(mobile)}>
                  View
                </button>
                <button className="btn-blue" type="button" onClick={() => onReceivePayment(row)}>
                  Receive
                </button>
              </div>
            </div>
          );
        })}

        {visibleRows.length === 0 && (
          <div
            style={{
              border: "1px dashed #cbd5e1",
              borderRadius: 16,
              padding: 18,
              color: "#64748b",
              fontWeight: 800,
              textAlign: "center",
            }}
          >
            No pending customer balance found.
          </div>
        )}
      </div>
    </section>
  );
}
