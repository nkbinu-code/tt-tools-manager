"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { Archive, Download, FileText, Search, Share2, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getPaymentsData, moveCustomerBalanceToArrears } from "./actions";
import StatementPopup from "../statements/statement-popup";
import StatementHeader from "../statements/StatementHeader";
import StatementCustomerCard from "../statements/StatementCustomerCard";
import StatementPaymentTable from "../statements/StatementPaymentTable";
import StatementSummary from "../statements/StatementSummary";
import StatementFooter from "../statements/StatementFooter";
import StatementActions from "../statements/StatementActions";
import StatementPrintStyles from "../statements/StatementPrintStyles";
import PaymentsHero from "./PaymentsHero";
import { useAppMessage } from "../contexts/AppMessageProvider";
import { rowMobile, rowToolName } from "../calculations";

const shops = [
  "All Shops",
  "Karuvannur",
  "Ollur",
  "Kachery",
  "Mulayam Rd",
  "Pattikkad",
];

const shopAddresses = [
  { shop: "KARUVANNUR", address: "Near St. Mary's Church, Karuvannur, Thrissur.", phone: "6282778096" },
  { shop: "OLLUR", address: "Gramodharanam Rd, Ollur, Thrissur.", phone: "8589874904" },
  { shop: "KACHERY", address: "Kachery Centre, Kachery, Thrissur.", phone: "9744774904" },
  { shop: "MULAYAM", address: "Mulayam Jn, Mulayam Rd, Thrissur.", phone: "8086774904" },
  { shop: "PATTIKKAD", address: "Peechi Rd, Pattikkad, Thrissur.", phone: "9539712465" },
];

const paymentModes = ["Cash", "UPI", "GPay", "Bank", "Card", "Other"];

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

