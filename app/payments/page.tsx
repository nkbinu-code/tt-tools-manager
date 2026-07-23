"use client";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  deletePaymentEntry,
  getPaymentsData,
  moveCustomerBalanceToArrears,
  updatePaymentEntry,
} from "./actions";
import StatementPrintStyles from "../statements/StatementPrintStyles";
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
  {
    shop: "KARUVANNUR",
    address: "Near St. Mary's Church, Karuvannur, Thrissur.",
    phone: "6282778096",
  },
  {
    shop: "OLLUR",
    address: "Gramodharanam Rd, Ollur, Thrissur.",
    phone: "8589874904",
  },
  {
    shop: "KACHERY",
    address: "Kachery Centre, Kachery, Thrissur.",
    phone: "9744774904",
  },
  {
    shop: "MULAYAM",
    address: "Mulayam Jn, Mulayam Rd, Thrissur.",
    phone: "8086774904",
  },
  {
    shop: "PATTIKKAD",
    address: "Peechi Rd, Pattikkad, Thrissur.",
    phone: "9539712465",
  },
];

const paymentModes = ["Cash", "UPI", "GPay", "Bank", "Card", "Other"];

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const monthStart = () => `${thisMonth()}-01`;

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
  const [closedSearchText, setClosedSearchText] = useState("");
  const [paymentQuickSearch, setPaymentQuickSearch] = useState("");
  const [recentShopFilter, setRecentShopFilter] = useState("All Shops");
  const [recentFromDate, setRecentFromDate] = useState("");
  const [recentToDate, setRecentToDate] = useState("");

  const [customers, setCustomers] = useState<any[]>([]);
  const [pendingRows, setPendingRows] = useState<any[]>([]);
  const [pendingReturnedRentals, setPendingReturnedRentals] = useState<any[]>(
    [],
  );
  const [payments, setPayments] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [arrears, setArrears] = useState<any[]>([]);
  const [shopCashEntries, setShopCashEntries] = useState<any[]>([]);

  const [paymentRows, setPaymentRows] = useState<any[]>(
    Array.from({ length: 5 }, emptyPaymentRow),
  );
  const [advanceRow, setAdvanceRow] = useState<any>({
    payment_date: today(), mobile: "", customer_id: "", customer_name: "", shop: "", amount: "", mode: "Cash", remarks: ""
  });
  const [cashRows, setCashRows] = useState<any[]>(
    Array.from({ length: 5 }, emptyCashRow),
  );

  const [arrearsPopup, setArrearsPopup] = useState<any>(null);
  const [editPaymentForm, setEditPaymentForm] = useState<any>(null);
  const [deletePaymentPopup, setDeletePaymentPopup] = useState<any>(null);
  const [statementOptions, setStatementOptions] = useState<any>(null);
  const [arrearsReason, setArrearsReason] = useState("");
  const [arrearsRemarks, setArrearsRemarks] = useState("");
  const [showShopCashStatement, setShowShopCashStatement] = useState(false);
  const [shopCashStatementShop, setShopCashStatementShop] =
    useState("All Shops");
  const [shopCashStatementFrom, setShopCashStatementFrom] =
    useState(monthStart());
  const [shopCashStatementTo, setShopCashStatementTo] = useState(today());
  const paymentEntryRef = useRef<HTMLDivElement | null>(null);
  const statementRef = useRef<HTMLDivElement | null>(null);

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
      { data: shopCashData },
    ] = await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .order("customer_name", { ascending: true }),
      supabase
        .from("payments")
        .select("*")
        .order("payment_date", { ascending: false }),
      supabase.from("rentals").select("*"),
      supabase.from("tools").select("*"),
      supabase.from("sale_entries").select("*"),
      supabase
        .from("customer_arrears")
        .select("*")
        .order("moved_date", { ascending: false }),
      supabase
        .from("shop_cash_received")
        .select("*")
        .order("received_date", { ascending: false }),
    ]);

    setCustomers(customerData || []);
    setPayments(paymentData || []);
    setRentals(rentalData || []);
    setTools(toolData || []);
    setSales(saleData || []);
    setArrears(arrearsData || []);
    setShopCashEntries(shopCashData || []);
  }

  function sameMonth(date: any) {
    return String(date || "").slice(0, 7) === month;
  }

  function matchShop(row: any) {
    return (
      shopFilter === "All Shops" ||
      row.shop === shopFilter ||
      row.branch === shopFilter
    );
  }

  function findCustomerByMobile(mobile: string) {
    return customers.find(
      (c) => String(c.mobile || "").trim() === String(mobile || "").trim(),
    );
  }

  function findPendingByMobile(mobile: string) {
    return pendingRows.find(
      (p) => String(p.mobile || "").trim() === String(mobile || "").trim(),
    );
  }

  function getCustomerArrearsAmount(mobile: string, customerId?: any) {
    return arrears
      .filter(
        (a) =>
          String(a.mobile || "").trim() === String(mobile || "").trim() ||
          (customerId &&
            String(a.customer_id || "").trim() ===
              String(customerId || "").trim()),
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
              (p) =>
                String(p.mobile || "").trim() === String(value || "").trim(),
            ) || findPendingByMobile(value);

          updated.customer_id = customer?.id || pending?.id || "";
          updated.customer_name =
            customer?.customer_name ||
            customer?.name ||
            pending?.customer_name ||
            "";
          updated.shop =
            customer?.shop || customer?.branch || pending?.shop || "";
          updated.outstanding = String(Number(pending?.balance || 0));
        }

        return updated;
      }),
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
      remarks: row.tool_name
        ? `Payment for ${row.tool_name}`
        : "Rental payment",
    };

    setPaymentRows((prev) => {
      const next = [...prev];
      const emptyIndex = next.findIndex(
        (r) =>
          !r.mobile &&
          !r.customer_name &&
          !r.amount &&
          !r.discount &&
          !r.rental_id,
      );

      if (emptyIndex >= 0) {
        next[emptyIndex] = paymentRow;
        return next;
      }

      return [paymentRow, ...next];
    });

    setCustomerFilter(row.mobile || "");
  }

  function updateCashRow(index: number, field: string, value: string) {
    setCashRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  async function saveCustomerPayments() {
    const firstRow = paymentRows[0];

    if (!firstRow?.mobile) {
      showWarning("Please select a customer first");
      return;
    }

    if (
      Number(firstRow.amount || 0) <= 0 &&
      Number(firstRow.discount || 0) <= 0
    ) {
      showWarning("Please enter payment amount or round off");
      return;
    }

    const insertRows = [
      {
        payment_date: firstRow.payment_date,
        rental_id: firstRow.rental_id || null,
        customer_id: firstRow.customer_id || null,
        customer_name: firstRow.customer_name,
        mobile: firstRow.mobile,
        shop: firstRow.shop,
        amount: Number(firstRow.amount || 0),
        discount: Number(firstRow.discount || 0),
        mode: firstRow.mode,
        payment_mode: firstRow.mode,
        remarks: firstRow.remarks,
      },
    ];

    const { error } = await supabase.from("payments").insert(insertRows);

    if (error) {
      showError(error.message);
      return;
    }

    setPaymentRows(Array.from({ length: 5 }, emptyPaymentRow));
    await loadData();
    showSuccess("Payment saved successfully");
  }

  async function saveQuickPayment() {
    await saveCustomerPayments();
  }

  function openEditPayment(payment: any) {
    const mobile = String(payment.mobile || payment.customer_mobile || "").trim();

    setEditPaymentForm({
      id: payment.id || "",
      original_customer_id: payment.customer_id || "",
      original_mobile: mobile,
      rental_id: payment.rental_id || "",
      payment_date: String(payment.payment_date || payment.date || today()).slice(0, 10),
      customer_name: payment.customer_name || "",
      mobile,
      shop: payment.shop || payment.branch || "",
      amount: String(payment.amount ?? ""),
      discount: String(payment.discount ?? ""),
      mode: payment.mode || payment.payment_mode || "Cash",
      remarks: payment.remarks || "",
      entry_type: payment.entry_type || "payment",
      effective_date: payment.effective_date || payment.payment_date || today(),
    });
  }

  function updateEditPaymentField(field: string, value: string) {
    setEditPaymentForm((prev: any) => {
      if (!prev) return prev;

      const updated = { ...prev, [field]: value };

      if (field === "mobile") {
        const customer = findCustomerByMobile(value);
        if (customer) {
          updated.customer_name = customer.customer_name || customer.name || "";
          updated.shop = customer.shop || customer.branch || updated.shop || "";
        }
      }

      return updated;
    });
  }

  async function saveEditedPayment() {
    if (!editPaymentForm?.id) {
      showError("Payment id not found");
      return;
    }

    const amount = Number(editPaymentForm.amount || 0);
    const discount = Number(editPaymentForm.discount || 0);

    if (amount <= 0 && discount <= 0) {
      showWarning("Please enter payment amount or round off");
      return;
    }

    const customer = findCustomerByMobile(editPaymentForm.mobile);
    const mobileChanged =
      String(editPaymentForm.mobile || "").trim() !==
      String(editPaymentForm.original_mobile || "").trim();

    const res: any = await updatePaymentEntry({
      id: editPaymentForm.id,
      payment_date: editPaymentForm.payment_date || today(),
      rental_id: mobileChanged ? null : editPaymentForm.rental_id || null,
      customer_id:
        customer?.id ||
        (mobileChanged ? null : editPaymentForm.original_customer_id || null),
      customer_name:
        customer?.customer_name || customer?.name || editPaymentForm.customer_name || "",
      mobile: editPaymentForm.mobile || "",
      shop:
        editPaymentForm.shop ||
        customer?.shop ||
        customer?.branch ||
        "",
      amount,
      discount,
      mode: editPaymentForm.mode || "Cash",
      remarks: editPaymentForm.remarks || "",
      entry_type: editPaymentForm.entry_type || "payment",
      effective_date: editPaymentForm.effective_date || editPaymentForm.payment_date || today(),
    });

    if (!res.success) {
      showError(res.message || "Failed to update payment");
      return;
    }

    setEditPaymentForm(null);
    await loadData();
    showSuccess("Payment updated successfully");
  }

  async function confirmDeletePayment() {
    if (!deletePaymentPopup?.id) {
      showError("Payment id not found");
      return;
    }

    const res: any = await deletePaymentEntry(deletePaymentPopup.id);

    if (!res.success) {
      showError(res.message || "Failed to delete payment");
      return;
    }

    setDeletePaymentPopup(null);
    await loadData();
    showSuccess("Payment deleted successfully");
  }

  async function saveAdvancePayment() {
    const customer = findCustomerByMobile(advanceRow.mobile || selectedMobile);
    const amount = Number(advanceRow.amount || 0);
    if (!customer) return showWarning("Please select a customer");
    if (amount <= 0) return showWarning("Please enter advance amount");

    const { error } = await supabase.from("payments").insert({
      payment_date: advanceRow.payment_date || today(),
      effective_date: advanceRow.payment_date || today(),
      rental_id: null,
      customer_id: customer.id,
      customer_name: customer.customer_name || customer.name || "",
      mobile: customer.mobile || "",
      shop: customer.shop || customer.branch || "",
      amount,
      discount: 0,
      mode: advanceRow.mode || "Cash",
      payment_mode: advanceRow.mode || "Cash",
      remarks: advanceRow.remarks || "Advance Payment",
      entry_type: "advance",
    });
    if (error) return showError(error.message);
    setAdvanceRow({ payment_date: today(), mobile: "", customer_id: "", customer_name: "", shop: "", amount: "", mode: "Cash", remarks: "" });
    await loadData();
    showSuccess("Advance payment saved successfully");
  }

  async function saveShopCash() {
    const filled = cashRows.filter(
      (row) => row.shop && Number(row.amount || 0) > 0,
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

    const { error } = await supabase
      .from("shop_cash_received")
      .insert(insertRows);

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
    return (
      row.start_date || row.date || row.rental_date || row.created_at || ""
    );
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
    selectedCustomer?.id ||
      selectedPending?.customer_id ||
      selectedPending?.id ||
      "",
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
    (r: any) => !(r.end_date || r.return_date),
  );

  const selectedReturnedPendingRentals = selectedMobile
    ? pendingReturnedRentals.filter(
        (r: any) => String(r.mobile || "").trim() === selectedMobile,
      )
    : [];

  const selectedTotalSalesBusiness = selectedMobile
    ? sales
        .filter((s) => rowMobile(s) === selectedMobile)
        .reduce((sum, s) => sum + Number(s.total_sale || 0), 0)
    : 0;

  const selectedTotalRentalBusiness = selectedCustomerRentals.reduce(
    (sum: number, r: any) => sum + paymentRentalAmount(r, tools),
    0,
  );

  const selectedTotalBusiness =
    selectedTotalRentalBusiness + selectedTotalSalesBusiness;

  const selectedOpeningBalance = selectedCustomerPayments.reduce((sum: number, p: any) => {
    const type = String(p.entry_type || "payment").toLowerCase();
    const amount = Math.abs(Number(p.amount || 0));
    if (type === "opening_due") return sum + amount;
    if (type === "opening_credit") return sum - amount;
    return sum;
  }, 0);

  const selectedCashReceived = selectedCustomerPayments.reduce((sum: number, p: any) => {
    const type = String(p.entry_type || "payment").toLowerCase();
    if (type === "opening_due" || type === "opening_credit") return sum;
    return sum + Number(p.amount || 0);
  }, 0);

  const selectedDiscount = selectedCustomerPayments.reduce(
    (sum: number, p: any) => sum + Number(p.discount || 0),
    0,
  );

  const selectedAlreadyArrears = selectedMobile
    ? getCustomerArrearsAmount(
        selectedMobile,
        selectedCustomer?.id || selectedPending?.id,
      )
    : 0;

  const selectedBalance =
    selectedOpeningBalance +
    selectedTotalBusiness -
    selectedCashReceived -
    selectedDiscount -
    selectedAlreadyArrears;

  const monthRentals = rentals.filter(
    (r) => sameMonth(r.date || r.start_date || r.rental_date) && matchShop(r),
  );

  const monthSales = sales.filter(
    (s) => sameMonth(s.sale_date) && matchShop(s),
  );

  const monthPayments = payments.filter(
    (p) => sameMonth(p.effective_date || p.payment_date) && matchShop(p),
  );

  const monthBusiness =
    monthRentals.reduce((sum, r) => sum + paymentRentalAmount(r, tools), 0) +
    monthSales.reduce((sum, s) => sum + Number(s.total_sale || 0), 0);

  const monthPaymentTotal = monthPayments.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0,
  );

  const filteredReturnedPending =
    shopFilter === "All Shops"
      ? pendingReturnedRentals
      : pendingReturnedRentals.filter((row) => row.shop === shopFilter);

  const returnedPendingTotal = filteredReturnedPending.reduce(
    (sum, row) => sum + Number(row.balance || 0),
    0,
  );

  const filteredArrears =
    shopFilter === "All Shops"
      ? arrears
      : arrears.filter((row) => row.shop === shopFilter);

  const totalArrears = filteredArrears.reduce(
    (sum, row) => sum + Number(row.arrears_amount || 0),
    0,
  );

  const shopWiseArrears = shops
    .filter((s) => s !== "All Shops")
    .map((shop) => ({
      shop,
      amount: arrears
        .filter((a) => a.shop === shop)
        .reduce((sum, a) => sum + Number(a.arrears_amount || 0), 0),
    }));

  const recentPayments = payments
    .filter((p: any) => {
      const paymentShop = String(p.shop || p.branch || "").trim();
      return recentShopFilter === "All Shops" || paymentShop === recentShopFilter;
    })
    .filter((p: any) => {
      const paymentCustomerId = String(p.customer_id || "").trim();
      const paymentMobile = String(p.mobile || p.customer_mobile || "").trim();

      if (!selectedMobile && !selectedCustomerId) return true;

      return (
        (selectedCustomerId && paymentCustomerId === selectedCustomerId) ||
        (selectedMobile && paymentMobile === selectedMobile)
      );
    })
    .filter((p: any) => {
      const d = String(p.payment_date || p.date || p.created_at || "").slice(0, 10);
      if (recentFromDate && d && d < recentFromDate) return false;
      if (recentToDate && d && d > recentToDate) return false;
      return true;
    })
    .sort((a: any, b: any) =>
      String(b.payment_date || b.date || b.created_at || "").localeCompare(
        String(a.payment_date || a.date || a.created_at || ""),
      ),
    )
    .slice(0, 100);

  const statementRange = useMemo(
    () => getStatementRange(statementOptions),
    [statementOptions],
  );

  const statementRentals = useMemo(() => {
    if (!statementOptions) return [];

    return (selectedCustomerRentals || [])
      .filter(
        (r: any) =>
          statementOptions.period === "all" ||
          isInStatementRange(
            rentalDate(r),
            statementRange.from,
            statementRange.to,
          ),
      )
      .sort((a: any, b: any) =>
        String(rentalDate(a)).localeCompare(String(rentalDate(b))),
      );
  }, [selectedCustomerRentals, statementOptions, statementRange]);

  const statementPayments = useMemo(() => {
    if (!statementOptions) return [];

    return (selectedCustomerPayments || [])
      .filter(
        (p: any) =>
          statementOptions.period === "all" ||
          isInStatementRange(
            paymentDate(p),
            statementRange.from,
            statementRange.to,
          ),
      )
      .sort((a: any, b: any) =>
        String(paymentDate(a)).localeCompare(String(paymentDate(b))),
      );
  }, [selectedCustomerPayments, statementOptions, statementRange]);

  const statementRentalTotal = statementRentals.reduce(
    (sum: number, r: any) => sum + paymentRentalAmount(r, tools),
    0,
  );

  const statementPaidTotal = statementPayments.reduce(
    (sum: number, p: any) => sum + Number(p.amount || 0),
    0,
  );

  const statementDiscountTotal = statementPayments.reduce(
    (sum: number, p: any) => sum + Number(p.discount || 0),
    0,
  );

  const statementBalance =
    statementRentalTotal - statementPaidTotal - statementDiscountTotal;

  function downloadCsv() {
    const header = [
      "Date",
      "Customer",
      "Mobile",
      "Shop",
      "Amount",
      "Round Off",
      "Mode",
      "Remarks",
    ];

    const rows = recentPayments.map((p: any) => [
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
        r.map((c) => `"${String(c || "").replaceAll('"', '""')}"`).join(","),
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

  function findCustomerBySearchText(value: string) {
    const q = String(value || "").trim().toLowerCase();
    const digits = String(value || "").replace(/\D/g, "").trim();

    if (!q && !digits) return null;

    return (
      customers.find((c: any) => {
        const mobile = String(c.mobile || "").replace(/\D/g, "").trim();
        const name = String(c.customer_name || c.name || "")
          .trim()
          .toLowerCase();

        return (
          (digits && mobile === digits) ||
          (q.length > 0 && name === q)
        );
      }) || null
    );
  }

  function selectCustomerForPayments(customer: any) {
    if (!customer) return;

    const mobile = String(customer.mobile || "").trim();
    if (!mobile) return;

    setCustomerFilter(mobile);
    updatePaymentRow(0, "mobile", mobile);
    setStatementOptions({
      type: "combined",
      period: "thisMonth",
      fromDate: monthStart(),
      toDate: today(),
    });
  }

  function handlePaymentTopSearch(value: string) {
    setClosedSearchText(value);

    const exactCustomer = findCustomerBySearchText(value);
    if (exactCustomer) {
      selectCustomerForPayments(exactCustomer);
    }
  }

  function handlePaymentQuickSearch(value: string) {
    setPaymentQuickSearch(value);

    const exactCustomer = findCustomerBySearchText(value);
    if (exactCustomer) {
      selectCustomerForPayments(exactCustomer);
      setPaymentQuickSearch("");
    }
  }

  const rentalPaymentRows = useMemo(() => {
    function customerKey(row: any) {
      const mobile = String(row.mobile || row.customer_mobile || "")
        .replace(/\D/g, "")
        .trim();
      const customerId = String(row.customer_id || "").trim();
      const name = String(row.customer_name || row.name || "")
        .trim()
        .toLowerCase();
      const shop = String(row.shop || row.branch || "")
        .trim()
        .toLowerCase();

      if (mobile) return `mobile:${mobile}`;
      if (customerId) return `customer:${customerId}`;
      return `name:${name}-${shop}`;
    }

    function findCustomerForRow(row: any) {
      const rowCustomerId = String(row.customer_id || "").trim();
      const rowMobile = String(row.mobile || row.customer_mobile || "").trim();
      return customers.find(
        (c: any) =>
          (rowCustomerId && String(c.id || "").trim() === rowCustomerId) ||
          (rowMobile && String(c.mobile || "").trim() === rowMobile),
      );
    }

    function customerFinalBalance(row: any) {
      const customer = findCustomerForRow(row);
      const customerId = String(row.customer_id || customer?.id || "").trim();
      const mobile = String(row.mobile || row.customer_mobile || customer?.mobile || "").trim();

      const customerRentals = rentals
        .filter((r: any) => {
          const rentalCustomerId = String(r.customer_id || "").trim();
          const rentalMobile = String(r.mobile || r.customer_mobile || "").trim();
          return (
            (customerId && rentalCustomerId === customerId) ||
            (mobile && rentalMobile === mobile)
          );
        })
        .map((r: any) => enrichRentalWithTool(r, tools));

      const rentalBusiness = customerRentals.reduce(
        (sum: number, r: any) => sum + paymentRentalAmount(r, tools),
        0,
      );

      const salesBusiness = mobile
        ? sales
            .filter((sale: any) => rowMobile(sale) === mobile)
            .reduce((sum: number, sale: any) => sum + Number(sale.total_sale || 0), 0)
        : 0;

      const customerPayments = payments.filter((p: any) => {
        const paymentCustomerId = String(p.customer_id || "").trim();
        const paymentMobile = String(p.mobile || p.customer_mobile || "").trim();
        return (
          (customerId && paymentCustomerId === customerId) ||
          (mobile && paymentMobile === mobile)
        );
      });

      const paid = customerPayments.reduce(
        (sum: number, p: any) => sum + Number(p.amount || 0),
        0,
      );

      const discount = customerPayments.reduce(
        (sum: number, p: any) => sum + Number(p.discount || 0),
        0,
      );

      const alreadyArrears = arrears
        .filter((a: any) => {
          const arrearsCustomerId = String(a.customer_id || "").trim();
          const arrearsMobile = String(a.mobile || "").trim();
          return (
            (customerId && arrearsCustomerId === customerId) ||
            (mobile && arrearsMobile === mobile)
          );
        })
        .reduce((sum: number, a: any) => sum + Number(a.arrears_amount || 0), 0);

      return rentalBusiness + salesBusiness - paid - discount - alreadyArrears;
    }

    function isReturnedRow(row: any) {
      const status = String(row.status || row.payment_status || "")
        .trim()
        .toLowerCase();

      return (
        status === "returned" ||
        status === "closed" ||
        status === "completed" ||
        Boolean(row.end_date || row.return_date || row.closed_date)
      );
    }

    function rowSearchText(row: any) {
      return `${row.customer_name || ""} ${row.name || ""} ${row.mobile || row.customer_mobile || ""} ${row.tool_name || row.tool || row.item_name || ""} ${row.shop || row.branch || ""}`.toLowerCase();
    }

    function passesPaymentListFilters(row: any) {
      const rowShop = row.shop || row.branch || "";
      if (paymentShopFilter !== "All Shops" && rowShop !== paymentShopFilter) {
        return false;
      }

      const q = closedSearchText.trim().toLowerCase();
      if (!q) return true;
      return rowSearchText(row).includes(q);
    }

    const returnedFromRentals = rentals
      .filter((row: any) => isReturnedRow(row))
      .map((row: any) => {
        const customer = findCustomerForRow(row);
        const enriched = enrichRentalWithTool(row, tools);
        const finalBalance = customerFinalBalance({
          ...enriched,
          customer_id: row.customer_id || customer?.id || "",
          mobile: row.mobile || row.customer_mobile || customer?.mobile || "",
        });

        return {
          ...enriched,
          rental_id: row.id || row.rental_id || "",
          customer_id: row.customer_id || customer?.id || "",
          customer_name:
            row.customer_name ||
            row.name ||
            customer?.customer_name ||
            customer?.name ||
            "",
          mobile: row.mobile || row.customer_mobile || customer?.mobile || "",
          shop: row.shop || row.branch || customer?.shop || customer?.branch || "",
          tool_name: displayToolName(enriched, tools),
          start_date: row.start_date || row.date || row.rental_date || "",
          end_date: row.end_date || row.return_date || row.closed_date || "",
          return_date: row.return_date || row.end_date || row.closed_date || row.date || "",
          balance: finalBalance,
          final_balance: finalBalance,
          payment_status: finalBalance > 0 ? "Pending" : "Paid",
          payment_list_status: "Recently Closed",
        };
      });

    const returnedFromAction = pendingReturnedRentals.map((row: any) => {
      const finalBalance = customerFinalBalance(row);

      return {
        ...row,
        balance: finalBalance || Number(row.balance || 0),
        final_balance: finalBalance || Number(row.balance || 0),
        payment_list_status: "Recently Closed",
      };
    });

    const returnedRows = [...returnedFromRentals, ...returnedFromAction]
      .filter((row: any) => row.mobile || row.customer_name)
      .filter((row: any) => Number(row.final_balance ?? row.balance ?? 0) > 0)
      .filter((row: any) => passesPaymentListFilters(row));

    const liveRows = rentals
      .filter(
        (row: any) => !(row.end_date || row.return_date || row.closed_date),
      )
      .map((row: any) => {
        const customer = customers.find(
          (c: any) =>
            String(c.id || "") === String(row.customer_id || "") ||
            String(c.mobile || "").trim() ===
              String(row.mobile || row.customer_mobile || "").trim(),
        );
        const enriched = enrichRentalWithTool(row, tools);
        return {
          ...enriched,
          rental_id: row.id || row.rental_id || "",
          customer_id: row.customer_id || customer?.id || "",
          customer_name:
            row.customer_name ||
            row.name ||
            customer?.customer_name ||
            customer?.name ||
            "",
          mobile: row.mobile || row.customer_mobile || customer?.mobile || "",
          shop:
            row.shop || row.branch || customer?.shop || customer?.branch || "",
          tool_name: displayToolName(enriched, tools),
          start_date: row.start_date || row.date || row.rental_date || "",
          return_date: "",
          balance: paymentRentalAmount(enriched, tools),
          payment_status: "Live",
          payment_list_status: "Live Rental",
        };
      })
      .filter((row: any) => row.mobile || row.customer_name)
      .filter((row: any) => passesPaymentListFilters(row));

    const groupedRows = new Map<string, any>();

    [...returnedRows, ...liveRows].forEach((row: any) => {
      const key = customerKey(row);
      const customer = findCustomerForRow(row);
      const current = groupedRows.get(key);
      const isLive = row.payment_list_status === "Live Rental";
      const rowReturnDate = String(row.return_date || row.end_date || row.closed_date || "").slice(0, 10);

      const baseRow = current || {
        ...row,
        rental_id: "",
        customer_id: row.customer_id || customer?.id || "",
        customer_name:
          row.customer_name || row.name || customer?.customer_name || customer?.name || "",
        mobile: row.mobile || row.customer_mobile || customer?.mobile || "",
        shop: row.shop || row.branch || customer?.shop || customer?.branch || "",
        tool_name: "",
        has_live_rental: false,
        latest_return_date: "",
        payment_list_status: "Recently Closed",
      };

      baseRow.has_live_rental = Boolean(baseRow.has_live_rental || isLive);
      baseRow.latest_return_date =
        rowReturnDate && rowReturnDate > String(baseRow.latest_return_date || "")
          ? rowReturnDate
          : baseRow.latest_return_date;
      baseRow.return_date = baseRow.latest_return_date;
      baseRow.payment_list_status = baseRow.has_live_rental ? "Live Rental" : "Recently Closed";
      baseRow.payment_status = baseRow.has_live_rental ? "Live" : "Returned";
      baseRow.final_balance = customerFinalBalance(baseRow);
      baseRow.balance = baseRow.final_balance;

      groupedRows.set(key, baseRow);
    });

    return Array.from(groupedRows.values())
      .filter((row: any) => row.mobile || row.customer_name)
      .sort((a: any, b: any) => {
        const aLive = a.payment_list_status === "Live Rental";
        const bLive = b.payment_list_status === "Live Rental";
        if (aLive !== bLive) return aLive ? 1 : -1;
        if (!aLive && !bLive) {
          return String(b.latest_return_date || "").localeCompare(String(a.latest_return_date || ""));
        }
        return String(a.customer_name || "").localeCompare(String(b.customer_name || ""));
      });
  }, [
    pendingReturnedRentals,
    rentals,
    customers,
    tools,
    sales,
    payments,
    arrears,
    paymentShopFilter,
    closedSearchText,
  ]);

  function selectRentalForPayment(row: any) {
    const mobile = String(row.mobile || "").trim();

    receivePendingRental(row);

    if (mobile) {
      setCustomerFilter(mobile);
      updatePaymentRow(0, "mobile", mobile);
      setStatementOptions({
        type: "combined",
        period: "thisMonth",
        fromDate: monthStart(),
        toDate: today(),
      });
    }

    setTimeout(
      () =>
        paymentEntryRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      50,
    );
  }

  function selectRentalForStatement(row: any) {
    const mobile = String(row.mobile || "").trim();
    if (!mobile) {
      showWarning("Customer mobile number not found");
      return;
    }
    setCustomerFilter(mobile);
    updatePaymentRow(0, "mobile", mobile);
    setStatementOptions({
      type: "combined",
      period: "thisMonth",
      fromDate: monthStart(),
      toDate: today(),
    });
    setTimeout(
      () =>
        statementRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      80,
    );
  }

  const shopCashStatementRows = shopCashEntries
    .filter(
      (row: any) =>
        shopCashStatementShop === "All Shops" ||
        row.shop === shopCashStatementShop,
    )
    .filter((row: any) => {
      const d = String(
        row.received_date || row.date || row.created_at || "",
      ).slice(0, 10);
      if (shopCashStatementFrom && d && d < shopCashStatementFrom) return false;
      if (shopCashStatementTo && d && d > shopCashStatementTo) return false;
      return true;
    });

  const shopCashStatementTotal = shopCashStatementRows.reduce(
    (sum: number, row: any) => sum + Number(row.amount || 0),
    0,
  );

  function downloadShopCashStatementCsv() {
    const header = [
      "Date",
      "Shop",
      "Received From",
      "Amount",
      "Mode",
      "Remarks",
    ];
    const rows = shopCashStatementRows.map((row: any) => [
      String(row.received_date || row.date || row.created_at || "").slice(
        0,
        10,
      ),
      row.shop,
      row.received_from,
      row.amount,
      row.mode || row.payment_mode,
      row.remarks,
    ]);

    const csv = [header, ...rows]
      .map((r) =>
        r.map((c) => `"${String(c || "").replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "T&T_Shop_Cash_Statement.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

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
    <main style={calculatorPageStyle}>
      <StatementPrintStyles />
      <style>{`
        .modern-card {
          background: linear-gradient(180deg, #0b4cc2 0%, #083987 100%) !important;
          border: 1px solid rgba(255,255,255,0.18) !important;
          border-radius: 24px !important;
          box-shadow: 0 20px 42px rgba(2, 8, 23, 0.22) !important;
          color: #ffffff !important;
        }

        .modern-card .section-header h2,
        .modern-card h2,
        .modern-card h3 {
          color: #ffffff !important;
        }

        .modern-card .section-header p {
          color: rgba(255,255,255,0.78) !important;
        }

        .modern-card table {
          background: #ffffff !important;
          border-radius: 18px !important;
          overflow: hidden !important;
        }

        .modern-card th {
          background: #071426 !important;
          color: #ffffff !important;
          border-color: rgba(255,255,255,0.12) !important;
        }

        .modern-card td {
          border-color: #dbeafe !important;
          color: #0f172a !important;
        }

        .modern-card td strong,
        .modern-card td .strong {
          color: #0f172a !important;
        }

        .modern-card .btn-blue {
          background: linear-gradient(135deg, #16a34a 0%, #0ca43d 100%) !important;
          border-color: #16a34a !important;
          color: #ffffff !important;
          box-shadow: 0 10px 20px rgba(22, 163, 74, 0.24) !important;
        }

        .modern-card .btn-gray {
          background: linear-gradient(135deg, #f59e0b 0%, #facc15 100%) !important;
          border-color: #f59e0b !important;
          color: #061426 !important;
          font-weight: 950 !important;
        }

        .modern-card input,
        .modern-card select,
        .modern-card textarea {
          border-radius: 12px !important;
          border: 1px solid #bfdbfe !important;
          font-weight: 850 !important;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

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
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
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
            font-size: 10.5px !important;
          }

          .tt-print-area th,
          .tt-print-area td {
            padding: 4px 5px !important;
            font-size: 10.5px !important;
            line-height: 1.16 !important;
          }

          .tt-print-area div,
          .tt-print-area span,
          .tt-print-area strong {
            font-size: 12px !important;
          }

          .tt-print-area [style*="font-size: 46px"],
          .tt-print-area [style*="font-size: 34px"],
          .tt-print-area [style*="font-size: 30px"],
          .tt-print-area [style*="font-size: 28px"],
          .tt-print-area [style*="font-size: 26px"] {
            font-size: 18px !important;
          }

          .tt-print-area [style*="font-size: 24px"],
          .tt-print-area [style*="font-size: 22px"],
          .tt-print-area [style*="font-size: 20px"] {
            font-size: 15px !important;
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

      {arrearsPopup && (
        <div style={overlayStyle}>
          <div style={popupStyle}>
            <h2 style={{ marginTop: 0, fontSize: 26, color: "#0f172a" }}>
              Move Balance to Arrears
            </h2>
            <div style={blueInfoStyle}>
              <div>Customer: {arrearsPopup.customer_name}</div>
              <div>Mobile: {arrearsPopup.mobile}</div>
              <div>Shop: {arrearsPopup.shop || "-"}</div>
              <div style={{ fontSize: 24, color: "#0057ff" }}>
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

      {editPaymentForm && (
        <PaymentEditorPopup
          form={editPaymentForm}
          shops={shops}
          paymentModes={paymentModes}
          onChange={updateEditPaymentField}
          onCancel={() => setEditPaymentForm(null)}
          onSave={saveEditedPayment}
        />
      )}

      {deletePaymentPopup && (
        <DeletePaymentPopup
          payment={deletePaymentPopup}
          onCancel={() => setDeletePaymentPopup(null)}
          onDelete={confirmDeletePayment}
        />
      )}

      <section style={rentalPaymentSheetStyle}>
        <div style={rentalPaymentTopStyle}>
          <h1 style={rentalPaymentTitleStyle}>Rental Payments</h1>
          <input
            list="paymentCustomerSearchList"
            value={closedSearchText}
            onChange={(e) => handlePaymentTopSearch(e.target.value)}
            placeholder="Search Customer, Shop, Mobile..."
            style={rentalPaymentSearchStyle}
          />
          <datalist id="paymentCustomerSearchList">
            {customers.map((c) => (
              <option key={c.id} value={c.mobile} label={c.customer_name || c.name} />
            ))}
          </datalist>
          <datalist id="paymentQuickCustomerSearchList">
            {customers.flatMap((c: any) => [
              <option key={`${c.id}-mobile`} value={c.mobile} label={c.customer_name || c.name} />,
              <option key={`${c.id}-name`} value={c.customer_name || c.name} label={c.mobile} />,
            ])}
          </datalist>
          <select
            value={paymentShopFilter}
            onChange={(e) => setPaymentShopFilter(e.target.value)}
            style={rentalPaymentShopSelectStyle}
            title="Select shop"
          >
            {shops.map((shop) => (
              <option key={shop}>{shop}</option>
            ))}
          </select>
        </div>

        <RentalPaymentsTable
          rows={rentalPaymentRows}
          onStatement={selectRentalForStatement}
          onPay={selectRentalForPayment}
        />
      </section>

      <section ref={paymentEntryRef} style={paymentBlueBoxStyle}>
        <div style={paymentBlueTopStyle}>
          <div style={paymentBlueTitleStyle}>Payments</div>

          <div style={paymentBlueCustomerStyle}>
            <div style={paymentBlueMetaLabelStyle}>Selected Customer</div>
            <div style={paymentBlueNameStyle}>
              {paymentRows[0]?.customer_name ||
                selectedCustomer?.customer_name ||
                selectedCustomer?.name ||
                selectedPending?.customer_name ||
                "Select customer"}
            </div>
            <div style={paymentBlueLongInfoBarStyle}>
              <span>📱 {selectedMobile || "-"}</span>
              <span>🏪 {paymentRows[0]?.shop || selectedCustomer?.shop || selectedPending?.shop || "-"}</span>
            </div>
            <input
              list="paymentQuickCustomerSearchList"
              value={paymentQuickSearch}
              onChange={(e) => handlePaymentQuickSearch(e.target.value)}
              placeholder="Search next customer by name or mobile..."
              style={paymentQuickCustomerSearchStyle}
            />
          </div>

          <div style={paymentBlueBalanceBoxStyle}>
            <div style={paymentBlueBalanceCaptionStyle}>Balance Rs</div>
            <div style={paymentBlueBalanceValueStyle}>{selectedBalance.toFixed(0)}</div>
          </div>
        </div>

        <div style={paymentBlueInputsStyle}>
          <input
            type="number"
            value={paymentRows[0]?.amount || ""}
            onChange={(e) => updatePaymentRow(0, "amount", e.target.value)}
            placeholder="Amount Received"
            style={paymentPillInputStyle}
          />
          <input
            type="number"
            value={paymentRows[0]?.discount || ""}
            onChange={(e) => updatePaymentRow(0, "discount", e.target.value)}
            placeholder="Round Off"
            style={paymentPillInputStyle}
          />
          <select
            value={paymentRows[0]?.mode || "Cash"}
            onChange={(e) => updatePaymentRow(0, "mode", e.target.value)}
            style={paymentPillInputStyle}
          >
            {paymentModes.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <button className="btn-blue" type="button" onClick={saveQuickPayment} style={paymentSaveButtonStyle}>
            Save Payment
          </button>
          <button className="btn-gray" type="button" onClick={openArrearsPopup} disabled={selectedBalance <= 0} style={paymentArrearsButtonStyle}>
            Move to Arrears
          </button>
        </div>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.35)" }}>
          <div style={{ fontWeight: 950, fontSize: 20, marginBottom: 10 }}>Receive Advance</div>
          <div style={paymentBlueInputsStyle}>
            <input type="date" value={advanceRow.payment_date} onChange={(e) => setAdvanceRow({ ...advanceRow, payment_date: e.target.value })} style={paymentPillInputStyle} />
            <input list="paymentQuickCustomerSearchList" value={advanceRow.mobile} onChange={(e) => setAdvanceRow({ ...advanceRow, mobile: e.target.value })} placeholder="Customer mobile" style={paymentPillInputStyle} />
            <input type="number" value={advanceRow.amount} onChange={(e) => setAdvanceRow({ ...advanceRow, amount: e.target.value })} placeholder="Advance Amount" style={paymentPillInputStyle} />
            <select value={advanceRow.mode} onChange={(e) => setAdvanceRow({ ...advanceRow, mode: e.target.value })} style={paymentPillInputStyle}>{paymentModes.map((m) => <option key={m}>{m}</option>)}</select>
            <input value={advanceRow.remarks} onChange={(e) => setAdvanceRow({ ...advanceRow, remarks: e.target.value })} placeholder="Notes" style={paymentPillInputStyle} />
            <button className="btn-blue" type="button" onClick={saveAdvancePayment} style={paymentSaveButtonStyle}>Save Advance</button>
          </div>
        </div>

        <RecentPaymentManager
          payments={recentPayments}
          shops={shops}
          shopFilter={recentShopFilter}
          setShopFilter={setRecentShopFilter}
          fromDate={recentFromDate}
          setFromDate={setRecentFromDate}
          toDate={recentToDate}
          setToDate={setRecentToDate}
          selectedMobile={selectedMobile}
          selectedCustomerName={
            paymentRows[0]?.customer_name ||
            selectedCustomer?.customer_name ||
            selectedCustomer?.name ||
            selectedPending?.customer_name ||
            ""
          }
          onEdit={openEditPayment}
          onDelete={setDeletePaymentPopup}
          onDownload={downloadCsv}
        />
      </section>

      <section ref={statementRef} style={statementSimpleSectionStyle}>
        {selectedMobile ? (
          <InlineCustomerStatement
            selectedCustomer={selectedCustomer}
            selectedPending={selectedPending}
            selectedMobile={selectedMobile}
            statementOptions={
              statementOptions || {
                type: "combined",
                period: "custom",
                fromDate: monthStart(),
                toDate: today(),
              }
            }
            statementRange={statementRange}
            statementRentals={statementRentals}
            statementPayments={statementPayments}
            statementRentalTotal={statementRentalTotal}
            statementPaidTotal={statementPaidTotal}
            statementDiscountTotal={statementDiscountTotal}
            statementBalance={statementBalance}
            allCustomerRentals={selectedCustomerRentals}
            allCustomerPayments={selectedCustomerPayments}
            tools={tools}
            statementPeriodLabel={statementPeriodLabel}
            formatDisplayDate={formatDisplayDate}
            setStatementOptions={setStatementOptions}
            clearStatement={() => setStatementOptions(null)}
          />
        ) : (
          <div style={emptyWorkflowStyle}>Click View from Rental Payments to see statement here.</div>
        )}
      </section>

      <section className="modern-card">
        <SectionHeader
          title="Shop Cash Received"
          subtitle="Kept as table style for fast shop cash entry."
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
              <button
                className="btn-gray"
                onClick={() => setShowShopCashStatement((v) => !v)}
              >
                📄 Statement
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
                      onChange={(e) =>
                        updateCashRow(index, "shop", e.target.value)
                      }
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
                      onChange={(e) =>
                        updateCashRow(index, "amount", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={row.mode}
                      onChange={(e) =>
                        updateCashRow(index, "mode", e.target.value)
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
                        updateCashRow(index, "remarks", e.target.value)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {showShopCashStatement && (
          <ShopCashStatement
            rows={shopCashStatementRows}
            total={shopCashStatementTotal}
            shops={shops}
            shop={shopCashStatementShop}
            setShop={setShopCashStatementShop}
            fromDate={shopCashStatementFrom}
            setFromDate={setShopCashStatementFrom}
            toDate={shopCashStatementTo}
            setToDate={setShopCashStatementTo}
            onDownload={downloadShopCashStatementCsv}
          />
        )}
      </section>

      <section className="modern-card">
        <SectionHeader
          title="Arrears"
          subtitle="Old not-paid money. Show mainly balances pending for 3 months or more."
        />
        <div className="kpi-grid">
          {shopWiseArrears.map((row) => (
            <Kpi
              key={row.shop}
              title={row.shop}
              value={`₹${Number(row.amount || 0).toFixed(0)}`}
            />
          ))}
        </div>
        <h3 style={smallTitleStyle}>
          3 months and older arrears / not paid money
        </h3>
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
              {oldArrearsRows.map((a: any, index: number) => (
                <tr key={`${a.id || "arrears"}-${index}`}>
                  <td>{a.moved_date}</td>
                  <td>
                    <strong>{a.customer_name}</strong>
                  </td>
                  <td>{a.mobile}</td>
                  <td>{a.shop}</td>
                  <td className="strong">
                    ₹{Number(a.arrears_amount || 0).toFixed(0)}
                  </td>
                  <td>{a.reason}</td>
                  <td>{a.remarks}</td>
                </tr>
              ))}
              {oldArrearsRows.length === 0 && (
                <tr>
                  <td colSpan={7}>No 3-month arrears found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}


function PaymentEditorPopup({
  form,
  shops,
  paymentModes,
  onChange,
  onCancel,
  onSave,
}: any) {
  return (
    <div style={overlayStyle}>
      <div style={{ ...popupStyle, width: "min(720px, 100%)" }}>
        <h2 style={paymentPopupTitleStyle}>Edit Payment</h2>
        <div style={paymentEditNoteStyle}>
          Change the wrong amount, round off, date, mode, shop, or mobile. If you
          change the mobile number, the old rental link will be cleared so the
          payment goes to the corrected customer.
        </div>

        <div style={paymentEditGridStyle}>
          <label style={paymentEditLabelStyle}>
            Date
            <input
              type="date"
              value={form.payment_date || today()}
              onChange={(e) => onChange("payment_date", e.target.value)}
            />
          </label>

          <label style={paymentEditLabelStyle}>
            Mobile
            <input
              value={form.mobile || ""}
              onChange={(e) => onChange("mobile", e.target.value)}
              placeholder="Customer mobile"
            />
          </label>

          <label style={paymentEditLabelStyle}>
            Customer
            <input
              value={form.customer_name || ""}
              onChange={(e) => onChange("customer_name", e.target.value)}
              placeholder="Customer name"
            />
          </label>

          <label style={paymentEditLabelStyle}>
            Shop
            <select
              value={form.shop || ""}
              onChange={(e) => onChange("shop", e.target.value)}
            >
              <option value="">Shop</option>
              {shops
                .filter((shop: string) => shop !== "All Shops")
                .map((shop: string) => (
                  <option key={shop}>{shop}</option>
                ))}
            </select>
          </label>

          <label style={paymentEditLabelStyle}>
            Amount
            <input
              type="number"
              value={form.amount || ""}
              onChange={(e) => onChange("amount", e.target.value)}
              placeholder="Amount received"
            />
          </label>

          <label style={paymentEditLabelStyle}>
            Round Off
            <input
              type="number"
              value={form.discount || ""}
              onChange={(e) => onChange("discount", e.target.value)}
              placeholder="Round off"
            />
          </label>

          <label style={paymentEditLabelStyle}>
            Mode
            <select
              value={form.mode || "Cash"}
              onChange={(e) => onChange("mode", e.target.value)}
            >
              {paymentModes.map((mode: string) => (
                <option key={mode}>{mode}</option>
              ))}
            </select>
          </label>

          <label style={{ ...paymentEditLabelStyle, gridColumn: "1 / -1" }}>
            Remarks
            <textarea
              value={form.remarks || ""}
              onChange={(e) => onChange("remarks", e.target.value)}
              rows={3}
              placeholder="Remarks"
            />
          </label>
        </div>

        <div style={popupButtonRowStyle}>
          <button className="btn-gray" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-blue" type="button" onClick={onSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function DeletePaymentPopup({ payment, onCancel, onDelete }: any) {
  return (
    <div style={overlayStyle}>
      <div style={popupStyle}>
        <h2 style={paymentPopupTitleStyle}>Delete Payment?</h2>
        <div style={deletePaymentWarningStyle}>
          <div>
            <strong>{payment.customer_name || "Customer"}</strong> • {payment.mobile || "-"}
          </div>
          <div>Shop: {payment.shop || "-"}</div>
          <div>Date: {formatCardDate(payment.payment_date || payment.date || payment.created_at)}</div>
          <div style={{ fontSize: 24, color: "#b91c1c", fontWeight: 1000 }}>
            Amount: ₹{Number(payment.amount || 0).toFixed(0)}
          </div>
          {Number(payment.discount || 0) > 0 && (
            <div>Round Off: ₹{Number(payment.discount || 0).toFixed(0)}</div>
          )}
        </div>
        <p style={deletePaymentTextStyle}>
          This will remove the wrong payment from Reports and Customer Balance.
        </p>
        <div style={popupButtonRowStyle}>
          <button className="btn-gray" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={onDelete} style={deleteConfirmButtonStyle}>
            Delete Payment
          </button>
        </div>
      </div>
    </div>
  );
}

function RecentPaymentManager({
  payments,
  shops,
  shopFilter,
  setShopFilter,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  selectedMobile,
  selectedCustomerName,
  onEdit,
  onDelete,
  onDownload,
}: any) {
  const title = selectedMobile
    ? `Recent Payments - ${selectedCustomerName || selectedMobile}`
    : "Recent Payments";

  const subtitle = selectedMobile
    ? "Showing payments for the selected customer. Use date range to check old payments."
    : "Select a customer above to see only that customer, or use shop/date range for all payments.";

  return (
    <div style={recentPaymentsInsidePaymentStyle}>
      <div style={recentPaymentsHeaderStyle}>
        <div>
          <h3 style={recentPaymentsTitleStyle}>{title}</h3>
          <p style={recentPaymentsSubtitleStyle}>{subtitle}</p>
        </div>
        <button className="btn-blue" type="button" onClick={onDownload} style={recentPaymentDownloadButtonStyle}>
          <Download size={16} /> Download
        </button>
      </div>

      <div style={recentPaymentsControlsStyle}>
        <select
          value={shopFilter}
          onChange={(e) => setShopFilter(e.target.value)}
          style={recentPaymentControlStyle}
          title="Select shop"
        >
          {shops.map((shop: string) => (
            <option key={shop}>{shop}</option>
          ))}
        </select>
        <label style={recentPaymentDateLabelStyle}>
          From
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={recentPaymentControlStyle}
          />
        </label>
        <label style={recentPaymentDateLabelStyle}>
          To
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={recentPaymentControlStyle}
          />
        </label>
        {(fromDate || toDate) && (
          <button
            className="btn-gray"
            type="button"
            onClick={() => {
              setFromDate("");
              setToDate("");
            }}
            style={recentPaymentClearButtonStyle}
          >
            Clear Dates
          </button>
        )}
      </div>

      <div className="table-wrap" style={recentPaymentTableWrapStyle}>
        <table style={recentPaymentTableStyle}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Customer</th>
              <th>Mobile</th>
              <th>Shop</th>
              <th>Amount</th>
              <th>Round Off</th>
              <th>Mode</th>
              <th>Remarks</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(payments || []).map((payment: any, index: number) => (
              <tr key={`${payment.id || "payment"}-${index}`}>
                <td>{formatCardDate(payment.payment_date || payment.date || payment.created_at)}</td>
                <td>
                  <strong>{payment.customer_name || "-"}</strong>
                </td>
                <td>{payment.mobile || "-"}</td>
                <td>{payment.shop || "-"}</td>
                <td className="strong">₹{Number(payment.amount || 0).toFixed(0)}</td>
                <td>₹{Number(payment.discount || 0).toFixed(0)}</td>
                <td>{payment.mode || payment.payment_mode || "-"}</td>
                <td>{payment.remarks || "-"}</td>
                <td>
                  <div style={recentPaymentActionStyle}>
                    <button type="button" style={editPaymentButtonStyle} onClick={() => onEdit(payment)}>
                      Edit
                    </button>
                    <button type="button" style={deletePaymentButtonStyle} onClick={() => onDelete(payment)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!payments || payments.length === 0) && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", fontWeight: 900, padding: 18 }}>
                  No payments found for this customer / date period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShopCashStatement({
  rows,
  total,
  shops,
  shop,
  setShop,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  onDownload,
}: any) {
  return (
    <div style={shopCashStatementStyle}>
      <div style={shopCashStatementHeaderStyle}>
        <div>
          <h3
            style={{
              margin: 0,
              color: "#0f766e",
              fontSize: 26,
              fontWeight: 1000,
            }}
          >
            📄 Shop Cash Statement
          </h3>
          <p style={{ margin: "4px 0 0", color: "#475569", fontWeight: 850 }}>
            View and download cash received from shops.
          </p>
        </div>
        <button
          className="btn-blue"
          onClick={onDownload}
          style={{
            background: "#0f766e",
            borderColor: "#0f766e",
            fontWeight: 1000,
          }}
        >
          <Download size={16} /> Download
        </button>
      </div>
      <div style={statementQuickControlsStyle}>
        <select
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          style={bigControlStyle}
        >
          {shops.map((s: string) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          style={bigControlStyle}
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          style={bigControlStyle}
        />
        <div style={{ ...balanceBadgeStyle, background: "#0f766e" }}>
          Total ₹{Number(total || 0).toFixed(0)}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Shop</th>
              <th>Received From</th>
              <th>Mode</th>
              <th>Remarks</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, index: number) => (
              <tr key={row.id || index}>
                <td>
                  {String(
                    row.received_date || row.date || row.created_at || "",
                  ).slice(0, 10)}
                </td>
                <td>{row.shop || "-"}</td>
                <td>{row.received_from || "-"}</td>
                <td>{row.mode || row.payment_mode || "-"}</td>
                <td>{row.remarks || "-"}</td>
                <td className="strong">
                  ₹{Number(row.amount || 0).toFixed(0)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6}>No shop cash entries found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkflowHeader({ number, icon, title, subtitle, color }: any) {
  return (
    <div style={{ ...workflowHeaderStyle, borderColor: color }}>
      <div style={{ ...workflowIconStyle, background: color }}>{number}</div>
      <div style={{ fontSize: 34 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <h2 style={{ ...workflowTitleStyle, color }}>{title}</h2>
        <p style={workflowSubtitleStyle}>{subtitle}</p>
      </div>
    </div>
  );
}

function RentalPaymentsTable({ rows, onStatement, onPay }: any) {
  function daysAfterReturn(row: any) {
    if (row.payment_list_status === "Live Rental") return "Ongoing";
    const d = String(row.return_date || row.end_date || "").slice(0, 10);
    if (!d) return "-";
    const start = new Date(d);
    const now = new Date(today());
    if (Number.isNaN(start.getTime())) return "-";
    const diff = Math.floor((now.getTime() - start.getTime()) / 86400000);
    return `${Math.max(0, diff)} day${Math.max(0, diff) === 1 ? "" : "s"}`;
  }

  function tableCustomerKey(row: any) {
    const mobile = String(row.mobile || row.customer_mobile || "")
      .replace(/\D/g, "")
      .trim();
    const customerId = String(row.customer_id || "").trim();
    const name = String(row.customer_name || row.name || "")
      .trim()
      .toLowerCase();
    const shop = String(row.shop || row.branch || "")
      .trim()
      .toLowerCase();

    if (mobile) return `mobile:${mobile}`;
    if (customerId) return `customer:${customerId}`;
    return `name:${name}-${shop}`;
  }

  const [sortKey, setSortKey] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function daysAfterReturnNumber(row: any) {
    if (row.payment_list_status === "Live Rental") return 999999;
    const d = String(row.return_date || row.end_date || "").slice(0, 10);
    if (!d) return -1;
    const start = new Date(d);
    const now = new Date(today());
    if (Number.isNaN(start.getTime())) return -1;
    return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
  }

  function changeSort(key: string) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "balance" || key === "days" ? "desc" : "asc");
  }

  function sortArrow(key: string) {
    if (sortKey !== key) return "▼";
    return sortDirection === "asc" ? "▲" : "▼";
  }

  function sortValue(row: any, key: string) {
    if (key === "name") return String(row.customer_name || "").toLowerCase();
    if (key === "shop") return String(row.shop || "").toLowerCase();
    if (key === "days") return daysAfterReturnNumber(row);
    if (key === "status") return row.payment_list_status === "Live Rental" ? "live" : "returned";
    if (key === "balance") return Number(row.balance || 0);
    return "";
  }

  const groupedRows = Array.from(
    rows.reduce((map: Map<string, any>, row: any) => {
      const key = tableCustomerKey(row);
      const current = map.get(key);

      if (!current) {
        map.set(key, { ...row, balance: Number(row.final_balance ?? row.balance ?? 0) });
        return map;
      }

      const currentIsLive = current.payment_list_status === "Live Rental";
      const rowIsLive = row.payment_list_status === "Live Rental";
      const currentDate = String(current.return_date || current.end_date || current.latest_return_date || "");
      const rowDate = String(row.return_date || row.end_date || row.latest_return_date || "");

      current.has_live_rental = Boolean(current.has_live_rental || rowIsLive);
      current.payment_list_status = currentIsLive || rowIsLive ? "Live Rental" : "Recently Closed";
      current.payment_status = current.payment_list_status === "Live Rental" ? "Live" : "Returned";
      current.return_date = rowDate > currentDate ? rowDate : currentDate;
      current.balance =
        row.final_balance !== undefined || current.final_balance !== undefined
          ? Number(row.final_balance ?? current.final_balance ?? row.balance ?? current.balance ?? 0)
          : Number(current.balance || 0) + Number(row.balance || 0);

      map.set(key, current);
      return map;
    }, new Map<string, any>()).values(),
  );

  const visibleRows = [...groupedRows]
    .sort((a: any, b: any) => {
      if (!sortKey) return 0;
      const aValue = sortValue(a, sortKey);
      const bValue = sortValue(b, sortKey);

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      const result = String(aValue).localeCompare(String(bValue));
      return sortDirection === "asc" ? result : -result;
    })
    .slice(0, 24);

  const emptyRows = Array.from({ length: Math.max(0, 24 - visibleRows.length) });

  return (
    <div style={rentalPaymentTableWrapStyle}>
      <table style={rentalPaymentTableStyle}>
        <thead>
          <tr>
            <th style={rentalPaymentThLeftStyle}>
              <button type="button" onClick={() => changeSort("name")} style={sortableHeaderButtonStyle}>
                Name {sortArrow("name")}
              </button>
            </th>
            <th style={rentalPaymentThStyle}>Mobile</th>
            <th style={rentalPaymentThStyle}>
              <button type="button" onClick={() => changeSort("shop")} style={sortableHeaderButtonStyle}>
                Shop {sortArrow("shop")}
              </button>
            </th>
            <th style={rentalPaymentThStyle}>
              <button type="button" onClick={() => changeSort("days")} style={sortableHeaderButtonStyle}>
                Days after return {sortArrow("days")}
              </button>
            </th>
            <th style={rentalPaymentThStyle}>
              <button type="button" onClick={() => changeSort("status")} style={sortableHeaderButtonStyle}>
                Status {sortArrow("status")}
              </button>
            </th>
            <th style={rentalPaymentThRightStyle}>
              <button type="button" onClick={() => changeSort("balance")} style={sortableHeaderButtonStyle}>
                Balance {sortArrow("balance")}
              </button>
            </th>
            <th style={rentalPaymentThStyle}>Statement</th>
            <th style={rentalPaymentThStyle}>Payment</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row: any, index: number) => {
            const isLive = row.payment_list_status === "Live Rental";
            return (
              <tr key={`${row.rental_id || row.id || row.mobile}-${index}`}>
                <td style={rentalPaymentNameTdStyle}>{row.customer_name || "-"}</td>
                <td style={rentalPaymentTdStyle}>{row.mobile || "-"}</td>
                <td style={rentalPaymentTdStyle}>{row.shop || "-"}</td>
                <td style={rentalPaymentTdStyle}>{daysAfterReturn(row)}</td>
                <td style={rentalPaymentTdStyle}>
                  <span style={isLive ? liveStatusBadgeStyle : closedStatusBadgeStyle}>
                    {isLive ? "Live" : "Returned"}
                  </span>
                </td>
                <td style={rentalPaymentAmountTdStyle}>{Number(row.balance || 0).toFixed(0)}</td>
                <td style={rentalPaymentTdStyle}>
                  <button type="button" onClick={() => onStatement(row)} style={plainLinkButtonStyle}>View</button>
                </td>
                <td style={rentalPaymentTdStyle}>
                  <button type="button" onClick={() => onPay(row)} style={plainLinkButtonStyle}>Pay</button>
                </td>
              </tr>
            );
          })}
          {visibleRows.length === 0 && (
            <tr>
              <td colSpan={8} style={{ ...rentalPaymentTdStyle, padding: 18, textAlign: "center", fontWeight: 950 }}>
                No recently closed or live rentals found
              </td>
            </tr>
          )}
          {emptyRows.map((_, index) => (
            <tr key={`empty-${index}`}>
              <td style={rentalPaymentEmptyCellStyle}>&nbsp;</td>
              <td style={rentalPaymentEmptyCellStyle}></td>
              <td style={rentalPaymentEmptyCellStyle}></td>
              <td style={rentalPaymentEmptyCellStyle}></td>
              <td style={rentalPaymentEmptyCellStyle}></td>
              <td style={rentalPaymentEmptyCellStyle}></td>
              <td style={rentalPaymentEmptyCellStyle}></td>
              <td style={rentalPaymentEmptyCellStyle}></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatementRentalDetailsTable({ rentals, tools }: any) {
  const rows = [...(rentals || [])].sort((a: any, b: any) => {
    const aReturned = a.end_date || a.return_date || a.status === "Returned";
    const bReturned = b.end_date || b.return_date || b.status === "Returned";
    if (aReturned && !bReturned) return -1;
    if (!aReturned && bReturned) return 1;
    return String(rentalDateForSort(a)).localeCompare(
      String(rentalDateForSort(b)),
    );
  });

  const total = rows.reduce(
    (sum: number, r: any) => sum + paymentRentalAmount(r, tools),
    0,
  );

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
            const isReturned = Boolean(
              r.end_date || r.return_date || r.status === "Returned",
            );
            const amount = paymentRentalAmount(r, tools);
            return (
              <tr key={r.id || r.rental_id || index}>
                <td style={statementTdStyle}>{index + 1}</td>
                <td style={statementTdStyle}>
                  {isReturned ? "Returned" : "Current"}
                </td>
                <td style={statementTdStyle}>
                  {formatCardDate(r.start_date || r.date || r.rental_date)}
                </td>
                <td style={statementTdItemStyle}>
                  🔧 {displayToolName(r, tools)}
                </td>
                <td style={statementTdRightStyle}>
                  {Number(r.qty || r.quantity || 1)}
                </td>
                <td style={statementTdRightStyle}>
                  ₹{paymentRentalRate(r, tools).toFixed(0)}
                </td>
                <td style={statementTdRightStyle}>{paymentRentalDays(r)}</td>
                <td style={statementTdAmountStyle}>₹{amount.toFixed(0)}</td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td colSpan={8} style={statementEmptyTdStyle}>
                No rental details found
              </td>
            </tr>
          )}

          {rows.length > 0 && (
            <tr>
              <td colSpan={7} style={statementTotalLabelStyle}>
                Total Rent
              </td>
              <td style={statementTotalValueStyle}>₹{total.toFixed(0)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function rentalDateForSort(row: any) {
  return (
    row.return_date ||
    row.end_date ||
    row.start_date ||
    row.date ||
    row.rental_date ||
    row.created_at ||
    ""
  );
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
  allCustomerRentals,
  allCustomerPayments,
  tools,
  statementPeriodLabel,
  formatDisplayDate,
  setStatementOptions,
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

  function moneyPlain(value: any) {
    return Number(value || 0).toFixed(0);
  }

  function isoDate(value: any) {
    return String(value || "").slice(0, 10);
  }

  function dateShort(date: any) {
    if (!date) return "-";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function monthValue(date: any) {
    const value = isoDate(date || today());
    return value ? value.slice(0, 7) : thisMonth();
  }

  function monthStartFromValue(value: string) {
    return value ? `${value}-01` : monthStart();
  }

  function monthEndFromValue(value: string) {
    if (!value) return today();
    const [year, month] = value.split("-").map(Number);
    if (!year || !month) return today();
    const lastDay = new Date(year, month, 0).getDate();
    return `${value}-${String(lastDay).padStart(2, "0")}`;
  }

  function changeStatementMonth(field: "from" | "to", value: string) {
    const current = statementOptions || {};
    setStatementOptions?.({
      ...current,
      type: current.type || "combined",
      period: "custom",
      fromDate:
        field === "from"
          ? monthStartFromValue(value)
          : current.fromDate || statementRange.from || monthStart(),
      toDate:
        field === "to"
          ? monthEndFromValue(value)
          : current.toDate || statementRange.to || today(),
    });
  }

  function rentalStartDate(row: any) {
    return row.start_date || row.date || row.rental_date || row.created_at || "";
  }

  function paymentEntryDate(row: any) {
    return row.payment_date || row.date || row.created_at || "";
  }

  const fromDate = isoDate(statementOptions?.fromDate || statementRange.from || "");
  const toDate = isoDate(statementOptions?.toDate || statementRange.to || "");

  const allRentals = allCustomerRentals || statementRentals || [];
  const allPayments = allCustomerPayments || statementPayments || [];

  const openingRentTotal = allRentals
    .filter((r: any) => fromDate && isoDate(rentalStartDate(r)) && isoDate(rentalStartDate(r)) < fromDate)
    .reduce((sum: number, r: any) => sum + paymentRentalAmount(r, tools), 0);

  const explicitOpeningBalance = allPayments.reduce((sum: number, p: any) => {
    const type = String(p.entry_type || "payment").toLowerCase();
    const amount = Math.abs(Number(p.amount || 0));
    if (type === "opening_due") return sum + amount;
    if (type === "opening_credit") return sum - amount;
    return sum;
  }, 0);

  const openingPaidTotal = allPayments
    .filter((p: any) => {
      const type = String(p.entry_type || "payment").toLowerCase();
      return type !== "opening_due" && type !== "opening_credit" && fromDate && isoDate(paymentEntryDate(p)) && isoDate(paymentEntryDate(p)) < fromDate;
    })
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  const openingDiscountTotal = allPayments
    .filter((p: any) => fromDate && isoDate(paymentEntryDate(p)) && isoDate(paymentEntryDate(p)) < fromDate)
    .reduce((sum: number, p: any) => sum + Number(p.discount || 0), 0);

  const openingBalance =
    explicitOpeningBalance + openingRentTotal - openingPaidTotal - openingDiscountTotal;

  const ledgerRows = [
    ...(statementRentals || []).map((r: any) => ({
      kind: "rent",
      date: rentalStartDate(r),
      item: displayToolName(r, tools),
      qty: Number(r.qty || r.quantity || 1),
      status:
        r.end_date || r.return_date
          ? `Returned on ${dateShort(r.end_date || r.return_date)}`
          : "Live",
      days: paymentRentalDays(r),
      rentalDates: `${dateShort(rentalStartDate(r))} - ${dateShort(r.end_date || r.return_date || today())}`,
      rent: paymentRentalRate(r, tools),
      amount: paymentRentalAmount(r, tools),
      payment: 0,
      discount: 0,
    })),
    ...(statementPayments || [])
      .filter((p: any) => !["opening_due", "opening_credit"].includes(String(p.entry_type || "payment").toLowerCase()))
      .map((p: any) => ({
      kind: String(p.entry_type || "payment").toLowerCase() === "advance" ? "advance" : "payment",
      date: p.effective_date || paymentEntryDate(p),
      item: String(p.entry_type || "payment").toLowerCase() === "advance" ? "Advance Payment" : "Payment received",
      qty: "",
      status: "",
      days: "",
      rentalDates: "",
      rent: "",
      amount: 0,
      payment: Number(p.amount || 0),
      discount: Number(p.discount || 0),
    })),
  ].sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

  let runningBalance = openingBalance;
  const rowsWithBalance = ledgerRows.map((row: any) => {
    runningBalance +=
      Number(row.amount || 0) -
      Number(row.payment || 0) -
      Number(row.discount || 0);
    return { ...row, balance: runningBalance };
  });

  const closingBalance = rowsWithBalance.length
    ? rowsWithBalance[rowsWithBalance.length - 1].balance
    : openingBalance;

  const statementQtyTotal = rowsWithBalance.reduce(
    (sum: number, row: any) =>
      row.kind === "rent" ? sum + Number(row.qty || 0) : sum,
    0,
  );

  const statementDaysTotal = rowsWithBalance.reduce(
    (sum: number, row: any) =>
      row.kind === "rent" ? sum + Number(row.days || 0) : sum,
    0,
  );

  const statementDailyRentTotal = rowsWithBalance.reduce(
    (sum: number, row: any) =>
      row.kind === "rent" ? sum + Number(row.rent || 0) : sum,
    0,
  );

  const statementAmountTotal = rowsWithBalance.reduce(
    (sum: number, row: any) => sum + Number(row.amount || 0),
    0,
  );

  const statementPaymentTotal = rowsWithBalance.reduce(
    (sum: number, row: any) => sum + Number(row.payment || 0),
    0,
  );

  const statementLedgerDiscountTotal = rowsWithBalance.reduce(
    (sum: number, row: any) => sum + Number(row.discount || 0),
    0,
  );

  function escapeHtml(value: any) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function statementFileName(ext: string) {
    const safeName = String(customerName || "Customer")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "");
    return `TNT_Statement_${safeName || "Customer"}_${today()}.${ext}`;
  }

  function statementDateLabel() {
    const d = new Date(today());
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  async function getLogoDataUrl() {
    const logoPaths = ["/branding/logo.png", "/logo.png", "/tnt-logo.png"];

    for (const path of logoPaths) {
      try {
        const response = await fetch(path);
        if (!response.ok) continue;

        const blob = await response.blob();

        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ""));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        // Try next logo path
      }
    }

    return "";
  }

  function buildShareStatementHtml(logoSrc = "/branding/logo.png") {

    const tableRows = [
      `<tr class="opening-row">
        <td class="strong">Opening Balance</td>
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td class="num strong">${escapeHtml(moneyPlain(openingBalance))}</td>
      </tr>`,
      ...rowsWithBalance.map(
        (row: any) => `<tr class="${row.kind === "payment" ? "payment-row" : row.status === "Live" ? "live-row" : "rental-row"}">
          <td>${escapeHtml(dateShort(row.date))}</td>
          <td class="strong">${escapeHtml(row.item || (row.kind === "payment" ? "Payment received" : ""))}</td>
          <td class="num">${row.kind === "rent" ? escapeHtml(row.qty) : ""}</td>
          <td class="strong">${escapeHtml(row.status)}</td>
          <td class="num">${escapeHtml(row.days)}</td>
          <td class="num">${escapeHtml(row.rentalDates)}</td>
          <td class="num">${row.kind === "rent" ? escapeHtml(moneyPlain(row.rent)) : ""}</td>
          <td class="num">${row.kind === "rent" ? escapeHtml(moneyPlain(row.amount)) : ""}</td>
          <td class="num">${row.payment ? escapeHtml(moneyPlain(row.payment)) : ""}</td>
          <td class="num">${row.discount ? escapeHtml(moneyPlain(row.discount)) : ""}</td>
          <td class="num strong">${escapeHtml(moneyPlain(row.balance))}</td>
        </tr>`,
      ),
      `<tr class="closing-row">
        <td class="strong">Closing Balance</td>
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td class="num strong">${escapeHtml(moneyPlain(closingBalance))}</td>
      </tr>`,
      `<tr class="total-row">
        <td class="strong">TOTAL</td>
        <td></td>
        <td class="num strong">${escapeHtml(statementQtyTotal)}</td>
        <td></td>
        <td class="num strong">${escapeHtml(statementDaysTotal)}</td>
        <td></td>
        <td class="num strong">${escapeHtml(moneyPlain(statementDailyRentTotal))}</td>
        <td class="num strong">${escapeHtml(moneyPlain(statementAmountTotal))}</td>
        <td class="num strong">${escapeHtml(moneyPlain(statementPaymentTotal))}</td>
        <td class="num strong">${escapeHtml(moneyPlain(statementLedgerDiscountTotal))}</td>
        <td class="num strong">${escapeHtml(moneyPlain(closingBalance))}</td>
      </tr>`,
    ].join("");

    const addressCards = shopAddresses
      .map(
        (s) => `<div class="shop-card">
          <div class="shop-title">📍 ${escapeHtml(s.shop)}</div>
          <div class="shop-address">${escapeHtml(s.address)}</div>
          <div class="shop-phone">Mob: ${escapeHtml(s.phone)}</div>
        </div>`,
      )
      .join("");

    return `<div class="share-statement">
      <div class="statement-brand">
        <div class="logo-row">
          ${logoSrc ? `<img class="statement-logo" src="${logoSrc}" alt="Tried & True Rent a Tool" />` : ""}
          <div class="logo-fallback">
            <div class="round-logo">T<span>&</span>T</div>
            <div class="fallback-text">
              <div class="fallback-name">TRIED & TRUE</div>
              <div class="fallback-sub">RENT A TOOL</div>
            </div>
          </div>
        </div>
        <div class="statement-date">Date : ${escapeHtml(statementDateLabel())}</div>
      </div>

      <div class="shop-grid">${addressCards}</div>

      <div class="customer-line">
        <span><b>Name:</b> ${escapeHtml(customerName)}</span>
        <span><b>Mobile:</b> ${escapeHtml(selectedMobile)}</span>
        <span><b>Shop:</b> ${escapeHtml(shop)}</span>
      </div>

      <table class="statement-table">
        <colgroup>
          <col class="col-date" />
          <col class="col-items" />
          <col class="col-qty" />
          <col class="col-status" />
          <col class="col-days" />
          <col class="col-rental-dates" />
          <col class="col-rent" />
          <col class="col-amount" />
          <col class="col-payments" />
          <col class="col-roundoff" />
          <col class="col-balance" />
        </colgroup>
        <thead>
          <tr>
            <th>Date</th>
            <th>Items</th>
            <th>Qty</th>
            <th>Status</th>
            <th>Total Days</th>
            <th>Rental Dates</th>
            <th>Daily Rent</th>
            <th>Amount</th>
            <th>Payments</th>
            <th>Round Off</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>

      <div class="final-balance">
        <span>അടക്കുവാനുള്ള ബാലൻസ് തുക</span>
        <strong>${escapeHtml(moneyPlain(closingBalance))}</strong>
      </div>
    </div>`;
  }

  async function shareStatementDocument() {
    const logoSrc = await getLogoDataUrl();
    const statementHtml = buildShareStatementHtml(logoSrc);
    const receiptRowsCount = rowsWithBalance.length + 2;
    const receiptHeightMm = Math.min(
      1200,
      Math.max(300, 190 + receiptRowsCount * 10),
    );
    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>${escapeHtml(statementFileName("pdf"))}</title>
          <style>
            @page { size: 330mm ${receiptHeightMm}mm; margin: 0; }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            html,
            body {
              margin: 0;
              padding: 0;
              width: 330mm;
              background: #ffffff;
              overflow: hidden;
            }
            body {
              font-family: Arial, "Noto Sans Malayalam", sans-serif;
              color: #111827;
            }
            .share-statement {
              width: 330mm;
              max-width: none;
              margin: 0;
              background: #ffffff;
              padding: 8mm 8mm 0;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .statement-brand {
              display: grid;
              justify-items: center;
              gap: 8px;
              margin-bottom: 10px;
            }
            .logo-row {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 92px;
            }
            .statement-logo {
              display: block;
              width: 430px;
              max-height: 100px;
              object-fit: contain;
            }
            .logo-fallback {
              display: none;
              align-items: center;
              gap: 16px;
            }
            .statement-logo[src=""] + .logo-fallback,
            .logo-row:not(:has(.statement-logo)) .logo-fallback {
              display: flex;
            }
            .round-logo {
              width: 88px;
              height: 88px;
              border-radius: 50%;
              background: #ef1d2f;
              color: #ffffff;
              display: grid;
              place-items: center;
              font-size: 34px;
              font-weight: 1000;
              letter-spacing: -3px;
            }
            .round-logo span {
              color: #facc15;
              margin: 0 2px;
            }
            .fallback-name {
              color: #ef1d2f;
              font-size: 38px;
              font-weight: 1000;
              letter-spacing: -1px;
            }
            .fallback-sub {
              width: fit-content;
              background: #000000;
              color: #ffffff;
              padding: 6px 18px;
              border-radius: 16px;
              font-size: 24px;
              font-weight: 1000;
              letter-spacing: 1px;
            }
            .statement-date {
              font-size: 23px;
              font-weight: 1000;
              color: #111827;
            }
            .shop-grid {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 10px;
              margin-bottom: 10px;
            }
            .shop-card {
              min-height: 90px;
              padding: 10px 8px;
              border: 1px solid #dbe3ee;
              border-radius: 8px;
              background: linear-gradient(180deg, #f8fbff 0%, #fffaf0 100%);
              text-align: center;
            }
            .shop-title {
              color: #3267b1;
              font-size: 17px;
              font-weight: 1000;
              margin-bottom: 8px;
            }
            .shop-address {
              color: #374151;
              font-size: 14px;
              line-height: 1.28;
              min-height: 34px;
            }
            .shop-phone {
              color: #111827;
              font-size: 14px;
              font-weight: 1000;
              margin-top: 6px;
            }
            .customer-line {
              display: flex;
              gap: 28px;
              flex-wrap: wrap;
              margin: 0 0 7px;
              font-size: 20px;
              color: #0b4cc2;
              font-weight: 900;
            }
            .customer-line b {
              color: #061426;
            }
            .statement-table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              font-size: 10.5px;
              page-break-inside: avoid;
              break-inside: avoid;
              background: #ffffff;
            }
            .statement-table .col-date { width: 135px; }
            .statement-table .col-items { width: 320px; }
            .statement-table .col-qty { width: 48px; }
            .statement-table .col-status { width: 56px; }
            .statement-table .col-days { width: 64px; }
            .statement-table .col-rental-dates { width: 180px; }
            .statement-table .col-rent { width: 66px; }
            .statement-table .col-amount { width: 62px; }
            .statement-table .col-payments { width: 92px; }
            .statement-table .col-roundoff { width: 92px; }
            .statement-table .col-balance { width: 72px; }
            .statement-table tr,
            .statement-table thead,
            .statement-table tbody,
            .statement-table tfoot {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .statement-table th {
              background: #37b5df;
              color: #ffffff;
              border: 1px solid #555;
              padding: 3px 4px;
              text-align: left;
              font-weight: 1000;
              font-size: 11.25px;
              line-height: 1.08;
              white-space: normal;
              overflow-wrap: normal;
              word-break: normal;
            }
            .statement-table th:nth-child(n+3) {
              text-align: center;
            }
            .statement-table td {
              border: 1px solid #555;
              padding: 3px 4px;
              vertical-align: middle;
              font-weight: 900;
              font-size: 10.5px;
              background: #ffffff;
              overflow-wrap: normal;
              word-break: normal;
              line-height: 1.12;
            }
            .statement-table .num {
              text-align: center;
              white-space: nowrap;
            }
            .statement-table .strong {
              font-weight: 1000;
            }
            .small-discount {
              color: #7e3fc8;
              font-size: 9px;
              font-weight: 1000;
              margin-top: 2px;
            }
            .opening-row td { background: #ffffff; }
            .rental-row td { background: #ffffff; }
            .payment-row td { background: #ffffff; }
            .live-row td { background: #ffffff; }
            .closing-row td { background: #ffffff; }
            .total-row td {
              background: #dbeafe;
              color: #0f2a5f;
              font-weight: 1000;
              border-top: 3px solid #2563eb;
              border-bottom: 3px solid #2563eb;
            }
            .final-balance {
              margin-top: 12px;
              min-height: 62px;
              page-break-inside: avoid;
              break-inside: avoid;
              background: linear-gradient(90deg, #eaf3ff 0%, #f4f8ff 100%);
              display: flex;
              justify-content: flex-end;
              align-items: center;
              gap: 24px;
              padding: 14px 22px;
              color: #6b8fc8;
              font-size: 21px;
              font-weight: 1000;
            }
            .final-balance strong {
              color: #5d7fbe;
              font-size: 32px;
              line-height: 1;
            }
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              html, body {
                background: #ffffff !important;
              }
              .share-statement {
                background: #ffffff !important;
              }
              .shop-card {
                background: linear-gradient(180deg, #f8fbff 0%, #fff7e8 100%) !important;
              }
              .statement-table th { background: #37b5df !important; color: #ffffff !important; }
              .statement-table th:nth-child(n+3) { text-align: center !important; }
              .statement-table { background: #ffffff !important; }
              .statement-table td { background: #ffffff !important; }
              .opening-row td { background: #ffffff !important; }
              .rental-row td { background: #ffffff !important; }
              .payment-row td { background: #ffffff !important; }
              .live-row td { background: #ffffff !important; }
              .closing-row td { background: #ffffff !important; }
              .total-row td { background: #dbeafe !important; }
              .final-balance { background: linear-gradient(90deg, #eaf3ff 0%, #f4f8ff 100%) !important; }
            }
          </style>
        </head>
        <body>${statementHtml}
          <script>
            window.onload = function () {
              setTimeout(function () {
                window.focus();
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>`);
    printWindow.document.close();
  }

  async function waitForImages(element: HTMLElement) {
    const images = Array.from(element.querySelectorAll("img"));
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
      ),
    );
  }

  async function shareStatementAsJpg() {
    const logoSrc = await getLogoDataUrl();
    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.left = "-10000px";
    wrapper.style.top = "0";
    wrapper.style.width = "1246px";
    wrapper.style.background = "#ffffff";
    wrapper.innerHTML = `<style>
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
      .share-statement {
        width: 1246px;
        background: #ffffff;
        padding: 12px 16px 0;
        font-family: Arial, "Noto Sans Malayalam", sans-serif;
        color: #111827;
      }
      .statement-brand {
        display: grid;
        justify-items: center;
        gap: 8px;
        margin-bottom: 16px;
      }
      .logo-row {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 92px;
      }
      .statement-logo {
        display: block;
        width: 430px;
        max-height: 100px;
        object-fit: contain;
      }
      .logo-fallback {
        display: none;
        align-items: center;
        gap: 16px;
      }
      .statement-logo[src=""] + .logo-fallback,
      .logo-row:not(:has(.statement-logo)) .logo-fallback {
        display: flex;
      }
      .round-logo {
        width: 88px;
        height: 88px;
        border-radius: 50%;
        background: #ef1d2f;
        color: #ffffff;
        display: grid;
        place-items: center;
        font-size: 34px;
        font-weight: 1000;
        letter-spacing: -3px;
      }
      .round-logo span {
        color: #facc15;
        margin: 0 2px;
      }
      .fallback-name {
        color: #ef1d2f;
        font-size: 38px;
        font-weight: 1000;
        letter-spacing: -1px;
      }
      .fallback-sub {
        width: fit-content;
        background: #000000;
        color: #ffffff;
        padding: 6px 18px;
        border-radius: 16px;
        font-size: 24px;
        font-weight: 1000;
        letter-spacing: 1px;
      }
      .statement-date {
        font-size: 23px;
        font-weight: 1000;
        color: #111827;
      }
      .shop-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
        margin-bottom: 16px;
      }
      .shop-card {
        min-height: 90px;
        padding: 10px 8px;
        border: 1px solid #dbe3ee;
        border-radius: 8px;
        background: linear-gradient(180deg, #f8fbff 0%, #fffaf0 100%);
        text-align: center;
      }
      .shop-title {
        color: #3267b1;
        font-size: 17px;
        font-weight: 1000;
        margin-bottom: 8px;
      }
      .shop-address {
        color: #374151;
        font-size: 14px;
        line-height: 1.28;
        min-height: 34px;
      }
      .shop-phone {
        color: #111827;
        font-size: 14px;
        font-weight: 1000;
        margin-top: 6px;
      }
      .customer-line {
        display: flex;
        gap: 28px;
        flex-wrap: wrap;
        margin: 0 0 7px;
        font-size: 20px;
        color: #0b4cc2;
        font-weight: 900;
      }
      .customer-line b {
        color: #061426;
      }
      .statement-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        font-size: 13.5px;
        background: #ffffff;
      }
      .statement-table .col-date { width: 135px; }
      .statement-table .col-items { width: 320px; }
      .statement-table .col-qty { width: 48px; }
      .statement-table .col-status { width: 56px; }
      .statement-table .col-days { width: 64px; }
      .statement-table .col-rental-dates { width: 180px; }
      .statement-table .col-rent { width: 66px; }
      .statement-table .col-amount { width: 62px; }
      .statement-table .col-payments { width: 92px; }
      .statement-table .col-roundoff { width: 92px; }
      .statement-table .col-balance { width: 72px; }
      .statement-table th {
        background: #37b5df;
        color: #ffffff;
        border: 1px solid #555;
        padding: 3px 4px;
        text-align: left;
        font-weight: 1000;
        font-size: 14.25px;
      }
      .statement-table th:nth-child(n+3) {
        text-align: center;
      }
      .statement-table td {
        border: 1px solid #555;
        padding: 4px 4px;
        vertical-align: middle;
        font-weight: 900;
        font-size: 13.5px;
        background: #ffffff;
        overflow-wrap: anywhere;
        word-break: normal;
      }
      .statement-table .num {
        text-align: center;
      }
      .statement-table .strong {
        font-weight: 1000;
      }
      .small-discount {
        color: #7e3fc8;
        font-size: 11.25px;
        font-weight: 1000;
        margin-top: 2px;
      }
      .opening-row td { background: #ffffff; }
      .rental-row td { background: #ffffff; }
      .payment-row td { background: #ffffff; }
      .live-row td { background: #ffffff; }
      .closing-row td { background: #ffffff; }
      .total-row td {
        background: #dbeafe;
        color: #0f2a5f;
        font-weight: 1000;
        border-top: 3px solid #2563eb;
        border-bottom: 3px solid #2563eb;
      }
      .final-balance {
        margin-top: 12px;
        min-height: 62px;
        background: linear-gradient(90deg, #eaf3ff 0%, #f4f8ff 100%);
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 24px;
        padding: 14px 22px;
        color: #6b8fc8;
        font-size: 21px;
        font-weight: 1000;
      }
      .final-balance strong {
        color: #5d7fbe;
        font-size: 32px;
        line-height: 1;
      }
    </style>${buildShareStatementHtml(logoSrc)}`;

    document.body.appendChild(wrapper);

    try {
      await waitForImages(wrapper);
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));

      const target = wrapper.querySelector(".share-statement") as HTMLElement;
      const width = target.scrollWidth;
      const height = target.scrollHeight;

      const serialized = new XMLSerializer().serializeToString(target);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">${serialized}</foreignObject>
      </svg>`;

      const svgBlob = new Blob([svg], {
        type: "image/svg+xml;charset=utf-8",
      });
      const svgUrl = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.decoding = "async";

      const jpgBlob: Blob = await new Promise((resolve, reject) => {
        image.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = width * 2;
            canvas.height = height * 2;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Canvas not available"));
              return;
            }
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(2, 2);
            ctx.drawImage(image, 0, 0);
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error("JPG creation failed"));
                  return;
                }
                resolve(blob);
              },
              "image/jpeg",
              0.96,
            );
          } catch (error) {
            reject(error);
          }
        };
        image.onerror = () => reject(new Error("Statement image failed to load"));
        image.src = svgUrl;
      });

      URL.revokeObjectURL(svgUrl);

      const fileName = statementFileName("jpg");
      const file = new File([jpgBlob], fileName, { type: "image/jpeg" });

      if (
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: "Tried & True Statement",
          text: `${customerName} statement`,
        });
      } else {
        const url = URL.createObjectURL(jpgBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error(error);
      alert("JPG could not be created. Please try again.");
    } finally {
      wrapper.remove();
    }
  }

  return (
    <div className="tt-print-area" style={simpleStatementWrapStyle}>
      <div style={simpleStatementHeaderStyle}>
        <div style={simpleCustomerPanelStyle}>
          <div style={simpleCustomerLabelStyle}>Customer Statement</div>
          <div style={simpleCustomerNameStyle}>{customerName}</div>
          <div style={simpleCustomerInfoGridStyle}>
            <div style={simpleCustomerInfoPillStyle}>
              <span style={simpleCustomerInfoLabelStyle}>Mobile</span>
              <strong style={simpleCustomerInfoValueStyle}>{selectedMobile}</strong>
            </div>
            <div style={simpleCustomerInfoPillStyle}>
              <span style={simpleCustomerInfoLabelStyle}>Shop</span>
              <strong style={simpleCustomerInfoValueStyle}>{shop}</strong>
            </div>
          </div>
        </div>
        <div style={simpleStatementRightStyle}>
          <div style={simpleDateRowStyle}>
            <label style={simpleDateLabelStyle}>From<input type="month" value={monthValue(statementOptions?.fromDate || statementRange.from || monthStart())} onChange={(e) => changeStatementMonth("from", e.target.value)} style={simpleDateInputStyle} /></label>
            <label style={simpleDateLabelStyle}>To<input type="month" value={monthValue(statementOptions?.toDate || statementRange.to || today())} onChange={(e) => changeStatementMonth("to", e.target.value)} style={simpleDateInputStyle} /></label>
          </div>
          <div style={simpleBalanceStyle}>Balance Rs: {moneyPlain(closingBalance)}</div>
        </div>
      </div>

      <table style={simpleStatementTableStyle}>
        <colgroup>
          <col style={{ width: "12%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "4.5%" }} />
          <col style={{ width: "5%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "6.5%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={simpleThStyle}>Date</th>
            <th style={simpleThStyle}>Items</th>
            <th style={simpleThCenterStyle}>Qty</th>
            <th style={simpleThCenterStyle}>Status</th>
            <th style={simpleThCenterStyle}>Total Days</th>
            <th style={simpleThCenterStyle}>Rental Dates</th>
            <th style={simpleThCenterStyle}>Daily Rent</th>
            <th style={simpleThCenterStyle}>Amount</th>
            <th style={simpleThCenterStyle}>Payments</th>
            <th style={simpleThCenterStyle}>Round Off</th>
            <th style={simpleThCenterStyle}>Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={simpleTdStyle}>Opening Balance</td>
            <td style={simpleTdStyle}></td>
            <td style={simpleTdStyle}></td>
            <td style={simpleTdStyle}></td>
            <td style={simpleTdStyle}></td>
            <td style={simpleTdStyle}></td>
            <td style={simpleTdStyle}></td>
            <td style={simpleTdStyle}></td>
            <td style={simpleTdStyle}></td>
            <td style={simpleTdStyle}></td>
            <td style={simpleTdAmountStyle}>{moneyPlain(openingBalance)}</td>
          </tr>
          {rowsWithBalance.map((row: any, index: number) => (
            <tr key={`${row.kind}-${index}-${row.date}`}>
              <td style={simpleTdStyle}>{dateShort(row.date)}</td>
              <td style={simpleTdStrongStyle}>{row.item}</td>
              <td style={simpleTdAmountStyle}>{row.kind === "rent" ? row.qty : ""}</td>
              <td style={simpleTdStrongStyle}>{row.status}</td>
              <td style={simpleTdAmountStyle}>{row.days}</td>
              <td style={simpleTdAmountStyle}>{row.rentalDates}</td>
              <td style={simpleTdAmountStyle}>{row.kind === "rent" ? moneyPlain(row.rent) : ""}</td>
              <td style={simpleTdAmountStyle}>{row.kind === "rent" ? moneyPlain(row.amount) : ""}</td>
              <td style={simpleTdAmountStyle}>{row.payment ? moneyPlain(row.payment) : ""}</td>
              <td style={simpleTdAmountStyle}>{row.discount ? moneyPlain(row.discount) : ""}</td>
              <td style={simpleTdAmountStyle}>{moneyPlain(row.balance)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...simpleTdStrongStyle, background: "#eff6ff" }}>Closing Balance</td>
            <td style={{ ...simpleTdStyle, background: "#eff6ff" }}></td>
            <td style={{ ...simpleTdStyle, background: "#eff6ff" }}></td>
            <td style={{ ...simpleTdStyle, background: "#eff6ff" }}></td>
            <td style={{ ...simpleTdStyle, background: "#eff6ff" }}></td>
            <td style={{ ...simpleTdStyle, background: "#eff6ff" }}></td>
            <td style={{ ...simpleTdStyle, background: "#eff6ff" }}></td>
            <td style={{ ...simpleTdStyle, background: "#eff6ff" }}></td>
            <td style={{ ...simpleTdStyle, background: "#eff6ff" }}></td>
            <td style={{ ...simpleTdStyle, background: "#eff6ff" }}></td>
            <td style={{ ...simpleTdAmountStyle, background: "#eff6ff" }}>{moneyPlain(closingBalance)}</td>
          </tr>
          <tr>
            <td style={simpleTotalLabelStyle}>TOTAL</td>
            <td style={simpleTotalStyle}></td>
            <td style={simpleTotalAmountStyle}>{statementQtyTotal}</td>
            <td style={simpleTotalStyle}></td>
            <td style={simpleTotalAmountStyle}>{statementDaysTotal}</td>
            <td style={simpleTotalStyle}></td>
            <td style={simpleTotalAmountStyle}>{moneyPlain(statementDailyRentTotal)}</td>
            <td style={simpleTotalAmountStyle}>{moneyPlain(statementAmountTotal)}</td>
            <td style={simpleTotalAmountStyle}>{moneyPlain(statementPaymentTotal)}</td>
            <td style={simpleTotalAmountStyle}>{moneyPlain(statementLedgerDiscountTotal)}</td>
            <td style={simpleTotalAmountStyle}>{moneyPlain(closingBalance)}</td>
          </tr>
        </tbody>
      </table>

      <div className="no-print" style={simpleStatementActionsStyle}>
        <button type="button" onClick={shareStatementDocument} style={simpleTextActionStyle}>Print</button>
        <button type="button" onClick={shareStatementDocument} style={simpleTextActionStyle}>Share PDF</button>

      </div>
    </div>
  );
}

function CustomerStatementBox({
  selectedCustomer,
  selectedPending,
  selectedMobile,
  selectedTotalBusiness,
  selectedCashReceived,
  selectedDiscount,
  selectedAlreadyArrears,
  selectedBalance,
  selectedCustomerPayments,
  activeRentals,
  returnedPendingRentals,
  tools,
}: any) {
  const advance = Math.max(
    0,
    Number(selectedCashReceived || 0) +
      Number(selectedDiscount || 0) +
      Number(selectedAlreadyArrears || 0) -
      Number(selectedTotalBusiness || 0),
  );

  return (
    <div style={customerBoxStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>
            {selectedCustomer?.customer_name ||
              selectedCustomer?.name ||
              selectedPending?.customer_name ||
              selectedMobile}
          </div>
          <div style={{ color: "#475569", fontWeight: 850 }}>
            {selectedMobile} •{" "}
            {selectedCustomer?.shop ||
              selectedCustomer?.branch ||
              selectedPending?.shop ||
              "-"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#f97316", fontWeight: 950 }}>Amount Due</div>
          <div style={{ fontSize: 34, fontWeight: 950, color: "#0f172a" }}>
            ₹{Number(selectedBalance || 0).toFixed(0)}
          </div>
        </div>
      </div>

      <CombinedRentalTable
        activeRentals={activeRentals}
        returnedPendingRentals={returnedPendingRentals}
        tools={tools}
        paidCredit={
          Number(selectedCashReceived || 0) +
          Number(selectedDiscount || 0) +
          Number(selectedAlreadyArrears || 0)
        }
      />

      <PaymentHistory payments={selectedCustomerPayments || []} />

      <div style={statementSummaryLineStyle}>
        <SummaryPill
          label="Business"
          value={selectedTotalBusiness}
          tone="blue"
        />
        <SummaryPill
          label="Received"
          value={selectedCashReceived}
          tone="green"
        />
        <SummaryPill label="Round Off" value={selectedDiscount} tone="purple" />
        <SummaryPill label="Advance" value={advance} tone="orange" />
        <SummaryPill
          label="Arrears"
          value={selectedAlreadyArrears}
          tone="red"
        />
        <SummaryPill
          label="Balance"
          value={selectedBalance}
          tone="dark"
          strong
        />
      </div>
    </div>
  );
}

function PaymentHistory({ payments }: any) {
  const rows = [...(payments || [])]
    .sort((a: any, b: any) =>
      String(b.payment_date || b.date || b.created_at || "").localeCompare(
        String(a.payment_date || a.date || a.created_at || ""),
      ),
    )
    .slice(0, 8);

  return (
    <div style={paymentHistoryBoxStyle}>
      <div style={paymentHistoryTitleStyle}>Payments Received</div>
      {rows.length === 0 ? (
        <div style={paymentHistoryEmptyStyle}>No payments received yet</div>
      ) : (
        <div style={paymentHistoryGridStyle}>
          {rows.map((p: any, index: number) => (
            <div
              key={`${p.id || "payment"}-${index}`}
              style={paymentHistoryItemStyle}
            >
              <span>
                {formatCardDate(p.payment_date || p.date || p.created_at)}
              </span>
              <strong>₹{Number(p.amount || 0).toFixed(0)}</strong>
              {Number(p.discount || 0) > 0 && (
                <span>Round Off ₹{Number(p.discount || 0).toFixed(0)}</span>
              )}
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
    <div
      style={{
        ...summaryPillStyle,
        ...(styleMap[tone] || styleMap.blue),
        fontWeight: strong ? 1000 : 900,
      }}
    >
      <span
        style={{
          fontSize: 15,
          fontWeight: 1000,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          opacity: 0.92,
        }}
      >
        {label}
      </span>
      <strong style={{ fontSize: 32, lineHeight: 1, fontWeight: 1000 }}>
        ₹{Number(value || 0).toFixed(0)}
      </strong>
    </div>
  );
}

function Row({ label, value, strong }: any) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontWeight: strong ? 950 : 850,
        fontSize: strong ? 18 : 16,
      }}
    >
      <span>{label}</span>
      <span>₹{Number(value || 0).toFixed(0)}</span>
    </div>
  );
}

function CombinedRentalTable({
  activeRentals,
  returnedPendingRentals,
  tools,
  paidCredit = 0,
}: any) {
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
              const startDate = formatCardDate(
                row.start_date || row.rental_date || row.date,
              );
              const endDate = isReturned
                ? formatCardDate(
                    row.return_date || row.end_date || row.closed_date,
                  )
                : formatCardDate(new Date());

              return (
                <tr key={`${row.rental_id || row.id || "rental"}-${index}`}>
                  <td style={rentalTdCenterStyle}>{index + 1}</td>
                  <td style={rentalTdStyle}>
                    <span
                      style={
                        isReturned ? returnedBadgeStyle : currentBadgeStyle
                      }
                    >
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
                  <td
                    style={{
                      ...rentalTdAmountStyle,
                      color: balance > 0 ? "#b91c1c" : "#166534",
                    }}
                  >
                    ₹{balance.toFixed(0)}
                  </td>
                </tr>
              );
            })}

            {rowsWithBalance.length === 0 && (
              <tr>
                <td colSpan={10} style={rentalEmptyCellStyle}>
                  No rental items found
                </td>
              </tr>
            )}

            {rowsWithBalance.length > 0 && (
              <>
                <tr>
                  <td colSpan={9} style={rentalTotalLabelStyle}>
                    Total Returned Pending
                  </td>
                  <td style={rentalTotalAmountStyle}>
                    ₹{totalReturned.toFixed(0)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={9} style={rentalTotalLabelStyle}>
                    Total Current Rentals
                  </td>
                  <td style={rentalTotalAmountStyle}>
                    ₹{totalCurrent.toFixed(0)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={9} style={rentalGrandTotalLabelStyle}>
                    Total Rental Amount
                  </td>
                  <td style={rentalGrandTotalAmountStyle}>
                    ₹{grandTotal.toFixed(0)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function hasRentalValue(value: any) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function firstRentalNumber(...values: any[]) {
  const value = values.find(hasRentalValue);
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function enrichRentalWithTool(row: any, tools: any[] = []) {
  const tool = findToolForRental(row, tools);

  return {
    ...row,
    tool_name: row.tool_name || row.tool || tool?.tool_name || tool?.name || "",
    daily_rate: firstRentalNumber(
      row.daily_rate,
      row.unit_price,
      row.daily_rent,
      row.rent,
      row.rate,
      tool?.daily_rent,
      tool?.daily_rate,
      tool?.rent,
      tool?.rate,
      0,
    ),
  };
}

function findToolForRental(row: any, tools: any[] = []) {
  return tools.find(
    (t: any) => String(t.id || "") === String(row.tool_id || row.toolId || ""),
  );
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
  const directRateSource = [
    row.daily_rate,
    row.unit_price,
    row.daily_rent,
    row.rent,
    row.rate,
  ].find(hasRentalValue);

  if (directRateSource !== undefined) {
    return firstRentalNumber(directRateSource);
  }

  return firstRentalNumber(
    tool?.daily_rent,
    tool?.daily_rate,
    tool?.rent,
    tool?.rate,
    0,
  );
}

function paymentRentalDays(row: any) {
  const start = row.start_date || row.date || row.rental_date;
  if (!start) return 0;

  const end = row.end_date || row.return_date || row.closed_date || new Date();
  const avoidSundays =
    row.avoid_sundays === false || row.avoid_sundays === "false" ? false : true;

  const startDate = new Date(String(start).slice(0, 10));
  const endDate = new Date(
    String(end instanceof Date ? end.toISOString() : end).slice(0, 10),
  );

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
    return 0;
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
  if (
    (row.status === "Returned" || row.end_date || row.return_date) &&
    storedReturnedTotal > 0
  ) {
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
    }),
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <strong style={{ fontSize: 18 }}>{p.customer_name || "-"}</strong>
              <div style={{ color: "#64748b", fontWeight: 800 }}>
                {p.mobile || "-"} • {p.shop || "-"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <strong style={{ fontSize: 22, color: "#16a34a" }}>
                ₹{Number(p.amount || 0).toFixed(0)}
              </strong>
              <div style={{ color: "#64748b" }}>{p.payment_date}</div>
            </div>
          </div>
          {(Number(p.discount || 0) > 0 || p.mode || p.remarks) && (
            <div style={{ marginTop: 8, color: "#475569" }}>
              Round Off ₹{Number(p.discount || 0).toFixed(0)} • {p.mode || "-"}{" "}
              {p.remarks ? `• ${p.remarks}` : ""}
            </div>
          )}
        </div>
      ))}
      {payments.length === 0 && (
        <div style={emptyStyle}>No received payments found</div>
      )}
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

const calculatorPageStyle: CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(180deg, #eaf3ff 0%, #dbeafe 42%, #cfe6ff 100%)",
  padding: "18px",
  borderRadius: 18,
};

const shopCashStatementStyle: CSSProperties = {
  marginTop: 18,
  border: "3px solid #0f766e",
  borderRadius: 24,
  padding: 16,
  background: "linear-gradient(135deg, #f0fdfa 0%, #ffffff 70%)",
  boxShadow: "0 16px 38px rgba(15, 118, 110, 0.16)",
};
const shopCashStatementHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  borderBottom: "1px solid #99f6e4",
  paddingBottom: 14,
  marginBottom: 14,
};
const paymentsWorkspaceStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 3.5fr) minmax(300px, 1fr)",
  gap: 18,
  alignItems: "start",
  marginBottom: 22,
};
const paymentsMainColumnStyle: CSSProperties = { display: "grid", gap: 20 };
const recentPaymentsStripStyle: CSSProperties = {
  position: "sticky",
  top: 12,
  border: "1px solid #bfdbfe",
  borderRadius: 24,
  padding: 16,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  boxShadow: "0 16px 40px rgba(37, 99, 235, 0.12)",
};
const workflowSectionStyle = (color: string, bg: string): CSSProperties => ({
  border: `3px solid ${color}`,
  borderRadius: 26,
  padding: 18,
  background: `linear-gradient(135deg, ${bg} 0%, #ffffff 62%)`,
  boxShadow: "0 18px 44px rgba(15, 23, 42, 0.10)",
  overflow: "hidden",
});
const workflowHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "0 0 16px",
  marginBottom: 16,
  borderBottom: "2px solid",
};
const workflowIconStyle: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 16,
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  fontWeight: 1000,
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.16)",
};
const workflowTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 1000,
  lineHeight: 1.08,
  letterSpacing: -0.5,
};
const workflowSubtitleStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#475569",
  fontSize: 15,
  fontWeight: 850,
};
const emptyWorkflowStyle: CSSProperties = {
  padding: 24,
  borderRadius: 18,
  background: "#ffffff",
  color: "#64748b",
  border: "1px dashed #94a3b8",
  textAlign: "center",
  fontWeight: 900,
  fontSize: 17,
};
const rentalPaymentTableWrapStyle: CSSProperties = {
  marginTop: 16,
  overflowX: "auto",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 18,
  background: "#ffffff",
  boxShadow: "0 16px 34px rgba(2, 8, 23, 0.18)",
};
const rentalPaymentTableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  minWidth: 980,
};
const rentalPaymentThStyle: CSSProperties = {
  background: "#061426",
  color: "white",
  padding: "13px 10px",
  fontWeight: 1000,
  fontSize: 15,
  textAlign: "center",
  whiteSpace: "nowrap",
  borderBottom: "3px solid #facc15",
};
const rentalPaymentThLeftStyle: CSSProperties = {
  ...rentalPaymentThStyle,
  textAlign: "left",
};
const rentalPaymentThRightStyle: CSSProperties = {
  ...rentalPaymentThStyle,
  textAlign: "right",
};
const rentalPaymentTdStyle: CSSProperties = {
  padding: "12px 10px",
  borderBottom: "1px solid #dbeafe",
  color: "#061426",
  fontWeight: 850,
  fontSize: 15,
  textAlign: "center",
  whiteSpace: "nowrap",
  background: "#ffffff",
};
const rentalPaymentNameTdStyle: CSSProperties = {
  ...rentalPaymentTdStyle,
  textAlign: "left",
  fontWeight: 1000,
  whiteSpace: "normal",
  minWidth: 210,
};
const rentalPaymentAmountTdStyle: CSSProperties = {
  ...rentalPaymentTdStyle,
  textAlign: "right",
  color: "#ef2f2f",
  fontWeight: 1000,
  fontSize: 17,
};
const rentalPaymentEmptyTdStyle: CSSProperties = {
  padding: 24,
  textAlign: "center",
  color: "#64748b",
  fontWeight: 900,
};
const liveStatusBadgeStyle: CSSProperties = {
  display: "inline-block",
  padding: "6px 12px",
  borderRadius: 999,
  background: "#16a34a",
  color: "#ffffff",
  fontWeight: 1000,
  boxShadow: "0 8px 16px rgba(22, 163, 74, 0.24)",
};
const closedStatusBadgeStyle: CSSProperties = {
  display: "inline-block",
  padding: "6px 12px",
  borderRadius: 999,
  background: "#ef2f2f",
  color: "#ffffff",
  fontWeight: 1000,
  boxShadow: "0 8px 16px rgba(239, 47, 47, 0.22)",
};
const payButtonStyle: CSSProperties = {
  background: "#16a34a",
  borderColor: "#16a34a",
  fontWeight: 1000,
  padding: "9px 14px",
};
const statementButtonStyle: CSSProperties = {
  background: "#7c3aed",
  borderColor: "#7c3aed",
  color: "white",
  fontWeight: 1000,
  padding: "9px 14px",
};
const paymentOptionCardStyle: CSSProperties = {
  marginTop: 16,
  border: "1px solid #bbf7d0",
  borderRadius: 22,
  padding: 18,
  background: "#ffffff",
  boxShadow: "0 14px 34px rgba(22, 163, 74, 0.12)",
};
const paymentOptionTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 16,
};
const paymentOptionLabelStyle: CSSProperties = {
  color: "#16a34a",
  fontWeight: 1000,
  fontSize: 13,
  letterSpacing: "0.08em",
};
const paymentOptionCustomerStyle: CSSProperties = {
  color: "#0f172a",
  fontWeight: 1000,
  fontSize: 26,
  lineHeight: 1.1,
  marginTop: 4,
};
const paymentOptionMetaStyle: CSSProperties = {
  color: "#475569",
  fontWeight: 850,
  marginTop: 5,
};
const balanceBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 16px",
  borderRadius: 999,
  background: "#dc2626",
  color: "white",
  fontSize: 20,
  fontWeight: 1000,
  boxShadow: "0 10px 24px rgba(220, 38, 38, 0.22)",
};
const statementQuickControlsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(170px, 1fr) 155px 155px auto",
  gap: 10,
  alignItems: "center",
  marginBottom: 14,
};

const twoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 4fr) minmax(260px, 1fr)",
  gap: 16,
  alignItems: "start",
  marginBottom: 22,
};
const filterBoxStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
};
const bigControlStyle: CSSProperties = {
  minHeight: 52,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  padding: "0 14px",
  fontSize: 16,
  fontWeight: 800,
  background: "white",
};
const labelStyle: CSSProperties = {
  display: "block",
  fontWeight: 950,
  marginBottom: 8,
  color: "#0f172a",
};
const smallTitleStyle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 20,
  color: "#0f172a",
};
const miniCardStyle: CSSProperties = {
  border: "1px solid #dbeafe",
  borderRadius: 18,
  padding: 14,
  background: "#ffffff",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
};
const emptyStyle: CSSProperties = {
  padding: 18,
  borderRadius: 16,
  background: "#f8fafc",
  color: "#64748b",
  fontWeight: 850,
  textAlign: "center",
};
const customerBoxStyle: CSSProperties = {
  border: "2px solid #bfdbfe",
  background: "#f8fbff",
  borderRadius: 22,
  padding: 18,
  boxShadow: "0 14px 34px rgba(37, 99, 235, 0.10)",
};
const statementLineBoxStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  marginTop: 16,
  background: "white",
  borderRadius: 16,
  padding: 14,
  border: "1px solid #e2e8f0",
};
const statementSummaryLineStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(145px, 1fr))",
  gap: 12,
  marginTop: 14,
};
const summaryPillStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",
  gap: 8,
  border: "2px solid",
  borderRadius: 18,
  padding: "16px 18px",
  minHeight: 92,
  fontSize: 16,
  whiteSpace: "nowrap",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)",
};
const paymentHistoryBoxStyle: CSSProperties = {
  marginTop: 14,
  border: "3px solid #2563eb",
  background: "#ffffff",
  borderRadius: 18,
  padding: 14,
  boxShadow: "0 14px 32px rgba(37, 99, 235, 0.16)",
};
const paymentHistoryTitleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 1000,
  color: "#1d4ed8",
  marginBottom: 10,
  letterSpacing: 0.2,
};
const paymentHistoryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 8,
};
const paymentHistoryItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "90px 82px 78px 1fr",
  gap: 8,
  alignItems: "center",
  border: "1px solid #bfdbfe",
  borderRadius: 14,
  padding: "10px 12px",
  fontSize: 15,
  fontWeight: 900,
  color: "#1e293b",
  background: "#f8fbff",
};
const paymentHistoryEmptyStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  background: "#f8fafc",
  color: "#64748b",
  fontWeight: 850,
};
const paymentFormStyle: CSSProperties = {
  marginTop: 16,
  border: "3px solid #a78bfa",
  borderRadius: 24,
  padding: 18,
  background: "linear-gradient(135deg, #6d28d9, #4f46e5)",
  boxShadow: "0 18px 42px rgba(79, 70, 229, 0.32)",
};
const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12,
};
const detailRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  border: "1px solid #e2e8f0",
  background: "white",
  padding: 10,
  borderRadius: 14,
};

const detailCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "white",
  padding: 12,
  borderRadius: 16,
};
const detailGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "6px 16px",
  marginTop: 10,
  color: "#475569",
};
const amountLineStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginTop: 10,
  fontSize: 18,
};
const compactDetailsBoxStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  marginTop: 10,
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  overflow: "hidden",
  background: "white",
};
const compactRentalLineStyle: CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
};
const compactToolNameStyle: CSSProperties = {
  fontWeight: 950,
  fontSize: 17,
  color: "#0f172a",
  lineHeight: 1.3,
};
const compactMetaStyle: CSSProperties = {
  marginTop: 5,
  color: "#475569",
  fontWeight: 850,
  fontSize: 15,
  lineHeight: 1.4,
};
const compactTotalLineStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  padding: "12px 14px",
  background: "#eff6ff",
  fontSize: 17,
};
const inlineStatementStyle: CSSProperties = {
  marginTop: 18,
  border: "1px solid #93c5fd",
  borderRadius: 20,
  padding: 16,
  background: "#ffffff",
  boxShadow: "0 10px 28px rgba(37, 99, 235, 0.12)",
};
const inlineStatementTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  alignItems: "center",
  marginBottom: 14,
  borderBottom: "1px solid #dbeafe",
  paddingBottom: 16,
};

const statementTitleStyle: CSSProperties = {
  fontSize: 26,
  fontWeight: 950,
  color: "#0b2a6f",
  lineHeight: 1.1,
};
const statementPeriodStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 15,
  fontWeight: 900,
  color: "#334155",
};
const statementInfoGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
  marginBottom: 12,
  fontSize: 15,
  fontWeight: 850,
};
const statementInnerStyle: CSSProperties = {
  border: "1px solid #dbeafe",
  borderRadius: 16,
  overflow: "hidden",
  background: "#ffffff",
};

const statementRentalTableWrapStyle: CSSProperties = {
  borderBottom: "1px solid #dbeafe",
};
const statementTableTitleStyle: CSSProperties = {
  padding: "12px 14px",
  fontSize: 20,
  fontWeight: 950,
  color: "#0b2a6f",
  background: "#eff6ff",
};
const statementTableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};
const statementThStyle: CSSProperties = {
  background: "#0057ff",
  color: "white",
  padding: "9px 8px",
  textAlign: "left",
  fontWeight: 950,
};
const statementThRightStyle: CSSProperties = {
  ...statementThStyle,
  textAlign: "right",
};
const statementTdStyle: CSSProperties = {
  padding: "9px 8px",
  borderBottom: "1px solid #e2e8f0",
  fontWeight: 800,
  color: "#0f172a",
};
const statementTdItemStyle: CSSProperties = {
  ...statementTdStyle,
  fontWeight: 950,
};
const statementTdRightStyle: CSSProperties = {
  ...statementTdStyle,
  textAlign: "right",
};
const statementTdAmountStyle: CSSProperties = {
  ...statementTdStyle,
  textAlign: "right",
  color: "#0057ff",
  fontWeight: 950,
};
const statementEmptyTdStyle: CSSProperties = {
  padding: 14,
  textAlign: "center",
  fontWeight: 850,
  color: "#64748b",
};
const statementTotalLabelStyle: CSSProperties = {
  padding: "10px 8px",
  textAlign: "right",
  fontWeight: 950,
  background: "#eff6ff",
  borderTop: "1px solid #bfdbfe",
};
const statementTotalValueStyle: CSSProperties = {
  padding: "10px 8px",
  textAlign: "right",
  fontWeight: 950,
  color: "#0057ff",
  background: "#eff6ff",
  borderTop: "1px solid #bfdbfe",
};

const rentalTableBoxStyle: CSSProperties = {
  marginTop: 16,
  border: "1px solid #bfdbfe",
  borderRadius: 18,
  overflow: "hidden",
  background: "#ffffff",
};
const rentalTableTitleStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  padding: "14px 16px",
  background: "#eff6ff",
  color: "#002e8a",
  fontSize: 22,
  fontWeight: 950,
};
const rentalTableWrapStyle: CSSProperties = { overflowX: "auto" };
const rentalTableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1080,
};
const rentalThStyle: CSSProperties = {
  background: "#0057ff",
  color: "white",
  padding: "12px 10px",
  fontSize: 17,
  fontWeight: 950,
  textAlign: "center",
  whiteSpace: "nowrap",
};
const rentalThSmallStyle: CSSProperties = { ...rentalThStyle, width: 52 };
const rentalThLeftStyle: CSSProperties = {
  ...rentalThStyle,
  textAlign: "left",
};
const rentalThRightStyle: CSSProperties = {
  ...rentalThStyle,
  textAlign: "right",
};
const rentalTdStyle: CSSProperties = {
  padding: "12px 10px",
  borderBottom: "1px solid #dbeafe",
  fontSize: 17,
  fontWeight: 850,
  color: "#0f172a",
  textAlign: "center",
  whiteSpace: "nowrap",
};
const rentalTdCenterStyle: CSSProperties = {
  ...rentalTdStyle,
  textAlign: "center",
  fontWeight: 950,
};
const rentalTdToolStyle: CSSProperties = {
  ...rentalTdStyle,
  textAlign: "left",
  fontWeight: 950,
  minWidth: 260,
  whiteSpace: "normal",
};
const rentalTdRightStyle: CSSProperties = {
  ...rentalTdStyle,
  textAlign: "right",
};
const rentalTdAmountStyle: CSSProperties = {
  ...rentalTdStyle,
  textAlign: "right",
  color: "#0057ff",
  fontWeight: 950,
};
const rentalEmptyCellStyle: CSSProperties = {
  padding: 20,
  textAlign: "center",
  fontSize: 18,
  fontWeight: 900,
  color: "#64748b",
};
const rentalTotalLabelStyle: CSSProperties = {
  padding: "12px 10px",
  textAlign: "right",
  background: "#f8fafc",
  borderTop: "1px solid #dbeafe",
  fontSize: 18,
  fontWeight: 950,
};
const rentalTotalAmountStyle: CSSProperties = {
  padding: "12px 10px",
  textAlign: "right",
  background: "#f8fafc",
  borderTop: "1px solid #dbeafe",
  color: "#0057ff",
  fontSize: 18,
  fontWeight: 950,
};
const rentalGrandTotalLabelStyle: CSSProperties = {
  padding: "14px 10px",
  textAlign: "right",
  background: "#eaf3ff",
  borderTop: "1px solid #bfdbfe",
  fontSize: 20,
  fontWeight: 950,
};
const rentalGrandTotalAmountStyle: CSSProperties = {
  padding: "14px 10px",
  textAlign: "right",
  background: "#eaf3ff",
  borderTop: "1px solid #bfdbfe",
  color: "#0057ff",
  fontSize: 22,
  fontWeight: 950,
};
const returnedBadgeStyle: CSSProperties = {
  display: "inline-block",
  padding: "5px 10px",
  borderRadius: 999,
  background: "#fee2e2",
  color: "#b91c1c",
  fontSize: 14,
  fontWeight: 950,
};
const currentBadgeStyle: CSSProperties = {
  display: "inline-block",
  padding: "5px 10px",
  borderRadius: 999,
  background: "#dbeafe",
  color: "#0057ff",
  fontSize: 14,
  fontWeight: 950,
};


const rentalPaymentSheetStyle: CSSProperties = {
  background:
    "radial-gradient(circle at top left, rgba(255,255,255,0.16), transparent 32%), linear-gradient(180deg, #0b4cc2 0%, #063378 100%)",
  borderRadius: 28,
  border: "1px solid rgba(255,255,255,0.22)",
  padding: "28px 32px 26px",
  boxShadow: "0 24px 54px rgba(2, 8, 23, 0.26)",
  marginBottom: 26,
  color: "#ffffff",
};
const rentalPaymentTopStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(260px, 1fr) minmax(180px, 240px)",
  gap: 20,
  alignItems: "end",
  marginBottom: 24,
};
const rentalPaymentTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(42px, 5vw, 72px)",
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: "-0.03em",
  color: "#ffffff",
  textShadow: "0 8px 24px rgba(2, 8, 23, 0.28)",
  whiteSpace: "nowrap",
};
const rentalPaymentSearchStyle: CSSProperties = {
  height: 46,
  border: "1px solid rgba(255,255,255,0.55)",
  borderRadius: 14,
  padding: "0 16px",
  fontSize: 16,
  fontWeight: 900,
  color: "#061426",
  background: "#ffffff",
  minWidth: 280,
  boxShadow: "0 12px 24px rgba(2, 8, 23, 0.18)",
  outline: "none",
};
const rentalPaymentShopSelectStyle: CSSProperties = {
  height: 46,
  border: "1px solid rgba(255,255,255,0.55)",
  borderRadius: 14,
  padding: "0 14px",
  fontSize: 16,
  fontWeight: 950,
  color: "#061426",
  background: "linear-gradient(135deg, #facc15 0%, #f59e0b 100%)",
  minWidth: 180,
  boxShadow: "0 12px 24px rgba(245, 158, 11, 0.22)",
  outline: "none",
};
const dateBoxWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  fontWeight: 900,
  color: "#0f172a",
  fontSize: 14,
};
const dateBoxStyle: CSSProperties = {
  height: 44,
  border: "1.5px solid #cbd5e1",
  borderRadius: 14,
  padding: "0 12px",
  fontSize: 15,
  fontWeight: 900,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  color: "#0f172a",
  boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.04)",
};
const paymentBlueBoxStyle: CSSProperties = {
  marginTop: 26,
  marginBottom: 24,
  borderRadius: 28,
  background:
    "radial-gradient(circle at top left, rgba(255,255,255,0.22), transparent 34%), linear-gradient(180deg, #0b4cc2 0%, #073780 100%)",
  padding: "30px 34px 34px",
  boxShadow: "0 24px 54px rgba(2, 8, 23, 0.28)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.24)",
  position: "relative",
  overflow: "hidden",
};
const paymentBlueTopStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, auto) minmax(280px, 1fr) minmax(220px, auto)",
  alignItems: "stretch",
  gap: 20,
};
const paymentBlueTitleStyle: CSSProperties = {
  fontSize: "clamp(40px, 5vw, 62px)",
  lineHeight: 1,
  fontWeight: 850,
  color: "white",
  letterSpacing: "-0.03em",
  textShadow: "0 8px 24px rgba(2, 8, 23, 0.18)",
  display: "flex",
  alignItems: "center",
};
const paymentBlueSearchStyle: CSSProperties = {
  height: 44,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.72)",
  padding: "0 22px",
  textAlign: "center",
  fontSize: 15,
  fontWeight: 900,
  color: "#0f172a",
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 14px 26px rgba(2, 132, 199, 0.20)",
  outline: "none",
};
const paymentBlueCustomerStyle: CSSProperties = {
  textAlign: "left",
  color: "white",
  background: "rgba(255,255,255,0.12)",
  padding: "14px 18px",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.24)",
  boxShadow: "0 14px 26px rgba(2, 8, 23, 0.12)",
  display: "grid",
  gap: 6,
};
const paymentBlueMetaLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.78)",
};
const paymentBlueNameStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 1000,
  lineHeight: 1.05,
  color: "#ffffff",
};
const paymentBlueMetaRowStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 850,
  lineHeight: 1.2,
  color: "rgba(255,255,255,0.96)",
};
const paymentBlueLongInfoBarStyle: CSSProperties = {
  minHeight: 42,
  borderRadius: 999,
  padding: "0 20px",
  background: "rgba(255,255,255,0.96)",
  color: "#061426",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 24,
  fontSize: 16,
  fontWeight: 1000,
  boxShadow: "0 12px 22px rgba(2, 8, 23, 0.16)",
};
const paymentQuickCustomerSearchStyle: CSSProperties = {
  minHeight: 42,
  borderRadius: 999,
  padding: "0 20px",
  background: "#ffffff",
  color: "#061426",
  border: "1px solid rgba(191,219,254,0.95)",
  fontSize: 15,
  fontWeight: 950,
  boxShadow: "0 12px 22px rgba(2, 8, 23, 0.14)",
  outline: "none",
  width: "100%",
};
const paymentBlueBalanceBoxStyle: CSSProperties = {
  textAlign: "center",
  color: "white",
  background: "linear-gradient(135deg, #0f172a 0%, #061426 100%)",
  padding: "16px 18px",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.18)",
  boxShadow: "0 18px 28px rgba(2, 8, 23, 0.22)",
  display: "grid",
  alignContent: "center",
};
const paymentBlueBalanceCaptionStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.76)",
  marginBottom: 4,
};
const paymentBlueBalanceValueStyle: CSSProperties = {
  fontSize: "clamp(28px, 4vw, 42px)",
  lineHeight: 1,
  fontWeight: 1000,
  color: "#facc15",
  textShadow: "0 6px 18px rgba(250, 204, 21, 0.18)",
};
const paymentBlueInputsStyle: CSSProperties = {
  marginTop: 24,
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1fr) minmax(160px, 0.8fr) minmax(170px, 0.8fr) auto auto",
  justifyContent: "center",
  alignItems: "center",
  gap: 18,
};
const paymentPillInputStyle: CSSProperties = {
  height: 46,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.68)",
  padding: "0 18px",
  textAlign: "center",
  fontSize: 16,
  fontWeight: 900,
  color: "#0f172a",
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 14px 26px rgba(2, 132, 199, 0.18)",
  outline: "none",
};
const paymentSaveButtonStyle: CSSProperties = {
  height: 46,
  borderRadius: 16,
  padding: "0 26px",
  background: "linear-gradient(135deg, #16a34a 0%, #0ca43d 100%)",
  border: "1px solid rgba(255,255,255,0.36)",
  color: "white",
  fontWeight: 1000,
  boxShadow: "0 14px 26px rgba(22, 163, 74, 0.34)",
  cursor: "pointer",
};
const paymentArrearsButtonStyle: CSSProperties = {
  height: 46,
  borderRadius: 16,
  padding: "0 26px",
  background: "linear-gradient(135deg, #ef2f2f 0%, #b91c1c 100%)",
  border: "1px solid rgba(255,255,255,0.34)",
  color: "white",
  fontWeight: 1000,
  boxShadow: "0 14px 26px rgba(239, 47, 47, 0.28)",
  cursor: "pointer",
};
const statementSimpleSectionStyle: CSSProperties = {
  background: "linear-gradient(180deg, #0b4cc2 0%, #073780 100%)",
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.20)",
  padding: 28,
  marginBottom: 24,
  boxShadow: "0 20px 44px rgba(2, 8, 23, 0.24)",
};
const plainLinkButtonStyle: CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#0b4cc2",
  fontSize: 16,
  fontWeight: 950,
  cursor: "pointer",
  padding: 0,
};
const rentalPaymentEmptyCellStyle: CSSProperties = {
  height: 25,
  border: "1px solid rgba(15, 23, 42, 0.45)",
  background: "rgba(255,255,255,0.65)",
};
const simpleStatementWrapStyle: CSSProperties = {
  background: "#ffffff",
  color: "#111827",
  padding: "30px 20px 12px",
  fontFamily: 'Arial, "Noto Sans Malayalam", sans-serif',
  borderRadius: 18,
  border: "1px solid #bfdbfe",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
};
const simpleStatementHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 26,
  marginBottom: 24,
};
const simpleStatementTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(36px, 5vw, 66px)",
  lineHeight: 1.02,
  color: "#0b4cc2",
  fontWeight: 850,
  textShadow: "0 6px 18px rgba(11, 76, 194, 0.12)",
};
const simpleStatementMetaStyle: CSSProperties = {
  display: "flex",
  gap: 28,
  flexWrap: "wrap",
  marginTop: 16,
  fontSize: 18,
  fontWeight: 900,
  color: "#111827",
};
const simpleCustomerPanelStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  minWidth: 420,
};
const simpleCustomerLabelStyle: CSSProperties = {
  width: "fit-content",
  padding: "5px 10px",
  borderRadius: 999,
  background: "#e0f2fe",
  color: "#0b4cc2",
  fontSize: 12,
  fontWeight: 1000,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
const simpleCustomerNameStyle: CSSProperties = {
  fontSize: "clamp(28px, 4vw, 44px)",
  lineHeight: 1,
  color: "#0b4cc2",
  fontWeight: 1000,
  letterSpacing: "-0.03em",
  textShadow: "0 6px 18px rgba(11, 76, 194, 0.10)",
};
const simpleCustomerInfoGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(160px, 220px) minmax(150px, 220px)",
  gap: 12,
  alignItems: "stretch",
};
const simpleCustomerInfoPillStyle: CSSProperties = {
  display: "grid",
  gap: 3,
  padding: "10px 14px",
  borderRadius: 16,
  background: "linear-gradient(180deg, #f8fbff 0%, #fffaf0 100%)",
  border: "1px solid #dbeafe",
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.06)",
};
const simpleCustomerInfoLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 1000,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
const simpleCustomerInfoValueStyle: CSSProperties = {
  color: "#0b4cc2",
  fontSize: 17,
  fontWeight: 1000,
  lineHeight: 1.1,
};
const simpleStatementRightStyle: CSSProperties = {
  minWidth: 230,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  alignItems: "stretch",
};
const simpleDateRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
};
const simpleDateLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  color: "#111827",
  fontSize: 14,
  fontWeight: 900,
};
const simpleDateInputStyle: CSSProperties = {
  width: 140,
  height: 38,
  border: "1.5px solid #94a3b8",
  borderRadius: 12,
  padding: "0 10px",
  fontSize: 14,
  fontWeight: 900,
  color: "#111827",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.04)",
};
const simpleBalanceStyle: CSSProperties = {
  background: "linear-gradient(135deg, #ef2f2f 0%, #b91c1c 100%)",
  color: "white",
  padding: "10px 14px",
  fontSize: 22,
  fontWeight: 900,
  textAlign: "center",
  borderRadius: 12,
  boxShadow: "0 12px 22px rgba(239, 47, 47, 0.24)",
};
const simpleStatementTableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  tableLayout: "fixed",
  fontSize: 16,
  overflow: "hidden",
  borderRadius: 14,
};
const simpleThStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "8px 5px",
  textAlign: "left",
  color: "#ffffff",
  fontSize: 15,
  lineHeight: 1.08,
  fontWeight: 1000,
  background: "#061426",
  overflowWrap: "normal",
  wordBreak: "normal",
};
const simpleThCenterStyle: CSSProperties = {
  ...simpleThStyle,
  textAlign: "center",
};
const simpleTdStyle: CSSProperties = {
  border: "1px solid #dbeafe",
  padding: "8px 5px",
  color: "#111827",
  fontSize: 16,
  lineHeight: 1.12,
  fontWeight: 900,
  verticalAlign: "middle",
  background: "#fffaf0",
  overflowWrap: "normal",
  wordBreak: "normal",
};
const simpleTdStrongStyle: CSSProperties = {
  ...simpleTdStyle,
  fontWeight: 950,
};
const simpleTdAmountStyle: CSSProperties = {
  ...simpleTdStyle,
  textAlign: "center",
  fontWeight: 900,
  whiteSpace: "nowrap",
};
const simpleTotalStyle: CSSProperties = {
  ...simpleTdStyle,
  background: "#dbeafe",
  color: "#0f2a5f",
  fontWeight: 1000,
  borderTop: "3px solid #2563eb",
  borderBottom: "3px solid #2563eb",
};
const simpleTotalLabelStyle: CSSProperties = {
  ...simpleTotalStyle,
  textAlign: "left",
};
const simpleTotalAmountStyle: CSSProperties = {
  ...simpleTotalStyle,
  textAlign: "center",
};
const simpleStatementActionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 26,
  marginTop: 20,
  paddingRight: 8,
  flexWrap: "wrap",
};
const simpleTextActionStyle: CSSProperties = {
  border: 0,
  background: "linear-gradient(135deg, #16a34a 0%, #0ca43d 100%)",
  color: "#ffffff",
  fontSize: 20,
  fontWeight: 900,
  cursor: "pointer",
  borderRadius: 12,
  padding: "10px 16px",
  boxShadow: "0 10px 20px rgba(22, 163, 74, 0.22)",
};

