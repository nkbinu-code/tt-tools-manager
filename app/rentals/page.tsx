"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getRentalPageData,
  saveRentals,
  returnRental,
  deleteRental,
  updateRentalWithAudit,
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
  is_outside_rent: false,
  outside_item_name: "",
  outside_shop_name: "",
  qty: 1,
  daily_rate: 0,
  discount: 0,
  start_date: today,
  end_date: "",
  status: "Active",
  shop: "",
  avoid_sundays: true,
};

const emptyTransport = () => ({
  customer_id: "",
  vehicle_type: "Auto",
  trip_type: "Delivery",
  delivery_location: "",
  amount: "",
  transport_date: today,
  notes: "",
});

const emptyNewCustomer = {
  customer_name: "",
  mobile: "",
  occupation: "",
  address: "",
  shop: "",
  notes: "",
  rating: 10,
};

const RENTAL_DRAFT_KEY = "tt_rentals_page_draft_v1";


function normalizeCustomerRating(value: any) {
  const rating = Number(value ?? 10);
  if (!Number.isFinite(rating)) return 10;
  return Math.min(10, Math.max(1, Math.round(rating)));
}

function customerRatingColor(value: any) {
  const rating = normalizeCustomerRating(value);
  const colors: Record<number, string> = {
    1: "#991b1b",
    2: "#dc2626",
    3: "#f97316",
    4: "#f59e0b",
    5: "#eab308",
    6: "#84cc16",
    7: "#65a30d",
    8: "#22c55e",
    9: "#16a34a",
    10: "#15803d",
  };
  return colors[rating] || colors[10];
}

function customerReliabilityBadge(value: any) {
  const rating = normalizeCustomerRating(value);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 46,
        padding: "6px 12px",
        borderRadius: 999,
        background: customerRatingColor(rating),
        color: "#ffffff",
        fontWeight: 1000,
      }}
    >
      {rating}/10
    </span>
  );
}


function hasRentalItem(row: any) {
  return Boolean(
    row?.tool_id ||
      (row?.is_outside_rent &&
        String(row?.outside_item_name || "").trim()),
  );
}

function isRentalRowFilled(row: any) {
  return Boolean(
    row?.customer_id ||
    row?.mobile ||
    row?.customer_name ||
    row?.tool_id ||
    row?.is_outside_rent ||
    row?.outside_item_name ||
    row?.outside_shop_name ||
    Number(row?.qty || 0) !== 1 ||
    Number(row?.daily_rate || 0) !== 0 ||
    Number(row?.discount || 0) !== 0 ||
    row?.end_date ||
    row?.status !== "Active" ||
    row?.shop ||
    row?.avoid_sundays === false,
  );
}

function countDraftRows(rows: any[]) {
  return (rows || []).filter(isRentalRowFilled).length;
}

function compressRowNumbers(rowNumbers: number[]) {
  const sorted = Array.from(new Set(rowNumbers))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (sorted.length === 0) return "-";

  const ranges: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];

    if (current === previous + 1) {
      previous = current;
      continue;
    }

    ranges.push(start === previous ? String(start) : `${start}–${previous}`);
    start = current;
    previous = current;
  }

  ranges.push(start === previous ? String(start) : `${start}–${previous}`);
  return ranges.join(", ");
}

function formatSaveDate(value: any) {
  if (!value || value === "Multiple Dates") return value || "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDraftSavedTime(value: any) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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
  gridTemplateColumns: "repeat(5, minmax(130px, 1fr))",
  gap: 10,
  marginBottom: 16,
};

