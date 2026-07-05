"use client";

import { type CSSProperties, useEffect, useState } from "react";
import {
  getRentalPageData,
  saveRentals,
  returnRental,
  deleteRental,
  saveCustomer,
} from "../actions";
import { useAppMessage } from "../contexts/AppMessageProvider";

const branches = ["Karuvannur", "Ollur", "Kachery", "Mulayam Rd", "Pattikkad"];
const today = new Date().toISOString().slice(0, 10);

const emptyRental = {
  customer_id: "",
  mobile: "",
  customer_name: "",
  tool_id: "",
  qty: 1,
  daily_rate: 0,
  discount: 0,
  start_date: today,
  end_date: "",
  status: "Active",
  shop: "",
  avoid_sundays: true,
};

const emptyNewCustomer = {
  customer_name: "",
  mobile: "",
  occupation: "",
  address: "",
  shop: "",
  notes: "",
};

const compactTableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
  tableLayout: "fixed" as const,
  fontSize: 15,
};

const compactHeaderStyle = {
  textAlign: "center" as const,
  fontWeight: 950,
  padding: "7px 6px",
  whiteSpace: "nowrap" as const,
};

const compactCellStyle = {
  padding: "5px 6px",
  lineHeight: 1.1,
  fontWeight: 850,
  verticalAlign: "middle" as const,
};

const compactCenterCellStyle = {
  ...compactCellStyle,
  textAlign: "center" as const,
};

const compactInputStyle = {
  width: "100%",
  minWidth: 0,
  padding: "7px 6px",
  fontWeight: 850,
  fontSize: 14,
};

const compactSelectStyle = {
  width: "100%",
  minWidth: 0,
  padding: "7px 6px",
  fontWeight: 850,
  fontSize: 14,
};

const liveSearchStyle: CSSProperties = {
  width: "min(420px, 100%)",
  minWidth: 260,
  padding: "13px 15px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  fontSize: 16,
  fontWeight: 900,
};

const shopTabsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(130px, 1fr))",
  gap: 10,
  marginBottom: 16,
};

const shopTabStyle: CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#0f2a5f",
  borderRadius: 14,
  padding: "13px 12px",
  fontSize: 15,
  fontWeight: 950,
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const activeShopTabStyle: CSSProperties = {
  background: "linear-gradient(135deg, #0057ff, #0f2a5f)",
  color: "white",
  borderColor: "#0057ff",
  boxShadow: "0 10px 22px rgba(0, 87, 255, 0.22)",
};

const confirmOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(7, 23, 53, 0.58)",
  zIndex: 100000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};

const confirmCardStyle: CSSProperties = {
  width: "min(520px, 94vw)",
  background: "#ffffff",
  borderRadius: 22,
  overflow: "hidden",
  boxShadow: "0 28px 80px rgba(15, 23, 42, 0.42)",
  border: "1px solid #e2e8f0",
};

const confirmBodyStyle: CSSProperties = {
  padding: "24px 26px 26px",
};

const confirmGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginTop: 18,
};

const confirmInfoStyle: CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: "12px 14px",
};

const confirmLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 950,
  color: "#64748b",
  textTransform: "uppercase",
  marginBottom: 4,
};

const confirmValueStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 950,
  color: "#0f172a",
};

const confirmButtonRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  marginTop: 24,
  flexWrap: "wrap",
};

const confirmCancelButtonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 12,
  padding: "13px 20px",
  fontSize: 16,
  fontWeight: 950,
  cursor: "pointer",
};

const confirmActionButtonStyle: CSSProperties = {
  border: 0,
  color: "#ffffff",
  borderRadius: 12,
  padding: "13px 22px",
  fontSize: 16,
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(15, 23, 42, 0.18)",
};

