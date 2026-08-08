"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  confirmCashReceivedFromStaff,
  recordCashSentThroughStaff,
} from "./actions";

type Allocation = { shop: string; amount: string };
type Transfer = {
  id: string;
  sent_date: string;
  shop: string;
  amount: number;
  staff_name: string;
  shop_breakdown?: Array<{ shop: string; amount: number }>;
  remarks?: string;
  status: "pending" | "received";
  confirmed_at?: string | null;
  confirmed_by?: string | null;
};

type Props = {
  shops: string[];
  transfers: Transfer[];
  onRefresh: () => Promise<void>;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyAllocation = (): Allocation => ({ shop: "", amount: "" });
const money = (value: any) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function displayDate(value: any, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", includeTime
    ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" });
}

function breakdownOf(row: Transfer) {
  if (Array.isArray(row.shop_breakdown) && row.shop_breakdown.length) return row.shop_breakdown;
  return [{ shop: row.shop, amount: Number(row.amount || 0) }];
}

export default function CashStaffTransfers({ shops, transfers, onRefresh, showError, showSuccess, showWarning }: Props) {
  const availableShops = shops.filter((shop) => shop !== "All Shops");
  const [form, setForm] = useState({ sent_date: today(), collect_from: "", remarks: "" });
  const [allocations, setAllocations] = useState<Allocation[]>([emptyAllocation(), emptyAllocation()]);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<Transfer | null>(null);
  const [password, setPassword] = useState("");
  const [historyFromMonth, setHistoryFromMonth] = useState(today().slice(0, 7));
  const [historyTillMonth, setHistoryTillMonth] = useState(today().slice(0, 7));
  const [historyShop, setHistoryShop] = useState("All Shops");

  const pending = useMemo(() => transfers.filter((row) => row.status === "pending"), [transfers]);
  const confirmed = useMemo(() => transfers.filter((row) => row.status === "received").slice(0, 10), [transfers]);
  const searchedTransfers = useMemo(() => {
    return transfers.filter((row) => {
      const sentMonth = String(row.sent_date || "").slice(0, 7);
      const matchesFrom = !historyFromMonth || sentMonth >= historyFromMonth;
      const matchesTill = !historyTillMonth || sentMonth <= historyTillMonth;
      const matchesShop = historyShop === "All Shops" ||
        breakdownOf(row).some((item) => item.shop === historyShop);
      return matchesFrom && matchesTill && matchesShop;
    });
  }, [transfers, historyFromMonth, historyTillMonth, historyShop]);
  const pendingTotal = pending.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const allocatedTotal = allocations.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  function updateAllocation(index: number, field: keyof Allocation, value: string) {
    setAllocations((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  async function save() {
    const filled = allocations.filter((row) => row.shop && Number(row.amount || 0) > 0);
    if (!form.collect_from.trim()) return showWarning("Please enter Collect From");
    if (!filled.length) return showWarning("Please add at least one shop amount");
    if (new Set(filled.map((row) => row.shop)).size !== filled.length) return showWarning("The same shop cannot be added twice");
    if (saving) return;
    setSaving(true);
    const result = await recordCashSentThroughStaff({
      ...form,
      amount: allocatedTotal,
      shop_breakdown: filled.map((row) => ({ shop: row.shop, amount: Number(row.amount) })),
    });
    setSaving(false);
    if (!result.success) return showError(result.message || "Unable to save cash sent entry");
    setForm({ sent_date: today(), collect_from: "", remarks: "" });
    setAllocations([emptyAllocation(), emptyAllocation()]);
    await onRefresh();
    showSuccess("Combined cash transfer saved. Waiting for confirmation.");
  }

  async function confirm() {
    if (!confirming || !password.trim() || saving) {
      if (!password.trim()) showWarning("Enter the Administrator password");
      return;
    }
    setSaving(true);
    const result = await confirmCashReceivedFromStaff({ transfer_id: confirming.id, administrator_password: password });
    setSaving(false);
    if (!result.success) return showError(result.message || "Confirmation failed");
    setConfirming(null);
    setPassword("");
    await onRefresh();
    showSuccess("Cash received confirmed and added shop-wise");
  }

  function downloadExcel() {
    if (!searchedTransfers.length) {
      showWarning("No Cash Sent to Binu records found to download");
      return;
    }

    const rows = searchedTransfers.map((row) => {
      const allocations = breakdownOf(row);
      const shopAmounts = Object.fromEntries(
        availableShops.map((shop) => [
          shop,
          Number(allocations.find((item) => item.shop === shop)?.amount || 0),
        ]),
      );

      return {
        "Sent Date": row.sent_date || "",
        "Total Amount": Number(row.amount || 0),
        "Collect From": row.staff_name || "",
        ...shopAmounts,
        Status: row.status === "received" ? "Received" : "Waiting",
        "Confirmed Date & Time": row.confirmed_at
          ? displayDate(row.confirmed_at, true)
          : "",
        "Confirmed By": row.confirmed_by || "",
        Remarks: row.remarks || "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 14 },
      { wch: 16 },
      { wch: 20 },
      ...availableShops.map(() => ({ wch: 15 })),
      { wch: 12 },
      { wch: 24 },
      { wch: 18 },
      { wch: 28 },
    ];

    const amountColumns = [1, ...availableShops.map((_, index) => index + 3)];
    amountColumns.forEach((columnIndex) => {
      for (let rowIndex = 1; rowIndex <= rows.length; rowIndex++) {
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        if (worksheet[address]) worksheet[address].z = "₹#,##0.00";
      }
    });

    worksheet["!autofilter"] = { ref: worksheet["!ref"] || "A1:A1" };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cash Sent to Binu");
    XLSX.writeFile(workbook, "Cash-Sent-to-Binu.xlsx");
  }

  return <section className="modern-card" style={{ marginTop: 18 }}>
    <div className="section-header"><div><h2>Cash Sent to Binu</h2><p>Enter each shop amount first. The total is calculated automatically.</p></div><span style={{ background: "#fff7ed", color: "#9a3412", padding: "8px 12px", borderRadius: 999, fontWeight: 900 }}>{money(pendingTotal)} Awaiting Confirmation</span></div>

    <h3 style={{ margin: "20px 0 8px" }}>Shop-wise Amount</h3>
    <div className="table-wrap"><table><thead><tr><th>Shop</th><th>Amount</th><th></th></tr></thead><tbody>
      {allocations.map((row, index) => <tr key={index}><td><select value={row.shop} onChange={(e) => updateAllocation(index, "shop", e.target.value)}><option value="">Shop</option>{availableShops.map((shop) => <option key={shop}>{shop}</option>)}</select></td><td><input type="number" min="0" placeholder="0" value={row.amount} onChange={(e) => updateAllocation(index, "amount", e.target.value)} /></td><td><button className="btn-gray" type="button" onClick={() => setAllocations((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</button></td></tr>)}
    </tbody></table></div>
    <div className="action-row" style={{ marginTop: 12 }}><button className="btn-gray" type="button" onClick={() => setAllocations((rows) => [...rows, emptyAllocation()])}>+ Add Shop</button></div>

    <div className="table-wrap" style={{ marginTop: 18 }}><table><thead><tr><th>Total Amount</th><th>Sent Date</th><th>Collect From</th><th>Remarks</th><th></th></tr></thead><tbody><tr>
      <td style={{ fontSize: 22, fontWeight: 950, color: "#166534" }}>{money(allocatedTotal)}</td>
      <td><input type="date" value={form.sent_date} onChange={(e) => setForm({ ...form, sent_date: e.target.value })} /></td>
      <td><input placeholder="Name" value={form.collect_from} onChange={(e) => setForm({ ...form, collect_from: e.target.value })} /></td>
      <td><input placeholder="Optional" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></td>
      <td><button className="btn-blue" type="button" disabled={saving || allocatedTotal <= 0} onClick={save}>{saving ? "Saving..." : "Record Cash Sent"}</button></td>
    </tr></tbody></table></div>

    <h3 style={{ margin: "24px 0 8px" }}>Money Awaiting Your Confirmation</h3>
    <div className="table-wrap"><table><thead><tr><th>Sent Date</th><th>Total</th><th>Collect From</th><th>Shop Breakdown</th><th>Status</th><th></th></tr></thead><tbody>
      {pending.map((row) => <tr key={row.id}><td>{displayDate(row.sent_date)}</td><td style={{ fontWeight: 900 }}>{money(row.amount)}</td><td>{row.staff_name}</td><td>{breakdownOf(row).map((item) => `${item.shop} ${money(item.amount)}`).join(" · ")}</td><td><span style={{ color: "#9a3412", fontWeight: 900 }}>Waiting</span></td><td><button className="btn-blue" type="button" onClick={() => { setConfirming(row); setPassword(""); }}>Confirm Received</button></td></tr>)}
      {!pending.length && <tr><td colSpan={6} style={{ textAlign: "center", color: "#64748b" }}>No money awaiting confirmation.</td></tr>}
    </tbody></table></div>

    <h3 style={{ margin: "24px 0 8px" }}>Recently Confirmed</h3>
    <div className="table-wrap"><table><thead><tr><th>Confirmed On</th><th>Total</th><th>Collect From</th><th>Shop Breakdown</th><th>Status</th></tr></thead><tbody>
      {confirmed.map((row) => <tr key={row.id}><td>{displayDate(row.confirmed_at, true)}</td><td style={{ fontWeight: 900 }}>{money(row.amount)}</td><td>{row.staff_name}</td><td>{breakdownOf(row).map((item) => `${item.shop} ${money(item.amount)}`).join(" · ")}</td><td><span style={{ color: "#166534", fontWeight: 900 }}>Received</span></td></tr>)}
      {!confirmed.length && <tr><td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>No confirmed entries yet.</td></tr>}
    </tbody></table></div>

    <h3 style={{ margin: "24px 0 8px" }}>Search &amp; Download Cash Sent to Binu</h3>
    <div className="action-row" style={{ display: "flex", flexWrap: "nowrap", alignItems: "end", gap: 12, marginBottom: 12, overflowX: "auto" }}>
        <label style={{ display: "grid", gap: 6, flex: "0 1 190px", fontWeight: 900 }}>
          From Month
          <input type="month" value={historyFromMonth} onChange={(event) => setHistoryFromMonth(event.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6, flex: "0 1 190px", fontWeight: 900 }}>
          Till Month
          <input type="month" min={historyFromMonth || undefined} value={historyTillMonth} onChange={(event) => setHistoryTillMonth(event.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6, flex: "0 1 220px", fontWeight: 900 }}>
          Shop
          <select value={historyShop} onChange={(event) => setHistoryShop(event.target.value)}>
            <option>All Shops</option>
            {availableShops.map((shop) => <option key={`history-${shop}`}>{shop}</option>)}
          </select>
        </label>
        <button className="btn-blue" type="button" onClick={downloadExcel} style={{ whiteSpace: "nowrap", flex: "0 0 auto" }}>Download Excel</button>
        <span style={{ fontWeight: 900, paddingBottom: 12, whiteSpace: "nowrap", flex: "0 0 auto" }}>{searchedTransfers.length} records</span>
    </div>
    <div className="table-wrap"><table><thead><tr><th>Sent Date</th><th>Total</th><th>Collect From</th><th>Shop Breakdown</th><th>Status</th><th>Confirmed On</th><th>Remarks</th></tr></thead><tbody>
      {searchedTransfers.map((row) => <tr key={`search-${row.id}`}><td>{displayDate(row.sent_date)}</td><td style={{ fontWeight: 900 }}>{money(row.amount)}</td><td>{row.staff_name}</td><td>{breakdownOf(row).map((item) => `${item.shop} ${money(item.amount)}`).join(" · ")}</td><td>{row.status === "received" ? "Received" : "Waiting"}</td><td>{displayDate(row.confirmed_at, true)}</td><td>{row.remarks || "—"}</td></tr>)}
      {!searchedTransfers.length && <tr><td colSpan={7} style={{ textAlign: "center", color: "#64748b" }}>No matching records found.</td></tr>}
    </tbody></table></div>

    {confirming && <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15, 23, 42, 0.56)", display: "grid", placeItems: "center", padding: 18 }}><div className="modern-card" role="dialog" aria-modal="true" aria-labelledby="cash-confirm-title" style={{ width: "min(480px, 100%)", margin: 0 }}><h2 id="cash-confirm-title">Confirm Cash Received</h2><p>Confirm <strong>{money(confirming.amount)}</strong> collected from <strong>{confirming.staff_name}</strong>. The shop amounts will be added to Shop Cash Received.</p><label style={{ display: "grid", gap: 7, fontWeight: 900 }}>Administrator Password<input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirm(); }} placeholder="Enter password" /></label><div className="action-row" style={{ justifyContent: "flex-end", marginTop: 18 }}><button className="btn-gray" type="button" disabled={saving} onClick={() => { setConfirming(null); setPassword(""); }}>Cancel</button><button className="btn-blue" type="button" disabled={saving} onClick={confirm}>{saving ? "Confirming..." : "Confirm Received"}</button></div></div></div>}
  </section>;
}
