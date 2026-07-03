"use client";

import { useState } from "react";
import type { StatementPeriod, StatementType } from "./statement-engine";

export default function StatementPopup({ onClose, onPreview }: any) {
  const [type, setType] = useState<StatementType>("combined");
  const [period, setPeriod] = useState<StatementPeriod>("thisMonth");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  return (
    <div style={overlay}>
      <div style={popup}>
        <div style={header}>
          <h2 style={{ margin: 0 }}>🧾 Customer Statement</h2>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>

        <div style={grid}>
          <div>
            <h3>സ്റ്റേറ്റ്മെന്റ് തരം</h3>

            <label style={label}>
              <input type="radio" checked={type === "rent"} onChange={() => setType("rent")} />
              വാടക വിവരങ്ങൾ
            </label>

            <label style={label}>
              <input type="radio" checked={type === "payment"} onChange={() => setType("payment")} />
              പേയ്മെന്റ് വിവരങ്ങൾ
            </label>

            <label style={label}>
              <input type="radio" checked={type === "combined"} onChange={() => setType("combined")} />
              വാടക-പേയ്മെന്റ് വിവരങ്ങൾ
            </label>
          </div>

          <div>
            <h3>കാലയളവ്</h3>

            <label style={label}>
              <input type="radio" checked={period === "all"} onChange={() => setPeriod("all")} />
              മുഴുവൻ കാലയളവ്
            </label>

            <label style={label}>
              <input type="radio" checked={period === "thisMonth"} onChange={() => setPeriod("thisMonth")} />
              ഈ മാസം
            </label>

            <label style={label}>
              <input type="radio" checked={period === "lastMonth"} onChange={() => setPeriod("lastMonth")} />
              കഴിഞ്ഞ മാസം
            </label>

            <label style={label}>
              <input type="radio" checked={period === "custom"} onChange={() => setPeriod("custom")} />
              തീയതി തിരഞ്ഞെടുക്കുക
            </label>

            {period === "custom" && (
              <div style={{ marginTop: 12 }}>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ marginTop: 8 }} />
              </div>
            )}
          </div>
        </div>

        <button
          className="btn-blue"
          style={{ width: "100%", marginTop: 20 }}
          onClick={() => onPreview({ type, period, fromDate, toDate })}
        >
          Preview Statement
        </button>
      </div>
    </div>
  );
}

const overlay: any = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,.65)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const popup: any = {
  width: "min(650px, 100%)",
  background: "white",
  borderRadius: 20,
  padding: 22,
  boxShadow: "0 25px 80px rgba(0,0,0,.35)",
};

const header: any = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const closeBtn: any = {
  border: 0,
  background: "transparent",
  fontSize: 34,
  cursor: "pointer",
};

const grid: any = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
  marginTop: 20,
};

const label: any = {
  display: "block",
  fontWeight: 800,
  marginBottom: 14,
};