function tryNextLogo(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const fallbacks = [
    "/tt-logo.png",
    "/logo.png",
    "/tt-logo.jpg",
    "/logo.jpg",
    "/tried-and-true-logo.png",
    "/Tried-and-True-logo.png",
  ];

  const currentIndex = Number(img.dataset.logoIndex || "0");
  const nextIndex = currentIndex + 1;

  if (nextIndex < fallbacks.length) {
    img.dataset.logoIndex = String(nextIndex);
    img.src = fallbacks[nextIndex];
  } else {
    img.style.display = "none";
  }
}

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
  const [paymentShopFilter, setPaymentShopFilter] = useState("All Shops");
  const [paymentFromDate, setPaymentFromDate] = useState("");
  const [paymentToDate, setPaymentToDate] = useState("");
  const [closedSearchText, setClosedSearchText] = useState("");
  const [recentShopFilter, setRecentShopFilter] = useState("All Shops");
  const [recentDate, setRecentDate] = useState("");

  const [customers, setCustomers] = useState<any[]>([]);
  const [pendingRows, setPendingRows] = useState<any[]>([]);
  const [pendingReturnedRentals, setPendingReturnedRentals] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
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
  const [statementPopupOpen, setStatementPopupOpen] = useState(false);
  const [statementOptions, setStatementOptions] = useState<any>(null);
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
      { data: rentalData },
      { data: toolData },
      { data: saleData },
      { data: arrearsData },
    ] = await Promise.all([
      supabase.from("customers").select("*").order("customer_name", { ascending: true }),
      supabase.from("payments").select("*").order("payment_date", { ascending: false }),
      supabase.from("rentals").select("*"),
      supabase.from("tools").select("*"),
      supabase.from("sale_entries").select("*"),
      supabase.from("customer_arrears").select("*").order("moved_date", { ascending: false }),
    ]);

    setCustomers(customerData || []);
    setPayments(paymentData || []);
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

  function selectClosedRentalForPayment(row: any) {
    receivePendingRental(row);
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

  async function saveQuickPayment() {
    await saveCustomerPayments();
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

  function openStatementPopup() {
    if (!selectedMobile) {
      showWarning("Please select a customer first");
      return;
    }

    setStatementPopupOpen(true);
  }


  function statementPeriodLabel(period: string) {
    if (period === "all") return "All Time";
    if (period === "thisMonth") return "This Month";
    if (period === "lastMonth") return "Last Month";
    return "Custom Date";
  }

  function formatDisplayDate(date: any) {
    if (!date) return "-";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString("en-GB");
  }

  function rentalDate(row: any) {
    return row.start_date || row.date || row.rental_date || row.created_at || "";
  }

  function paymentDate(row: any) {
    return row.payment_date || row.date || row.created_at || "";
  }


  function getStatementRange(options: any) {
    if (!options || options.period === "all") return { from: "", to: "" };

    const now = new Date();

    if (options.period === "thisMonth") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      };
    }

    if (options.period === "lastMonth") {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      };
    }

    return { from: options.fromDate || "", to: options.toDate || "" };
  }

  function isInStatementRange(date: any, from: string, to: string) {
    if (!date) return false;
    const d = String(date || "").slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
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

  const selectedCustomerId = String(
    selectedCustomer?.id || selectedPending?.customer_id || selectedPending?.id || ""
  );

  const selectedCustomerRentals = useMemo(() => {
    if (!selectedMobile && !selectedCustomerId) return [];

    return rentals
      .filter((r: any) => {
        const rentalCustomerId = String(r.customer_id || "");
        const rentalMobile = String(r.mobile || r.customer_mobile || "").trim();

        return (
          (selectedCustomerId && rentalCustomerId === selectedCustomerId) ||
          (selectedMobile && rentalMobile === selectedMobile)
        );
      })
      .map((r: any) => enrichRentalWithTool(r, tools));
  }, [rentals, tools, selectedMobile, selectedCustomerId]);

  const selectedCustomerPayments = useMemo(() => {
    if (!selectedMobile && !selectedCustomerId) return [];

    return payments.filter((p: any) => {
      const paymentCustomerId = String(p.customer_id || "");
      const paymentMobile = String(p.mobile || p.customer_mobile || "").trim();

      return (
        (selectedCustomerId && paymentCustomerId === selectedCustomerId) ||
        (selectedMobile && paymentMobile === selectedMobile)
      );
    });
  }, [payments, selectedMobile, selectedCustomerId]);

  const selectedActiveRentals = selectedCustomerRentals.filter(
    (r: any) => !(r.end_date || r.return_date)
  );

  const selectedReturnedPendingRentals = selectedMobile
    ? pendingReturnedRentals.filter(
        (r: any) => String(r.mobile || "").trim() === selectedMobile
      )
    : [];

  const selectedTotalSalesBusiness = selectedMobile
    ? sales
        .filter((s) => rowMobile(s) === selectedMobile)
        .reduce((sum, s) => sum + Number(s.total_sale || 0), 0)
    : 0;

  const selectedTotalRentalBusiness = selectedCustomerRentals.reduce(
    (sum: number, r: any) => sum + paymentRentalAmount(r, tools),
    0
  );

  const selectedTotalBusiness = selectedTotalRentalBusiness + selectedTotalSalesBusiness;

  const selectedCashReceived = selectedCustomerPayments.reduce(
    (sum: number, p: any) => sum + Number(p.amount || 0),
    0
  );

  const selectedDiscount = selectedCustomerPayments.reduce(
    (sum: number, p: any) => sum + Number(p.discount || 0),
    0
  );

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


  const monthBusiness =
    monthRentals.reduce((sum, r) => sum + paymentRentalAmount(r, tools), 0) +
    monthSales.reduce((sum, s) => sum + Number(s.total_sale || 0), 0);

  const monthPaymentTotal = monthPayments.reduce(
    (sum, p) => sum + Number(p.amount || 0),
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


  const visiblePayments = payments.filter((p) => {
    const matchMonth = sameMonth(p.payment_date);
    const matchSelectedShop = shopFilter === "All Shops" || p.shop === shopFilter;
    const matchCustomer =
      !selectedMobile || String(p.mobile || "").trim() === selectedMobile;

    return matchMonth && matchSelectedShop && matchCustomer;
  });


  const statementRange = useMemo(
    () => getStatementRange(statementOptions),
    [statementOptions]
  );

  const statementRentals = useMemo(() => {
    if (!statementOptions) return [];

    return (selectedCustomerRentals || [])
      .filter((r: any) =>
        statementOptions.period === "all" ||
        isInStatementRange(rentalDate(r), statementRange.from, statementRange.to)
      )
      .sort((a: any, b: any) =>
        String(rentalDate(a)).localeCompare(String(rentalDate(b)))
      );
  }, [selectedCustomerRentals, statementOptions, statementRange]);

  const statementPayments = useMemo(() => {
    if (!statementOptions) return [];

    return (selectedCustomerPayments || [])
      .filter((p: any) =>
        statementOptions.period === "all" ||
        isInStatementRange(paymentDate(p), statementRange.from, statementRange.to)
      )
      .sort((a: any, b: any) =>
        String(paymentDate(a)).localeCompare(String(paymentDate(b)))
      );
  }, [selectedCustomerPayments, statementOptions, statementRange]);

  const statementRentalTotal = statementRentals.reduce(
    (sum: number, r: any) => sum + paymentRentalAmount(r, tools),
    0
  );

  const statementPaidTotal = statementPayments.reduce(
    (sum: number, p: any) => sum + Number(p.amount || 0),
    0
  );

  const statementDiscountTotal = statementPayments.reduce(
    (sum: number, p: any) => sum + Number(p.discount || 0),
    0
  );

  const statementBalance = Math.max(
    0,
    statementRentalTotal - statementPaidTotal - statementDiscountTotal
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


  function handlePaymentTopSearch(value: string) {
    setClosedSearchText(value);

    const exactCustomer = customers.find((c: any) => {
      const mobile = String(c.mobile || "").trim();
      const name = String(c.customer_name || c.name || "").trim().toLowerCase();
      const q = String(value || "").trim().toLowerCase();

      return mobile === String(value || "").trim() || (q.length > 0 && name === q);
    });

    if (exactCustomer) {
      const mobile = String(exactCustomer.mobile || "").trim();
      setCustomerFilter(mobile);
      updatePaymentRow(0, "mobile", mobile);
    }
  }


  const pendingReturnedForCounter = pendingReturnedRentals
    .filter((row: any) => paymentShopFilter === "All Shops" || row.shop === paymentShopFilter)
    .filter((row: any) => {
      const d = String(row.return_date || row.end_date || row.date || "").slice(0, 10);
      if (paymentFromDate && d && d < paymentFromDate) return false;
      if (paymentToDate && d && d > paymentToDate) return false;
      return true;
    })
    .slice(0, 20);

  const recentlyClosedForPayment = pendingReturnedRentals
    .filter((row: any) => paymentShopFilter === "All Shops" || row.shop === paymentShopFilter)
    .filter((row: any) => {
      const d = String(row.return_date || row.end_date || row.date || row.closed_date || "").slice(0, 10);
      if (paymentFromDate && d && d < paymentFromDate) return false;
      if (paymentToDate && d && d > paymentToDate) return false;
      return true;
    })
    .filter((row: any) => {
      const q = closedSearchText.trim().toLowerCase();
      if (!q) return true;
      return `${row.customer_name || ""} ${row.mobile || ""} ${row.tool_name || row.tool || ""} ${row.shop || ""}`
        .toLowerCase()
        .includes(q);
    })
    .sort((a: any, b: any) =>
      String(b.return_date || b.end_date || b.date || b.closed_date || "").localeCompare(
        String(a.return_date || a.end_date || a.date || a.closed_date || "")
      )
    )
    .slice(0, 30);

  const recentPayments = payments
    .filter((p: any) => recentShopFilter === "All Shops" || p.shop === recentShopFilter)
    .filter((p: any) => !recentDate || String(p.payment_date || "").slice(0, 10) === recentDate)
    .slice(0, 20);

  const oldArrearsRows = arrears.filter((a: any) => {
    const moved = String(a.moved_date || a.created_at || "").slice(0, 10);
    if (!moved) return true;
    const d = new Date(moved);
    if (Number.isNaN(d.getTime())) return true;
    const limit = new Date();
    limit.setMonth(limit.getMonth() - 3);
    return d <= limit;
  });

  return (
    <main>
      <StatementPrintStyles />
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm;
          }

          html,
          body {
            width: 210mm !important;
            min-height: 297mm !important;
            background: #ffffff !important;
            overflow: visible !important;
          }

          .no-print,
          .tt-print-area .no-print,
          .tt-print-area button {
            display: none !important;
          }

          body * {
            visibility: hidden !important;
          }

          .tt-print-area,
          .tt-print-area * {
            visibility: visible !important;
          }

          .tt-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 200mm !important;
            max-width: 200mm !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 6mm !important;
            box-shadow: none !important;
            border: 1px solid #bfdbfe !important;
            border-radius: 8px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }

          .tt-print-area * {
            line-height: 1.18 !important;
          }

          .tt-print-area img {
            max-width: 220px !important;
            max-height: 86px !important;
            object-fit: contain !important;
          }

          .tt-print-area table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 8.5px !important;
          }

          .tt-print-area th,
          .tt-print-area td {
            padding: 3px 4px !important;
            font-size: 8.5px !important;
            line-height: 1.12 !important;
          }

          .tt-print-area div,
          .tt-print-area span,
          .tt-print-area strong {
            font-size: 10px !important;
          }

          .tt-print-area [style*="font-size: 46px"],
          .tt-print-area [style*="font-size: 34px"],
          .tt-print-area [style*="font-size: 30px"],
          .tt-print-area [style*="font-size: 28px"],
          .tt-print-area [style*="font-size: 26px"] {
            font-size: 16px !important;
          }

          .tt-print-area [style*="font-size: 24px"],
          .tt-print-area [style*="font-size: 22px"],
          .tt-print-area [style*="font-size: 20px"] {
            font-size: 13px !important;
          }

          .tt-print-area [style*="padding: 16px"],
          .tt-print-area [style*="padding: 14px"],
          .tt-print-area [style*="padding: 12px"] {
            padding: 5px !important;
          }

          .tt-print-area [style*="margin-top: 18px"],
          .tt-print-area [style*="margin-top: 16px"],
          .tt-print-area [style*="margin-top: 14px"],
          .tt-print-area [style*="margin-top: 12px"] {
            margin-top: 5px !important;
          }

          .tt-print-area [style*="margin-bottom: 14px"],
          .tt-print-area [style*="margin-bottom: 12px"] {
            margin-bottom: 5px !important;
          }

          .tt-print-area [style*="gap: 18px"],
          .tt-print-area [style*="gap: 12px"],
          .tt-print-area [style*="gap: 10px"] {
            gap: 4px !important;
          }

          .tt-print-area [style*="border-radius: 20px"],
          .tt-print-area [style*="border-radius: 18px"],
          .tt-print-area [style*="border-radius: 16px"] {
            border-radius: 6px !important;
          }
        }
      `}</style>
      {statementPopupOpen && (
        <StatementPopup
          customer={{
            ...(selectedCustomer || selectedPending || {}),
            customer_name:
              selectedCustomer?.customer_name ||
              selectedCustomer?.name ||
              selectedPending?.customer_name ||
              selectedMobile,
            mobile: selectedMobile,
            shop: selectedCustomer?.shop || selectedCustomer?.branch || selectedPending?.shop || "",
          }}
          onClose={() => setStatementPopupOpen(false)}
          onPreview={(data: any) => {
            setStatementOptions(data);
            setStatementPopupOpen(false);
          }}
        />
      )}

      <PaymentsHero shop={paymentShopFilter} month={month} />

      {arrearsPopup && (
        <div style={overlayStyle}>
          <div style={popupStyle}>
            <h2 style={{ marginTop: 0, fontSize: 26, color: "#0f172a" }}>Move Balance to Arrears</h2>
            <div style={blueInfoStyle}>
              <div>Customer: {arrearsPopup.customer_name}</div>
              <div>Mobile: {arrearsPopup.mobile}</div>
              <div>Shop: {arrearsPopup.shop || "-"}</div>
              <div style={{ fontSize: 24, color: "#0057ff" }}>
                Amount: ₹{Number(arrearsPopup.amount || 0).toFixed(0)}
              </div>
            </div>
            <label style={{ fontWeight: 900 }}>Reason</label>
            <input value={arrearsReason} onChange={(e) => setArrearsReason(e.target.value)} placeholder="Long pending / customer not paying..." style={{ width: "100%", marginBottom: 12 }} />
            <label style={{ fontWeight: 900 }}>Remarks</label>
            <textarea value={arrearsRemarks} onChange={(e) => setArrearsRemarks(e.target.value)} placeholder="Any notes..." rows={3} style={{ width: "100%", marginBottom: 18 }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button className="btn-gray" onClick={() => setArrearsPopup(null)}>Cancel</button>
              <button className="btn-blue" onClick={confirmMoveToArrears}>Move to Arrears</button>
            </div>
          </div>
        </div>
      )}

      <div className="kpi-grid">
        <Kpi title="Month Business" value={`₹${monthBusiness.toFixed(0)}`} />
        <Kpi title="Payments Received" value={`₹${monthPaymentTotal.toFixed(0)}`} />
        <Kpi title="Pending Returned" value={`₹${returnedPendingTotal.toFixed(0)}`} />
        <Kpi title="Total Arrears" value={`₹${totalArrears.toFixed(0)}`} />
      </div>

      <div style={twoColumnStyle}>
        <section className="modern-card" style={{ margin: 0 }}>
          <SectionHeader title="Payments" subtitle="Search customer, check returned pending items, and receive payment." />

          <div style={filterBoxStyle}>
            <select value={paymentShopFilter} onChange={(e) => setPaymentShopFilter(e.target.value)} style={bigControlStyle}>
              {shops.map((shop) => <option key={shop}>{shop}</option>)}
            </select>
            <input type="date" value={paymentFromDate} onChange={(e) => setPaymentFromDate(e.target.value)} style={bigControlStyle} title="From date" />
            <input type="date" value={paymentToDate} onChange={(e) => setPaymentToDate(e.target.value)} style={bigControlStyle} title="To date" />
            <input
              list="paymentCustomerSearchList"
              value={closedSearchText}
              onChange={(e) => handlePaymentTopSearch(e.target.value)}
              placeholder="Search mobile / customer / tool"
              style={bigControlStyle}
            />
            <datalist id="paymentCustomerSearchList">
              {customers.map((c) => (
                <option key={c.id} value={c.mobile} label={c.customer_name || c.name} />
              ))}
            </datalist>
          </div>

          {!selectedMobile && (
            <div style={{ marginTop: 16 }}>
              <h3 style={smallTitleStyle}>Recently Closed for Payment</h3>
              <RecentlyClosedForPaymentList
                rows={recentlyClosedForPayment}
                onReceive={(row: any) => selectClosedRentalForPayment(row)}
              />
            </div>
          )}

          {selectedMobile && (
            <div style={{ marginTop: 20 }}>
              <CustomerStatementBox
                selectedCustomer={selectedCustomer}
                selectedPending={selectedPending}
                selectedMobile={selectedMobile}
                selectedTotalBusiness={selectedTotalBusiness}
                selectedCashReceived={selectedCashReceived}
                selectedDiscount={selectedDiscount}
                selectedAlreadyArrears={selectedAlreadyArrears}
                selectedBalance={selectedBalance}
                selectedCustomerPayments={selectedCustomerPayments}
                activeRentals={selectedActiveRentals}
                returnedPendingRentals={selectedReturnedPendingRentals}
                tools={tools}
              />

              <div style={paymentFormStyle}>
                <h3 style={{ margin: "0 0 14px", fontSize: 28, fontWeight: 1000, color: "white", letterSpacing: 0.4 }}>💰 Receive Payment</h3>
                <div style={formGridStyle}>
                  <input type="date" value={paymentRows[0]?.payment_date || today()} onChange={(e) => updatePaymentRow(0, "payment_date", e.target.value)} style={bigControlStyle} />
                  <input type="number" value={paymentRows[0]?.amount || ""} onChange={(e) => updatePaymentRow(0, "amount", e.target.value)} placeholder="Amount received" style={bigControlStyle} />
                  <input type="number" value={paymentRows[0]?.discount || ""} onChange={(e) => updatePaymentRow(0, "discount", e.target.value)} placeholder="Discount" style={bigControlStyle} />
                  <select value={paymentRows[0]?.mode || "Cash"} onChange={(e) => updatePaymentRow(0, "mode", e.target.value)} style={bigControlStyle}>
                    {paymentModes.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <input value={paymentRows[0]?.remarks || ""} onChange={(e) => updatePaymentRow(0, "remarks", e.target.value)} placeholder="Remarks" style={{ ...bigControlStyle, width: "100%", marginTop: 12 }} />
                <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                  <button className="btn-blue" type="button" onClick={saveQuickPayment} style={{ fontSize: 20, padding: "16px 26px", background: "#16a34a", borderColor: "#16a34a", fontWeight: 1000, boxShadow: "0 10px 22px rgba(22, 163, 74, 0.28)" }}>💵 Save Payment</button>
                  <button className="btn-gray" type="button" onClick={openStatementPopup} style={{ fontSize: 18, padding: "14px 22px", background: "#2563eb", color: "white", borderColor: "#2563eb", fontWeight: 1000 }}><FileText size={18} /> Statement</button>
                  <button className="btn-gray" type="button" onClick={openArrearsPopup} disabled={selectedBalance <= 0} style={{ fontSize: 18, padding: "14px 22px", background: "#f97316", color: "white", borderColor: "#f97316", fontWeight: 1000 }}><Archive size={18} /> Move to Arrears</button>
                </div>
              </div>

              {statementOptions && (
                <InlineCustomerStatement
                  selectedCustomer={selectedCustomer}
                  selectedPending={selectedPending}
                  selectedMobile={selectedMobile}
                  statementOptions={statementOptions}
                  statementRange={statementRange}
                  statementRentals={statementRentals}
                  statementPayments={statementPayments}
                  statementRentalTotal={statementRentalTotal}
                  statementPaidTotal={statementPaidTotal}
                  statementDiscountTotal={statementDiscountTotal}
                  statementBalance={statementBalance}
                  tools={tools}
                  statementPeriodLabel={statementPeriodLabel}
                  formatDisplayDate={formatDisplayDate}
                  openStatementPopup={openStatementPopup}
                  clearStatement={() => setStatementOptions(null)}
                />
              )}
            </div>
          )}
        </section>

        <section className="modern-card" style={{ margin: 0 }}>
          <SectionHeader
            title="Recently Received Payments"
            subtitle="Latest received payments. Filter by shop or date."
            right={<button className="btn-blue" onClick={downloadCsv}><Download size={16} /> Download</button>}
          />
          <div style={filterBoxStyle}>
            <select value={recentShopFilter} onChange={(e) => setRecentShopFilter(e.target.value)} style={bigControlStyle}>
              {shops.map((shop) => <option key={shop}>{shop}</option>)}
            </select>
            <input type="date" value={recentDate} onChange={(e) => setRecentDate(e.target.value)} style={bigControlStyle} />
          </div>
          <RecentPaymentList payments={recentPayments} />
        </section>
      </div>

      <section className="modern-card">
        <SectionHeader
          title="Shop Cash Received"
          subtitle="Kept as table style for fast shop cash entry."
          right={
            <div className="action-row">
              <button className="btn-gray" onClick={() => setCashRows([...cashRows, ...Array.from({ length: 5 }, emptyCashRow)])}>+ Add 5 Rows</button>
              <button className="btn-blue" onClick={saveShopCash}>Save Cash</button>
            </div>
          }
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Shop</th><th>Received From</th><th>Amount</th><th>Mode</th><th>Remarks</th></tr>
            </thead>
            <tbody>
              {cashRows.map((row, index) => (
                <tr key={index}>
                  <td><input type="date" value={row.received_date} onChange={(e) => updateCashRow(index, "received_date", e.target.value)} /></td>
                  <td><select value={row.shop} onChange={(e) => updateCashRow(index, "shop", e.target.value)}><option value="">Shop</option>{shops.filter((s) => s !== "All Shops").map((s) => <option key={s}>{s}</option>)}</select></td>
                  <td><input value={row.received_from} onChange={(e) => updateCashRow(index, "received_from", e.target.value)} /></td>
                  <td><input type="number" value={row.amount} onChange={(e) => updateCashRow(index, "amount", e.target.value)} /></td>
                  <td><select value={row.mode} onChange={(e) => updateCashRow(index, "mode", e.target.value)}>{paymentModes.map((m) => <option key={m}>{m}</option>)}</select></td>
                  <td><input value={row.remarks} onChange={(e) => updateCashRow(index, "remarks", e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="modern-card">
        <SectionHeader title="Arrears" subtitle="Old not-paid money. Show mainly balances pending for 3 months or more." />
        <div className="kpi-grid">
          {shopWiseArrears.map((row) => <Kpi key={row.shop} title={row.shop} value={`₹${Number(row.amount || 0).toFixed(0)}`} />)}
        </div>
        <h3 style={smallTitleStyle}>3 months and older arrears / not paid money</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Customer</th><th>Mobile</th><th>Shop</th><th>Amount</th><th>Reason</th><th>Remarks</th></tr></thead>
            <tbody>
              {oldArrearsRows.map((a: any, index: number) => (
                <tr key={`${a.id || "arrears"}-${index}`}>
                  <td>{a.moved_date}</td><td><strong>{a.customer_name}</strong></td><td>{a.mobile}</td><td>{a.shop}</td><td className="strong">₹{Number(a.arrears_amount || 0).toFixed(0)}</td><td>{a.reason}</td><td>{a.remarks}</td>
                </tr>
              ))}
              {oldArrearsRows.length === 0 && <tr><td colSpan={7}>No 3-month arrears found</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}


function StatementRentalDetailsTable({ rentals, tools }: any) {
  const rows = [...(rentals || [])].sort((a: any, b: any) => {
    const aReturned = a.end_date || a.return_date || a.status === "Returned";
    const bReturned = b.end_date || b.return_date || b.status === "Returned";
    if (aReturned && !bReturned) return -1;
    if (!aReturned && bReturned) return 1;
    return String(rentalDateForSort(a)).localeCompare(String(rentalDateForSort(b)));
  });

  const total = rows.reduce((sum: number, r: any) => sum + paymentRentalAmount(r, tools), 0);

  return (
    <div style={statementRentalTableWrapStyle}>
      <div style={statementTableTitleStyle}>Rental Details</div>
      <table style={statementTableStyle}>
        <thead>
          <tr>
            <th style={statementThStyle}>#</th>
            <th style={statementThStyle}>Type</th>
            <th style={statementThStyle}>Date</th>
            <th style={statementThStyle}>Item</th>
            <th style={statementThRightStyle}>Qty</th>
            <th style={statementThRightStyle}>Rent</th>
            <th style={statementThRightStyle}>Days</th>
            <th style={statementThRightStyle}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, index: number) => {
            const isReturned = Boolean(r.end_date || r.return_date || r.status === "Returned");
            const amount = paymentRentalAmount(r, tools);
            return (
              <tr key={r.id || r.rental_id || index}>
                <td style={statementTdStyle}>{index + 1}</td>
                <td style={statementTdStyle}>{isReturned ? "Returned" : "Current"}</td>
                <td style={statementTdStyle}>{formatCardDate(r.start_date || r.date || r.rental_date)}</td>
                <td style={statementTdItemStyle}>🔧 {displayToolName(r, tools)}</td>
                <td style={statementTdRightStyle}>{Number(r.qty || r.quantity || 1)}</td>
                <td style={statementTdRightStyle}>₹{paymentRentalRate(r, tools).toFixed(0)}</td>
                <td style={statementTdRightStyle}>{paymentRentalDays(r)}</td>
                <td style={statementTdAmountStyle}>₹{amount.toFixed(0)}</td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td colSpan={8} style={statementEmptyTdStyle}>No rental details found</td>
            </tr>
          )}

          {rows.length > 0 && (
            <tr>
              <td colSpan={7} style={statementTotalLabelStyle}>Total Rent</td>
              <td style={statementTotalValueStyle}>₹{total.toFixed(0)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function rentalDateForSort(row: any) {
  return row.return_date || row.end_date || row.start_date || row.date || row.rental_date || row.created_at || "";
}

function InlineCustomerStatement({
  selectedCustomer,
  selectedPending,
  selectedMobile,
  statementOptions,
  statementRange,
  statementRentals,
  statementPayments,
  statementRentalTotal,
  statementPaidTotal,
  statementDiscountTotal,
  statementBalance,
  tools,
  statementPeriodLabel,
  formatDisplayDate,
  openStatementPopup,
  clearStatement,
}: any) {
  const customerName =
    selectedCustomer?.customer_name ||
    selectedCustomer?.name ||
    selectedPending?.customer_name ||
    selectedMobile;

  const shop =
    selectedCustomer?.shop ||
    selectedCustomer?.branch ||
    selectedPending?.shop ||
    "-";

  const periodText =
    statementOptions?.period === "all"
      ? "All Time"
      : `${formatDisplayDate(statementRange.from)} to ${formatDisplayDate(statementRange.to)}`;

  const [isSharingJpg, setIsSharingJpg] = useState(false);

  async function shareStatementAsJpg() {
    if (isSharingJpg) return;

    setIsSharingJpg(true);

    try {
      const canvas = document.createElement("canvas");
      const width = 1200;
      const rowHeight = 44;
      const rentRows = statementRentals || [];
      const paymentRows = statementPayments || [];
      const rentTableHeight = 62 + Math.max(rentRows.length, 1) * rowHeight + 50;
      const paymentTableHeight = paymentRows.length > 0 ? 70 + paymentRows.length * rowHeight + 50 : 0;
      const addressHeight = 160;
      const height = Math.max(900, 360 + rentTableHeight + paymentTableHeight + addressHeight);
      const scale = 2;

      canvas.width = width * scale;
      canvas.height = height * scale;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        alert("Could not create statement image");
        return;
      }

      ctx.scale(scale, scale);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      const blue = "#003b8f";
      const darkBlue = "#061a55";
      const lightBlue = "#eff6ff";
      const border = "#bfdbfe";
      const red = "#dc2626";
      const green = "#16a34a";
      const orange = "#f97316";
      const black = "#0f172a";
      const gray = "#475569";

      function text(value: any, x: number, y: number, options: any = {}) {
        const size = options.size || 20;
        const weight = options.weight || 700;
        const color = options.color || black;
        const align = options.align || "left";
        ctx.fillStyle = color;
        ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
        ctx.textAlign = align;
        ctx.textBaseline = "alphabetic";
        ctx.fillText(String(value ?? ""), x, y);
      }

      function rect(x: number, y: number, w: number, h: number, fill: string, stroke = "") {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, w, h);
        }
      }

      function line(x1: number, y1: number, x2: number, y2: number, color = "#dbeafe") {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      function money(value: any) {
        return `₹${Number(value || 0).toFixed(0)}`;
      }

      function dateText(date: any) {
        return formatDisplayDate(date);
      }

      async function loadLogo() {
        const candidates = [
          "/tt-logo.png",
          "/logo.png",
          "/tt-logo.jpg",
          "/logo.jpg",
          "/tried-and-true-logo.png",
          "/Tried-and-True-logo.png",
        ];

        for (const src of candidates) {
          try {
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
              const image = new Image();
              image.onload = () => resolve(image);
              image.onerror = reject;
              image.src = src;
            });
            return img;
          } catch {}
        }

        return null;
      }

      const logo = await loadLogo();

      // Header
      if (logo) {
        const logoW = 500;
        const logoH = Math.min(230, (logo.height / logo.width) * logoW || 220);
        ctx.drawImage(logo, 36, 28, logoW, logoH);
      }

      rect(690, 32, 440, 46, blue);
      text("CUSTOMER STATEMENT", 910, 64, { size: 24, weight: 950, color: "#ffffff", align: "center" });

      const infoX = 690;
      let infoY = 112;
      const infoRows = [
        ["Customer", customerName],
        ["Mobile", selectedMobile],
        ["Shop", shop],
        ["Period", statementPeriodLabel(statementOptions.period)],
        ["From", dateText(statementRange.from)],
        ["To", dateText(statementRange.to)],
      ];

      infoRows.forEach(([label, value]) => {
        text(label, infoX, infoY, { size: 19, weight: 900 });
        text(":", infoX + 118, infoY, { size: 19, weight: 900 });
        text(value, infoX + 145, infoY, { size: 19, weight: 900 });
        infoY += 32;
      });

      // Summary boxes
      const boxY = 210;
      const boxW = 270;
      const boxH = 70;
      const summaryBoxes = [
        ["TOTAL BUSINESS", statementRentalTotal, blue],
        ["TOTAL PAID", statementPaidTotal, green],
        ["DISCOUNT", statementDiscountTotal, orange],
        ["BALANCE", statementBalance, red],
      ];

      summaryBoxes.forEach(([label, value, color]: any, i: number) => {
        const x = 36 + i * (boxW + 8);
        rect(x, boxY, boxW, boxH, "#ffffff", "#cbd5e1");
        text(label, x + 14, boxY + 25, { size: 16, weight: 950, color: black });
        text(money(value), x + 14, boxY + 55, { size: 23, weight: 950, color });
      });

      let y = 310;

      function tableHeader(title: string, yPos: number, columns: any[]) {
        rect(36, yPos, 1128, 44, blue);
        text(title, 56, yPos + 30, { size: 22, weight: 950, color: "#ffffff" });
        const headerY = yPos + 44;
        rect(36, headerY, 1128, 42, darkBlue);
        columns.forEach((c: any) => text(c.label, c.x, headerY + 28, { size: 16, weight: 950, color: "#ffffff", align: c.align || "left" }));
        return headerY + 42;
      }

      function rowLine(yPos: number) {
        line(36, yPos, 1164, yPos, "#dbeafe");
      }

      const rentColumns = [
        { label: "#", x: 58, align: "left" },
        { label: "DATE", x: 120, align: "left" },
        { label: "TYPE", x: 240, align: "left" },
        { label: "ITEM", x: 360, align: "left" },
        { label: "QTY", x: 765, align: "right" },
        { label: "RENT", x: 865, align: "right" },
        { label: "DAYS", x: 955, align: "right" },
        { label: "AMOUNT", x: 1138, align: "right" },
      ];

      y = tableHeader("RENTAL DETAILS", y, rentColumns);

      if (rentRows.length === 0) {
        rect(36, y, 1128, rowHeight, "#ffffff", "#dbeafe");
        text("No rental details", 56, y + 29, { size: 17, weight: 800, color: gray });
        y += rowHeight;
      } else {
        rentRows.forEach((r: any, i: number) => {
          const isReturned = !!(r.end_date || r.return_date || r.status === "Returned");
          const item = displayToolName(r, tools);
          const amount = paymentRentalAmount(r, tools);
          const rent = paymentRentalRate(r, tools);
          const days = paymentRentalDays(r);
          const rowY = y + i * rowHeight;
          rect(36, rowY, 1128, rowHeight, i % 2 === 0 ? "#ffffff" : "#f8fbff", "#dbeafe");
          text(i + 1, 58, rowY + 29, { size: 16, weight: 800 });
          text(dateText(r.start_date || r.date || r.rental_date), 120, rowY + 29, { size: 16, weight: 800 });
          text(isReturned ? "Returned" : "Current", 240, rowY + 29, { size: 16, weight: 950, color: isReturned ? red : blue });
          text(item.length > 32 ? `${item.slice(0, 32)}...` : item, 360, rowY + 29, { size: 16, weight: 900 });
          text(Number(r.qty || r.quantity || 1), 765, rowY + 29, { size: 16, weight: 800, align: "right" });
          text(money(rent), 865, rowY + 29, { size: 16, weight: 800, align: "right" });
          text(days, 955, rowY + 29, { size: 16, weight: 800, align: "right" });
          text(money(amount), 1138, rowY + 29, { size: 16, weight: 950, align: "right", color: blue });
        });
        y += rentRows.length * rowHeight;
      }

      rect(36, y, 1128, 50, lightBlue, "#dbeafe");
      text("TOTAL RENT", 880, y + 33, { size: 18, weight: 950 });
      text(money(statementRentalTotal), 1138, y + 33, { size: 22, weight: 950, color: blue, align: "right" });
      y += 74;

      // Payment summary + payments
      const summaryW = 350;
      rect(36, y, summaryW, 44, green);
      text("PAYMENT SUMMARY", 211, y + 30, { size: 20, weight: 950, color: "#ffffff", align: "center" });
      rect(36, y + 44, summaryW, 150, "#ffffff", "#cbd5e1");
      const summaryLines = [
        ["Total Business", statementRentalTotal],
        ["Total Paid", statementPaidTotal],
        ["Discount", statementDiscountTotal],
      ];
      summaryLines.forEach(([label, value]: any, i: number) => {
        text(label, 60, y + 82 + i * 34, { size: 17, weight: 800 });
        text(":", 210, y + 82 + i * 34, { size: 17, weight: 800 });
        text(money(value), 355, y + 82 + i * 34, { size: 17, weight: 950, align: "right" });
      });
      line(36, y + 154, 386, y + 154, "#cbd5e1");
      text("BALANCE", 60, y + 180, { size: 18, weight: 950, color: red });
      text(":", 210, y + 180, { size: 18, weight: 950, color: red });
      text(money(statementBalance), 355, y + 180, { size: 20, weight: 950, color: red, align: "right" });

      const paymentX = 420;
      rect(paymentX, y, 744, 44, blue);
      text("PAYMENTS", paymentX + 372, y + 30, { size: 20, weight: 950, color: "#ffffff", align: "center" });
      rect(paymentX, y + 44, 744, 42, darkBlue);
      text("DATE", paymentX + 40, y + 72, { size: 16, weight: 950, color: "#ffffff" });
      text("MODE", paymentX + 220, y + 72, { size: 16, weight: 950, color: "#ffffff" });
      text("AMOUNT", paymentX + 450, y + 72, { size: 16, weight: 950, color: "#ffffff", align: "right" });
      text("REMARKS", paymentX + 500, y + 72, { size: 16, weight: 950, color: "#ffffff" });

      if (paymentRows.length === 0) {
        rect(paymentX, y + 86, 744, 44, "#ffffff", "#dbeafe");
        text("No payments", paymentX + 40, y + 114, { size: 16, weight: 800, color: gray });
        rect(paymentX, y + 130, 744, 64, lightBlue, "#dbeafe");
        text("TOTAL PAID", paymentX + 40, y + 170, { size: 18, weight: 950, color: blue });
        text(money(statementPaidTotal), paymentX + 450, y + 170, { size: 20, weight: 950, color: blue, align: "right" });
      } else {
        paymentRows.forEach((p: any, i: number) => {
          const rowY = y + 86 + i * rowHeight;
          rect(paymentX, rowY, 744, rowHeight, i % 2 === 0 ? "#ffffff" : "#f8fbff", "#dbeafe");
          text(dateText(p.payment_date || p.date), paymentX + 40, rowY + 29, { size: 16, weight: 800 });
          text(p.mode || p.payment_mode || "-", paymentX + 220, rowY + 29, { size: 16, weight: 800 });
          text(money(p.amount), paymentX + 450, rowY + 29, { size: 16, weight: 950, color: green, align: "right" });
          text(String(p.remarks || "").slice(0, 24), paymentX + 500, rowY + 29, { size: 16, weight: 800 });
        });
        const totalY = y + 86 + paymentRows.length * rowHeight;
        rect(paymentX, totalY, 744, 64, lightBlue, "#dbeafe");
        text("TOTAL PAID", paymentX + 40, totalY + 40, { size: 18, weight: 950, color: blue });
        text(money(statementPaidTotal), paymentX + 450, totalY + 40, { size: 20, weight: 950, color: blue, align: "right" });
      }

      y += Math.max(220, 86 + Math.max(paymentRows.length, 1) * rowHeight + 64) + 48;

      // Footer addresses
      text("Five Branches, Same Commitment!", width / 2, y, { size: 24, weight: 950, color: red, align: "center" });
      y += 28;
      line(46, y, width - 46, y, "#94a3b8");
      y += 28;

      const addrW = (width - 72) / 5;
      shopAddresses.forEach((s, i) => {
        const x = 36 + i * addrW;
        text(`📍 ${s.shop}`, x, y, { size: 16, weight: 950, color: blue });
        text(s.address, x, y + 28, { size: 13, weight: 700 });
        text(`Mob: ${s.phone}`, x, y + 52, { size: 13, weight: 850 });
      });
      y += 94;

      rect(0, height - 58, width, 58, blue);
      text("Thank you for choosing T&T Rent a Tool", width / 2, height - 22, { size: 21, weight: 900, color: "#ffffff", align: "center" });

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.95);
      });

      if (!blob) {
        alert("Could not create statement JPG");
        return;
      }

      const safeName = String(customerName || selectedMobile || "customer")
        .replace(/[^a-z0-9]/gi, "_")
        .replace(/_+/g, "_");

      const file = new File([blob], `TT_Statement_${safeName}_${today()}.jpg`, {
        type: "image/jpeg",
      });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Tried & True Customer Statement",
          text: `Customer statement for ${customerName}`,
          files: [file],
        });
        return;
      }

      const jpgUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = jpgUrl;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(jpgUrl);
    } catch (error) {
      console.error(error);
      alert("Could not share statement JPG");
    } finally {
      setIsSharingJpg(false);
    }
  }

  return (
    <section className="tt-print-area" style={inlineStatementStyle}>
      <div style={inlineStatementTopStyle}>
        <div style={logoWrapStyle}>
          <img
            src="/tt-logo.png"
            alt="Tried & True logo"
            style={logoImageStyle}
            data-logo-index="0"
            onError={tryNextLogo}
          />
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={statementTitleStyle}>Customer Statement</div>
          <div style={statementPeriodStyle}>Statement Period : {periodText}</div>
          <button className="btn-gray no-print" type="button" onClick={openStatementPopup} style={{ marginTop: 8 }}>
            <FileText size={16} /> Change
          </button>
        </div>
      </div>

      <div style={statementInfoGridStyle}>
        <div><strong>Customer : </strong><span>{customerName}</span></div>
        <div><strong>Mobile : </strong><span>{selectedMobile}</span></div>
        <div><strong>Shop : </strong><span>{shop}</span></div>
        <div><strong>Period : </strong><span>{statementPeriodLabel(statementOptions.period)}</span></div>
        <div><strong>From : </strong><span>{formatDisplayDate(statementRange.from)}</span></div>
        <div><strong>To : </strong><span>{formatDisplayDate(statementRange.to)}</span></div>
      </div>

      <div style={statementInnerStyle}>
        <StatementActions onPrint={() => window.print()} />
        <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            className="btn-blue"
            type="button"
            onClick={shareStatementAsJpg}
            disabled={isSharingJpg}
          >
            <Share2 size={16} /> {isSharingJpg ? "Preparing JPG..." : "Share JPG"}
          </button>
        </div>
        {(statementOptions.type === "rent" || statementOptions.type === "combined") && (
          <StatementRentalDetailsTable rentals={statementRentals} tools={tools} />
        )}
        {(statementOptions.type === "payment" || statementOptions.type === "combined") && (
          <StatementPaymentTable payments={statementPayments} formatDate={formatDisplayDate} />
        )}
        <StatementSummary
          totalRent={statementRentalTotal}
          paid={statementPaidTotal}
          discount={statementDiscountTotal}
          balance={statementBalance}
        />
      </div>

      <div style={allShopAddressBoxStyle}>
        <div style={allShopAddressGridStyle}>
          {shopAddresses.map((s) => (
            <div key={s.shop} style={shopAddressItemStyle}>
              <strong>{s.shop}</strong>
              <span>{s.address}</span>
              {s.phone && <span>Mob: {s.phone}</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <button className="btn-gray no-print" type="button" onClick={clearStatement}>Hide Statement</button>
      </div>
    </section>
  );
}

function RecentlyClosedForPaymentList({ rows, onReceive }: any) {
  return (
    <div className="table-wrap" style={{ marginTop: 8 }}>
      <table style={{ minWidth: 980 }}>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Mobile</th>
            <th>Tool</th>
            <th>Qty</th>
            <th>Start Date</th>
            <th>Return Date</th>
            <th>Days</th>
            <th>Amount</th>
            <th>Shop</th>
            <th>Payment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, index: number) => (
            <tr key={`${row.rental_id || row.id || "closed"}-${index}`}>
              <td><strong>{row.customer_name || "-"}</strong></td>
              <td>{row.mobile || "-"}</td>
              <td>{row.tool_name || row.tool || "Returned tool"}</td>
              <td>{Number(row.qty || row.quantity || 1)}</td>
              <td>{formatCardDate(row.start_date || row.rental_date || row.date)}</td>
              <td>{formatCardDate(row.return_date || row.end_date || row.closed_date)}</td>
              <td>{paymentRentalDays(row) || Number(row.days || row.total_days || 0) || "-"}</td>
              <td><strong>₹{Number(row.balance || row.pending || row.amount || 0).toFixed(0)}</strong></td>
              <td>{row.shop || "-"}</td>
              <td>
                <button
                  className="btn-blue"
                  type="button"
                  onClick={() => onReceive(row)}
                  style={{ padding: "9px 14px", fontWeight: 950 }}
                >
                  Payment
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} style={{ textAlign: "center", fontWeight: 900, padding: 18 }}>
                No recently closed rentals found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CustomerStatementBox({ selectedCustomer, selectedPending, selectedMobile, selectedTotalBusiness, selectedCashReceived, selectedDiscount, selectedAlreadyArrears, selectedBalance, selectedCustomerPayments, activeRentals, returnedPendingRentals, tools }: any) {
  const advance = Math.max(
    0,
    Number(selectedCashReceived || 0) +
      Number(selectedDiscount || 0) +
      Number(selectedAlreadyArrears || 0) -
      Number(selectedTotalBusiness || 0)
  );

  return (
    <div style={customerBoxStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>{selectedCustomer?.customer_name || selectedCustomer?.name || selectedPending?.customer_name || selectedMobile}</div>
          <div style={{ color: "#475569", fontWeight: 850 }}>{selectedMobile} • {selectedCustomer?.shop || selectedCustomer?.branch || selectedPending?.shop || "-"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#f97316", fontWeight: 950 }}>Amount Due</div>
          <div style={{ fontSize: 34, fontWeight: 950, color: "#0f172a" }}>₹{Number(selectedBalance || 0).toFixed(0)}</div>
        </div>
      </div>

      <CombinedRentalTable
        activeRentals={activeRentals}
        returnedPendingRentals={returnedPendingRentals}
        tools={tools}
        paidCredit={Number(selectedCashReceived || 0) + Number(selectedDiscount || 0) + Number(selectedAlreadyArrears || 0)}
      />

      <PaymentHistory payments={selectedCustomerPayments || []} />

      <div style={statementSummaryLineStyle}>
        <SummaryPill label="Business" value={selectedTotalBusiness} tone="blue" />
        <SummaryPill label="Received" value={selectedCashReceived} tone="green" />
        <SummaryPill label="Discount" value={selectedDiscount} tone="purple" />
        <SummaryPill label="Advance" value={advance} tone="orange" />
        <SummaryPill label="Arrears" value={selectedAlreadyArrears} tone="red" />
        <SummaryPill label="Balance" value={selectedBalance} tone="dark" strong />
      </div>
    </div>
  );
}

function PaymentHistory({ payments }: any) {
  const rows = [...(payments || [])]
    .sort((a: any, b: any) => String(b.payment_date || b.date || b.created_at || "").localeCompare(String(a.payment_date || a.date || a.created_at || "")))
    .slice(0, 8);

  return (
    <div style={paymentHistoryBoxStyle}>
      <div style={paymentHistoryTitleStyle}>Payments Received</div>
      {rows.length === 0 ? (
        <div style={paymentHistoryEmptyStyle}>No payments received yet</div>
      ) : (
        <div style={paymentHistoryGridStyle}>
          {rows.map((p: any, index: number) => (
            <div key={`${p.id || "payment"}-${index}`} style={paymentHistoryItemStyle}>
              <span>{formatCardDate(p.payment_date || p.date || p.created_at)}</span>
              <strong>₹{Number(p.amount || 0).toFixed(0)}</strong>
              {Number(p.discount || 0) > 0 && <span>Disc ₹{Number(p.discount || 0).toFixed(0)}</span>}
              <span>{p.mode || p.payment_mode || "-"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryPill({ label, value, tone, strong }: any) {
  const styleMap: any = {
    blue: { background: "#eff6ff", color: "#0b3f91", borderColor: "#bfdbfe" },
    green: { background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" },
    purple: { background: "#faf5ff", color: "#7e22ce", borderColor: "#e9d5ff" },
    orange: { background: "#fff7ed", color: "#c2410c", borderColor: "#fed7aa" },
    red: { background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" },
    dark: { background: "#0f172a", color: "white", borderColor: "#0f172a" },
  };

  return (
    <div style={{ ...summaryPillStyle, ...(styleMap[tone] || styleMap.blue), fontWeight: strong ? 1000 : 900 }}>
      <span style={{ fontSize: 15, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.92 }}>{label}</span>
      <strong style={{ fontSize: 32, lineHeight: 1, fontWeight: 1000 }}>₹{Number(value || 0).toFixed(0)}</strong>
    </div>
  );
}

function Row({ label, value, strong }: any) {
  return <div style={{ display: "flex", justifyContent: "space-between", fontWeight: strong ? 950 : 850, fontSize: strong ? 18 : 16 }}><span>{label}</span><span>₹{Number(value || 0).toFixed(0)}</span></div>;
}

function CombinedRentalTable({ activeRentals, returnedPendingRentals, tools, paidCredit = 0 }: any) {
  const returnedRows = (returnedPendingRentals || []).map((row: any) => ({
    ...row,
    __type: "Returned",
  }));

  const currentRows = (activeRentals || []).map((row: any) => ({
    ...row,
    __type: "Current",
  }));

  const rows = [...returnedRows, ...currentRows];

  let creditLeft = Number(paidCredit || 0);
  const rowsWithBalance = rows.map((row: any) => {
    const isReturned = row.__type === "Returned";
    const amount = detailAmount(row, isReturned, tools);
    const covered = Math.min(Math.max(creditLeft, 0), amount);
    creditLeft -= covered;

    return {
      ...row,
      __amount: amount,
      __paidAgainst: covered,
      __balance: Math.max(0, amount - covered),
    };
  });

  const totalReturned = rowsWithBalance
    .filter((row: any) => row.__type === "Returned")
    .reduce((sum: number, row: any) => sum + Number(row.__balance || 0), 0);

  const totalCurrent = rowsWithBalance
    .filter((row: any) => row.__type === "Current")
    .reduce((sum: number, row: any) => sum + Number(row.__balance || 0), 0);

  const grandTotal = totalReturned + totalCurrent;

  return (
    <div style={rentalTableBoxStyle}>
      <div style={rentalTableTitleStyle}>
        <div>Rental Items</div>
        <span>Returned first, then current</span>
      </div>

      <div style={rentalTableWrapStyle}>
        <table style={rentalTableStyle}>
          <thead>
            <tr>
              <th style={rentalThSmallStyle}>#</th>
              <th style={rentalThStyle}>Type</th>
              <th style={rentalThStyle}>Start</th>
              <th style={rentalThStyle}>End / As On</th>
              <th style={rentalThLeftStyle}>Item</th>
              <th style={rentalThRightStyle}>Qty</th>
              <th style={rentalThRightStyle}>Rent</th>
              <th style={rentalThRightStyle}>Days</th>
              <th style={rentalThRightStyle}>Amount</th>
              <th style={rentalThRightStyle}>Balance</th>
            </tr>
          </thead>

          <tbody>
            {rowsWithBalance.map((row: any, index: number) => {
              const isReturned = row.__type === "Returned";
              const days = paymentRentalDays(row);
              const rent = `₹${paymentRentalRate(row, tools).toFixed(0)}`;
              const qty = Number(row.qty || row.quantity || 1);
              const amount = Number(row.__amount || 0);
              const balance = Number(row.__balance || 0);
              const toolName = displayToolName(row, tools);
              const startDate = formatCardDate(row.start_date || row.rental_date || row.date);
              const endDate = isReturned
                ? formatCardDate(row.return_date || row.end_date || row.closed_date)
                : formatCardDate(new Date());

              return (
                <tr key={`${row.rental_id || row.id || "rental"}-${index}`}>
                  <td style={rentalTdCenterStyle}>{index + 1}</td>
                  <td style={rentalTdStyle}>
                    <span style={isReturned ? returnedBadgeStyle : currentBadgeStyle}>
                      {isReturned ? "Returned" : "Live"}
                    </span>
                  </td>
                  <td style={rentalTdStyle}>{startDate}</td>
                  <td style={rentalTdStyle}>{endDate}</td>
                  <td style={rentalTdToolStyle}>🔧 {toolName}</td>
                  <td style={rentalTdRightStyle}>{qty}</td>
                  <td style={rentalTdRightStyle}>{rent}</td>
                  <td style={rentalTdRightStyle}>{days}</td>
                  <td style={rentalTdAmountStyle}>₹{amount.toFixed(0)}</td>
                  <td style={{ ...rentalTdAmountStyle, color: balance > 0 ? "#b91c1c" : "#166534" }}>
                    ₹{balance.toFixed(0)}
                  </td>
                </tr>
              );
            })}

            {rowsWithBalance.length === 0 && (
              <tr>
                <td colSpan={10} style={rentalEmptyCellStyle}>No rental items found</td>
              </tr>
            )}

            {rowsWithBalance.length > 0 && (
              <>
                <tr>
                  <td colSpan={9} style={rentalTotalLabelStyle}>Total Returned Pending</td>
                  <td style={rentalTotalAmountStyle}>₹{totalReturned.toFixed(0)}</td>
                </tr>
                <tr>
                  <td colSpan={9} style={rentalTotalLabelStyle}>Total Current Rentals</td>
                  <td style={rentalTotalAmountStyle}>₹{totalCurrent.toFixed(0)}</td>
                </tr>
                <tr>
                  <td colSpan={9} style={rentalGrandTotalLabelStyle}>Total Rental Amount</td>
                  <td style={rentalGrandTotalAmountStyle}>₹{grandTotal.toFixed(0)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function enrichRentalWithTool(row: any, tools: any[] = []) {
  const tool = findToolForRental(row, tools);

  return {
    ...row,
    tool_name: row.tool_name || row.tool || tool?.tool_name || tool?.name || "",
    daily_rate: Number(row.daily_rate || row.unit_price || row.daily_rent || row.rent || row.rate || tool?.daily_rent || tool?.daily_rate || tool?.rent || tool?.rate || 0),
  };
}

function findToolForRental(row: any, tools: any[] = []) {
  return tools.find((t: any) => String(t.id || "") === String(row.tool_id || row.toolId || ""));
}

function displayToolName(row: any, tools: any[] = []) {
  const tool = findToolForRental(row, tools);
  return (
    rowToolName(row) ||
    row.tool_name ||
    row.tool ||
    row.item_name ||
    row.name ||
    row.description ||
    tool?.tool_name ||
    tool?.name ||
    "Tool"
  );
}

function paymentRentalRate(row: any, tools: any[] = []) {
  const tool = findToolForRental(row, tools);
  const directRate = Number(
    row.daily_rate || row.unit_price || row.daily_rent || row.rent || row.rate || 0
  );

  if (directRate > 0) return directRate;

  return Number(tool?.daily_rent || tool?.daily_rate || tool?.rent || tool?.rate || 0);
}

function paymentRentalDays(row: any) {
  const start = row.start_date || row.date || row.rental_date;
  if (!start) return 0;

  const end = row.end_date || row.return_date || row.closed_date || new Date();
  const avoidSundays =
    row.avoid_sundays === false || row.avoid_sundays === "false" ? false : true;

  const startDate = new Date(String(start).slice(0, 10));
  const endDate = new Date(String(end instanceof Date ? end.toISOString() : end).slice(0, 10));

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  if (endDate < startDate) return 1;

  let days = 0;
  const d = new Date(startDate);

  while (d <= endDate) {
    const isSunday = d.getDay() === 0;
    if (!(avoidSundays && isSunday)) days++;
    d.setDate(d.getDate() + 1);
  }

  return Math.max(days, 1);
}

function paymentRentalAmount(row: any, tools: any[] = []) {
  const qty = Number(row.qty || row.quantity || 1);
  const rent = paymentRentalRate(row, tools);
  const days = paymentRentalDays(row);
  const discount = Number(row.discount || 0);

  const storedReturnedTotal = Number(row.total_amount || row.amount || 0);
  if ((row.status === "Returned" || row.end_date || row.return_date) && storedReturnedTotal > 0) {
    return storedReturnedTotal;
  }

  return Math.max(0, qty * rent * days - discount);
}

function detailAmount(row: any, isReturned: boolean, tools: any[] = []) {
  if (isReturned) return Number(row.balance || row.pending || row.amount || 0);
  return paymentRentalAmount(row, tools);
}

function formatCardDate(date: any) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString("en-GB");
}

async function embedImagesAsDataUrls(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;

      try {
        const absoluteUrl = new URL(src, window.location.origin).toString();
        const res = await fetch(absoluteUrl);
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        img.setAttribute("src", dataUrl);
      } catch {
        img.remove();
      }
    })
  );
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function RecentPaymentList({ payments }: any) {
  return (
    <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
      {payments.map((p: any, index: number) => (
        <div key={`${p.id || "payment"}-${index}`} style={miniCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div><strong style={{ fontSize: 18 }}>{p.customer_name || "-"}</strong><div style={{ color: "#64748b", fontWeight: 800 }}>{p.mobile || "-"} • {p.shop || "-"}</div></div>
            <div style={{ textAlign: "right" }}><strong style={{ fontSize: 22, color: "#16a34a" }}>₹{Number(p.amount || 0).toFixed(0)}</strong><div style={{ color: "#64748b" }}>{p.payment_date}</div></div>
          </div>
          {(Number(p.discount || 0) > 0 || p.mode || p.remarks) && <div style={{ marginTop: 8, color: "#475569" }}>Discount ₹{Number(p.discount || 0).toFixed(0)} • {p.mode || "-"} {p.remarks ? `• ${p.remarks}` : ""}</div>}
        </div>
      ))}
      {payments.length === 0 && <div style={emptyStyle}>No received payments found</div>}
    </div>
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

const twoColumnStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 4fr) minmax(260px, 1fr)", gap: 16, alignItems: "start", marginBottom: 22 };
const filterBoxStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 };
const bigControlStyle: CSSProperties = { minHeight: 52, borderRadius: 14, border: "1px solid #cbd5e1", padding: "0 14px", fontSize: 16, fontWeight: 800, background: "white" };
const labelStyle: CSSProperties = { display: "block", fontWeight: 950, marginBottom: 8, color: "#0f172a" };
const smallTitleStyle: CSSProperties = { margin: "0 0 12px", fontSize: 20, color: "#0f172a" };
const miniCardStyle: CSSProperties = { border: "1px solid #dbeafe", borderRadius: 18, padding: 14, background: "#ffffff", boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)" };
const emptyStyle: CSSProperties = { padding: 18, borderRadius: 16, background: "#f8fafc", color: "#64748b", fontWeight: 850, textAlign: "center" };
const customerBoxStyle: CSSProperties = { border: "2px solid #bfdbfe", background: "#f8fbff", borderRadius: 22, padding: 18, boxShadow: "0 14px 34px rgba(37, 99, 235, 0.10)" };
const statementLineBoxStyle: CSSProperties = { display: "grid", gap: 8, marginTop: 16, background: "white", borderRadius: 16, padding: 14, border: "1px solid #e2e8f0" };
const statementSummaryLineStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(6, minmax(145px, 1fr))", gap: 12, marginTop: 14 };
const summaryPillStyle: CSSProperties = { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: 8, border: "2px solid", borderRadius: 18, padding: "16px 18px", minHeight: 92, fontSize: 16, whiteSpace: "nowrap", boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)" };
const paymentHistoryBoxStyle: CSSProperties = { marginTop: 14, border: "3px solid #2563eb", background: "#ffffff", borderRadius: 18, padding: 14, boxShadow: "0 14px 32px rgba(37, 99, 235, 0.16)" };
const paymentHistoryTitleStyle: CSSProperties = { fontSize: 22, fontWeight: 1000, color: "#1d4ed8", marginBottom: 10, letterSpacing: 0.2 };
const paymentHistoryGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 };
const paymentHistoryItemStyle: CSSProperties = { display: "grid", gridTemplateColumns: "90px 82px 78px 1fr", gap: 8, alignItems: "center", border: "1px solid #bfdbfe", borderRadius: 14, padding: "10px 12px", fontSize: 15, fontWeight: 900, color: "#1e293b", background: "#f8fbff" };
const paymentHistoryEmptyStyle: CSSProperties = { padding: "8px 10px", borderRadius: 12, background: "#f8fafc", color: "#64748b", fontWeight: 850 };
const paymentFormStyle: CSSProperties = { marginTop: 16, border: "3px solid #a78bfa", borderRadius: 24, padding: 18, background: "linear-gradient(135deg, #6d28d9, #4f46e5)", boxShadow: "0 18px 42px rgba(79, 70, 229, 0.32)" };
const formGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 };
const detailRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", border: "1px solid #e2e8f0", background: "white", padding: 10, borderRadius: 14 };

const detailCardStyle: CSSProperties = { border: "1px solid #e2e8f0", background: "white", padding: 12, borderRadius: 16 };
const detailGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr auto", gap: "6px 16px", marginTop: 10, color: "#475569" };
const amountLineStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 10, fontSize: 18 };
const compactDetailsBoxStyle: CSSProperties = { display: "grid", gap: 0, marginTop: 10, border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", background: "white" };
const compactRentalLineStyle: CSSProperties = { padding: "12px 14px", borderBottom: "1px solid #e2e8f0" };
const compactToolNameStyle: CSSProperties = { fontWeight: 950, fontSize: 17, color: "#0f172a", lineHeight: 1.3 };
const compactMetaStyle: CSSProperties = { marginTop: 5, color: "#475569", fontWeight: 850, fontSize: 15, lineHeight: 1.4 };
const compactTotalLineStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "12px 14px", background: "#eff6ff", fontSize: 17 };
const inlineStatementStyle: CSSProperties = { marginTop: 18, border: "1px solid #93c5fd", borderRadius: 20, padding: 16, background: "#ffffff", boxShadow: "0 10px 28px rgba(37, 99, 235, 0.12)" };
const inlineStatementTopStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", marginBottom: 14, borderBottom: "1px solid #dbeafe", paddingBottom: 16 };
const logoWrapStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, minWidth: 390 };
const logoImageStyle: CSSProperties = { width: 380, maxHeight: 230, objectFit: "contain" };
const textLogoStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, color: "#0b2a6f" };
const textLogoBigStyle: CSSProperties = { fontSize: 38, lineHeight: 1, fontWeight: 950, letterSpacing: -2 };
const textLogoSmallStyle: CSSProperties = { fontSize: 17, lineHeight: 1.05, fontWeight: 950, textTransform: "uppercase", letterSpacing: 1.5 };
const statementTitleStyle: CSSProperties = { fontSize: 26, fontWeight: 950, color: "#0b2a6f", lineHeight: 1.1 };
const statementPeriodStyle: CSSProperties = { marginTop: 4, fontSize: 15, fontWeight: 900, color: "#334155" };
const statementInfoGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 12, fontSize: 15, fontWeight: 850 };
const statementInnerStyle: CSSProperties = { border: "1px solid #dbeafe", borderRadius: 16, overflow: "hidden", background: "#ffffff" };
const allShopAddressBoxStyle: CSSProperties = { marginTop: 12, border: "1px solid #dbeafe", borderRadius: 16, padding: 12, background: "#f8fbff" };
const allShopAddressGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 10 };
const shopAddressItemStyle: CSSProperties = { display: "grid", gap: 3, fontSize: 13, fontWeight: 850, color: "#334155", borderLeft: "4px solid #2563eb", paddingLeft: 9, lineHeight: 1.35 };
const statementRentalTableWrapStyle: CSSProperties = { borderBottom: "1px solid #dbeafe" };
const statementTableTitleStyle: CSSProperties = { padding: "12px 14px", fontSize: 20, fontWeight: 950, color: "#0b2a6f", background: "#eff6ff" };
const statementTableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const statementThStyle: CSSProperties = { background: "#0057ff", color: "white", padding: "9px 8px", textAlign: "left", fontWeight: 950 };
const statementThRightStyle: CSSProperties = { ...statementThStyle, textAlign: "right" };
const statementTdStyle: CSSProperties = { padding: "9px 8px", borderBottom: "1px solid #e2e8f0", fontWeight: 800, color: "#0f172a" };
const statementTdItemStyle: CSSProperties = { ...statementTdStyle, fontWeight: 950 };
const statementTdRightStyle: CSSProperties = { ...statementTdStyle, textAlign: "right" };
const statementTdAmountStyle: CSSProperties = { ...statementTdStyle, textAlign: "right", color: "#0057ff", fontWeight: 950 };
const statementEmptyTdStyle: CSSProperties = { padding: 14, textAlign: "center", fontWeight: 850, color: "#64748b" };
const statementTotalLabelStyle: CSSProperties = { padding: "10px 8px", textAlign: "right", fontWeight: 950, background: "#eff6ff", borderTop: "1px solid #bfdbfe" };
const statementTotalValueStyle: CSSProperties = { padding: "10px 8px", textAlign: "right", fontWeight: 950, color: "#0057ff", background: "#eff6ff", borderTop: "1px solid #bfdbfe" };

const rentalTableBoxStyle: CSSProperties = { marginTop: 16, border: "1px solid #bfdbfe", borderRadius: 18, overflow: "hidden", background: "#ffffff" };
const rentalTableTitleStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "14px 16px", background: "#eff6ff", color: "#002e8a", fontSize: 22, fontWeight: 950 };
const rentalTableWrapStyle: CSSProperties = { overflowX: "auto" };
const rentalTableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 1080 };
const rentalThStyle: CSSProperties = { background: "#0057ff", color: "white", padding: "12px 10px", fontSize: 17, fontWeight: 950, textAlign: "center", whiteSpace: "nowrap" };
const rentalThSmallStyle: CSSProperties = { ...rentalThStyle, width: 52 };
const rentalThLeftStyle: CSSProperties = { ...rentalThStyle, textAlign: "left" };
const rentalThRightStyle: CSSProperties = { ...rentalThStyle, textAlign: "right" };
const rentalTdStyle: CSSProperties = { padding: "12px 10px", borderBottom: "1px solid #dbeafe", fontSize: 17, fontWeight: 850, color: "#0f172a", textAlign: "center", whiteSpace: "nowrap" };
const rentalTdCenterStyle: CSSProperties = { ...rentalTdStyle, textAlign: "center", fontWeight: 950 };
const rentalTdToolStyle: CSSProperties = { ...rentalTdStyle, textAlign: "left", fontWeight: 950, minWidth: 260, whiteSpace: "normal" };
const rentalTdRightStyle: CSSProperties = { ...rentalTdStyle, textAlign: "right" };
const rentalTdAmountStyle: CSSProperties = { ...rentalTdStyle, textAlign: "right", color: "#0057ff", fontWeight: 950 };
const rentalEmptyCellStyle: CSSProperties = { padding: 20, textAlign: "center", fontSize: 18, fontWeight: 900, color: "#64748b" };
const rentalTotalLabelStyle: CSSProperties = { padding: "12px 10px", textAlign: "right", background: "#f8fafc", borderTop: "1px solid #dbeafe", fontSize: 18, fontWeight: 950 };
const rentalTotalAmountStyle: CSSProperties = { padding: "12px 10px", textAlign: "right", background: "#f8fafc", borderTop: "1px solid #dbeafe", color: "#0057ff", fontSize: 18, fontWeight: 950 };
const rentalGrandTotalLabelStyle: CSSProperties = { padding: "14px 10px", textAlign: "right", background: "#eaf3ff", borderTop: "1px solid #bfdbfe", fontSize: 20, fontWeight: 950 };
const rentalGrandTotalAmountStyle: CSSProperties = { padding: "14px 10px", textAlign: "right", background: "#eaf3ff", borderTop: "1px solid #bfdbfe", color: "#0057ff", fontSize: 22, fontWeight: 950 };
const returnedBadgeStyle: CSSProperties = { display: "inline-block", padding: "5px 10px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontSize: 14, fontWeight: 950 };
const currentBadgeStyle: CSSProperties = { display: "inline-block", padding: "5px 10px", borderRadius: 999, background: "#dbeafe", color: "#0057ff", fontSize: 14, fontWeight: 950 };

const overlayStyle: CSSProperties = { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.65)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const popupStyle: CSSProperties = { width: "min(560px, 100%)", background: "white", borderRadius: 22, padding: 24, boxShadow: "0 25px 80px rgba(0,0,0,0.35)", border: "1px solid #dbeafe" };
const blueInfoStyle: CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 16, padding: 16, marginBottom: 16, fontWeight: 900, lineHeight: 1.8 };