const shopTabStyle: CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#bfdbfe",
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
    Array.from({ length: 10 }, () => ({ ...emptyRental })),
  );

  const [transportRows, setTransportRows] = useState<any[]>([
    emptyTransport(),
    emptyTransport(),
  ]);

  const [selectedBranch, setSelectedBranch] = useState("");
  const [bulkDate, setBulkDate] = useState(today);
  const [businessDate, setBusinessDate] = useState(today);
  const [liveBranchFilter, setLiveBranchFilter] = useState(branches[0]);
  const [liveSearchText, setLiveSearchText] = useState("");
  const [returnedSearchText, setReturnedSearchText] = useState("");
  const [toolSearchTexts, setToolSearchTexts] = useState<Record<number, string>>(
    {},
  );
  const [openToolSearchRow, setOpenToolSearchRow] = useState<number | null>(
    null,
  );

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
  const [partialReturn, setPartialReturn] = useState<any>(null);
  const [partialReturnQty, setPartialReturnQty] = useState("1");
  const [partialReturnDate, setPartialReturnDate] = useState(today);
  const [draftChecked, setDraftChecked] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState<any>(null);
  const [draftStatus, setDraftStatus] = useState("Draft not saved yet");
  const [draftSaveTick, setDraftSaveTick] = useState(0);
  const [editRental, setEditRental] = useState<any>(null);
  const [editReason, setEditReason] = useState("");
  const [editExplanation, setEditExplanation] = useState("");
  const [editSaving, setEditSaving] = useState(false);

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

  function isLiveRentalRecord(rental: any) {
    if (rental?.is_transport_charge) return false;
    if (rental?.end_date || rental?.return_date || rental?.closed_date) {
      return false;
    }

    const status = String(rental?.status || "Active")
      .trim()
      .toLowerCase();

    return !["returned", "closed", "completed", "cancelled"].includes(
      status,
    );
  }

  function availableQtyForTool(tool: any) {
    const totalQty = Math.max(Number(tool?.total_qty || 1), 1);
    const activeQty = rentals
      .filter(
        (rental: any) =>
          isLiveRentalRecord(rental) &&
          Number(rental.tool_id) === Number(tool?.id),
      )
      .reduce(
        (sum: number, rental: any) =>
          sum + Math.max(Number(rental.qty || 1), 1),
        0,
      );

    return Math.max(totalQty - activeQty, 0);
  }

  const rentableTools = uniqueTools.filter((tool: any) => {
    if (!selectedBranch) return false;

    const currentLocation = String(
      tool.current_location || tool.home_branch || "",
    ).trim();
    const status = String(tool.status || "").trim().toLowerCase();
    const blockedStatus = [
      "service",
      "in service",
      "missing",
      "inactive",
      "damaged",
    ].includes(status);

    return (
      currentLocation === selectedBranch &&
      !blockedStatus &&
      availableQtyForTool(tool) > 0
    );
  });

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

  useEffect(() => {
    if (selectedBranch) {
      setLiveBranchFilter(selectedBranch);
    }
  }, [selectedBranch]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RENTAL_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft?.rows?.length && countDraftRows(draft.rows) > 0) {
          setDraftPrompt(draft);
          setDraftStatus(
            `Draft found from ${formatDraftSavedTime(draft.savedAt)}`,
          );
        }
      }
    } catch (error) {
      console.error("Failed to read rental draft", error);
    } finally {
      setDraftChecked(true);
    }
  }, []);

  useEffect(() => {
    if (!draftChecked) return;

    const filledCount = countDraftRows(rows);
    if (
      filledCount === 0 &&
      !selectedBranch &&
      bulkDate === today &&
      businessDate === today
    ) {
      return;
    }

    setDraftStatus("Saving draft...");

    const timer = window.setTimeout(() => {
      try {
        const draft = {
          rows,
          transportRows,
          selectedBranch,
          bulkDate,
          businessDate,
          savedAt: new Date().toISOString(),
        };

        window.localStorage.setItem(RENTAL_DRAFT_KEY, JSON.stringify(draft));
        setDraftStatus(
          `Draft saved ${new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`,
        );
      } catch (error) {
        console.error("Failed to save rental draft", error);
        setDraftStatus("Draft could not be saved");
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    rows,
    transportRows,
    selectedBranch,
    bulkDate,
    businessDate,
    draftChecked,
    draftSaveTick,
  ]);

  function restoreRentalDraft() {
    if (!draftPrompt) return;

    setRows(
      draftPrompt.rows?.length
        ? draftPrompt.rows
        : Array.from({ length: 10 }, () => ({ ...emptyRental })),
    );
    setToolSearchTexts({});
    setOpenToolSearchRow(null);
    setTransportRows(
      draftPrompt.transportRows?.length
        ? draftPrompt.transportRows
        : [emptyTransport(), emptyTransport()],
    );
    setSelectedBranch(draftPrompt.selectedBranch || "");
    setBulkDate(draftPrompt.bulkDate || today);
    setBusinessDate(draftPrompt.businessDate || today);
    setDraftStatus(
      `Draft restored from ${formatDraftSavedTime(draftPrompt.savedAt)}`,
    );
    setDraftPrompt(null);
  }

  function clearRentalDraft(showMessage = true) {
    try {
      window.localStorage.removeItem(RENTAL_DRAFT_KEY);
    } catch (error) {
      console.error("Failed to clear rental draft", error);
    }

    setDraftPrompt(null);
    setDraftStatus("Draft cleared");

    if (showMessage) {
      showSuccess("Rental draft cleared");
    }
  }

  function saveRentalDraftNow() {
    setDraftSaveTick((value) => value + 1);
    showSuccess("Rental draft saved in this browser");
  }

  function changeRow(index: number, field: string, value: any) {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  }

  function changeTransportRow(index: number, field: string, value: any) {
    setTransportRows((previous) =>
      previous.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  }

  function addTransportRows() {
    setTransportRows((previous) => [
      ...previous,
      emptyTransport(),
      emptyTransport(),
    ]);
  }

  function validTransportRows() {
    return transportRows.filter(
      (row) => row.customer_id && Number(row.amount || 0) > 0 && row.transport_date,
    );
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

      if (normalizeCustomerRating(exact.rating) <= 3) {
        showWarning(
          `Proceed with caution. Customer Reliability: ${normalizeCustomerRating(exact.rating)}/10`,
        );
      }
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

  function handleToolChange(index: number, toolId: string): boolean {
    const selectedTool = tools.find(
      (tool) => String(tool.id) === String(toolId),
    );

    if (selectedTool && selectedBranch) {
      const toolName = selectedTool.tool_name || "Selected item";
      const currentLocation = String(
        selectedTool.current_location ||
          selectedTool.home_branch ||
          "",
      ).trim();
      const totalQty = Math.max(
        Number(selectedTool.total_qty || 1),
        1,
      );
      const isIndividualTool = totalQty === 1;

      const alreadyLive = rentals.some(
        (rental: any) =>
          isLiveRentalRecord(rental) &&
          Number(rental.tool_id) === Number(selectedTool.id),
      );

      const alreadySelectedInEntry = rows.some(
        (entry: any, rowIndex: number) =>
          rowIndex !== index &&
          !entry.is_outside_rent &&
          Number(entry.tool_id) === Number(selectedTool.id),
      );

      if (isIndividualTool && alreadyLive) {
        showWarning(
          `${toolName} is already on a live rental. The same individual tool cannot be rented twice at the same time.`,
        );
        return false;
      }

      if (isIndividualTool && alreadySelectedInEntry) {
        showWarning(
          `${toolName} is already selected in another entry row. An individual tool can be entered only once.`,
        );
        return false;
      }

      const availableQty = availableQtyForTool(selectedTool);

      if (
        currentLocation !== selectedBranch ||
        availableQty <= 0
      ) {
        showWarning(
          `${toolName} is not available at ${selectedBranch}. Move it to ${selectedBranch} first.`,
        );
        return false;
      }
    }

    const updated = [...rows];

    updated[index] = {
      ...updated[index],
      tool_id: toolId,
      is_outside_rent: false,
      outside_item_name: "",
      outside_shop_name: "",
      daily_rate: selectedTool?.daily_rent || 0,
      qty:
        Math.max(Number(selectedTool?.total_qty || 1), 1) === 1
          ? 1
          : updated[index].qty,
    };

    setRows(updated);
    return true;
  }

  function setOutsideRentMode(index: number, enabled: boolean) {
    const updated = [...rows];
    const current = updated[index];

    updated[index] = {
      ...current,
      is_outside_rent: enabled,
      tool_id: "",
      outside_item_name: enabled ? current.outside_item_name || "" : "",
      outside_shop_name: enabled ? current.outside_shop_name || "" : "",
      daily_rate: enabled ? Number(current.daily_rate || 0) : 0,
    };

    setRows(updated);

    setToolSearchTexts((previous) => {
      const next = { ...previous };
      delete next[index];
      return next;
    });

    if (openToolSearchRow === index) {
      setOpenToolSearchRow(null);
    }
  }

  function customerName(id: number) {
    const c = customers.find((x) => Number(x.id) === Number(id));
    return c ? `${c.customer_name} - ${c.mobile}` : "";
  }

  function toolName(id: number) {
    const t = tools.find((x) => Number(x.id) === Number(id));
    return t ? t.tool_name : "";
  }

  function currentToolSearchText(index: number, row: any) {
    if (Object.prototype.hasOwnProperty.call(toolSearchTexts, index)) {
      return toolSearchTexts[index] || "";
    }

    return row?.tool_id ? toolName(row.tool_id) : "";
  }

  function matchingToolsForSearch(searchText: string) {
    const query = String(searchText || "").trim().toLowerCase();

    if (!query) {
      return rentableTools.slice(0, 30);
    }

    return rentableTools.filter((tool: any) =>
      String(tool.tool_name || "").toLowerCase().includes(query),
    );
  }

  function handleToolSearchInput(index: number, value: string) {
    setToolSearchTexts((previous) => ({
      ...previous,
      [index]: value,
    }));
    setOpenToolSearchRow(index);

    const selectedTool = tools.find(
      (tool: any) => String(tool.id) === String(rows[index]?.tool_id || ""),
    );
    const selectedName = String(selectedTool?.tool_name || "");

    if (
      rows[index]?.tool_id &&
      value.trim().toLowerCase() !== selectedName.trim().toLowerCase()
    ) {
      setRows((previous) =>
        previous.map((row, rowIndex) =>
          rowIndex === index
            ? {
                ...row,
                tool_id: "",
                daily_rate: 0,
              }
            : row,
        ),
      );
    }
  }

  function selectToolFromSearch(index: number, tool: any) {
    const accepted = handleToolChange(index, String(tool.id));

    if (!accepted) return;

    setToolSearchTexts((previous) => ({
      ...previous,
      [index]: String(tool.tool_name || ""),
    }));
    setOpenToolSearchRow(null);
  }

  function clearRentalEntryRows() {
    setRows(Array.from({ length: 10 }, () => ({ ...emptyRental })));
    setToolSearchTexts({});
    setOpenToolSearchRow(null);
  }

  function rentalCustomerDetails(row: any) {
    const customer = customers.find(
      (x) => Number(x.id) === Number(row?.customer_id),
    );

    return {
      name: customer?.customer_name || row?.customer_name || row?.name || "-",
      mobile: customer?.mobile || row?.mobile || row?.customer_mobile || "-",
    };
  }

  function rentalToolDetails(row: any) {
    if (row?.is_outside_rent && row?.outside_item_name) {
      return row.outside_item_name;
    }

    const tool = tools.find((x) => Number(x.id) === Number(row?.tool_id));
    return (
      row?.outside_item_name ||
      tool?.tool_name ||
      row?.tool_name ||
      row?.tool ||
      "-"
    );
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
      const res = await returnRental(
        rentalConfirm.id,
        rentalConfirm.returnDate,
      );

      if (!res.success) {
        showError(res.message || "Failed to return rental");
        return;
      }
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
    if (!hasRentalItem(row)) return 0;

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
    return rows.filter(
      (r) => r.customer_id && hasRentalItem(r) && r.start_date,
    );
  }

  function openSaveConfirmation() {
    const v = validRows();

    const transport = validTransportRows();

    if (v.length === 0 && transport.length === 0) {
      showWarning("No valid rentals or transport entries to save");
      return;
    }

    const dates = Array.from(
      new Set([
        ...v.map((r) => r.start_date),
        ...transport.map((r) => r.transport_date),
      ]),
    );
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
    const transport = validTransportRows();

    if (v.length === 0 && transport.length === 0) {
      setShopPopupOpen(false);
      showWarning("No valid rentals or transport entries to save");
      return;
    }

    setSelectedBranch(popupShop);
    setShopPopupOpen(false);

    const dates = Array.from(
      new Set([
        ...v.map((r) => r.start_date),
        ...transport.map((r) => r.transport_date),
      ]),
    );
    setConfirmDate(dates.length === 1 ? dates[0] : "Multiple Dates");
    setShowConfirm(true);
  }

  async function confirmSaveRentals() {
    setLoading(true);


    const rowsWithBranch = rows.map((r) => ({
      ...r,
      shop: selectedBranch,
    }));

    const transportWithBranch = transportRows.map((row) => ({
      ...row,
      shop: selectedBranch,
    }));

    const res = await saveRentals(rowsWithBranch, transportWithBranch);

    setLoading(false);
    setShowConfirm(false);

    if (!res.success) {
      showError(res.message || "Failed to save rentals");
      return;
    }
    clearRentalDraft(false);
    clearRentalEntryRows();
    setTransportRows([emptyTransport(), emptyTransport()]);
    await loadData();
  }

  async function handleReturn(id: number, mode: string) {
    if (!mode) return;

    if (mode === "Pick Date") {
      setReturnMode({ ...returnMode, [id]: "Pick Date" });
      return;
    }

    const rental = rentals.find((r) => Number(r.id) === Number(id));

    if (mode === "Same Day") {
      openRentalReturnConfirm(id, rental?.start_date || today);
      return;
    }

    if (mode === "Today") {
      openRentalReturnConfirm(id, today);
      return;
    }

    if (mode === "Partial Return") {
      openPartialReturnPopup(id);
      return;
    }
  }

  async function handleReturnWithDate(id: number) {
    const pickedDate = returnDates[id];

    if (!pickedDate) {
      showWarning("Please select return date");
      return;
    }

    openRentalReturnConfirm(id, pickedDate);
  }

  function openPartialReturnPopup(id: number) {
    const rental = rentals.find((r) => Number(r.id) === Number(id));

    if (!rental) {
      showError("Rental not found");
      return;
    }

    const liveQty = Number(rental.qty || 1);

    if (liveQty <= 1) {
      showWarning("Partial return is available only when quantity is more than 1");
      setReturnMode({ ...returnMode, [id]: "" });
      return;
    }

    setPartialReturn({ id, rental });
    setPartialReturnQty("1");
    setPartialReturnDate(today);
    setReturnMode({ ...returnMode, [id]: "Partial Return" });
  }

  async function confirmPartialReturn() {
    if (!partialReturn) return;

    const rental = partialReturn.rental;
    const rentalId = partialReturn.id;
    const liveQty = Number(rental?.qty || 1);
    const returnQty = Number(partialReturnQty || 0);
    const returnDate = partialReturnDate || today;

    if (!returnQty || returnQty <= 0) {
      showWarning("Please enter return quantity");
      return;
    }

    if (returnQty > liveQty) {
      showWarning("Return quantity cannot be more than live quantity");
      return;
    }

    if (returnQty === liveQty) {
      const res = await returnRental(rentalId, returnDate);

      if (!res.success) {
        showError(res.message || "Failed to return rental");
        return;
      }
      setPartialReturn(null);
      setReturnMode({ ...returnMode, [rentalId]: "" });
      await loadData();
      return;
    }

    const remainingQty = liveQty - returnQty;
    const returnedDays = calcDays(
      rental.start_date,
      returnDate,
      "Returned",
      rental.avoid_sundays !== false,
    );

    const returnedAmount = Math.max(
      returnedDays * returnQty * Number(rental.daily_rate || 0),
      0,
    );

    const { id, created_at, updated_at, total_amount, ...copySource } = rental;

    const returnedRental: any = {
      ...copySource,
      qty: returnQty,
      end_date: returnDate,
      status: "Returned",
    };

    if ("total_amount" in rental) {
      returnedRental.total_amount = returnedAmount;
    }

    const insertRes = await supabase.from("rentals").insert([returnedRental]);

    if (insertRes.error) {
      showError(insertRes.error.message);
      return;
    }

    const updateRes = await supabase
      .from("rentals")
      .update({ qty: remainingQty })
      .eq("id", rentalId);

    if (updateRes.error) {
      showError(updateRes.error.message);
      return;
    }
    setPartialReturn(null);
    setReturnMode({ ...returnMode, [rentalId]: "" });
    await loadData();
  }

  async function handleDelete(id: number) {
    openRentalDeleteConfirm(id);
  }

  function openEditRental(rental: any) {
    setEditRental({
      ...rental,
      customer_id: String(rental.customer_id || ""),
      tool_id: String(rental.tool_id || ""),
      qty: String(rental.qty ?? 1),
      daily_rate: String(rental.daily_rate ?? 0),
      discount: String(rental.discount ?? 0),
      transport_amount: String(rental.transport_amount ?? rental.total_amount ?? 0),
      start_date: String(rental.start_date || "").slice(0, 10),
      end_date: String(rental.end_date || "").slice(0, 10),
      transport_date: String(rental.transport_date || rental.start_date || "").slice(0, 10),
    });
    setEditReason("");
    setEditExplanation("");
  }

  function changeEditRental(field: string, value: any) {
    setEditRental((current: any) => current ? { ...current, [field]: value } : current);
  }

  async function saveRentalEdit() {
    if (!editRental?.id) return;
    if (!editReason) {
      showWarning("Please select the reason for editing");
      return;
    }
    if (editExplanation.trim().length < 10) {
      showWarning("Please write a proper explanation of at least 10 characters");
      return;
    }

    setEditSaving(true);
    const res: any = await updateRentalWithAudit({
      rental: editRental,
      reason: editReason,
      explanation: editExplanation.trim(),
      edited_by: "Manager",
    });
    setEditSaving(false);

    if (!res.success) {
      showError(res.message || "Failed to update rental");
      return;
    }

    setEditRental(null);
    await loadData();
    showSuccess(res.message || "Rental updated successfully");
  }


  const activeRentals = rentals.filter((r) =>
    isLiveRentalRecord(r),
  );
  const returnedRentals = rentals
    .filter((r) => !isLiveRentalRecord(r))
    .filter((r) => r.shop === liveBranchFilter)
    .filter((r) => {
      const q = returnedSearchText.trim().toLowerCase();
      if (!q) return true;

      return `${customerName(r.customer_id)} ${r.mobile || r.customer_mobile || ""} ${rentalToolDetails(r)} ${r.shop || ""} ${r.start_date || ""} ${r.end_date || r.return_date || ""}`
        .toLowerCase()
        .includes(q);
    })
    .sort((a: any, b: any) => {
      const aDate = String(
        a.end_date ||
          a.return_date ||
          a.closed_date ||
          a.updated_at ||
          a.created_at ||
          "",
      );
      const bDate = String(
        b.end_date ||
          b.return_date ||
          b.closed_date ||
          b.updated_at ||
          b.created_at ||
          "",
      );

      return bDate.localeCompare(aDate);
    })
    .slice(0, 5);
  const filteredActiveRentals = activeRentals
    .filter((r) => r.shop === liveBranchFilter)
    .filter((r) => {
      const q = liveSearchText.trim().toLowerCase();
      if (!q) return true;

      return `${customerName(r.customer_id)} ${r.mobile || r.customer_mobile || ""} ${rentalToolDetails(r)} ${r.outside_shop_name || ""} ${r.shop || ""}`
        .toLowerCase()
        .includes(q);
    });

  const entryRows = rows.filter(
    (r) => r.customer_id && hasRentalItem(r),
  );
  const totalRows = entryRows.length;

  const totalQty = rows.reduce(
    (sum, r) => sum + (hasRentalItem(r) ? Number(r.qty || 0) : 0),
    0,
  );

  const totalEntryAmount = rows.reduce((sum, r) => sum + calcEntryAmount(r), 0);
  const totalTransportAmount = validTransportRows().reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );

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

  const dayTotalBusiness = totalEntryAmount + liveRentalToday;

  const lowReliabilityRows = rows
    .map((row, index) => {
      const customer = customers.find(
        (c: any) =>
          String(c.id || "") === String(row.customer_id || "") ||
          String(c.mobile || "").trim() === String(row.mobile || "").trim(),
      );
      const rating = normalizeCustomerRating(customer?.rating);

      if (!customer || rating > 3) return null;

      return {
        index,
        rowNumber: index + 1,
        rating,
        name: customer.customer_name || row.customer_name || "Customer",
        mobile: customer.mobile || row.mobile || "-",
      };
    })
    .filter(Boolean) as any[];

  const lowReliabilityGroups = Array.from(
    lowReliabilityRows
      .reduce((map: Map<string, any>, item: any) => {
        const key = `${item.mobile}-${item.name}-${item.rating}`;
        const existing = map.get(key) || {
          name: item.name,
          mobile: item.mobile,
          rating: item.rating,
          rowNumbers: [],
        };

        existing.rowNumbers.push(item.rowNumber);
        map.set(key, existing);
        return map;
      }, new Map())
      .values(),
  );

  const confirmRows = validRows();
  const confirmTransportRows = validTransportRows();
  const confirmRowsCount = confirmRows.length;
  const confirmQty = confirmRows.reduce(
    (sum, row) => sum + Number(row.qty || 0),
    0,
  );
  const confirmAmount =
    confirmRows.reduce((sum, row) => sum + calcEntryAmount(row), 0) +
    confirmTransportRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return (
    <main className="rentals-premium-page">
      <style>{premiumRentalStyles}</style>
      <h1 className="rentals-premium-title">Rentals</h1>

      {editRental && (
        <div style={confirmOverlayStyle}>
          <div style={{ ...confirmCardStyle, width: "min(920px, 96vw)", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ background: editRental.status === "Returned" ? "linear-gradient(135deg,#b91c1c,#7f1d1d)" : "linear-gradient(135deg,#0057ff,#0f2a5f)", color: "white", padding: "20px 24px" }}>
              <div style={{ fontSize: 28, fontWeight: 1000 }}>Edit {editRental.status === "Returned" ? "Returned " : ""}Rental</div>
              <div style={{ marginTop: 6, fontWeight: 800, opacity: .92 }}>
                {editRental.status === "Returned"
                  ? "Warning: this change will recalculate the customer statement and balance."
                  : "Changes are recorded in the rental audit history."}
              </div>
            </div>
            <div style={confirmBodyStyle}>
              {editRental.is_transport_charge ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(150px,1fr))", gap: 12 }}>
                  <label>Customer<select style={compactSelectStyle} value={editRental.customer_id} onChange={(e)=>changeEditRental("customer_id",e.target.value)}>{customers.map((c:any)=><option key={c.id} value={c.id}>{c.customer_name} - {c.mobile}</option>)}</select></label>
                  <label>Vehicle Type<input style={compactInputStyle} value={editRental.transport_vehicle_type || "Auto"} onChange={(e)=>changeEditRental("transport_vehicle_type",e.target.value)} /></label>
                  <label>Trip<select style={compactSelectStyle} value={editRental.transport_trip_type || "Delivery"} onChange={(e)=>changeEditRental("transport_trip_type",e.target.value)}><option>Delivery</option><option>Pickup</option><option>Both</option><option>Other</option></select></label>
                  <label>Delivery Location<input style={compactInputStyle} value={editRental.transport_location || ""} onChange={(e)=>changeEditRental("transport_location",e.target.value)} /></label>
                  <label>Amount<input style={compactInputStyle} type="number" value={editRental.transport_amount} onChange={(e)=>changeEditRental("transport_amount",e.target.value)} /></label>
                  <label>Date<input style={compactInputStyle} type="date" value={editRental.transport_date} onChange={(e)=>changeEditRental("transport_date",e.target.value)} /></label>
                  <label style={{ gridColumn: "1 / -1" }}>Notes<input style={compactInputStyle} value={editRental.transport_notes || ""} onChange={(e)=>changeEditRental("transport_notes",e.target.value)} /></label>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(140px,1fr))", gap: 12 }}>
                  <label style={{ gridColumn: "span 2" }}>Customer<select style={compactSelectStyle} value={editRental.customer_id} onChange={(e)=>changeEditRental("customer_id",e.target.value)}>{customers.map((c:any)=><option key={c.id} value={c.id}>{c.customer_name} - {c.mobile}</option>)}</select></label>
                  <label>Shop<select style={compactSelectStyle} value={editRental.shop || ""} onChange={(e)=>changeEditRental("shop",e.target.value)}>{branches.map(shop=><option key={shop}>{shop}</option>)}</select></label>
                  <label>Status<select style={compactSelectStyle} value={editRental.status || "Active"} onChange={(e)=>changeEditRental("status",e.target.value)}><option>Active</option><option>Returned</option></select></label>
                  {!editRental.is_outside_rent ? <label style={{ gridColumn: "span 2" }}>Tool<select style={compactSelectStyle} value={editRental.tool_id} onChange={(e)=>changeEditRental("tool_id",e.target.value)}>{tools.map((t:any)=><option key={t.id} value={t.id}>{t.tool_name}</option>)}</select></label> : <><label>Outside Item<input style={compactInputStyle} value={editRental.outside_item_name || ""} onChange={(e)=>changeEditRental("outside_item_name",e.target.value)} /></label><label>Outside Shop<input style={compactInputStyle} value={editRental.outside_shop_name || ""} onChange={(e)=>changeEditRental("outside_shop_name",e.target.value)} /></label></>}
                  <label>Qty<input style={compactInputStyle} type="number" min="1" value={editRental.qty} onChange={(e)=>changeEditRental("qty",e.target.value)} /></label>
                  <label>Daily Rate<input style={compactInputStyle} type="number" min="0" value={editRental.daily_rate} onChange={(e)=>changeEditRental("daily_rate",e.target.value)} /></label>
                  <label>Round Off<input style={compactInputStyle} type="number" min="0" value={editRental.discount} onChange={(e)=>changeEditRental("discount",e.target.value)} /></label>
                  <label style={{ display:"flex", alignItems:"center", gap:8, paddingTop:22 }}><input type="checkbox" checked={editRental.avoid_sundays !== false} onChange={(e)=>changeEditRental("avoid_sundays",e.target.checked)} /> Avoid Sunday</label>
                  <label>Start Date<input style={compactInputStyle} type="date" value={editRental.start_date} onChange={(e)=>changeEditRental("start_date",e.target.value)} /></label>
                  <label>Return Date<input style={compactInputStyle} type="date" value={editRental.end_date} onChange={(e)=>changeEditRental("end_date",e.target.value)} /></label>
                </div>
              )}
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #e2e8f0", display:"grid", gridTemplateColumns:"240px 1fr", gap:12 }}>
                <label>Reason<select style={compactSelectStyle} value={editReason} onChange={(e)=>setEditReason(e.target.value)}><option value="">Select reason</option><option>Wrong return date</option><option>Wrong start date</option><option>Wrong quantity</option><option>Wrong rate or round off</option><option>Wrong customer or tool</option><option>Transport correction</option><option>Other correction</option></select></label>
                <label>Proper Explanation<textarea value={editExplanation} onChange={(e)=>setEditExplanation(e.target.value)} placeholder="Explain what was wrong, the correct information, and how it was verified." style={{ ...compactInputStyle, minHeight: 82, resize:"vertical" }} /></label>
              </div>
              <div style={confirmButtonRowStyle}>
                <button type="button" style={confirmCancelButtonStyle} onClick={()=>setEditRental(null)} disabled={editSaving}>Cancel</button>
                <button type="button" style={{...confirmActionButtonStyle, background: editRental.status === "Returned" ? "#b91c1c" : "#0057ff"}} onClick={saveRentalEdit} disabled={editSaving}>{editSaving ? "Saving..." : "Save Edit"}</button>
              </div>
            </div>
          </div>
        </div>
      )}


      {draftPrompt && (
        <div style={confirmOverlayStyle}>
          <div style={confirmCardStyle}>
            <div
              style={{
                background: "linear-gradient(135deg, #0057ff, #0f2a5f)",
                color: "white",
                padding: "24px 26px",
              }}
            >
              <div style={{ fontSize: 34, fontWeight: 1000, lineHeight: 1.1 }}>
                📄 Rental Draft Found
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 16,
                  fontWeight: 850,
                  opacity: 0.92,
                }}
              >
                Your unsaved rental entries were saved in this browser.
              </div>
            </div>

            <div style={confirmBodyStyle}>
              <div style={confirmGridStyle}>
                <div style={confirmInfoStyle}>
                  <div style={confirmLabelStyle}>Saved</div>
                  <div style={confirmValueStyle}>
                    {formatDraftSavedTime(draftPrompt.savedAt) || "Recently"}
                  </div>
                </div>

                <div style={confirmInfoStyle}>
                  <div style={confirmLabelStyle}>Rows</div>
                  <div style={confirmValueStyle}>
                    {countDraftRows(draftPrompt.rows || [])}
                  </div>
                </div>

                <div style={{ ...confirmInfoStyle, gridColumn: "1 / -1" }}>
                  <div style={confirmLabelStyle}>Shop</div>
                  <div style={confirmValueStyle}>
                    {draftPrompt.selectedBranch || "Not selected"}
                  </div>
                </div>
              </div>

              <div style={confirmButtonRowStyle}>
                <button
                  type="button"
                  style={confirmCancelButtonStyle}
                  onClick={() => clearRentalDraft(true)}
                >
                  Start New
                </button>

                <button
                  type="button"
                  style={{
                    ...confirmActionButtonStyle,
                    background: "linear-gradient(135deg, #0057ff, #0f2a5f)",
                  }}
                  onClick={restoreRentalDraft}
                >
                  Restore Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
        <div style={confirmOverlayStyle}>
          <div
            style={{
              ...confirmCardStyle,
              width: "min(420px, 94vw)",
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #0f2a5f, #0057ff)",
                color: "white",
                padding: "18px 20px",
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 1000 }}>
                Confirm Save Rentals
              </div>
              <div style={{ marginTop: 6, fontSize: 14, fontWeight: 850 }}>
                Please check before saving.
              </div>
            </div>

            <div style={{ padding: 20 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <div style={confirmInfoStyle}>
                  <div style={confirmLabelStyle}>Shop</div>
                  <div style={confirmValueStyle}>{selectedBranch || "-"}</div>
                </div>

                <div style={confirmInfoStyle}>
                  <div style={confirmLabelStyle}>Date</div>
                  <div style={confirmValueStyle}>
                    {formatSaveDate(confirmDate)}
                  </div>
                </div>

                <div style={confirmInfoStyle}>
                  <div style={confirmLabelStyle}>Rows</div>
                  <div style={confirmValueStyle}>{confirmRowsCount}</div>
                </div>

                <div style={confirmInfoStyle}>
                  <div style={confirmLabelStyle}>Transport</div>
                  <div style={confirmValueStyle}>{confirmTransportRows.length}</div>
                </div>

                <div style={confirmInfoStyle}>
                  <div style={confirmLabelStyle}>Qty</div>
                  <div style={confirmValueStyle}>{confirmQty}</div>
                </div>

                <div style={{ ...confirmInfoStyle, gridColumn: "1 / -1" }}>
                  <div style={confirmLabelStyle}>Amount</div>
                  <div
                    style={{
                      ...confirmValueStyle,
                      color: "#0057ff",
                      fontSize: 22,
                    }}
                  >
                    ₹{confirmAmount.toFixed(0)}
                  </div>
                </div>
              </div>

              <div style={confirmButtonRowStyle}>
                <button
                  type="button"
                  style={confirmCancelButtonStyle}
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  style={{
                    ...confirmActionButtonStyle,
                    background: "linear-gradient(135deg, #0057ff, #0f2a5f)",
                  }}
                  onClick={confirmSaveRentals}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {partialReturn && (() => {
        const rental = partialReturn.rental || {};
        const customer = rentalCustomerDetails(rental);
        const tool = rentalToolDetails(rental);
        const liveQty = Number(rental.qty || 1);
        const returnQty = Number(partialReturnQty || 0);
        const remainingQty = Math.max(liveQty - returnQty, 0);

        return (
          <div style={confirmOverlayStyle}>
            <div style={confirmCardStyle}>
              <div
                style={{
                  background: "linear-gradient(135deg, #2563eb, #0f2a5f)",
                  color: "white",
                  padding: "24px 26px",
                }}
              >
                <div style={{ fontSize: 34, fontWeight: 1000, lineHeight: 1.1 }}>
                  ↩ Partial Return
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 16,
                    fontWeight: 850,
                    opacity: 0.92,
                  }}
                >
                  Return only part of this live rental quantity.
                </div>
              </div>

              <div style={confirmBodyStyle}>
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
                    <div style={confirmLabelStyle}>Live Qty</div>
                    <div style={confirmValueStyle}>{liveQty}</div>
                  </div>

                  <div style={confirmInfoStyle}>
                    <div style={confirmLabelStyle}>Remaining Qty</div>
                    <div
                      style={{
                        ...confirmValueStyle,
                        color: remainingQty < 0 ? "#dc2626" : "#16a34a",
                      }}
                    >
                      {remainingQty}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginTop: 18,
                  }}
                >
                  <div>
                    <div style={confirmLabelStyle}>Return Qty</div>
                    <input
                      type="number"
                      min="1"
                      max={liveQty}
                      value={partialReturnQty}
                      onChange={(e) => setPartialReturnQty(e.target.value)}
                      style={{
                        width: "100%",
                        fontSize: 20,
                        fontWeight: 950,
                        textAlign: "center",
                      }}
                    />
                  </div>

                  <div>
                    <div style={confirmLabelStyle}>Return Date</div>
                    <input
                      type="date"
                      value={partialReturnDate}
                      onChange={(e) => setPartialReturnDate(e.target.value)}
                      style={{ width: "100%", fontWeight: 950 }}
                    />
                  </div>
                </div>

                <div style={confirmButtonRowStyle}>
                  <button
                    type="button"
                    style={confirmCancelButtonStyle}
                    onClick={() => {
                      setPartialReturn(null);
                      setReturnMode({ ...returnMode, [partialReturn.id]: "" });
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    style={{
                      ...confirmActionButtonStyle,
                      background: "linear-gradient(135deg, #2563eb, #0f2a5f)",
                    }}
                    onClick={confirmPartialReturn}
                  >
                    Confirm Partial Return
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
                {rentalConfirm.type === "return"
                  ? "↩ Return Rental"
                  : "🗑 Delete Rental"}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 16,
                  fontWeight: 850,
                  opacity: 0.92,
                }}
              >
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

                      <div
                        style={{ ...confirmInfoStyle, gridColumn: "1 / -1" }}
                      >
                        <div style={confirmLabelStyle}>Tool</div>
                        <div style={confirmValueStyle}>{tool}</div>
                      </div>

                      <div style={confirmInfoStyle}>
                        <div style={confirmLabelStyle}>Qty</div>
                        <div style={confirmValueStyle}>
                          {rentalConfirm.rental?.qty || 1}
                        </div>
                      </div>

                      <div style={confirmInfoStyle}>
                        <div style={confirmLabelStyle}>Shop</div>
                        <div style={confirmValueStyle}>
                          {rentalConfirm.rental?.shop || "-"}
                        </div>
                      </div>

                      {rentalConfirm.type === "return" && (
                        <div
                          style={{ ...confirmInfoStyle, gridColumn: "1 / -1" }}
                        >
                          <div style={confirmLabelStyle}>Return Date</div>
                          <div
                            style={{ ...confirmValueStyle, color: "#ea580c" }}
                          >
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
                      <button
                        type="button"
                        style={confirmCancelButtonStyle}
                        onClick={closeRentalConfirm}
                      >
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
                        {rentalConfirm.type === "return"
                          ? "Return Rental"
                          : "Delete Rental"}
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
              padding: "14px 16px",
              minHeight: 90,
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
              padding: "14px 16px",
              minHeight: 90,
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
              padding: "14px 16px",
              minHeight: 90,
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
              padding: "14px 16px",
              minHeight: 90,
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
              padding: "14px 16px",
              minHeight: 90,
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
            padding: "10px 12px",
            marginBottom: 14,
            display: "grid",
            gridTemplateColumns: "auto auto minmax(260px, 1fr) 230px auto",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={{ minWidth: 170 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>
              Entry Date
            </div>
            <input
              type="date"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
              style={{ fontWeight: 800, height: 40 }}
            />
          </div>

          <button
            className="btn-gray"
            onClick={applyDateToAllRows}
            style={{ fontWeight: 900, whiteSpace: "nowrap" }}
          >
            Apply Date
          </button>

          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #bbf7d0",
              borderRadius: 12,
              color: "#166534",
              fontWeight: 950,
              padding: "8px 10px",
              display: "flex",
              justifyContent: "center",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              minHeight: 42,
            }}
          >
            <span>💾 {draftStatus}</span>
            <button
              type="button"
              className="btn-gray"
              onClick={saveRentalDraftNow}
              style={{ padding: "8px 10px", fontWeight: 900 }}
            >
              Save Draft
            </button>
            <button
              type="button"
              className="btn-gray"
              onClick={() => clearRentalDraft(true)}
              style={{ padding: "8px 10px", fontWeight: 900 }}
            >
              Clear Draft
            </button>
          </div>

          <select
  value={selectedBranch}
  onChange={(e) => setSelectedBranch(e.target.value)}
  style={{
    width: 230,
    minWidth: 230,
    height: 42,
    padding: "0 36px 0 12px",
    fontWeight: 900,
    fontSize: 15,
    whiteSpace: "nowrap",
  }}
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
            style={{ fontWeight: 900, padding: "10px 14px", whiteSpace: "nowrap" }}
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

        {lowReliabilityGroups.length > 0 && (
          <div
            style={{
              marginBottom: 14,
              borderRadius: 14,
              border: "2px solid #f97316",
              background: "linear-gradient(135deg, #fff7ed, #ffedd5)",
              color: "#9a3412",
              padding: "14px 16px",
              fontWeight: 950,
              boxShadow: "0 10px 22px rgba(249, 115, 22, 0.16)",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 1000 }}>
              ⚠️ PROCEED WITH CAUTION
            </div>
            {lowReliabilityGroups.map((item: any) => (
              <div
                key={`${item.mobile}-${item.name}-${item.rating}`}
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr auto 1.1fr",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div>Customer: {item.name}</div>
                <div>Mobile: {item.mobile}</div>
                <div>{customerReliabilityBadge(item.rating)}</div>
                <div>Applied to rows: {compressRowNumbers(item.rowNumbers)}</div>
              </div>
            ))}
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
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={compactHeaderStyle}>No</th>
              <th style={compactHeaderStyle}>⎘</th>
              <th style={compactHeaderStyle}>Mobile</th>
              <th style={compactHeaderStyle}>Customer</th>
              <th style={compactHeaderStyle}>Tool / Outside Item</th>
              <th style={compactHeaderStyle}>Qty</th>
              <th style={compactHeaderStyle}>Rate</th>
              <th style={compactHeaderStyle}>Total</th>
              <th style={compactHeaderStyle}>Start</th>
              <th style={compactHeaderStyle}>End</th>
              <th style={{ ...compactHeaderStyle, whiteSpace: "normal", lineHeight: 1.05 }}>Avoid Sunday</th>
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

                              if (normalizeCustomerRating(c.rating) <= 3) {
                                showWarning(
                                  `Proceed with caution. Customer Reliability: ${normalizeCustomerRating(c.rating)}/10`,
                                );
                              }
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
                  {row.is_outside_rent ? (
                    <div style={{ display: "grid", gap: 5 }}>
                      <input
                        style={compactInputStyle}
                        value={row.outside_item_name || ""}
                        onChange={(e) =>
                          changeRow(index, "outside_item_name", e.target.value)
                        }
                        placeholder="Outside item name"
                      />

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) auto",
                          gap: 5,
                        }}
                      >
                        <input
                          style={compactInputStyle}
                          value={row.outside_shop_name || ""}
                          onChange={(e) =>
                            changeRow(index, "outside_shop_name", e.target.value)
                          }
                          placeholder="Outside shop (internal)"
                        />

                        <button
                          type="button"
                          title="Change back to our tool"
                          onClick={() => setOutsideRentMode(index, false)}
                          style={{
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            color: "#334155",
                            borderRadius: 7,
                            padding: "0 8px",
                            fontWeight: 900,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Our Tool
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        gap: 5,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <input
                          type="search"
                          value={currentToolSearchText(index, row)}
                          onChange={(event) =>
                            handleToolSearchInput(index, event.target.value)
                          }
                          onFocus={() => setOpenToolSearchRow(index)}
                          onBlur={() =>
                            window.setTimeout(() => {
                              setOpenToolSearchRow((current) =>
                                current === index ? null : current,
                              );
                            }, 150)
                          }
                          disabled={!selectedBranch}
                          placeholder={
                            selectedBranch
                              ? "Type any part of tool name"
                              : "Select rental shop first"
                          }
                          autoComplete="off"
                          style={{
                            ...compactInputStyle,
                            minHeight: 38,
                            border:
                              openToolSearchRow === index
                                ? "2px solid #0057ff"
                                : "1px solid #cbd5e1",
                            background: selectedBranch
                              ? "#ffffff"
                              : "#f1f5f9",
                          }}
                        />

                        {selectedBranch && openToolSearchRow === index && (
                          <div
                            style={{
                              marginTop: 4,
                              maxHeight: 230,
                              overflowY: "auto",
                              border: "1px solid #9db7dc",
                              borderRadius: 9,
                              background: "#ffffff",
                              boxShadow:
                                "0 12px 28px rgba(15, 42, 95, 0.18)",
                            }}
                          >
                            {matchingToolsForSearch(
                              currentToolSearchText(index, row),
                            ).map((t: any) => (
                              <button
                                key={t.id}
                                type="button"
                                onMouseDown={(event) =>
                                  event.preventDefault()
                                }
                                onClick={() =>
                                  selectToolFromSearch(index, t)
                                }
                                style={{
                                  width: "100%",
                                  display: "grid",
                                  gridTemplateColumns:
                                    "minmax(0, 1fr) auto",
                                  gap: 8,
                                  alignItems: "center",
                                  padding: "9px 10px",
                                  border: 0,
                                  borderBottom:
                                    "1px solid #e2e8f0",
                                  background: "#ffffff",
                                  color: "#10234c",
                                  textAlign: "left",
                                  cursor: "pointer",
                                  fontSize: 14,
                                  fontWeight: 900,
                                }}
                              >
                                <span
                                  style={{
                                    minWidth: 0,
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  {t.tool_name}
                                </span>

                                <small
                                  style={{
                                    color: "#52647f",
                                    fontWeight: 850,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  Avl {availableQtyForTool(t)} · ₹
                                  {Number(t.daily_rent || 0).toFixed(0)}
                                </small>
                              </button>
                            ))}

                            {matchingToolsForSearch(
                              currentToolSearchText(index, row),
                            ).length === 0 && (
                              <div
                                style={{
                                  padding: "12px",
                                  color: "#b42318",
                                  fontSize: 14,
                                  fontWeight: 900,
                                  textAlign: "center",
                                }}
                              >
                                No available tool contains “
                                {currentToolSearchText(index, row)}”
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        title="Enter an item rented from an outside shop"
                        onClick={() => setOutsideRentMode(index, true)}
                        style={{
                          border: "1px solid #fdba74",
                          background: "#fff7ed",
                          color: "#9a3412",
                          borderRadius: 7,
                          padding: "0 8px",
                          fontWeight: 950,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Outside Rent
                      </button>
                    </div>
                  )}
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

        <section
          style={{
            marginTop: 18,
            border: "1px solid #bfdbfe",
            borderRadius: 16,
            background: "#f8fbff",
            padding: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 1000 }}>
                Transport Entry
              </h3>
              <div style={{ color: "#64748b", fontWeight: 800, fontSize: 13 }}>
                Add Auto or other transport charges separately from tool rows.
              </div>
            </div>
            <button type="button" className="btn-gray" onClick={addTransportRows}>
              + Add More
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ ...compactTableStyle, minWidth: 1080 }}>
              <thead>
                <tr>
                  {['#','Customer','Vehicle','Trip','Delivery Location','Amount','Date','Notes'].map((title) => (
                    <th key={title} style={compactHeaderStyle}>{title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transportRows.map((row, index) => (
                  <tr key={`transport-${index}`}>
                    <td style={compactCenterCellStyle}>{index + 1}</td>
                    <td style={compactCellStyle}>
                      <select
                        style={compactSelectStyle}
                        value={row.customer_id}
                        onChange={(e) => changeTransportRow(index, 'customer_id', e.target.value)}
                      >
                        <option value="">Select Customer</option>
                        {customers.map((customer: any) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.mobile} - {customer.customer_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={compactCellStyle}>
                      <input style={compactInputStyle} value={row.vehicle_type} onChange={(e) => changeTransportRow(index, 'vehicle_type', e.target.value)} placeholder="Auto" />
                    </td>
                    <td style={compactCellStyle}>
                      <select style={compactSelectStyle} value={row.trip_type} onChange={(e) => changeTransportRow(index, 'trip_type', e.target.value)}>
                        <option>Delivery</option><option>Pickup</option><option>Both</option><option>Other</option>
                      </select>
                    </td>
                    <td style={compactCellStyle}>
                      <input style={compactInputStyle} value={row.delivery_location} onChange={(e) => changeTransportRow(index, 'delivery_location', e.target.value)} placeholder="Location" />
                    </td>
                    <td style={compactCellStyle}>
                      <input style={compactInputStyle} type="number" min="0" value={row.amount} onChange={(e) => changeTransportRow(index, 'amount', e.target.value)} placeholder="0" />
                    </td>
                    <td style={compactCellStyle}>
                      <input style={compactInputStyle} type="date" value={row.transport_date} onChange={(e) => changeTransportRow(index, 'transport_date', e.target.value)} />
                    </td>
                    <td style={compactCellStyle}>
                      <input style={compactInputStyle} value={row.notes} onChange={(e) => changeTransportRow(index, 'notes', e.target.value)} placeholder="Notes" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, textAlign: "right", fontWeight: 950, color: "#0057ff" }}>
            Transport Total: ₹{totalTransportAmount.toFixed(0)}
          </div>
        </section>

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
            Rental Total: ₹{totalEntryAmount.toFixed(0)} &nbsp; | &nbsp; Transport: ₹{totalTransportAmount.toFixed(0)}
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
              + Add More Rows
            </button>

            <button
              className="btn-gray"
              style={{ marginLeft: 8 }}
              onClick={clearRentalEntryRows}
            >
              Clear Table
            </button>

            <button
              className="btn-gray"
              style={{ marginLeft: 8 }}
              onClick={() => clearRentalDraft(true)}
            >
              Clear Draft
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
          <h2 style={{ margin: 0 }}>Live Rentals — {liveBranchFilter}</h2>

          <input
            value={liveSearchText}
            onChange={(e) => setLiveSearchText(e.target.value)}
            placeholder="Search item, name, mobile..."
            style={liveSearchStyle}
          />
        </div>

        <div style={shopTabsStyle}>
          {branches.map((shop) => {
            const count = activeRentals.filter(
              (r) => r.shop === shop,
            ).length;

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
              <th style={compactHeaderStyle}>Daily Total</th>
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
                <td style={compactCellStyle}>
                  <div>{rentalToolDetails(r)}</div>
                  {r.is_outside_rent && (
                    <div
                      style={{
                        marginTop: 3,
                        color: "#9a3412",
                        fontSize: 12,
                        fontWeight: 950,
                      }}
                    >
                      Outside Rent
                      {r.outside_shop_name
                        ? ` · ${r.outside_shop_name}`
                        : ""}
                    </div>
                  )}
                </td>
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
                <td style={compactCenterCellStyle}>₹{(Number(r.qty || 1) * Number(r.daily_rate || 0)).toFixed(0)}</td>
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
                    <option value="Today">Today</option>
                    <option value="Pick Date">Pick a Date</option>
                    <option value="Partial Return">Partial Return</option>
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
                  <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                    <button className="btn-blue" onClick={() => openEditRental(r)}>Edit</button>
                    <button className="btn-red" onClick={() => handleDelete(r.id)}>Delete</button>
                  </div>
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

      <div className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Returned Rentals</h2>
            <p
              style={{
                margin: "4px 0 0",
                color: "#64748b",
                fontWeight: 800,
              }}
            >
              Latest 5 returned entries for the selected shop. Every edit
              requires an explanation.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              flexWrap: "wrap",
              gap: 10,
              width: "min(660px, 100%)",
            }}
          >
            <label
              style={{
                display: "grid",
                gap: 5,
                flex: "1 1 430px",
                color: "#475569",
                fontSize: 13,
                fontWeight: 950,
                textTransform: "uppercase",
              }}
            >
              Search Returned Rentals
              <input
                type="search"
                value={returnedSearchText}
                onChange={(event) =>
                  setReturnedSearchText(event.target.value)
                }
                placeholder="Search customer, mobile, item, shop or date..."
                style={{
                  width: "100%",
                  minHeight: 46,
                  padding: "10px 13px",
                  border: "1px solid #a9bdd8",
                  borderRadius: 12,
                  background: "#ffffff",
                  color: "#0f172a",
                  fontSize: 16,
                  fontWeight: 850,
                  outline: "none",
                }}
              />
            </label>

            {returnedSearchText && (
              <button
                type="button"
                className="btn-gray"
                onClick={() => setReturnedSearchText("")}
                style={{ minHeight: 46 }}
              >
                Clear
              </button>
            )}

            <strong
              style={{
                minHeight: 46,
                display: "inline-flex",
                alignItems: "center",
                padding: "0 14px",
                border: "1px solid #bfdbfe",
                borderRadius: 12,
                background: "#eff6ff",
                color: "#0f2a5f",
                whiteSpace: "nowrap",
              }}
            >
              {returnedRentals.length} shown
            </strong>
          </div>
        </div>

        <div style={{ width: "100%", overflowX: "hidden" }}>
          <table style={{ ...compactTableStyle, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>

            <thead>
              <tr>
                <th style={{ ...compactHeaderStyle, textAlign: "left" }}>
                  Customer
                </th>
                <th style={{ ...compactHeaderStyle, textAlign: "left" }}>
                  Item
                </th>
                <th style={compactHeaderStyle}>Qty</th>
                <th style={compactHeaderStyle}>Rate</th>
                <th style={compactHeaderStyle}>Start</th>
                <th style={compactHeaderStyle}>Return</th>
                <th style={compactHeaderStyle}>Amount</th>
                <th style={compactHeaderStyle}>Shop</th>
                <th style={compactHeaderStyle}>Action</th>
              </tr>
            </thead>

            <tbody>
              {returnedRentals.map((r: any) => (
                <tr key={`returned-${r.id}`}>
                  <td
                    style={{
                      ...compactCellStyle,
                      fontSize: 16,
                      fontWeight: 950,
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {customerName(r.customer_id)}
                  </td>
                  <td
                    style={{
                      ...compactCellStyle,
                      fontSize: 16,
                      fontWeight: 900,
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {rentalToolDetails(r)}
                  </td>
                  <td style={compactCenterCellStyle}>{r.qty || 1}</td>
                  <td style={compactCenterCellStyle}>
                    ₹{Number(r.daily_rate || 0).toFixed(0)}
                  </td>
                  <td
                    style={{
                      ...compactCenterCellStyle,
                      paddingLeft: 3,
                      paddingRight: 3,
                      fontSize: 13,
                    }}
                  >
                    {r.start_date || "-"}
                  </td>
                  <td
                    style={{
                      ...compactCenterCellStyle,
                      paddingLeft: 3,
                      paddingRight: 3,
                      fontSize: 13,
                    }}
                  >
                    {r.end_date || r.return_date || "-"}
                  </td>
                  <td
                    style={{
                      ...compactCenterCellStyle,
                      paddingLeft: 3,
                      paddingRight: 3,
                    }}
                  >
                    ₹{Number(r.total_amount || calcTotal(r)).toFixed(0)}
                  </td>
                  <td
                    style={{
                      ...compactCenterCellStyle,
                      paddingLeft: 3,
                      paddingRight: 3,
                      fontSize: 13,
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {r.shop || "-"}
                  </td>
                  <td
                    style={{
                      ...compactCenterCellStyle,
                      paddingLeft: 3,
                      paddingRight: 3,
                    }}
                  >
                    <button
                      className="btn-blue"
                      onClick={() => openEditRental(r)}
                      style={{
                        padding: "7px 9px",
                        minWidth: 0,
                        fontSize: 13,
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}

              {returnedRentals.length === 0 && (
                <tr>
                  <td colSpan={9} style={compactCenterCellStyle}>
                    {returnedSearchText
                      ? "No returned rentals match this search"
                      : "No returned rentals found for the selected shop"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

const premiumRentalStyles = `
  .rentals-premium-page {
    background: linear-gradient(180deg, #f4f8ff 0%, #eef4ff 38%, #f8fafc 100%);
    padding: 12px !important;
  }

  .rentals-premium-title {
    margin: 0 0 10px !important;
    padding: 14px 18px !important;
    border-radius: 18px !important;
    color: #ffffff !important;
    font-size: 30px !important;
    font-weight: 1000 !important;
    letter-spacing: -0.6px !important;
    background: linear-gradient(135deg, #0f2a5f 0%, #0057ff 55%, #38bdf8 100%) !important;
    box-shadow: 0 14px 34px rgba(0, 87, 255, 0.18) !important;
  }

  .rentals-premium-page .panel {
    background: rgba(255, 255, 255, 0.96) !important;
    border: 1px solid #c7d8ff !important;
    border-radius: 18px !important;
    box-shadow: 0 16px 38px rgba(15, 42, 95, 0.10) !important;
    padding: 14px !important;
    margin-bottom: 12px !important;
    overflow: hidden !important;
  }

  .rentals-premium-page .panel h2 {
    color: #071735 !important;
    font-weight: 1000 !important;
    letter-spacing: -0.3px !important;
    font-size: 23px !important;
  }

  .rentals-premium-page table {
    border-collapse: separate !important;
    border-spacing: 0 !important;
    width: 100% !important;
    background: #ffffff !important;
    border: 1px solid #c7d8ff !important;
    border-radius: 14px !important;
    overflow: hidden !important;
    box-shadow: 0 10px 24px rgba(15, 42, 95, 0.06) !important;
  }

  .rentals-premium-page thead th {
    background: linear-gradient(135deg, #0f2a5f, #0057ff) !important;
    color: #ffffff !important;
    border: 0 !important;
    padding: 8px 7px !important;
    font-size: 12.5px !important;
    line-height: 1.05 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.25px !important;
  }

  .rentals-premium-page tbody td {
    border-bottom: 1px solid #e3ecff !important;
    border-right: 1px solid #edf3ff !important;
    padding: 6px 7px !important;
    background: #ffffff !important;
    color: #0f172a !important;
  }

  .rentals-premium-page tbody tr:nth-child(even) td {
    background: #f8fbff !important;
  }

  .rentals-premium-page tbody tr:hover td {
    background: #eef6ff !important;
  }

  .rentals-premium-page input,
  .rentals-premium-page select,
  .rentals-premium-page textarea {
    border: 1px solid #cbdaf8 !important;
    background: #ffffff !important;
    color: #071735 !important;
    border-radius: 10px !important;
    min-height: 34px !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.85) !important;
  }

  .rentals-premium-page input:focus,
  .rentals-premium-page select:focus,
  .rentals-premium-page textarea:focus {
    outline: none !important;
    border-color: #0057ff !important;
    box-shadow: 0 0 0 3px rgba(0, 87, 255, 0.14) !important;
  }

  .rentals-premium-page .btn-blue,
  .rentals-premium-page .btn-green,
  .rentals-premium-page .btn-gray,
  .rentals-premium-page .btn-red {
    border-radius: 999px !important;
    min-height: 36px !important;
    padding: 8px 15px !important;
    font-weight: 1000 !important;
    box-shadow: 0 8px 18px rgba(15, 42, 95, 0.12) !important;
  }

  .rentals-premium-page .btn-blue {
    background: linear-gradient(135deg, #0057ff, #0f2a5f) !important;
    color: #ffffff !important;
    border: 1px solid #0057ff !important;
  }

  .rentals-premium-page .btn-green {
    background: linear-gradient(135deg, #16a34a, #166534) !important;
    color: #ffffff !important;
    border: 1px solid #16a34a !important;
  }

  .rentals-premium-page .btn-red {
    background: linear-gradient(135deg, #ef4444, #991b1b) !important;
    color: #ffffff !important;
    border: 1px solid #ef4444 !important;
  }

  .rentals-premium-page .btn-gray {
    background: #ffffff !important;
    color: #0f2a5f !important;
    border: 1px solid #c7d8ff !important;
  }

  .rentals-premium-page button:hover {
    transform: translateY(-1px) !important;
  }

  .rentals-premium-page button {
    transition: transform 0.12s ease, box-shadow 0.12s ease !important;
  }

  @media (max-width: 900px) {
    .rentals-premium-page {
      padding: 8px !important;
    }

    .rentals-premium-title {
      font-size: 24px !important;
      padding: 12px 14px !important;
    }

    .rentals-premium-page .panel {
      padding: 10px !important;
      border-radius: 14px !important;
    }
  }
`;
