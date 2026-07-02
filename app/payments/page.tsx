"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getPaymentsData, moveCustomerBalanceToArrears } from "./actions";
import { useAppMessage } from "../contexts/AppMessageProvider";
import {
  calcCustomerTotals,
  calcRentalAmount,
  countDays,
  rowMobile,
  rowToolName,
} from "../calculations";

const shops = [
  "All Shops",
  "Karuvannur",
  "Ollur",
  "Kachery",
  "Mulayam Rd",
  "Pattikkad",
];

const paymentModes = ["Cash", "UPI", "GPay", "Bank", "Card", "Other"];

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

const emptyPaymentRow = () => ({
  payment_date: today(),
  rental_id: "",
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
  const { setAppMessage } = useAppMessage();

  const [month, setMonth] = useState(thisMonth());
  const [shopFilter, setShopFilter] = useState("All Shops");
  const [customerFilter, setCustomerFilter] = useState("");

  const [customers, setCustomers] = useState<any[]>([]);
  const [pendingRows, setPendingRows] = useState<any[]>([]);
  const [pendingReturnedRentals, setPendingReturnedRentals] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [cashReceived, setCashReceived] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [arrears, setArrears] = useState<any[]>([]);

  const [paymentRows, setPaymentRows] = useState<any[]>(
    Array.from({ length: 5 }, emptyPaymentRow)
  );
  const [cashRows, setCashRows] = useState<any[]>(
    Array.from({ length: 5 }, emptyCashRow)
  );

  const [arrearsPopup, setArrearsPopup] = useState<any>(null);
  const [arrearsReason, setArrearsReason] = useState("");
  const [arrearsRemarks, setArrearsRemarks] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  function showError(message: string) {
    setAppMessage({ type: "error", title: "Error", message });
  }

  function showSuccess(message: string) {
    setAppMessage({ type: "success", title: "Success", message });
  }

  function showWarning(message: string) {
    setAppMessage({ type: "warning", title: "Warning", message });
  }

  async function loadData() {
    const paymentsRes: any = await getPaymentsData();

    if (paymentsRes.success) {
      setPendingRows(paymentsRes.data || []);
      setPendingReturnedRentals(paymentsRes.pendingReturnedRentals || []);
    } else {
      showError(paymentsRes.message || "Failed to load payments data");
    }

    const [
      { data: customerData },
      { data: paymentData },
      { data: cashData },
      { data: rentalData },
      { data: toolData },
      { data: saleData },
      { data: arrearsData },
    ] = await Promise.all([
      supabase.from("customers").select("*").order("customer_name", { ascending: true }),
      supabase.from("payments").select("*").order("payment_date", { ascending: false }),
      supabase.from("shop_cash_received").select("*").order("received_date", { ascending: false }),
      supabase.from("rentals").select("*"),
      supabase.from("tools").select("*"),
      supabase.from("sale_entries").select("*"),
      supabase.from("customer_arrears").select("*").order("moved_date", { ascending: false }),
    ]);

    setCustomers(customerData || []);
    setPayments(paymentData || []);
    setCashReceived(cashData || []);
    setRentals(rentalData || []);
    setTools(toolData || []);
    setSales(saleData || []);
    setArrears(arrearsData || []);
  }

  function sameMonth(date: any) {
    return String(date || "").slice(0, 7) === month;
  }

  function matchShop(row: any) {
    return shopFilter === "All Shops" || row.shop === shopFilter || row.branch === shopFilter;
  }

  function findCustomerByMobile(mobile: string) {
    return customers.find(
      (c) => String(c.mobile || "").trim() === String(mobile || "").trim()
    );
  }

  function findPendingByMobile(mobile: string) {
    return pendingRows.find(
      (p) => String(p.mobile || "").trim() === String(mobile || "").trim()
    );
  }

  function getCustomerArrearsAmount(mobile: string, customerId?: any) {
    return arrears
      .filter(
        (a) =>
          String(a.mobile || "").trim() === String(mobile || "").trim() ||
          (customerId &&
            String(a.customer_id || "").trim() === String(customerId || "").trim())
      )
      .reduce((sum, a) => sum + Number(a.arrears_amount || 0), 0);
  }

  function updatePaymentRow(index: number, field: string, value: string) {
    setPaymentRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;

        const updated = { ...row, [field]: value };

        if (field === "mobile") {
          const customer = findCustomerByMobile(value);
          const pending =
            pendingReturnedRentals.find(
              (p) => String(p.mobile || "").trim() === String(value || "").trim()
            ) || findPendingByMobile(value);

          updated.customer_id = customer?.id || pending?.id || "";
          updated.customer_name =
            customer?.customer_name ||
            customer?.name ||
            pending?.customer_name ||
            "";
          updated.shop = customer?.shop || customer?.branch || pending?.shop || "";
          updated.outstanding = String(Number(pending?.balance || 0));
        }

        return updated;
      })
    );
  }

  function receivePendingRental(row: any) {
    const paymentRow = {
      payment_date: today(),
      rental_id: row.rental_id || row.id || "",
      mobile: row.mobile || "",
      customer_id: row.customer_id || "",
      customer_name: row.customer_name || "",
      shop: row.shop || "",
      outstanding: String(Number(row.balance || 0)),
      amount: "",
      discount: "",
      mode: "Cash",
      remarks: row.tool_name ? `Payment for ${row.tool_name}` : "Rental payment",
    };

    setPaymentRows((prev) => {
      const next = [...prev];
      const emptyIndex = next.findIndex(
        (r) =>
          !r.mobile &&
          !r.customer_name &&
          !r.amount &&
          !r.discount &&
          !r.rental_id
      );

      if (emptyIndex >= 0) {
        next[emptyIndex] = paymentRow;
        return next;
      }

      return [paymentRow, ...next];
    });

    setCustomerFilter(row.mobile || "");
    showSuccess("Payment row filled. Enter amount and save payment.");
  }

  function updateCashRow(index: number, field: string, value: string) {
    setCashRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  async function saveCustomerPayments() {
    const filled = paymentRows.filter(
      (row) =>
        row.mobile &&
        (Number(row.amount || 0) > 0 || Number(row.discount || 0) > 0)
    );

    if (filled.length === 0) {
      showWarning("Please enter at least one payment");
      return;
    }

    const insertRows = filled.map((row) => ({
      payment_date: row.payment_date,
      rental_id: row.rental_id || null,
      customer_id: row.customer_id || null,
      customer_name: row.customer_name,
      mobile: row.mobile,
      shop: row.shop,
      amount: Number(row.amount || 0),
      discount: Number(row.discount || 0),
      mode: row.mode,
      payment_mode: row.mode,
      remarks: row.remarks,
    }));

    const { error } = await supabase.from("payments").insert(insertRows);

    if (error) {
      showError(error.message);
      return;
    }

    setPaymentRows(Array.from({ length: 5 }, emptyPaymentRow));
    await loadData();
    showSuccess("Payments saved successfully");
  }

  async function saveShopCash() {
    const filled = cashRows.filter(
      (row) => row.shop && Number(row.amount || 0) > 0
    );

    if (filled.length === 0) {
      showWarning("Please enter at least one cash received row");
      return;
    }

    const insertRows = filled.map((row) => ({
      received_date: row.received_date,
      shop: row.shop,
      received_from: row.received_from,
      amount: Number(row.amount || 0),
      mode: row.mode,
      payment_mode: row.mode,
      remarks: row.remarks,
    }));

    const { error } = await supabase.from("shop_cash_received").insert(insertRows);

    if (error) {
      showError(error.message);
      return;
    }

    setCashRows(Array.from({ length: 5 }, emptyCashRow));
    await loadData();
    showSuccess("Cash received saved successfully");
  }

  function openArrearsPopup() {
    if (!selectedMobile || selectedBalance <= 0) {
      showWarning("No balance amount to move");
      return;
    }

    setArrearsReason("");
    setArrearsRemarks("");

    setArrearsPopup({
      customer_id: selectedCustomer?.id || selectedPending?.id || null,
      customer_name:
        selectedCustomer?.customer_name ||
        selectedCustomer?.name ||
        selectedPending?.customer_name ||
        "",
      mobile: selectedMobile,
      shop: selectedCustomer?.shop || selectedPending?.shop || "",
      amount: selectedBalance,
    });
  }

  async function confirmMoveToArrears() {
    if (!arrearsPopup) return;

    const res: any = await moveCustomerBalanceToArrears({
      ...arrearsPopup,
      reason: arrearsReason,
      remarks: arrearsRemarks,
    });

    if (!res.success) {
      showError(res.message || "Failed to move balance to arrears");
      return;
    }

    setArrearsPopup(null);
    setCustomerFilter("");
    await loadData();
    showSuccess("Balance moved to arrears successfully");
  }

  const selectedMobile = String(customerFilter || "").trim();

  const selectedCustomer = useMemo(() => {
    if (!selectedMobile) return null;
    return findCustomerByMobile(selectedMobile);
  }, [customers, selectedMobile]);

  const selectedPending = useMemo(() => {
    if (!selectedMobile) return null;
    return findPendingByMobile(selectedMobile);
  }, [pendingRows, selectedMobile]);

  const selectedTotals = useMemo(() => {
    if (!selectedMobile) {
      return {
        totalBusiness: 0,
        totalPaid: 0,
        totalDiscount: 0,
        balance: 0,
        rentals: [],
        payments: [],
      };
    }

    const customer = selectedCustomer || selectedPending || {
      mobile: selectedMobile,
      id: selectedPending?.id || "",
      customer_name: selectedPending?.customer_name || "",
    };

    return calcCustomerTotals(customer, rentals, payments);
  }, [selectedMobile, selectedCustomer, selectedPending, rentals, payments]);

  const selectedCustomerRentals = selectedTotals.rentals || [];

  const selectedTotalSalesBusiness = selectedMobile
    ? sales
        .filter((s) => rowMobile(s) === selectedMobile)
        .reduce((sum, s) => sum + Number(s.total_sale || 0), 0)
    : 0;

  const selectedTotalBusiness =
    Number(selectedTotals.totalBusiness || 0) + selectedTotalSalesBusiness;

  const selectedCashReceived = Number(selectedTotals.totalPaid || 0);
  const selectedDiscount = Number(selectedTotals.totalDiscount || 0);

  const selectedAlreadyArrears = selectedMobile
    ? getCustomerArrearsAmount(
        selectedMobile,
        selectedCustomer?.id || selectedPending?.id
      )
    : 0;

  const selectedBalance = Math.max(
    0,
    selectedTotalBusiness -
      selectedCashReceived -
      selectedDiscount -
      selectedAlreadyArrears
  );

  const monthRentals = rentals.filter(
    (r) => sameMonth(r.date || r.start_date || r.rental_date) && matchShop(r)
  );

  const monthSales = sales.filter((s) => sameMonth(s.sale_date) && matchShop(s));

  const monthPayments = payments.filter(
    (p) => sameMonth(p.payment_date) && matchShop(p)
  );

  const monthCash = cashReceived.filter(
    (c) => sameMonth(c.received_date) && matchShop(c)
  );

  const monthBusiness =
    monthRentals.reduce((sum, r) => sum + calcRentalAmount(r), 0) +
    monthSales.reduce((sum, s) => sum + Number(s.total_sale || 0), 0);

  const monthPaymentTotal = monthPayments.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );

  const monthCashTotal = monthCash.reduce(
    (sum, c) => sum + Number(c.amount || 0),
    0
  );

  const filteredReturnedPending =
    shopFilter === "All Shops"
      ? pendingReturnedRentals
      : pendingReturnedRentals.filter((row) => row.shop === shopFilter);

  const returnedPendingTotal = filteredReturnedPending.reduce(
    (sum, row) => sum + Number(row.balance || 0),
    0
  );

  const filteredPending =
    shopFilter === "All Shops"
      ? pendingRows
      : pendingRows.filter((row) => row.shop === shopFilter);

  const outstandingTotal = filteredPending.reduce(
    (sum, row) => sum + Number(row.balance || 0),
    0
  );

  const filteredArrears =
    shopFilter === "All Shops"
      ? arrears
      : arrears.filter((row) => row.shop === shopFilter);

  const totalArrears = filteredArrears.reduce(
    (sum, row) => sum + Number(row.arrears_amount || 0),
    0
  );

  const shopWiseArrears = shops
    .filter((s) => s !== "All Shops")
    .map((shop) => ({
      shop,
      amount: arrears
        .filter((a) => a.shop === shop)
        .reduce((sum, a) => sum + Number(a.arrears_amount || 0), 0),
    }));

  const yearWiseArrears = Object.values(
    arrears.reduce((acc: any, a) => {
      const year =
        a.moved_year || String(a.moved_date || "").slice(0, 4) || "Unknown";

      if (!acc[year]) acc[year] = { year, amount: 0 };
      acc[year].amount += Number(a.arrears_amount || 0);
      return acc;
    }, {})
  ).sort((a: any, b: any) => String(b.year).localeCompare(String(a.year)));

  const visiblePayments = payments.filter((p) => {
    const matchMonth = sameMonth(p.payment_date);
    const matchSelectedShop = shopFilter === "All Shops" || p.shop === shopFilter;
    const matchCustomer =
      !selectedMobile || String(p.mobile || "").trim() === selectedMobile;

    return matchMonth && matchSelectedShop && matchCustomer;
  });

  const visibleArrears = arrears.filter((a) => {
    const matchSelectedShop = shopFilter === "All Shops" || a.shop === shopFilter;
    const matchCustomer =
      !selectedMobile || String(a.mobile || "").trim() === selectedMobile;

    return matchSelectedShop && matchCustomer;
  });

  const rentalDetailsTotal = selectedCustomerRentals.reduce(
    (sum, r) => sum + calcRentalAmount(r),
    0
  );

  function downloadCsv() {
    const header = [
      "Date",
      "Customer",
      "Mobile",
      "Shop",
      "Amount",
      "Discount",
      "Mode",
      "Remarks",
    ];

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

    const csv = [header, ...rows]
      .map((r) =>
        r.map((c) => `"${String(c || "").replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");

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
      <p className="page-subtitle">
        Customer payments, discounts, shop cash received and arrears
      </p>

      {arrearsPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              background: "white",
              borderRadius: 22,
              padding: 24,
              boxShadow: "0 25px 80px rgba(0,0,0,0.35)",
              border: "1px solid #dbeafe",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 28, color: "#0f172a" }}>
              Move Balance to Arrears
            </h2>

            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                fontWeight: 900,
                lineHeight: 1.8,
              }}
            >
              <div>Customer: {arrearsPopup.customer_name}</div>
              <div>Mobile: {arrearsPopup.mobile}</div>
              <div>Shop: {arrearsPopup.shop || "-"}</div>
              <div style={{ fontSize: 26, color: "#0057ff" }}>
                Amount: ₹{Number(arrearsPopup.amount || 0).toFixed(0)}
              </div>
            </div>

            <label style={{ fontWeight: 900 }}>Reason</label>
            <input
              value={arrearsReason}
              onChange={(e) => setArrearsReason(e.target.value)}
              placeholder="Long pending / customer not paying..."
              style={{ width: "100%", marginBottom: 12 }}
            />

            <label style={{ fontWeight: 900 }}>Remarks</label>
            <textarea
              value={arrearsRemarks}
              onChange={(e) => setArrearsRemarks(e.target.value)}
              placeholder="Any notes..."
              rows={3}
              style={{ width: "100%", marginBottom: 18 }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button className="btn-gray" onClick={() => setArrearsPopup(null)}>
                Cancel
              </button>

              <button className="btn-blue" onClick={confirmMoveToArrears}>
                Move to Arrears
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="kpi-grid">
        <Kpi title="Month Business" value={`₹${monthBusiness.toFixed(0)}`} />
        <Kpi title="Payments Received" value={`₹${monthPaymentTotal.toFixed(0)}`} />
        <Kpi title="Cash From Shops" value={`₹${monthCashTotal.toFixed(0)}`} />
        <Kpi title="Pending Returned" value={`₹${returnedPendingTotal.toFixed(0)}`} />
        <Kpi title="Total Arrears" value={`₹${totalArrears.toFixed(0)}`} />
      </div>

      <section className="modern-card">
        <SectionHeader
          title="Pending Returned Rentals"
          subtitle="Returned tools waiting for payment. Use shop dropdown in Search & Results to filter."
        />

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Return Date</th>
                <th>Customer</th>
                <th>Mobile</th>
                <th>Tool</th>
                <th>Shop</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Discount</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredReturnedPending.map((row, index) => (
                <tr key={`${row.rental_id || row.id || "rental"}-${index}`}>
                  <td>{row.return_date || row.end_date || "-"}</td>
                  <td>
                    <strong>{row.customer_name || "-"}</strong>
                  </td>
                  <td>{row.mobile || "-"}</td>
                  <td>{row.tool_name || "-"}</td>
                  <td>{row.shop || "-"}</td>
                  <td className="strong">₹{Number(row.amount || 0).toFixed(0)}</td>
                  <td>₹{Number(row.paid || 0).toFixed(0)}</td>
                  <td>₹{Number(row.discount || 0).toFixed(0)}</td>
                  <td className="strong">₹{Number(row.balance || 0).toFixed(0)}</td>
                  <td>{row.payment_status}</td>
                  <td>
                    <button
                      className="btn-blue"
                      type="button"
                      onClick={() => receivePendingRental(row)}
                    >
                      Receive Payment
                    </button>
                  </td>
                </tr>
              ))}

              {filteredReturnedPending.length === 0 && (
                <tr>
                  <td colSpan={11}>No pending returned rentals found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="modern-card">
        <SectionHeader
          title="Customer Payments"
          subtitle="Type mobile number. Customer, shop and outstanding auto-fill."
          right={
            <div className="action-row">
              <button
                className="btn-gray"
                onClick={() =>
                  setPaymentRows([
                    ...paymentRows,
                    ...Array.from({ length: 5 }, emptyPaymentRow),
                  ])
                }
              >
                + Add 5 Rows
              </button>

              <button className="btn-blue" onClick={saveCustomerPayments}>
                Save Payments
              </button>
            </div>
          }
        />

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Mobile</th>
                <th>Customer</th>
                <th>Shop</th>
                <th>Outstanding</th>
                <th>Amount</th>
                <th>Discount</th>
                <th>Mode</th>
                <th>Remarks</th>
              </tr>
            </thead>

            <tbody>
              {paymentRows.map((row, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="date"
                      value={row.payment_date}
                      onChange={(e) =>
                        updatePaymentRow(index, "payment_date", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      list="paymentCustomerMobileList"
                      value={row.mobile}
                      onChange={(e) =>
                        updatePaymentRow(index, "mobile", e.target.value)
                      }
                      placeholder="Type mobile"
                    />
                  </td>

                  <td>
                    <input value={row.customer_name} readOnly />
                  </td>

                  <td>
                    <input value={row.shop} readOnly />
                  </td>

                  <td>
                    <input
                      value={`₹${Number(row.outstanding || 0).toFixed(0)}`}
                      readOnly
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={row.amount}
                      onChange={(e) =>
                        updatePaymentRow(index, "amount", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={row.discount}
                      onChange={(e) =>
                        updatePaymentRow(index, "discount", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <select
                      value={row.mode}
                      onChange={(e) =>
                        updatePaymentRow(index, "mode", e.target.value)
                      }
                    >
                      {paymentModes.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <input
                      value={row.remarks}
                      onChange={(e) =>
                        updatePaymentRow(index, "remarks", e.target.value)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <datalist id="paymentCustomerMobileList">
            {customers.map((c) => (
              <option key={c.id} value={c.mobile} label={c.customer_name || c.name} />
            ))}
          </datalist>
        </div>
      </section>

      <section className="modern-card">
        <SectionHeader title="Search & Results" subtitle="Filter by month, shop and mobile number" />

        <div className="filter-row sales-filter">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />

          <select value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}>
            {shops.map((shop) => (
              <option key={shop}>{shop}</option>
            ))}
          </select>

          <input
            list="filterCustomerMobileList"
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            placeholder="Type mobile number..."
          />

          <datalist id="filterCustomerMobileList">
            {customers.map((c) => (
              <option key={c.id} value={c.mobile} label={c.customer_name || c.name} />
            ))}
          </datalist>
        </div>
      </section>

      {selectedMobile && (
        <section className="modern-card">
          <SectionHeader
            title="Customer Summary"
            subtitle="Selected customer's total business, cash received, discounts, balance and arrears"
            right={
              <button
                className="btn-blue"
                onClick={openArrearsPopup}
                disabled={selectedBalance <= 0}
              >
                <Archive size={16} /> Move to Arrears
              </button>
            }
          />

          <div className="kpi-grid">
            <Kpi title="Total Business" value={`₹${selectedTotalBusiness.toFixed(0)}`} />
            <Kpi title="Cash Received" value={`₹${selectedCashReceived.toFixed(0)}`} />
            <Kpi title="Discount" value={`₹${selectedDiscount.toFixed(0)}`} />
            <Kpi title="Already in Arrears" value={`₹${selectedAlreadyArrears.toFixed(0)}`} />
            <Kpi title="Current Balance" value={`₹${selectedBalance.toFixed(0)}`} />
          </div>

          <div style={{ fontWeight: 900, marginBottom: 12, lineHeight: 1.7 }}>
            <div>
              {selectedCustomer?.customer_name ||
                selectedCustomer?.name ||
                selectedPending?.customer_name}{" "}
              • {selectedMobile}
            </div>
            <div>Shop: {selectedCustomer?.shop || selectedPending?.shop || "-"}</div>
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
                {selectedCustomerRentals.map((r, i) => {
                  const days = countDays(
                    r.start_date || r.date || r.rental_date,
                    r.end_date || r.return_date,
                    r.avoid_sundays !== false
                  );

                  return (
                    <tr key={r.id || i}>
                      <td>
                        <strong>{rowToolName(r) || "-"}</strong>
                      </td>
                      <td>{r.start_date || r.date || "-"}</td>
                      <td>{r.end_date || r.return_date || "Live"}</td>
                      <td>{days}</td>
                      <td className="strong">₹{calcRentalAmount(r).toFixed(0)}</td>
                    </tr>
                  );
                })}

                {selectedCustomerRentals.length > 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "right", fontWeight: 950 }}>
                      Total
                    </td>
                    <td className="strong">₹{rentalDetailsTotal.toFixed(0)}</td>
                  </tr>
                )}

                {selectedCustomerRentals.length === 0 && (
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
        <SectionHeader title="Arrears Summary" subtitle="Shop-wise and year-wise arrears total" />

        <div className="kpi-grid">
          {shopWiseArrears.map((row) => (
            <Kpi key={row.shop} title={row.shop} value={`₹${Number(row.amount || 0).toFixed(0)}`} />
          ))}
        </div>

        <h2 style={{ marginTop: 24 }}>Year-wise Arrears</h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Total Arrears</th>
              </tr>
            </thead>

            <tbody>
              {yearWiseArrears.map((row: any) => (
                <tr key={row.year}>
                  <td>
                    <strong>{row.year}</strong>
                  </td>
                  <td className="strong">₹{Number(row.amount || 0).toFixed(0)}</td>
                </tr>
              ))}

              {yearWiseArrears.length === 0 && (
                <tr>
                  <td colSpan={2}>No arrears found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="modern-card">
        <SectionHeader title="Arrears History" subtitle="Customer-wise arrears records" />

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Mobile</th>
                <th>Shop</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Remarks</th>
              </tr>
            </thead>

            <tbody>
              {visibleArrears.map((a, index) => (
                <tr key={`${a.id || "arrears"}-${index}`}>
                  <td>{a.moved_date}</td>
                  <td>
                    <strong>{a.customer_name}</strong>
                  </td>
                  <td>{a.mobile}</td>
                  <td>{a.shop}</td>
                  <td className="strong">₹{Number(a.arrears_amount || 0).toFixed(0)}</td>
                  <td>{a.reason}</td>
                  <td>{a.remarks}</td>
                </tr>
              ))}

              {visibleArrears.length === 0 && (
                <tr>
                  <td colSpan={7}>No arrears found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="modern-card">
        <SectionHeader
          title="Payment History"
          subtitle="Selected month payment records"
          right={
            <button className="btn-blue" onClick={downloadCsv}>
              <Download size={16} /> Download
            </button>
          }
        />

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Mobile</th>
                <th>Shop</th>
                <th>Amount</th>
                <th>Discount</th>
                <th>Mode</th>
                <th>Remarks</th>
              </tr>
            </thead>

            <tbody>
              {visiblePayments.map((p, index) => (
                <tr key={`${p.id || "payment"}-${index}`}>
                  <td>{p.payment_date}</td>
                  <td>
                    <strong>{p.customer_name}</strong>
                  </td>
                  <td>{p.mobile}</td>
                  <td>{p.shop}</td>
                  <td className="strong">₹{Number(p.amount || 0).toFixed(0)}</td>
                  <td>₹{Number(p.discount || 0).toFixed(0)}</td>
                  <td>{p.mode}</td>
                  <td>{p.remarks}</td>
                </tr>
              ))}

              {visiblePayments.length === 0 && (
                <tr>
                  <td colSpan={8}>No payments found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="modern-card">
        <SectionHeader
          title="Cash Received from Shop"
          subtitle="Money physically received from each shop"
          right={
            <div className="action-row">
              <button
                className="btn-gray"
                onClick={() =>
                  setCashRows([
                    ...cashRows,
                    ...Array.from({ length: 5 }, emptyCashRow),
                  ])
                }
              >
                + Add 5 Rows
              </button>

              <button className="btn-blue" onClick={saveShopCash}>
                Save Cash
              </button>
            </div>
          }
        />

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Shop</th>
                <th>Received From</th>
                <th>Amount</th>
                <th>Mode</th>
                <th>Remarks</th>
              </tr>
            </thead>

            <tbody>
              {cashRows.map((row, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="date"
                      value={row.received_date}
                      onChange={(e) =>
                        updateCashRow(index, "received_date", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <select
                      value={row.shop}
                      onChange={(e) => updateCashRow(index, "shop", e.target.value)}
                    >
                      <option value="">Shop</option>
                      {shops
                        .filter((s) => s !== "All Shops")
                        .map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                    </select>
                  </td>

                  <td>
                    <input
                      value={row.received_from}
                      onChange={(e) =>
                        updateCashRow(index, "received_from", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={row.amount}
                      onChange={(e) => updateCashRow(index, "amount", e.target.value)}
                    />
                  </td>

                  <td>
                    <select
                      value={row.mode}
                      onChange={(e) => updateCashRow(index, "mode", e.target.value)}
                    >
                      {paymentModes.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <input
                      value={row.remarks}
                      onChange={(e) =>
                        updateCashRow(index, "remarks", e.target.value)
                      }
                    />
                  </td>
                </tr>
              ))}
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