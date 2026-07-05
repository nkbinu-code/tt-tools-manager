"use client";

import { useMemo, useState } from "react";
import { Archive, FileText, Search, Wrench } from "lucide-react";
import { calcRentalAmount, countDays, rowToolName } from "../calculations";

type Props = {
  month: string;
  shop: string;
  shops: string[];
  customers: any[];
  pendingRows: any[];
  selectedMobile: string;
  selectedCustomer: any;
  selectedPending: any;
  selectedTotalBusiness: number;
  selectedCashReceived: number;
  selectedDiscount: number;
  selectedAlreadyArrears: number;
  selectedBalance: number;
  activeRentals: any[];
  returnedPendingRentals: any[];
  paymentRow: any;
  paymentModes: string[];
  onMonthChange: (value: string) => void;
  onShopChange: (value: string) => void;
  onSelectCustomer: (mobile: string) => void;
  onPaymentChange: (field: string, value: string) => void;
  onSavePayment: () => void;
  onOpenStatement: () => void;
  onMoveToArrears: () => void;
};

function money(value: any) {
  return `₹${Number(value || 0).toFixed(0)}`;
}

function clean(value: any) {
  return String(value || "").trim();
}

export default function CustomerPaymentCounter({
  month,
  shop,
  shops,
  customers,
  pendingRows,
  selectedMobile,
  selectedCustomer,
  selectedPending,
  selectedTotalBusiness,
  selectedCashReceived,
  selectedDiscount,
  selectedAlreadyArrears,
  selectedBalance,
  activeRentals,
  returnedPendingRentals,
  paymentRow,
  paymentModes,
  onMonthChange,
  onShopChange,
  onSelectCustomer,
  onPaymentChange,
  onSavePayment,
  onOpenStatement,
  onMoveToArrears,
}: Props) {
  const [search, setSearch] = useState("");
  const [showTools, setShowTools] = useState(true);

  const customerName =
    selectedCustomer?.customer_name ||
    selectedCustomer?.name ||
    selectedPending?.customer_name ||
    "";

  const customerShop =
    selectedCustomer?.shop || selectedCustomer?.branch || selectedPending?.shop || "-";

  const quickCustomers = useMemo(() => {
    const map = new Map<string, any>();

    customers.forEach((c) => {
      const mobile = clean(c.mobile);
      if (!mobile) return;
      map.set(mobile, {
        mobile,
        name: c.customer_name || c.name || "Customer",
        shop: c.shop || c.branch || "-",
        balance: Number(pendingRows.find((p) => clean(p.mobile) === mobile)?.balance || 0),
      });
    });

    pendingRows.forEach((p) => {
      const mobile = clean(p.mobile);
      if (!mobile) return;
      const existing = map.get(mobile) || {};
      map.set(mobile, {
        mobile,
        name: existing.name || p.customer_name || "Customer",
        shop: existing.shop || p.shop || "-",
        balance: Number(p.balance || existing.balance || 0),
      });
    });

    const q = search.toLowerCase().trim();
    return Array.from(map.values())
      .filter((c) => {
        if (!q) return Number(c.balance || 0) > 0;
        return (
          String(c.name || "").toLowerCase().includes(q) ||
          String(c.mobile || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [customers, pendingRows, search]);

  const activeTotal = activeRentals.reduce(
    (sum, row) => sum + Number(calcRentalAmount(row) || 0),
    0
  );

  const returnedTotal = returnedPendingRentals.reduce(
    (sum, row) => sum + Number(row.balance || row.amount || 0),
    0
  );

  const hasCustomer = Boolean(selectedMobile);
  const statusText = selectedBalance <= 0 ? "Clear" : "Amount Due";
  const statusBg = selectedBalance <= 0 ? "#dcfce7" : "#ffedd5";
  const statusColor = selectedBalance <= 0 ? "#166534" : "#c2410c";

  return (
    <section className="modern-card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          padding: 20,
          borderBottom: "1px solid #e5e7eb",
          background: "linear-gradient(135deg, #eff6ff, #ffffff)",
        }}
      >
        <div className="section-header" style={{ marginBottom: 14 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Payment Counter</h2>
            <p>Search customer, check tools, receive payment.</p>
          </div>
        </div>

        <div className="filter-row sales-filter">
          <input type="month" value={month} onChange={(e) => onMonthChange(e.target.value)} />

          <select value={shop} onChange={(e) => onShopChange(e.target.value)}>
            {shops.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <div style={{ position: "relative", marginTop: 12 }}>
          <Search
            size={18}
            style={{ position: "absolute", left: 14, top: 17, color: "#64748b" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search mobile or customer name..."
            style={{
              width: "100%",
              paddingLeft: 44,
              minHeight: 54,
              fontSize: 17,
              fontWeight: 800,
            }}
          />
        </div>

        {quickCustomers.length > 0 && (
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {quickCustomers.map((c) => (
              <button
                key={c.mobile}
                type="button"
                onClick={() => {
                  setSearch(`${c.name} ${c.mobile}`);
                  onSelectCustomer(c.mobile);
                }}
                style={{
                  border: clean(c.mobile) === selectedMobile ? "2px solid #2563eb" : "1px solid #dbeafe",
                  background: "#ffffff",
                  borderRadius: 14,
                  padding: "12px 14px",
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <span>
                  <strong style={{ display: "block", color: "#0f172a" }}>{c.name}</strong>
                  <span style={{ color: "#64748b", fontWeight: 800 }}>
                    {c.mobile} • {c.shop}
                  </span>
                </span>
                <strong style={{ color: Number(c.balance || 0) > 0 ? "#dc2626" : "#16a34a" }}>
                  {money(c.balance)}
                </strong>
              </button>
            ))}
          </div>
        )}
      </div>

      {!hasCustomer && (
        <div style={{ padding: 22, color: "#64748b", fontWeight: 800 }}>
          Select a customer to see balance, active rentals and payment form.
        </div>
      )}

      {hasCustomer && (
        <div style={{ padding: 20, display: "grid", gap: 18 }}>
          <div
            style={{
              border: "1px solid #dbeafe",
              borderRadius: 22,
              padding: 18,
              background: "#ffffff",
              boxShadow: "0 12px 30px rgba(15, 23, 42, 0.07)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 950, color: "#0f172a" }}>
                  {customerName || selectedMobile}
                </div>
                <div style={{ color: "#475569", fontWeight: 850, marginTop: 5 }}>
                  📞 {selectedMobile} • 🏪 {customerShop}
                </div>
              </div>

              <div
                style={{
                  background: statusBg,
                  color: statusColor,
                  borderRadius: 999,
                  padding: "9px 13px",
                  fontWeight: 950,
                  alignSelf: "start",
                }}
              >
                {statusText}
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ color: "#64748b", fontWeight: 900 }}>Amount Due</div>
              <div style={{ fontSize: 42, fontWeight: 950, color: selectedBalance > 0 ? "#dc2626" : "#16a34a" }}>
                {money(selectedBalance)}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 10,
                marginTop: 16,
              }}
            >
              <MiniStat label="Business" value={money(selectedTotalBusiness)} />
              <MiniStat label="Received" value={money(selectedCashReceived)} />
              <MiniStat label="Discount" value={money(selectedDiscount)} />
              <MiniStat label="Arrears" value={money(selectedAlreadyArrears)} />
            </div>

            <div className="action-row" style={{ marginTop: 16 }}>
              <button className="btn-blue" type="button" onClick={onOpenStatement}>
                <FileText size={16} /> Statement
              </button>
              <button
                className="btn-blue"
                type="button"
                onClick={onMoveToArrears}
                disabled={selectedBalance <= 0}
              >
                <Archive size={16} /> Move to Arrears
              </button>
            </div>
          </div>

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 20,
              padding: 16,
              background: "#f8fafc",
            }}
          >
            <button
              type="button"
              onClick={() => setShowTools(!showTools)}
              style={{
                width: "100%",
                border: 0,
                background: "transparent",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: 950,
                color: "#0f172a",
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              <span>
                <Wrench size={18} /> Active Rentals: {activeRentals.length} • Returned Pending: {returnedPendingRentals.length}
              </span>
              <span>{showTools ? "▲" : "▼"}</span>
            </button>

            {showTools && (
              <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                {activeRentals.map((row, index) => {
                  const days = countDays(
                    row.start_date || row.date || row.rental_date,
                    row.end_date || row.return_date,
                    row.avoid_sundays !== false
                  );

                  return (
                    <ToolLine
                      key={row.id || `active-${index}`}
                      title={rowToolName(row) || "Tool"}
                      detail={`Active • ${days} days`}
                      amount={money(calcRentalAmount(row))}
                    />
                  );
                })}

                {returnedPendingRentals.map((row, index) => (
                  <ToolLine
                    key={row.id || row.rental_id || `returned-${index}`}
                    title={row.tool_name || "Returned tool"}
                    detail={`Returned ${row.return_date || row.end_date || ""}`}
                    amount={money(row.balance || row.amount)}
                  />
                ))}

                {activeRentals.length === 0 && returnedPendingRentals.length === 0 && (
                  <div style={{ color: "#64748b", fontWeight: 800 }}>No active or returned pending tools found.</div>
                )}

                {(activeRentals.length > 0 || returnedPendingRentals.length > 0) && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderTop: "1px dashed #cbd5e1",
                      paddingTop: 12,
                      fontWeight: 950,
                    }}
                  >
                    <span>Tools Total</span>
                    <span>{money(activeTotal + returnedTotal)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              border: "1px solid #bfdbfe",
              borderRadius: 22,
              padding: 18,
              background: "#eff6ff",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Receive Payment</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <label style={{ fontWeight: 900 }}>
                Date
                <input
                  type="date"
                  value={paymentRow.payment_date || ""}
                  onChange={(e) => onPaymentChange("payment_date", e.target.value)}
                  style={{ width: "100%", marginTop: 6 }}
                />
              </label>

              <label style={{ fontWeight: 900 }}>
                Amount Received
                <input
                  type="number"
                  value={paymentRow.amount || ""}
                  onChange={(e) => onPaymentChange("amount", e.target.value)}
                  placeholder="Enter amount"
                  style={{ width: "100%", marginTop: 6 }}
                />
              </label>

              <label style={{ fontWeight: 900 }}>
                Discount
                <input
                  type="number"
                  value={paymentRow.discount || ""}
                  onChange={(e) => onPaymentChange("discount", e.target.value)}
                  placeholder="0"
                  style={{ width: "100%", marginTop: 6 }}
                />
              </label>

              <label style={{ fontWeight: 900 }}>
                Mode
                <select
                  value={paymentRow.mode || "Cash"}
                  onChange={(e) => onPaymentChange("mode", e.target.value)}
                  style={{ width: "100%", marginTop: 6 }}
                >
                  {paymentModes.map((mode) => (
                    <option key={mode}>{mode}</option>
                  ))}
                </select>
              </label>
            </div>

            <label style={{ display: "block", fontWeight: 900, marginTop: 12 }}>
              Remarks
              <input
                value={paymentRow.remarks || ""}
                onChange={(e) => onPaymentChange("remarks", e.target.value)}
                placeholder="Optional notes"
                style={{ width: "100%", marginTop: 6 }}
              />
            </label>

            <button
              className="btn-blue"
              type="button"
              onClick={onSavePayment}
              style={{ width: "100%", marginTop: 16, minHeight: 52, fontSize: 18 }}
            >
              Save Payment
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function MiniStat({ label, value }: any) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        padding: 12,
      }}
    >
      <div style={{ color: "#64748b", fontWeight: 900, fontSize: 12 }}>{label}</div>
      <div style={{ color: "#0f172a", fontWeight: 950, fontSize: 18 }}>{value}</div>
    </div>
  );
}

function ToolLine({ title, detail, amount }: any) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: 12,
        borderRadius: 14,
        background: "#ffffff",
        border: "1px solid #e2e8f0",
      }}
    >
      <div>
        <strong style={{ color: "#0f172a" }}>{title}</strong>
        <div style={{ color: "#64748b", fontWeight: 800, marginTop: 3 }}>{detail}</div>
      </div>
      <strong style={{ color: "#0f172a", whiteSpace: "nowrap" }}>{amount}</strong>
    </div>
  );
}
