"use client";

import { Plus, Save } from "lucide-react";

type CashRow = {
  received_date: string;
  shop: string;
  received_from: string;
  amount: string;
  mode: string;
  remarks: string;
};

type Props = {
  rows: CashRow[];
  shops: string[];
  paymentModes: string[];
  onChange: (index: number, field: string, value: string) => void;
  onAddRows: () => void;
  onSave: () => void;
};

export default function ShopCashSimple({
  rows,
  shops,
  paymentModes,
  onChange,
  onAddRows,
  onSave,
}: Props) {
  return (
    <section className="modern-card">
      <div className="section-header">
        <div>
          <h2>Shop Cash Received</h2>
          <p>Enter money physically received from each shop.</p>
        </div>

        <div className="action-row">
          <button className="btn-gray" type="button" onClick={onAddRows}>
            <Plus size={16} /> Add Rows
          </button>

          <button className="btn-blue" type="button" onClick={onSave}>
            <Save size={16} /> Save Cash
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        {rows.map((row, index) => (
          <div
            key={index}
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
                alignItems: "center",
                marginBottom: 12,
                gap: 10,
              }}
            >
              <strong style={{ color: "#0f172a" }}>Cash Entry {index + 1}</strong>
              <span
                style={{
                  background: Number(row.amount || 0) > 0 ? "#dcfce7" : "#f1f5f9",
                  color: Number(row.amount || 0) > 0 ? "#166534" : "#475569",
                  borderRadius: 999,
                  padding: "5px 10px",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                ₹{Number(row.amount || 0).toFixed(0)}
              </span>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ fontWeight: 900 }}>
                Date
                <input
                  type="date"
                  value={row.received_date}
                  onChange={(e) => onChange(index, "received_date", e.target.value)}
                  style={{ width: "100%", marginTop: 6 }}
                />
              </label>

              <label style={{ fontWeight: 900 }}>
                Shop
                <select
                  value={row.shop}
                  onChange={(e) => onChange(index, "shop", e.target.value)}
                  style={{ width: "100%", marginTop: 6 }}
                >
                  <option value="">Select shop</option>
                  {shops
                    .filter((shop) => shop !== "All Shops")
                    .map((shop) => (
                      <option key={shop}>{shop}</option>
                    ))}
                </select>
              </label>

              <label style={{ fontWeight: 900 }}>
                Received From
                <input
                  value={row.received_from}
                  onChange={(e) => onChange(index, "received_from", e.target.value)}
                  placeholder="Staff / shop counter"
                  style={{ width: "100%", marginTop: 6 }}
                />
              </label>

              <label style={{ fontWeight: 900 }}>
                Amount
                <input
                  type="number"
                  value={row.amount}
                  onChange={(e) => onChange(index, "amount", e.target.value)}
                  placeholder="0"
                  style={{ width: "100%", marginTop: 6 }}
                />
              </label>

              <label style={{ fontWeight: 900 }}>
                Mode
                <select
                  value={row.mode}
                  onChange={(e) => onChange(index, "mode", e.target.value)}
                  style={{ width: "100%", marginTop: 6 }}
                >
                  {paymentModes.map((mode) => (
                    <option key={mode}>{mode}</option>
                  ))}
                </select>
              </label>

              <label style={{ fontWeight: 900 }}>
                Remarks
                <input
                  value={row.remarks}
                  onChange={(e) => onChange(index, "remarks", e.target.value)}
                  placeholder="Optional note"
                  style={{ width: "100%", marginTop: 6 }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
