"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCollectionsData } from "../actions";

const shops = ["All Shops", "Karuvannur", "Ollur", "Kachery", "Mulayam Rd", "Pattikkad"];
const paymentModes = ["Cash", "UPI", "GPay", "Bank", "Card", "Other"];
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

const emptyPaymentRow = () => ({
  payment_date: today(),
  mobile: "",
  customer_id: "",
  customer_name: "",
  shop: "",
  outstanding: "",
  amount: "",
  discount: "",
  mode: "Cash",
  remarks: "",
});

const emptyCashRow = () => ({
  received_date: today(),
  shop: "",
  received_from: "",
  amount: "",
  mode: "Cash",
  remarks: "",
});

export default function PaymentsPage() {
  const [month, setMonth] = useState(thisMonth());
  const [shopFilter, setShopFilter] = useState("All Shops");
  const [customerFilter, setCustomerFilter] = useState("");
  const [search, setSearch] = useState("");

  const [customers, setCustomers] = useState<any[]>([]);
  const [pendingRows, setPendingRows] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [cashReceived, setCashReceived] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);

  const [paymentRows, setPaymentRows] = useState<any[]>(Array.from({ length: 5 }, emptyPaymentRow));
  const [cashRows, setCashRows] = useState<any[]>(Array.from({ length: 5 }, emptyCashRow));
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  function showMessage(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(""), 2500);
  }

  async function loadData() {
    const collectionsRes: any = await getCollectionsData();
    if (collectionsRes.success) setPendingRows(collectionsRes.data || []);

    const [{ data: customerData }, { data: paymentData }, { data: cashData }, { data: rentalData }, { data: saleData }] =
      await Promise.all([
        supabase.from("customers").select("*").order("customer_name", { ascending: true }),
        supabase.from("payments").select("*").order("payment_date", { ascending: false }),
        supabase.from("shop_cash_received").select("*").order("received_date", { ascending: false }),
        supabase.from("rentals").select("*"),
        supabase.from("sale_entries").select("*"),
      ]);

    setCustomers(customerData || []);
    setPayments(paymentData || []);
    setCashReceived(cashData || []);
    setRentals(rentalData || []);
    setSales(saleData || []);
  }

  function sameMonth(date: any) {
    return String(date || "").slice(0, 7) === month;
  }

  function matchShop(row: any) {
    return shopFilter === "All Shops" || row.shop === shopFilter || row.branch === shopFilter;
  }

  function money(row: any) {
    return Number(row.total || row.total_amount || row.rental_total || row.amount || row.total_sale || 0);
  }

  function updatePaymentRow(index: number, field: string, value: string) {
    setPaymentRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };

        if (field === "mobile") {
          const customer = customers.find((c) => String(c.mobile || "") === String(value || ""));
          const pending = pendingRows.find((p) => String(p.mobile || "") === String(value || ""));

          updated.customer_id = customer?.id || pending?.id || "";
          updated.customer_name = customer?.customer_name || customer?.name || pending?.customer_name || "";
          updated.shop = customer?.shop || pending?.shop || "";
          updated.outstanding = String(Number(pending?.balance || 0));
        }

        return updated;
      })
    );
  }

  function updateCashRow(index: number, field: string, value: string) {
    setCashRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function saveCustomerPayments() {
    const filled = paymentRows.filter(
      (row) => row.mobile && (Number(row.amount || 0) > 0 || Number(row.discount || 0) > 0)
    );

    if (filled.length === 0) return showMessage("Please enter at least one payment");

    const insertRows = filled.map((row) => ({
      payment_date: row.payment_date,
      customer_id: row.customer_id || null,
      customer_name: row.customer_name,
      mobile: row.mobile,
      shop: row.shop,
      amount: Number(row.amount || 0),
      discount: Number(row.discount || 0),
      mode: row.mode,
      remarks: row.remarks,
    }));

    const { error } = await supabase.from("payments").insert(insertRows);
    if (error) return showMessage(error.message);

    setPaymentRows(Array.from({ length: 5 }, emptyPaymentRow));
    await loadData();
    showMessage("Payments saved");
  }

  async function saveShopCash() {
    const filled = cashRows.filter((row) => row.shop && Number(row.amount || 0) > 0);
    if (filled.length === 0) return showMessage("Please enter at least one cash received row");

    const insertRows = filled.map((row) => ({
      received_date: row.received_date,
      shop: row.shop,
      received_from: row.received_from,
      amount: Number(row.amount || 0),
      mode: row.mode,
      remarks: row.remarks,
    }));

    const { error } = await supabase.from("shop_cash_received").insert(insertRows);
    if (error) return showMessage(error.message);

    setCashRows(Array.from({ length: 5 }, emptyCashRow));
    await loadData();
    showMessage("Cash received saved");
  }

  const selectedCustomer = useMemo(() => {
    if (!customerFilter) return null;
    return customers.find((c) => String(c.mobile || "") === String(customerFilter || null));
  }, [customers, customerFilter]);

  const selectedPending = useMemo(() => {
    if (!customerFilter) return null;
    return pendingRows.find((p) => String(p.mobile || "") === String(customerFilter));
  }, [pendingRows, customerFilter]);

  const monthRentals = rentals.filter((r) => sameMonth(r.date || r.start_date || r.rental_date) && matchShop(r));
  const monthSales = sales.filter((s) => sameMonth(s.sale_date) && matchShop(s));
  const monthPayments = payments.filter((p) => sameMonth(p.payment_date) && matchShop(p));
  const monthCash = cashReceived.filter((c) => sameMonth(c.received_date) && matchShop(c));

  const monthBusiness =
    monthRentals.reduce((sum, r) => sum + money(r), 0) +
    monthSales.reduce((sum, s) => sum + Number(s.total_sale || 0), 0);

  const monthPaymentTotal = monthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const monthCashTotal = monthCash.reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const filteredPending =
    shopFilter === "All Shops" ? pendingRows : pendingRows.filter((row) => row.shop === shopFilter);

  const outstandingTotal = filteredPending.reduce((sum, row) => sum + Number(row.balance || 0), 0);

  const customerPayments = customerFilter
    ? payments.filter((p) => String(p.mobile || "") === String(customerFilter))
    : [];

  const customerPaid = customerPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const customerDiscount = customerPayments.reduce((sum, p) => sum + Number(p.discount || 0), 0);

  const customerRentals = customerFilter
    ? rentals.filter((r) => String(r.mobile || r.customer_mobile || "") === String(customerFilter))
    : [];

  const visiblePayments = payments.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      String(p.customer_name || "").toLowerCase().includes(q) ||
      String(p.mobile || "").includes(q) ||
      String(p.remarks || "").toLowerCase().includes(q);

    const matchMonth = sameMonth(p.payment_date);
    const matchSelectedShop = shopFilter === "All Shops" || p.shop === shopFilter;
    const matchCustomer = !customerFilter || String(p.mobile || "") === String(customerFilter);

    return matchSearch && matchMonth && matchSelectedShop && matchCustomer;
  });

  function downloadCsv() {
    const header = ["Date", "Customer", "Mobile", "Shop", "Amount", "Discount", "Mode", "Remarks"];
    const rows = visiblePayments.map((p) => [
      p.payment_date,
      p.customer_name,
      p.mobile,
      p.shop,
      p.amount,
      p.discount,
      p.mode,
      p.remarks,
    ]);

    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c || "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "T&T_Payments.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <h1 className="page-title">Payments</h1>
      <p className="page-subtitle">Customer payments, discounts and cash received from shops</p>

      {message && <div className="modern-message">{message}</div>}

      <section className="modern-card">
        <div className="filter-row sales-filter">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />

          <select value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}>
            {shops.map((shop) => (
              <option key={shop}>{shop}</option>
            ))}
          </select>

          <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
            <option value="">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.mobile}>
                {c.mobile} - {c.customer_name || c.name}
              </option>
            ))}
          </select>

          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search payment..." />
        </div>
      </section>

      <div className="kpi-grid">
        <Kpi title="Month Business" value={`₹${monthBusiness.toFixed(0)}`} />
        <Kpi title="Payments Received" value={`₹${monthPaymentTotal.toFixed(0)}`} />
        <Kpi title="Cash From Shops" value={`₹${monthCashTotal.toFixed(0)}`} />
        <Kpi title="Pending Balance" value={`₹${outstandingTotal.toFixed(0)}`} />
      </div>

      {customerFilter && (
        <section className="modern-card">
          <SectionHeader title="Customer Summary" subtitle="Full balance view for selected customer" />

          <div className="kpi-grid">
            <Kpi title="Rental Total" value={`₹${Number(selectedPending?.rental_total || 0).toFixed(0)}`} />
            <Kpi title="Total Paid" value={`₹${customerPaid.toFixed(0)}`} />
            <Kpi title="Discount" value={`₹${customerDiscount.toFixed(0)}`} />
            <Kpi title="Outstanding" value={`₹${Number(selectedPending?.balance || 0).toFixed(0)}`} />
          </div>

          <div style={{ fontWeight: 900, marginBottom: 12 }}>
            {selectedCustomer?.customer_name || selectedCustomer?.name || selectedPending?.customer_name} • {customerFilter} •{" "}
            {selectedCustomer?.shop || selectedPending?.shop}
          </div>

          <h2>Pending Rentals / Balance Details</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Start Date</th>
                  <th>End / Live</th>
                  <th>Days</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {customerRentals.map((r, i) => (
                  <tr key={r.id || i}>
                    <td><strong>{r.tool_name || r.tool || "-"}</strong></td>
                    <td>{r.start_date || r.date || "-"}</td>
                    <td>{r.end_date || r.return_date || "Live"}</td>
                    <td>{r.days || "-"}</td>
                    <td className="strong">₹{money(r).toFixed(0)}</td>
                  </tr>
                ))}
                {customerRentals.length === 0 && (
                  <tr>
                    <td colSpan={5}>No rental details found for this customer</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="modern-card">
        <SectionHeader
          title="Customer Payments"
          subtitle="Select mobile number. Customer, shop and outstanding auto-fill."
          right={
            <div className="action-row">
              <button className="btn-gray" onClick={() => setPaymentRows([...paymentRows, ...Array.from({ length: 5 }, emptyPaymentRow)])}>
                + Add 5 Rows
              </button>
              <button className="btn-blue" onClick={saveCustomerPayments}>Save Payments</button>
            </div>
          }
        />

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Mobile</th><th>Customer</th><th>Shop</th><th>Outstanding</th><th>Amount</th><th>Discount</th><th>Mode</th><th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.map((row, index) => (
                <tr key={index}>
                  <td><input type="date" value={row.payment_date} onChange={(e) => updatePaymentRow(index, "payment_date", e.target.value)} /></td>
                  <td>
                    <select value={row.mobile} onChange={(e) => updatePaymentRow(index, "mobile", e.target.value)}>
                      <option value="">Mobile</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.mobile}>{c.mobile} - {c.customer_name || c.name}</option>
                      ))}
                    </select>
                  </td>
                  <td><input value={row.customer_name} readOnly /></td>
                  <td><input value={row.shop} readOnly /></td>
                  <td><input value={`₹${Number(row.outstanding || 0).toFixed(0)}`} readOnly /></td>
                  <td><input type="number" value={row.amount} onChange={(e) => updatePaymentRow(index, "amount", e.target.value)} /></td>
                  <td><input type="number" value={row.discount} onChange={(e) => updatePaymentRow(index, "discount", e.target.value)} /></td>
                  <td>
                    <select value={row.mode} onChange={(e) => updatePaymentRow(index, "mode", e.target.value)}>
                      {paymentModes.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </td>
                  <td><input value={row.remarks} onChange={(e) => updatePaymentRow(index, "remarks", e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="modern-card">
        <SectionHeader
          title="Cash Received from Shop"
          subtitle="Money physically received from each branch"
          right={
            <div className="action-row">
              <button className="btn-gray" onClick={() => setCashRows([...cashRows, ...Array.from({ length: 5 }, emptyCashRow)])}>
                + Add 5 Rows
              </button>
              <button className="btn-blue" onClick={saveShopCash}>Save Cash</button>
            </div>
          }
        />

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Shop</th><th>Received From</th><th>Amount</th><th>Mode</th><th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {cashRows.map((row, index) => (
                <tr key={index}>
                  <td><input type="date" value={row.received_date} onChange={(e) => updateCashRow(index, "received_date", e.target.value)} /></td>
                  <td>
                    <select value={row.shop} onChange={(e) => updateCashRow(index, "shop", e.target.value)}>
                      <option value="">Shop</option>
                      {shops.filter((s) => s !== "All Shops").map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><input value={row.received_from} onChange={(e) => updateCashRow(index, "received_from", e.target.value)} /></td>
                  <td><input type="number" value={row.amount} onChange={(e) => updateCashRow(index, "amount", e.target.value)} /></td>
                  <td>
                    <select value={row.mode} onChange={(e) => updateCashRow(index, "mode", e.target.value)}>
                      {paymentModes.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </td>
                  <td><input value={row.remarks} onChange={(e) => updateCashRow(index, "remarks", e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="modern-card">
        <SectionHeader
          title="Payment History"
          subtitle="Selected month payment records"
          right={<button className="btn-blue" onClick={downloadCsv}><Download size={16} /> Download</button>}
        />

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Customer</th><th>Mobile</th><th>Shop</th><th>Amount</th><th>Discount</th><th>Mode</th><th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {visiblePayments.map((p) => (
                <tr key={p.id}>
                  <td>{p.payment_date}</td>
                  <td><strong>{p.customer_name}</strong></td>
                  <td>{p.mobile}</td>
                  <td>{p.shop}</td>
                  <td className="strong">₹{Number(p.amount || 0).toFixed(0)}</td>
                  <td>₹{Number(p.discount || 0).toFixed(0)}</td>
                  <td>{p.mode}</td>
                  <td>{p.remarks}</td>
                </tr>
              ))}
              {visiblePayments.length === 0 && (
                <tr><td colSpan={8}>No payments found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="modern-card">
        <SectionHeader title="Shop Summary" subtitle="Month-wise branch business and cash received" />

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Shop</th><th>Business</th><th>Payments</th><th>Cash Received</th><th>Pending Balance</th>
              </tr>
            </thead>
            <tbody>
              {shops.filter((s) => s !== "All Shops").map((shop) => {
                const business =
                  rentals.filter((r) => sameMonth(r.date || r.start_date || r.rental_date) && (r.shop === shop || r.branch === shop)).reduce((sum, r) => sum + money(r), 0) +
                  sales.filter((s) => sameMonth(s.sale_date) && s.shop === shop).reduce((sum, s) => sum + Number(s.total_sale || 0), 0);

                const pay = payments.filter((p) => sameMonth(p.payment_date) && p.shop === shop).reduce((sum, p) => sum + Number(p.amount || 0), 0);
                const cash = cashReceived.filter((c) => sameMonth(c.received_date) && c.shop === shop).reduce((sum, c) => sum + Number(c.amount || 0), 0);
                const balance = pendingRows.filter((p) => p.shop === shop).reduce((sum, p) => sum + Number(p.balance || 0), 0);

                return (
                  <tr key={shop}>
                    <td><strong>{shop}</strong></td>
                    <td>₹{business.toFixed(0)}</td>
                    <td>₹{pay.toFixed(0)}</td>
                    <td>₹{cash.toFixed(0)}</td>
                    <td className="red strong">₹{balance.toFixed(0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Kpi({ title, value }: any) {
  return (
    <div className="kpi-card">
      <div style={{ flex: 1 }}>
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{title}</div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, right }: any) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}