export default function RentalsPage() {
  const { setAppMessage } = useAppMessage();

  const [customers, setCustomers] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>(
    Array.from({ length: 20 }, () => ({ ...emptyRental })),
  );

  const [selectedBranch, setSelectedBranch] = useState("");
  const [bulkDate, setBulkDate] = useState(today);
  const [businessDate, setBusinessDate] = useState(today);
  const [liveBranchFilter, setLiveBranchFilter] = useState("All Shops");
  const [liveSearchText, setLiveSearchText] = useState("");

  const [newCustomer, setNewCustomer] = useState<any>({ ...emptyNewCustomer });
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [addCustomerRowIndex, setAddCustomerRowIndex] = useState<number | null>(
    null,
  );

  const [loading, setLoading] = useState(false);

  const [returnMode, setReturnMode] = useState<any>({});
  const [returnDates, setReturnDates] = useState<any>({});

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmDate, setConfirmDate] = useState("");
  const [mobileSuggestions, setMobileSuggestions] = useState<any>({});
  const [shopPopupOpen, setShopPopupOpen] = useState(false);
  const [popupShop, setPopupShop] = useState("");
  const [rentalConfirm, setRentalConfirm] = useState<any>(null);

  function showError(message: string) {
    setAppMessage({
      type: "error",
      title: "Error",
      message,
    });
  }

  function showSuccess(message: string) {
    setAppMessage({
      type: "success",
      title: "Success",
      message,
    });
  }

  function showWarning(message: string) {
    setAppMessage({
      type: "warning",
      title: "Warning",
      message,
    });
  }

  const uniqueTools = Array.from(
    new Map(
      tools.map((tool: any) => [
        String(tool.tool_name || "")
          .trim()
          .toLowerCase(),
        tool,
      ]),
    ).values(),
  );

  async function loadData() {
    const res = await getRentalPageData();

    if (res.success) {
      setCustomers(res.customers || []);
      setTools(res.tools || []);
      setRentals(res.rentals || []);
    } else {
      showError(res.message || "Failed to load rentals");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function changeRow(index: number, field: string, value: any) {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  }

  function copyPreviousCustomerDetails(index: number) {
    let sourceRow: any = null;

    for (let i = index - 1; i >= 0; i--) {
      const row = rows[i];

      if (row?.customer_id || row?.mobile || row?.customer_name) {
        sourceRow = row;
        break;
      }
    }

    if (!sourceRow) {
      showWarning("No previous customer found to copy");
      return;
    }

    const updated = [...rows];

    updated[index] = {
      ...updated[index],
      customer_id: sourceRow.customer_id || "",
      mobile: sourceRow.mobile || "",
      customer_name: sourceRow.customer_name || "",
      start_date: sourceRow.start_date || today,
      end_date: sourceRow.end_date || "",
      avoid_sundays: sourceRow.avoid_sundays !== false,
    };

    setRows(updated);
    setMobileSuggestions({
      ...mobileSuggestions,
      [index]: [],
    });
  }

  function applyDateToAllRows() {
    if (!bulkDate) {
      showWarning("Please select a date");
      return;
    }

    const updated = rows.map((row) => ({
      ...row,
      start_date: bulkDate,
    }));

    setRows(updated);
    showSuccess(`Date applied to all rows: ${bulkDate}`);
  }

  function handleMobileChange(index: number, value: string) {
    const updated = [...rows];

    updated[index] = {
      ...updated[index],
      mobile: value,
    };

    setRows(updated);

    const searchValue = value.trim();

    const matches =
      searchValue.length === 0
        ? []
        : customers.filter((c) => String(c.mobile || "").includes(searchValue));

    setMobileSuggestions({
      ...mobileSuggestions,
      [index]: matches.slice(0, 8),
    });

    const exact = customers.find((c) => String(c.mobile) === String(value));

    if (exact) {
      updated[index] = {
        ...updated[index],
        customer_id: exact.id,
        customer_name: exact.customer_name,
      };

      setRows(updated);
      setShowAddCustomer(false);
      setAddCustomerRowIndex(null);
    } else {
      updated[index] = {
        ...updated[index],
        customer_id: "",
        customer_name: "",
      };

      setRows(updated);

      setNewCustomer({
        ...emptyNewCustomer,
        mobile: value,
      });

      setAddCustomerRowIndex(index);

      if (searchValue.length >= 5 && matches.length === 0) {
        setShowAddCustomer(true);
      } else {
        setShowAddCustomer(false);
      }
    }
  }

  async function handleSaveNewCustomer() {
    const res = await saveCustomer(newCustomer);

    if (!res.success) {
      showError(res.message || "Failed to save customer");
      return;
    }

    showSuccess(res.message || "Customer saved successfully");

    const reload = await getRentalPageData();

    if (reload.success) {
      const updatedCustomers = reload.customers || [];
      const found = updatedCustomers.find(
        (c: any) => String(c.mobile) === String(newCustomer.mobile),
      );

      setCustomers(updatedCustomers);

      if (found && addCustomerRowIndex !== null) {
        const updatedRows = [...rows];

        updatedRows[addCustomerRowIndex] = {
          ...updatedRows[addCustomerRowIndex],
          customer_id: found.id,
          mobile: found.mobile,
          customer_name: found.customer_name,
        };

        setRows(updatedRows);
      }
    }

    setNewCustomer({ ...emptyNewCustomer });
    setShowAddCustomer(false);
    setAddCustomerRowIndex(null);
  }

  function handleToolChange(index: number, toolId: string) {
    const selectedTool = tools.find((t) => String(t.id) === String(toolId));
    const updated = [...rows];

    updated[index] = {
      ...updated[index],
      tool_id: toolId,
      daily_rate: selectedTool?.daily_rent || 0,
    };

    setRows(updated);
  }

  function customerName(id: number) {
    const c = customers.find((x) => Number(x.id) === Number(id));
    return c ? `${c.customer_name} - ${c.mobile}` : "";
  }

  function toolName(id: number) {
    const t = tools.find((x) => Number(x.id) === Number(id));
    return t ? t.tool_name : "";
  }


  function rentalCustomerDetails(row: any) {
    const customer = customers.find((x) => Number(x.id) === Number(row?.customer_id));

    return {
      name: customer?.customer_name || row?.customer_name || row?.name || "-",
      mobile: customer?.mobile || row?.mobile || row?.customer_mobile || "-",
    };
  }

  function rentalToolDetails(row: any) {
    const tool = tools.find((x) => Number(x.id) === Number(row?.tool_id));
    return tool?.tool_name || row?.tool_name || row?.tool || "-";
  }

  function openRentalReturnConfirm(id: number, returnDate: string) {
    const rental = rentals.find((r) => Number(r.id) === Number(id));
    if (!rental) {
      showError("Rental not found");
      return;
    }

    setRentalConfirm({
      type: "return",
      id,
      returnDate,
      rental,
    });
  }

  function openRentalDeleteConfirm(id: number) {
    const rental = rentals.find((r) => Number(r.id) === Number(id));
    if (!rental) {
      showError("Rental not found");
      return;
    }

    setRentalConfirm({
      type: "delete",
      id,
      rental,
    });
  }

  function closeRentalConfirm() {
    if (rentalConfirm?.type === "return") {
      setReturnMode({ ...returnMode, [rentalConfirm.id]: "" });
    }

    setRentalConfirm(null);
  }

  async function confirmRentalAction() {
    if (!rentalConfirm) return;

    if (rentalConfirm.type === "return") {
      const res = await returnRental(rentalConfirm.id, rentalConfirm.returnDate);

      if (!res.success) {
        showError(res.message || "Failed to return rental");
        return;
      }

      showSuccess(res.message || "Rental returned successfully");
      setReturnMode({ ...returnMode, [rentalConfirm.id]: "" });
      setReturnDates({ ...returnDates, [rentalConfirm.id]: "" });
      setRentalConfirm(null);
      await loadData();
      return;
    }

    if (rentalConfirm.type === "delete") {
      const res = await deleteRental(rentalConfirm.id);

      if (!res.success) {
        showError(res.message || "Failed to delete rental");
        return;
      }

      showSuccess(res.message || "Rental deleted successfully");
      setRentalConfirm(null);
      await loadData();
    }
  }

  function calcDays(
    start: string,
    end: string | null,
    status: string,
    avoidSundays = true,
  ) {
    if (!start) return 0;

    const startDate = new Date(start);
    const endDate =
      status === "Returned" && end ? new Date(end) : new Date(today);

    if (endDate < startDate) return 1;

    let count = 0;
    const d = new Date(startDate);

    while (d <= endDate) {
      const isSunday = d.getDay() === 0;
      if (!(avoidSundays && isSunday)) count++;
      d.setDate(d.getDate() + 1);
    }

    return Math.max(count, 1);
  }

  function calcEntryDays(row: any) {
    if (!row.start_date) return 1;

    if (row.end_date) {
      return calcDays(
        row.start_date,
        row.end_date,
        "Returned",
        row.avoid_sundays !== false,
      );
    }

    return 1;
  }

  function calcEntryAmount(row: any) {
    if (!row.tool_id) return 0;

    const days = calcEntryDays(row);

    return Math.max(
      days * Number(row.qty || 1) * Number(row.daily_rate || 0) -
        Number(row.discount || 0),
      0,
    );
  }

  function calcTotal(row: any) {
    if (row.status === "Returned" && Number(row.total_amount || 0) > 0) {
      return Number(row.total_amount || 0);
    }

    const days = calcDays(
      row.start_date,
      row.end_date,
      row.status,
      row.avoid_sundays !== false,
    );

    return Math.max(
      days * Number(row.qty || 1) * Number(row.daily_rate || 0) -
        Number(row.discount || 0),
      0,
    );
  }

  function validRows() {
    return rows.filter((r) => r.customer_id && r.tool_id && r.start_date);
  }

  function openSaveConfirmation() {
    const v = validRows();

    if (v.length === 0) {
      showWarning("No valid rentals to save");
      return;
    }

    const dates = Array.from(new Set(v.map((r) => r.start_date)));
    setConfirmDate(dates.length === 1 ? dates[0] : "Multiple Dates");
    setShowConfirm(true);
  }

  function askSaveConfirmation() {
    if (!selectedBranch) {
      setPopupShop("");
      setShopPopupOpen(true);
      return;
    }

    openSaveConfirmation();
  }

  function continueAfterShopSelect() {
    if (!popupShop) return;

    const v = validRows();

    if (v.length === 0) {
      setShopPopupOpen(false);
      showWarning("No valid rentals to save");
      return;
    }

    setSelectedBranch(popupShop);
    setShopPopupOpen(false);

    const dates = Array.from(new Set(v.map((r) => r.start_date)));
    setConfirmDate(dates.length === 1 ? dates[0] : "Multiple Dates");
    setShowConfirm(true);
  }

  async function confirmSaveRentals() {
    setLoading(true);

    const rowsWithBranch = rows.map((r) => ({
      ...r,
      shop: selectedBranch,
    }));

    const res = await saveRentals(rowsWithBranch);

    setLoading(false);
    setShowConfirm(false);

    if (!res.success) {
      showError(res.message || "Failed to save rentals");
      return;
    }

    showSuccess(res.message || "Rentals saved successfully");
    setRows(Array.from({ length: 20 }, () => ({ ...emptyRental })));
    await loadData();
  }

  async function handleReturn(id: number, mode: string) {
    if (!mode) return;

    if (mode === "Pick Date") {
      setReturnMode({ ...returnMode, [id]: "Pick Date" });
      return;
    }

    openRentalReturnConfirm(id, today);
  }

  async function handleReturnWithDate(id: number) {
    const pickedDate = returnDates[id];

    if (!pickedDate) {
      showWarning("Please select return date");
      return;
    }

    openRentalReturnConfirm(id, pickedDate);
  }

  async function handleDelete(id: number) {
    openRentalDeleteConfirm(id);
  }

  const activeRentals = rentals.filter((r) => r.status === "Active");
  const filteredActiveRentals = activeRentals
    .filter((r) => liveBranchFilter === "All Shops" || r.shop === liveBranchFilter)
    .filter((r) => {
      const q = liveSearchText.trim().toLowerCase();
      if (!q) return true;

      return `${customerName(r.customer_id)} ${r.mobile || r.customer_mobile || ""} ${toolName(r.tool_id)} ${r.shop || ""}`
        .toLowerCase()
        .includes(q);
    });

  const entryRows = rows.filter((r) => r.customer_id && r.tool_id);
  const totalRows = entryRows.length;

  const totalQty = rows.reduce(
    (sum, r) => sum + (r.tool_id ? Number(r.qty || 0) : 0),
    0,
  );

  const totalEntryAmount = rows.reduce((sum, r) => sum + calcEntryAmount(r), 0);

  const entryBusinessForSelectedDate = rows
    .filter((r) => r.tool_id && r.start_date === businessDate)
    .reduce((sum, r) => sum + calcEntryAmount(r), 0);

  const liveRentalToday = activeRentals
    .filter((r) => {
      const branchOk = selectedBranch ? r.shop === selectedBranch : true;
      const startOk = !r.start_date || r.start_date <= businessDate;
      const endOk = !r.end_date || r.end_date >= businessDate;
      return branchOk && startOk && endOk;
    })
    .reduce((sum, r) => {
      const oneDayAmount = Math.max(
        Number(r.qty || 1) * Number(r.daily_rate || 0) -
          Number(r.discount || 0),
        0,
      );

      return sum + oneDayAmount;
    }, 0);

  const dayTotalBusiness = entryBusinessForSelectedDate + liveRentalToday;

  return (
    <main>
      <h1>Rentals</h1>

      {shopPopupOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(7, 23, 53, 0.45)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              width: "min(540px, 94vw)",
              background: "white",
              borderRadius: 18,
              padding: "32px 30px",
              textAlign: "center",
              boxShadow: "0 25px 70px rgba(15, 23, 42, 0.35)",
              border: "1px solid #dbe5f2",
            }}
          >
            <div
              style={{
                fontSize: 28,
                fontWeight: 950,
                color: "#071735",
                marginBottom: 10,
              }}
            >
              Select Shop
            </div>

            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: "#475569",
                marginBottom: 22,
              }}
            >
              Please select the shop to continue.
            </div>

            <select
              value={popupShop}
              onChange={(e) => setPopupShop(e.target.value)}
              style={{
                width: "100%",
                marginBottom: 24,
                fontSize: 18,
                fontWeight: 900,
                padding: "14px 16px",
              }}
            >
              <option value="">Select Shop</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                className="btn-gray"
                onClick={() => setShopPopupOpen(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-blue"
                disabled={!popupShop}
                onClick={continueAfterShopSelect}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              background: "#b91c1c",
              color: "white",
              padding: 40,
              borderRadius: 18,
              width: "min(560px, 94vw)",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ fontSize: 44, fontWeight: 900, marginBottom: 20 }}>
              {selectedBranch}
            </div>

            <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 30 }}>
              {confirmDate}
            </div>

            <button
              onClick={confirmSaveRentals}
              disabled={loading}
              style={{
                background: "white",
                color: "#b91c1c",
                padding: "16px 28px",
                borderRadius: 10,
                fontSize: 18,
                fontWeight: 900,
                marginRight: 12,
                cursor: "pointer",
              }}
            >
              {loading ? "Saving..." : "CONFIRM SAVE"}
            </button>

            <button
              onClick={() => setShowConfirm(false)}
              style={{
                background: "#111827",
                color: "white",
                padding: "16px 28px",
                borderRadius: 10,
                fontSize: 18,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {rentalConfirm && (
        <div style={confirmOverlayStyle}>
          <div style={confirmCardStyle}>
            <div
              style={{
                background:
                  rentalConfirm.type === "return"
                    ? "linear-gradient(135deg, #f97316, #ea580c)"
                    : "linear-gradient(135deg, #dc2626, #7f1d1d)",
                color: "white",
                padding: "24px 26px",
              }}
            >
              <div style={{ fontSize: 34, fontWeight: 1000, lineHeight: 1.1 }}>
                {rentalConfirm.type === "return" ? "↩ Return Rental" : "🗑 Delete Rental"}
              </div>
              <div style={{ marginTop: 8, fontSize: 16, fontWeight: 850, opacity: 0.92 }}>
                {rentalConfirm.type === "return"
                  ? "Please confirm before closing this live rental."
                  : "Please confirm before deleting this rental."}
              </div>
            </div>

            <div style={confirmBodyStyle}>
              {(() => {
                const customer = rentalCustomerDetails(rentalConfirm.rental);
                const tool = rentalToolDetails(rentalConfirm.rental);

                return (
                  <>
                    <div style={confirmGridStyle}>
                      <div style={confirmInfoStyle}>
                        <div style={confirmLabelStyle}>Customer</div>
                        <div style={confirmValueStyle}>{customer.name}</div>
                      </div>

                      <div style={confirmInfoStyle}>
                        <div style={confirmLabelStyle}>Mobile</div>
                        <div style={confirmValueStyle}>{customer.mobile}</div>
                      </div>

                      <div style={{ ...confirmInfoStyle, gridColumn: "1 / -1" }}>
                        <div style={confirmLabelStyle}>Tool</div>
                        <div style={confirmValueStyle}>{tool}</div>
                      </div>

                      <div style={confirmInfoStyle}>
                        <div style={confirmLabelStyle}>Qty</div>
                        <div style={confirmValueStyle}>{rentalConfirm.rental?.qty || 1}</div>
                      </div>

                      <div style={confirmInfoStyle}>
                        <div style={confirmLabelStyle}>Shop</div>
                        <div style={confirmValueStyle}>{rentalConfirm.rental?.shop || "-"}</div>
                      </div>

                      {rentalConfirm.type === "return" && (
                        <div style={{ ...confirmInfoStyle, gridColumn: "1 / -1" }}>
                          <div style={confirmLabelStyle}>Return Date</div>
                          <div style={{ ...confirmValueStyle, color: "#ea580c" }}>
                            {rentalConfirm.returnDate}
                          </div>
                        </div>
                      )}
                    </div>

                    {rentalConfirm.type === "delete" && (
                      <div
                        style={{
                          marginTop: 18,
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          color: "#991b1b",
                          borderRadius: 14,
                          padding: "13px 15px",
                          fontWeight: 950,
                        }}
                      >
                        ⚠ This action cannot be undone.
                      </div>
                    )}

                    <div style={confirmButtonRowStyle}>
                      <button type="button" style={confirmCancelButtonStyle} onClick={closeRentalConfirm}>
                        Cancel
                      </button>

                      <button
                        type="button"
                        style={{
                          ...confirmActionButtonStyle,
                          background:
                            rentalConfirm.type === "return"
                              ? "linear-gradient(135deg, #f97316, #ea580c)"
                              : "linear-gradient(135deg, #dc2626, #991b1b)",
                        }}
                        onClick={confirmRentalAction}
                      >
                        {rentalConfirm.type === "return" ? "Return Rental" : "Delete Rental"}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <h2 style={{ marginTop: 0, marginBottom: 14 }}>New Rentals</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(170px, 1fr))",
            gap: 14,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 12,
              padding: "20px 18px",
              minHeight: 96,
              fontWeight: 900,
            }}
          >
            <div style={{ color: "#1e40af", fontSize: 13 }}>Total Rows</div>
            <div style={{ fontSize: 34 }}>{totalRows}</div>
          </div>

          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 12,
              padding: "20px 18px",
              minHeight: 96,
              fontWeight: 900,
            }}
          >
            <div style={{ color: "#166534", fontSize: 13 }}>Total Qty</div>
            <div style={{ fontSize: 34 }}>{totalQty}</div>
          </div>

          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: 12,
              padding: "20px 18px",
              minHeight: 96,
              fontWeight: 900,
            }}
          >
            <div style={{ color: "#9a3412", fontSize: 13 }}>
              Entry Table Total
            </div>
            <div style={{ fontSize: 34 }}>₹{totalEntryAmount.toFixed(0)}</div>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "20px 18px",
              minHeight: 96,
              fontWeight: 900,
            }}
          >
            <div style={{ color: "#334155", fontSize: 13 }}>
              Live Rental Today
            </div>
            <div style={{ fontSize: 34 }}>₹{liveRentalToday.toFixed(0)}</div>
          </div>

          <div
            style={{
              background: "linear-gradient(135deg, #1d4ed8, #0f172a)",
              color: "white",
              borderRadius: 12,
              padding: "20px 18px",
              minHeight: 96,
              fontWeight: 900,
              boxShadow: "0 10px 22px rgba(29,78,216,0.25)",
            }}
          >
            <div style={{ fontSize: 13 }}>Total Business Today</div>

            <input
              type="date"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
              style={{
                width: "100%",
                marginTop: 6,
                marginBottom: 6,
                fontWeight: 900,
                color: "#0f172a",
              }}
            />

            <div style={{ fontSize: 34 }}>₹{dayTotalBusiness.toFixed(0)}</div>
          </div>
        </div>

        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #cbd5e1",
            borderRadius: 12,
            padding: 14,
            marginBottom: 14,
            display: "grid",
            gridTemplateColumns: "190px 190px 1fr 180px",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>
              Entry Date
            </div>
            <input
              type="date"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
              style={{ fontWeight: 800 }}
            />
          </div>

          <button
            className="btn-gray"
            onClick={applyDateToAllRows}
            style={{ fontWeight: 900 }}
          >
            Apply To All Rows
          </button>

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={{ fontWeight: 800 }}
          >
            <option value="">Select Shop</option>
            {branches.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>

          <button
            className="btn-blue"
            onClick={askSaveConfirmation}
            disabled={loading}
            style={{ fontWeight: 900 }}
          >
            Save Rentals
          </button>
        </div>

        {showAddCustomer && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(7, 23, 53, 0.55)",
              zIndex: 99998,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <div
              style={{
                width: "min(1120px, 96vw)",
                background: "#ffffff",
                borderRadius: 16,
                boxShadow: "0 25px 70px rgba(15, 23, 42, 0.35)",
                border: "1px solid #dbe5f2",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  minHeight: 78,
                  padding: "18px 28px",
                  borderBottom: "1px solid #e5eaf3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 28,
                    fontWeight: 950,
                    color: "#071735",
                  }}
                >
                  Add New Customer
                </h2>

                <button
                  type="button"
                  onClick={() => {
                    setShowAddCustomer(false);
                    setAddCustomerRowIndex(null);
                  }}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    border: "1px solid #d6deec",
                    background: "#ffffff",
                    color: "#071735",
                    fontSize: 28,
                    lineHeight: "36px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: 28 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.1fr 1.4fr 1.1fr 1.5fr 1.1fr 1.3fr",
                    gap: 18,
                    alignItems: "start",
                  }}
                >
                  <div>
                    <input
                      placeholder="Mobile"
                      value={newCustomer.mobile}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          mobile: e.target.value,
                        })
                      }
                    />
                    <div
                      style={{
                        marginTop: 8,
                        color: "#003b8f",
                        fontWeight: 900,
                        fontSize: 14,
                      }}
                    >
                      Mobile Number *
                    </div>
                  </div>

                  <div>
                    <input
                      placeholder="Customer Name"
                      value={newCustomer.customer_name}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          customer_name: e.target.value,
                        })
                      }
                    />
                    <div
                      style={{
                        marginTop: 8,
                        color: "#003b8f",
                        fontWeight: 900,
                        fontSize: 14,
                      }}
                    >
                      Customer Name *
                    </div>
                  </div>

                  <div>
                    <input
                      placeholder="Occupation"
                      value={newCustomer.occupation}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          occupation: e.target.value,
                        })
                      }
                    />
                    <div
                      style={{
                        marginTop: 8,
                        color: "#003b8f",
                        fontWeight: 900,
                        fontSize: 14,
                      }}
                    >
                      Occupation
                    </div>
                  </div>

                  <div>
                    <input
                      placeholder="Address"
                      value={newCustomer.address}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          address: e.target.value,
                        })
                      }
                    />
                    <div
                      style={{
                        marginTop: 8,
                        color: "#003b8f",
                        fontWeight: 900,
                        fontSize: 14,
                      }}
                    >
                      Address
                    </div>
                  </div>

                  <div>
                    <select
                      value={newCustomer.shop}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          shop: e.target.value,
                        })
                      }
                    >
                      <option value="">Select Shop</option>
                      {branches.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                    <div
                      style={{
                        marginTop: 8,
                        color: "#003b8f",
                        fontWeight: 900,
                        fontSize: 14,
                      }}
                    >
                      Shop *
                    </div>
                  </div>

                  <div>
                    <input
                      placeholder="Notes"
                      value={newCustomer.notes}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          notes: e.target.value,
                        })
                      }
                    />
                    <div
                      style={{
                        marginTop: 8,
                        color: "#003b8f",
                        fontWeight: 900,
                        fontSize: 14,
                      }}
                    >
                      Notes
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 30,
                    display: "flex",
                    justifyContent: "center",
                    gap: 16,
                  }}
                >
                  <button
                    type="button"
                    className="btn-green"
                    onClick={handleSaveNewCustomer}
                    style={{
                      padding: "15px 34px",
                      fontSize: 17,
                      fontWeight: 950,
                    }}
                  >
                    Save New Customer
                  </button>

                  <button
                    type="button"
                    className="btn-gray"
                    onClick={() => {
                      setShowAddCustomer(false);
                      setAddCustomerRowIndex(null);
                    }}
                    style={{
                      padding: "15px 34px",
                      fontSize: 17,
                      fontWeight: 950,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <table style={compactTableStyle}>
          <colgroup>
            <col style={{ width: "3%" }} />
            <col style={{ width: "3%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "27%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "5%" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={compactHeaderStyle}>No</th>
              <th style={compactHeaderStyle}>⎘</th>
              <th style={compactHeaderStyle}>Mobile</th>
              <th style={compactHeaderStyle}>Customer</th>
              <th style={compactHeaderStyle}>Tool</th>
              <th style={compactHeaderStyle}>Qty</th>
              <th style={compactHeaderStyle}>Rate</th>
              <th style={compactHeaderStyle}>Discount</th>
              <th style={compactHeaderStyle}>Total</th>
              <th style={compactHeaderStyle}>Start</th>
              <th style={compactHeaderStyle}>End</th>
              <th style={compactHeaderStyle}>Avoid Sundays</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td style={compactCenterCellStyle}>{index + 1}</td>

                <td style={compactCenterCellStyle}>
                  <button
                    type="button"
                    title="Copy previous customer"
                    onClick={() => copyPreviousCustomerDetails(index)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      border: "1px solid #bfdbfe",
                      background: "#eff6ff",
                      color: "#0057ff",
                      fontSize: 16,
                      fontWeight: 950,
                      lineHeight: 1,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    ⎘
                  </button>
                </td>

                <td style={compactCellStyle}>
                  <div style={{ position: "relative" }}>
                    <input
                      style={compactInputStyle}
                      value={row.mobile}
                      onChange={(e) =>
                        handleMobileChange(index, e.target.value)
                      }
                      placeholder="Mobile"
                    />

                    {(mobileSuggestions[index] || []).length > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          background: "white",
                          border: "1px solid #d1d5db",
                          zIndex: 999,
                          maxHeight: 220,
                          overflowY: "auto",
                        }}
                      >
                        {mobileSuggestions[index].map((c: any) => (
                          <div
                            key={c.id}
                            style={{
                              padding: "8px",
                              cursor: "pointer",
                              borderBottom: "1px solid #eee",
                            }}
                            onClick={() => {
                              const updated = [...rows];

                              updated[index] = {
                                ...updated[index],
                                customer_id: c.id,
                                mobile: c.mobile,
                                customer_name: c.customer_name,
                              };

                              setRows(updated);

                              setMobileSuggestions({
                                ...mobileSuggestions,
                                [index]: [],
                              });

                              setShowAddCustomer(false);
                            }}
                          >
                            <strong>{c.mobile}</strong>
                            {" - "}
                            {c.customer_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </td>

                <td style={compactCellStyle}>
                  <input
                    style={compactInputStyle}
                    value={row.customer_name}
                    readOnly
                    placeholder="Name"
                  />
                </td>

                <td style={compactCellStyle}>
                  <select
                    style={compactSelectStyle}
                    value={row.tool_id}
                    onChange={(e) => handleToolChange(index, e.target.value)}
                  >
                    <option value="">Select Tool</option>
                    {uniqueTools.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.tool_name} - ₹{t.daily_rent}/day
                      </option>
                    ))}
                  </select>
                </td>

                <td style={compactCenterCellStyle}>
                  <input
                    style={compactInputStyle}
                    type="number"
                    value={row.qty}
                    onChange={(e) => changeRow(index, "qty", e.target.value)}
                  />
                </td>

                <td style={compactCenterCellStyle}>
                  <input
                    style={compactInputStyle}
                    type="number"
                    value={row.daily_rate}
                    onChange={(e) =>
                      changeRow(index, "daily_rate", e.target.value)
                    }
                  />
                </td>

                <td style={compactCenterCellStyle}>
                  <input
                    style={compactInputStyle}
                    type="number"
                    value={row.discount}
                    onChange={(e) =>
                      changeRow(index, "discount", e.target.value)
                    }
                  />
                </td>

                <td
                  style={{
                    ...compactCenterCellStyle,
                    fontWeight: 950,
                    color: "#0057ff",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  ₹{calcEntryAmount(row).toFixed(0)}
                </td>

                <td style={compactCenterCellStyle}>
                  <input
                    style={compactInputStyle}
                    type="date"
                    value={row.start_date}
                    onChange={(e) =>
                      changeRow(index, "start_date", e.target.value)
                    }
                  />
                </td>

                <td style={compactCenterCellStyle}>
                  <input
                    style={compactInputStyle}
                    type="date"
                    value={row.end_date}
                    onChange={(e) =>
                      changeRow(index, "end_date", e.target.value)
                    }
                  />
                </td>

                <td style={compactCenterCellStyle}>
                  <input
                    type="checkbox"
                    checked={row.avoid_sundays !== false}
                    onChange={(e) =>
                      changeRow(index, "avoid_sundays", e.target.checked)
                    }
                    style={{ width: 20 }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 950, color: "#071735" }}>
            Rows: {totalRows} &nbsp; | &nbsp; Qty: {totalQty} &nbsp; | &nbsp;
            Entry Total: ₹{totalEntryAmount.toFixed(0)}
          </div>

          <div>
            <button
              className="btn-gray"
              onClick={() =>
                setRows([
                  ...rows,
                  ...Array.from({ length: 5 }, () => ({ ...emptyRental })),
                ])
              }
            >
              + Add 5 Rows
            </button>

            <button
              className="btn-gray"
              style={{ marginLeft: 8 }}
              onClick={() =>
                setRows(Array.from({ length: 20 }, () => ({ ...emptyRental })))
              }
            >
              Clear Table
            </button>

            <button
              className="btn-blue"
              style={{ marginLeft: 8, fontWeight: 900 }}
              onClick={askSaveConfirmation}
              disabled={loading}
            >
              Save Rentals
            </button>
          </div>
        </div>
      </div>


      <div className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0 }}>Live Rentals</h2>

          <input
            value={liveSearchText}
            onChange={(e) => setLiveSearchText(e.target.value)}
            placeholder="Search item, name, mobile..."
            style={liveSearchStyle}
          />
        </div>

        <div style={shopTabsStyle}>
          {["All Shops", ...branches].map((shop) => {
            const count =
              shop === "All Shops"
                ? activeRentals.length
                : activeRentals.filter((r) => r.shop === shop).length;

            return (
              <button
                key={shop}
                type="button"
                onClick={() => setLiveBranchFilter(shop)}
                style={{
                  ...shopTabStyle,
                  ...(liveBranchFilter === shop ? activeShopTabStyle : {}),
                }}
              >
                <span>{shop}</span>
                <strong>{count}</strong>
              </button>
            );
          })}
        </div>

        <table style={compactTableStyle}>
          <colgroup>
            <col style={{ width: "21%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "7%" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={compactHeaderStyle}>Customer</th>
              <th style={compactHeaderStyle}>Tool</th>
              <th style={compactHeaderStyle}>Qty</th>
              <th style={compactHeaderStyle}>Daily Rate</th>
              <th style={compactHeaderStyle}>Start</th>
              <th style={compactHeaderStyle}>Days</th>
              <th style={compactHeaderStyle}>Current Total</th>
              <th style={compactHeaderStyle}>Shop</th>
              <th style={compactHeaderStyle}>Status</th>
              <th style={compactHeaderStyle}>Return</th>
              <th style={compactHeaderStyle}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredActiveRentals.map((r) => (
              <tr key={r.id}>
                <td style={compactCellStyle}>{customerName(r.customer_id)}</td>
                <td style={compactCellStyle}>{toolName(r.tool_id)}</td>
                <td style={compactCenterCellStyle}>{r.qty}</td>
                <td style={compactCenterCellStyle}>₹{r.daily_rate}</td>
                <td style={compactCenterCellStyle}>{r.start_date}</td>
                <td style={compactCenterCellStyle}>
                  {calcDays(
                    r.start_date,
                    r.end_date,
                    r.status,
                    r.avoid_sundays !== false,
                  )}
                </td>
                <td style={compactCenterCellStyle}>₹{calcTotal(r)}</td>
                <td style={compactCenterCellStyle}>{r.shop || "-"}</td>
                <td style={compactCenterCellStyle}>{r.status}</td>

                <td style={compactCenterCellStyle}>
                  <select
                    style={compactSelectStyle}
                    value={returnMode[r.id] || ""}
                    onChange={(e) => handleReturn(r.id, e.target.value)}
                  >
                    <option value="">Return</option>
                    <option value="Same Day">Same Day</option>
                    <option value="Pick Date">Pick a Date</option>
                  </select>

                  {returnMode[r.id] === "Pick Date" && (
                    <div style={{ marginTop: 6 }}>
                      <input
                        type="date"
                        value={returnDates[r.id] || today}
                        onChange={(e) =>
                          setReturnDates({
                            ...returnDates,
                            [r.id]: e.target.value,
                          })
                        }
                      />

                      <button
                        className="btn-green"
                        style={{ marginTop: 6 }}
                        onClick={() => handleReturnWithDate(r.id)}
                      >
                        Save
                      </button>
                    </div>
                  )}
                </td>

                <td style={compactCenterCellStyle}>
                  <button
                    className="btn-red"
                    onClick={() => handleDelete(r.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {filteredActiveRentals.length === 0 && (
              <tr>
                <td colSpan={11} style={compactCenterCellStyle}>
                  No live rentals
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </main>
  );
}