const sortableHeaderButtonStyle: CSSProperties = {
  border: 0,
  background: "transparent",
  color: "inherit",
  font: "inherit",
  fontWeight: 950,
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
};


const paymentPopupTitleStyle: CSSProperties = {
  margin: "0 0 14px",
  fontSize: 28,
  color: "#0f172a",
  fontWeight: 1000,
};
const paymentEditNoteStyle: CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 14,
  padding: 12,
  marginBottom: 16,
  color: "#0f2a5f",
  fontWeight: 850,
  lineHeight: 1.45,
};
const paymentEditGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
  gap: 12,
};
const paymentEditLabelStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 950,
};
const popupButtonRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  marginTop: 18,
  flexWrap: "wrap",
};
const deletePaymentWarningStyle: CSSProperties = {
  background: "#fff1f2",
  border: "1px solid #fecaca",
  borderRadius: 16,
  padding: 16,
  marginBottom: 14,
  color: "#111827",
  fontWeight: 900,
  lineHeight: 1.8,
};
const deletePaymentTextStyle: CSSProperties = {
  color: "#475569",
  fontWeight: 850,
  margin: "0 0 10px",
};
const deleteConfirmButtonStyle: CSSProperties = {
  border: "1px solid #dc2626",
  background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
  color: "#ffffff",
  borderRadius: 12,
  padding: "10px 16px",
  fontSize: 15,
  fontWeight: 1000,
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(185, 28, 28, 0.24)",
};
const recentPaymentsInsidePaymentStyle: CSSProperties = {
  marginTop: 18,
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(255,255,255,0.35)",
  borderRadius: 18,
  padding: 14,
  color: "#0f172a",
};

const recentPaymentsHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 12,
};

const recentPaymentsTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 24,
  fontWeight: 1000,
};

const recentPaymentsSubtitleStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#475569",
  fontSize: 13,
  fontWeight: 850,
};

const recentPaymentsControlsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr 1fr auto",
  gap: 10,
  alignItems: "end",
  marginBottom: 12,
};

const recentPaymentDateLabelStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  color: "#334155",
  fontSize: 11,
  fontWeight: 1000,
  textTransform: "uppercase",
};

const recentPaymentClearButtonStyle: CSSProperties = {
  minHeight: 42,
  whiteSpace: "nowrap",
};

const recentPaymentDownloadButtonStyle: CSSProperties = {
  minHeight: 40,
  padding: "0 16px",
  whiteSpace: "nowrap",
};

const recentPaymentTableWrapStyle: CSSProperties = {
  marginTop: 0,
  border: "1px solid #bfdbfe",
  borderRadius: 14,
  overflow: "auto",
};

const recentPaymentTableStyle: CSSProperties = {
  width: "100%",
  minWidth: 980,
  borderCollapse: "collapse",
};

const recentPaymentControlStyle: CSSProperties = {
  height: 42,
  minWidth: 150,
  borderRadius: 12,
  border: "1px solid #bfdbfe",
  padding: "0 12px",
  fontWeight: 900,
  color: "#0f172a",
};
const recentPaymentActionStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};
const editPaymentButtonStyle: CSSProperties = {
  border: "1px solid #2563eb",
  background: "#eff6ff",
  color: "#0b4cc2",
  borderRadius: 10,
  padding: "7px 10px",
  fontSize: 13,
  fontWeight: 1000,
  cursor: "pointer",
};
const deletePaymentButtonStyle: CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
  borderRadius: 10,
  padding: "7px 10px",
  fontSize: 13,
  fontWeight: 1000,
  cursor: "pointer",
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.65)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};
const popupStyle: CSSProperties = {
  width: "min(560px, 100%)",
  background: "white",
  borderRadius: 22,
  padding: 24,
  boxShadow: "0 25px 80px rgba(0,0,0,0.35)",
  border: "1px solid #dbeafe",
};
const blueInfoStyle: CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 16,
  padding: 16,
  marginBottom: 16,
  fontWeight: 900,
  lineHeight: 1.8,
};
