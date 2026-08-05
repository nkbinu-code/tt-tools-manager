"use client";

import { useMemo, useState } from "react";
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

  const pending = useMemo(() => transfers.filter((row) => row.status === "pending"), [transfers]);
  const confirmed = useMemo(() => transfers.filter((row) => row.status === "received").slice(0, 10), [transfers]);
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

    {confirming && <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15, 23, 42, 0.56)", display: "grid", placeItems: "center", padding: 18 }}><div className="modern-card" role="dialog" aria-modal="true" aria-labelledby="cash-confirm-title" style={{ width: "min(480px, 100%)", margin: 0 }}><h2 id="cash-confirm-title">Confirm Cash Received</h2><p>Confirm <strong>{money(confirming.amount)}</strong> collected from <strong>{confirming.staff_name}</strong>. The shop amounts will be added to Shop Cash Received.</p><label style={{ display: "grid", gap: 7, fontWeight: 900 }}>Administrator Password<input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirm(); }} placeholder="Enter password" /></label><div className="action-row" style={{ justifyContent: "flex-end", marginTop: 18 }}><button className="btn-gray" type="button" disabled={saving} onClick={() => { setConfirming(null); setPassword(""); }}>Cancel</button><button className="btn-blue" type="button" disabled={saving} onClick={confirm}>{saving ? "Confirming..." : "Confirm Received"}</button></div></div></div>}
  </section>;
}
