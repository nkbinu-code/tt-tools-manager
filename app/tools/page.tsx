"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  searchToolsForToolsPage,
  suggestToolsForToolsPage,
  searchToolsForHistory,
  saveTools,
  updateTool,
  deleteTool,
  getToolHistory,
} from "../actions";
import { useAppMessage } from "../contexts/AppMessageProvider";

const branches = ["Karuvannur", "Ollur", "Kachery", "Mulayam Rd", "Pattikkad"];

const serviceCentres = [
  "MJ Tools",
  "Shiju Poochatty",
  "Prijo Kachery",
  "Global Tools",
  "iBell Tools",
  "Vincent Global",
  "Brotech Tools",
];

const statuses = ["Available", "Rented", "Service", "Missing"];

const shortNames: any = {
  Karuvannur: "KVR",
  Ollur: "OLR",
  Kachery: "KCH",
  "Mulayam Rd": "MLY",
  Pattikkad: "PTK",
  "MJ Tools": "MJ",
  "Shiju Poochatty": "SP",
  "Prijo Kachery": "PK",
  "Global Tools": "GLB",
  "iBell Tools": "IB",
  "Vincent Global": "VG",
  "Brotech Tools": "BT",
};

const shopCodeSet = new Set(branches.map((name) => shortNames[name] || name));
const serviceCodeSet = new Set(
  serviceCentres.map((name) => shortNames[name] || name),
);


const emptyTool = {
  tool_name: "",
  total_qty: 1,
  daily_rent: 0,
  purchase_cost: 0,
  category: "",
  brand: "",
  color: "",
  home_branch: "",
  current_location: "",
  status: "Available",
  greasing_due_days: 0,
  oil_change_due_days: 0,
  scheduled_service_due_days: 0,
  rental_overdue_days: 0,
};

const cellStyle = {
  padding: "12px 10px",
  fontWeight: 750,
  lineHeight: 1.3,
  fontSize: 17,
  textAlign: "center" as const,
  verticalAlign: "middle" as const,
};

const strongCellStyle = {
  padding: "12px 10px",
  fontWeight: 850,
  lineHeight: 1.3,
  fontSize: 17,
  textAlign: "center" as const,
  verticalAlign: "middle" as const,
};

const compactLocationCellStyle = {
  ...strongCellStyle,
  padding: "11px 8px",
  fontSize: 16,
  whiteSpace: "normal" as const,
  overflow: "visible" as const,
  lineHeight: 1.35,
};


const toolNameCellStyle = {
  ...strongCellStyle,
  textAlign: "left" as const,
  fontSize: 21,
  fontWeight: 950,
  minWidth: 440,
  maxWidth: 620,
  whiteSpace: "normal" as const,
};

const tableHeadStyle = {
  fontSize: 16,
  fontWeight: 900,
  textAlign: "center" as const,
  whiteSpace: "nowrap" as const,
};

const inputStyle = {
  fontSize: 16,
  fontWeight: 800,
  textAlign: "center" as const,
};

function numberValue(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function rowForSave(row: any) {
  return {
    ...row,
    total_qty: numberValue(row.total_qty || 1),
    daily_rent: numberValue(row.daily_rent),
    purchase_cost: numberValue(row.purchase_cost),
    greasing_due_days: numberValue(row.greasing_due_days),
    oil_change_due_days: numberValue(row.oil_change_due_days),
    scheduled_service_due_days: numberValue(row.scheduled_service_due_days),
    rental_overdue_days: numberValue(row.rental_overdue_days),
  };
}

function cleanDate(value: any) {
  return String(value || "").slice(0, 10);
}

function countRentalDays(startValue: any, endValue: any, avoidSundays = true) {
  const start = cleanDate(startValue);
  const end = cleanDate(endValue || new Date().toISOString().slice(0, 10));

  if (!start || !end) return 1;

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 1;
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

function rentalAmountForTool(row: any, tool: any) {
  if (Number(row.total_amount || 0) > 0) return numberValue(row.total_amount);

  const qty = numberValue(row.qty || row.quantity || 1) || 1;
  const rate = numberValue(row.daily_rate || row.daily_rent || row.unit_price || row.rate || tool?.daily_rent || 0);
  const days = countRentalDays(
    row.start_date || row.date || row.rental_date || row.created_at,
    row.end_date || row.return_date || row.closed_date,
    row.avoid_sundays !== false,
  );

  return Math.max(qty * rate * days - numberValue(row.discount), 0);
}

function serviceCostValue(row: any) {
  return numberValue(row.cost || row.service_cost || row.amount || row.total_cost);
}

function toolDueValues(tool: any) {
  return [
    numberValue(tool.greasing_due_days),
    numberValue(tool.oil_change_due_days),
    numberValue(tool.scheduled_service_due_days),
  ];
}

function toolServiceStatus(tool: any) {
  const dueValues = toolDueValues(tool);
  const passedValues = dueValues.filter((value) => value < 0);

  if (passedValues.length === 0) {
    return {
      color: "#16a34a",
      rgb: "22, 163, 74",
      textColor: "#064e3b",
      shadow: "inset 6px 0 0 rgba(22, 163, 74, 0.85)",
    };
  }

  const worstPassed = Math.min(...passedValues);

  if (worstPassed <= -30) {
    return {
      color: "#450a0a",
      rgb: "69, 10, 10",
      textColor: "#ffffff",
      shadow: "inset 6px 0 0 rgba(69, 10, 10, 0.95)",
    };
  }

  if (worstPassed <= -15) {
    return {
      color: "#7f1d1d",
      rgb: "127, 29, 29",
      textColor: "#ffffff",
      shadow: "inset 6px 0 0 rgba(127, 29, 29, 0.95)",
    };
  }

  return {
    color: "#991b1b",
    rgb: "153, 27, 27",
    textColor: "#ffffff",
    shadow: "inset 6px 0 0 rgba(153, 27, 27, 0.9)",
  };
}

function toolNameDueStyle(tool: any) {
  const status = toolServiceStatus(tool);

  return {
    ...toolNameCellStyle,
    color: "#064e3b",
    textShadow: "none",
    background: `linear-gradient(90deg, rgba(${status.rgb}, 0.96) 0%, rgba(${status.rgb}, 0.54) 44%, rgba(${status.rgb}, 0) 100%)`,
    boxShadow: status.shadow,
  };
}

function formatDueCell(value: any) {
  const days = numberValue(value);

  if (days < 0) {
    return (
      <span style={{ color: "#7f1d1d", fontWeight: 1000 }}>
        {days} <span style={{ fontSize: 12 }}>({Math.abs(days)} gone)</span>
      </span>
    );
  }

  return <span>{days}</span>;
}

export default function ToolsPage() {
  const { setAppMessage } = useAppMessage();

  const [rows, setRows] = useState<any[]>(
    Array.from({ length: 10 }, () => ({ ...emptyTool }))
  );

  const [tools, setTools] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [serviceRows, setServiceRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("All");
  const [sortKey, setSortKey] = useState("tool_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<any>({});
  const [openDetailsKey, setOpenDetailsKey] = useState<string | null>(null);
  const [detailEditingId, setDetailEditingId] = useState<number | null>(null);
  const [detailEditRow, setDetailEditRow] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState("");

  const [historyToolId, setHistoryToolId] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyOptions, setHistoryOptions] = useState<any[]>([]);
  const [toolHistory, setToolHistory] = useState<any[]>([]);
  const [historyTool, setHistoryTool] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOptionsLoading, setHistoryOptionsLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultLimited, setResultLimited] = useState(false);
  const [showAddTools, setShowAddTools] = useState(false);
  const [toolSuggestions, setToolSuggestions] = useState<any[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLimited, setSuggestionLimited] = useState(false);
  const [selectedExactToolName, setSelectedExactToolName] = useState<
    string | null
  >(null);
  const skipNextSuggestionSearch = useRef(false);

  async function loadTools(
    value = search,
    exactToolName: string | null = selectedExactToolName
  ) {
    const term = String(value || "").trim();
    const useExactName = Boolean(
      exactToolName &&
        exactToolName.trim().toLowerCase() === term.toLowerCase()
    );

    if (!term) {
      setTools([]);
      setRentals([]);
      setServiceRows([]);
      setHasSearched(false);
      setResultLimited(false);
      return;
    }

    setSearchLoading(true);

    try {
      const res = await searchToolsForToolsPage(term, useExactName);
      setHasSearched(true);

      if (res.success) {
        setTools(res.data || []);
        setRentals(res.rentals || []);
        setServiceRows(res.services || []);
        setResultLimited(Boolean(res.limited));
      } else {
        setTools([]);
        setRentals([]);
        setServiceRows([]);
        setResultLimited(false);
        showError(res.message || "Failed to search tools");
      }
    } finally {
      setSearchLoading(false);
    }
  }

  useEffect(() => {
    const term = search.trim();

    if (skipNextSuggestionSearch.current) {
      skipNextSuggestionSearch.current = false;
      return;
    }

    if (term.length < 2) {
      setToolSuggestions([]);
      setSuggestionLoading(false);
      setSuggestionLimited(false);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setSuggestionLoading(true);

      try {
        const res = await suggestToolsForToolsPage(term);

        if (cancelled) return;

        if (res.success) {
          setToolSuggestions(res.data || []);
          setSuggestionLimited(Boolean(res.limited));
          setShowSuggestions(true);
        } else {
          setToolSuggestions([]);
          setSuggestionLimited(false);
        }
      } finally {
        if (!cancelled) setSuggestionLoading(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search]);

  async function chooseLiveSuggestion(toolName: string) {
    const exactName = String(toolName || "").trim();
    if (!exactName) return;

    skipNextSuggestionSearch.current = true;
    setSearch(exactName);
    setSelectedExactToolName(exactName);
    setShowSuggestions(false);
    setToolSuggestions([]);
    await loadTools(exactName, exactName);
  }

  function functionTextWithMatch(textValue: string) {
    const text = String(textValue || "");
    const term = search.trim();

    if (!term) return text;

    const index = text.toLowerCase().indexOf(term.toLowerCase());
    if (index < 0) return text;

    return (
      <>
        {text.slice(0, index)}
        <mark className="tool-suggestion-mark">
          {text.slice(index, index + term.length)}
        </mark>
        {text.slice(index + term.length)}
      </>
    );
  }

  function showMessage(text: string) {
    if (!text) return;

    setAppMessage({
      type: "info",
      title: "Message",
      message: text,
    });
  }

  function showSuccess(message: string) {
    setAppMessage({
      type: "success",
      title: "Success",
      message,
    });
  }

  function showError(message: string) {
    setAppMessage({
      type: "error",
      title: "Error",
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

  function locationName(tool: any) {
    return (
      tool.service_centre ||
      tool.physical_location ||
      tool.current_location ||
      ""
    );
  }

  function makeLocationSummary(items: any[], field: string) {
    const dist: any = {};

    items.forEach((item) => {
      const loc =
        field === "home_branch" ? item.home_branch || "" : locationName(item);

      if (!loc) return;

      dist[loc] = (dist[loc] || 0) + Number(item.total_qty || 1);
    });

    const orderedLocations = [...branches, ...serviceCentres].filter(
      (loc) => Number(dist[loc] || 0) > 0,
    );

    const otherLocations = Object.keys(dist)
      .filter(
        (loc) =>
          Number(dist[loc] || 0) > 0 &&
          !branches.includes(loc) &&
          !serviceCentres.includes(loc),
      )
      .sort();

    const locations = [...orderedLocations, ...otherLocations];

    if (locations.length === 0) return "-";

    if (locationFilter !== "All") {
      const selectedQty = Number(dist[locationFilter] || 0);
      if (selectedQty <= 0) return "-";
      const code = shortNames[locationFilter] || locationFilter;
      return selectedQty === 1 ? code : `${code}(${selectedQty})`;
    }

    return locations
      .map((loc) => {
        const code = shortNames[loc] || loc;
        const qty = Number(dist[loc] || 0);
        return qty === 1 ? code : `${code}(${qty})`;
      })
      .join(" ");
  }

  function renderLocationSummary(summary: string) {
    const text = String(summary || "-").trim();
    if (!text || text === "-") return "-";

    return (
      <span
        style={{
          display: "inline-flex",
          gap: 7,
          rowGap: 3,
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          whiteSpace: "normal",
          width: "100%",
        }}
      >
        {text.split(/\s+/).map((part, index) => {
          const code = part.replace(/\(.*/, "");
          const isService = serviceCodeSet.has(code);
          const isShop = shopCodeSet.has(code);

          return (
            <span key={`${part}-${index}`} style={{ whiteSpace: "nowrap" }}>
              <strong
                style={{
                  color: isService ? "#f97316" : isShop ? "#0057ff" : "#0f172a",
                  fontWeight: 1000,
                }}
              >
                {code}
              </strong>
              <span style={{ color: "#0f172a", fontWeight: 850 }}>
                {part.slice(code.length)}
              </span>
            </span>
          );
        })}
      </span>
    );
  }

  const groupedTools = useMemo(() => {
    const groups: any = {};

    tools.forEach((tool) => {
      const key = String(tool.tool_name || "").trim().toLowerCase();

      if (!groups[key]) {
        groups[key] = {
          ...tool,
          group_key: key,
          grouped_items: [],
        };
      }

      groups[key].grouped_items.push(tool);
    });

    return Object.values(groups).map((group: any) => {
      const items = group.grouped_items || [];

      const totalQty = items.reduce(
        (sum: number, item: any) => sum + Number(item.total_qty || 1),
        0
      );

      const toolIds = new Set(items.map((item: any) => String(item.id || "")));
      const toolNames = new Set(items.map((item: any) => String(item.tool_name || "").trim().toLowerCase()));

      const earned_total = rentals
        .filter((r: any) => {
          const rentalToolId = String(r.tool_id || "");
          const rentalToolName = String(r.tool_name || r.tool || "").trim().toLowerCase();
          return (rentalToolId && toolIds.has(rentalToolId)) || (rentalToolName && toolNames.has(rentalToolName));
        })
        .reduce((sum: number, r: any) => {
          const matchedTool = items.find((item: any) => String(item.id || "") === String(r.tool_id || "")) || items[0];
          return sum + rentalAmountForTool(r, matchedTool);
        }, 0);

      const purchase_cost = items.reduce(
        (sum: number, item: any) => sum + numberValue(item.purchase_cost || item.purchase_price || item.cost_price),
        0,
      );

      const service_cost = serviceRows
        .filter((s: any) => {
          const serviceToolId = String(s.tool_id || "");
          const serviceToolName = String(s.tool_name || s.tool || "").trim().toLowerCase();
          return (serviceToolId && toolIds.has(serviceToolId)) || (serviceToolName && toolNames.has(serviceToolName));
        })
        .reduce((sum: number, s: any) => sum + serviceCostValue(s), 0);

      return {
        ...group,
        total_qty: totalQty,
        purchase_cost,
        earned_total,
        spent_total: service_cost,
        service_cost,
        profit_total: earned_total - purchase_cost - service_cost,
        home_branch_summary: makeLocationSummary(items, "home_branch"),
        current_location_summary: makeLocationSummary(
          items,
          "current_location"
        ),
        status: items[0]?.status || "Available",
        greasing_due_days: items[0]?.greasing_due_days || 0,
        oil_change_due_days: items[0]?.oil_change_due_days || 0,
        scheduled_service_due_days: items[0]?.scheduled_service_due_days || 0,
        rental_overdue_days: items[0]?.rental_overdue_days || 0,
      };
    });
  }, [tools, locationFilter, rentals, serviceRows]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "earned_total" || key === "spent_total" || key === "profit_total" ? "desc" : "asc");
  }

  function sortArrow(key: string) {
    if (sortKey !== key) return "";
    return sortDirection === "asc" ? " ▲" : " ▼";
  }

  function sortableHeader(label: string, key: string, style: any) {
    return (
      <button
        type="button"
        className="tools-sort-button"
        onClick={() => handleSort(key)}
        style={{
          width: "100%",
          border: 0,
          background: "transparent",
          color: "inherit",
          font: "inherit",
          fontWeight: 1000,
          textAlign: style?.textAlign || "center",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {label}{sortArrow(key)}
      </button>
    );
  }

  function sortValue(tool: any, key: string) {
    if (key === "tool_name") return String(tool.tool_name || "").toLowerCase();
    if (key === "total_qty") return Number(tool.total_qty || 0);
    if (key === "daily_rent") return Number(tool.daily_rent || 0);
    if (key === "purchase_cost") return Number(tool.purchase_cost || 0);
    if (key === "earned_total") return Number(tool.earned_total || 0);
    if (key === "spent_total") return Number(tool.spent_total || 0);
    if (key === "profit_total") return Number(tool.profit_total || 0);
    if (key === "category") return String(tool.category || "").toLowerCase();
    if (key === "brand") return String(tool.brand || "").toLowerCase();
    if (key === "color") return String(tool.color || "").toLowerCase();
    if (key === "home_branch") return String(tool.home_branch_summary || "").toLowerCase();
    if (key === "current_location") return String(tool.current_location_summary || "").toLowerCase();
    if (key === "status") return String(tool.status || "").toLowerCase();
    if (key === "greasing_due_days") return Number(tool.greasing_due_days || 0);
    if (key === "oil_change_due_days") return Number(tool.oil_change_due_days || 0);
    if (key === "scheduled_service_due_days") return Number(tool.scheduled_service_due_days || 0);
    if (key === "rental_overdue_days") return Number(tool.rental_overdue_days || 0);
    return "";
  }

  const filteredTools = useMemo(() => {
    const base = groupedTools.filter((tool: any) => {
      if (locationFilter === "All") return true;

      return tool.grouped_items.some((item: any) => {
        return (
          item.home_branch === locationFilter ||
          item.current_location === locationFilter ||
          item.service_centre === locationFilter ||
          item.physical_location === locationFilter ||
          String(item.display_location || "").includes(locationFilter)
        );
      });
    });

    return [...base].sort((a: any, b: any) => {
      const aValue = sortValue(a, sortKey);
      const bValue = sortValue(b, sortKey);

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      const result = String(aValue).localeCompare(String(bValue));
      return sortDirection === "asc" ? result : -result;
    });
  }, [groupedTools, locationFilter, sortKey, sortDirection]);

  const toolSummary = useMemo(() => {
    const purchase = filteredTools.reduce((sum: number, tool: any) => sum + Number(tool.purchase_cost || 0), 0);
    const earned = filteredTools.reduce((sum: number, tool: any) => sum + Number(tool.earned_total || 0), 0);
    const spent = filteredTools.reduce((sum: number, tool: any) => sum + Number(tool.spent_total || 0), 0);
    const profit = earned - purchase - spent;

    return {
      tools: filteredTools.length,
      qty: filteredTools.reduce((sum: number, tool: any) => sum + Number(tool.total_qty || 0), 0),
      purchase,
      earned,
      spent,
      profit,
      service: filteredTools.filter((tool: any) => String(tool.status || "").toLowerCase() === "service").length,
    };
  }, [filteredTools]);

  function changeRow(i: number, field: string, value: any) {
    const updated = [...rows];

    updated[i] = {
      ...updated[i],
      [field]: value,
    };

    if (field === "home_branch" && !updated[i].current_location) {
      updated[i].current_location = value;
    }

    setRows(updated);
  }

  async function handleSave() {
    setLoading(true);

    const res = await saveTools(rows.map(rowForSave));

    setLoading(false);

    if (!res.success) {
      showError(res.message || "Failed to save tools");
      return;
    }

    showSuccess(res.message || "Tools saved successfully");
    setRows(Array.from({ length: 10 }, () => ({ ...emptyTool })));
    setShowAddTools(false);
    await loadTools(search);
  }

  async function handleSearch() {
    const term = search.trim();

    if (!term) {
      showWarning("Start typing a tool name");
      return;
    }

    const selectedName =
      selectedExactToolName &&
      selectedExactToolName.trim().toLowerCase() === term.toLowerCase()
        ? selectedExactToolName
        : null;

    if (selectedName) {
      setShowSuggestions(false);
      await loadTools(selectedName, selectedName);
      return;
    }

    if (toolSuggestions.length === 1) {
      await chooseLiveSuggestion(toolSuggestions[0].tool_name);
      return;
    }

    setShowSuggestions(true);
    showWarning("Click one tool from the live matches to continue");
  }

  function clearSearch() {
    setSearch("");
    setTools([]);
    setRentals([]);
    setServiceRows([]);
    setHasSearched(false);
    setResultLimited(false);
    setLocationFilter("All");
    setToolSuggestions([]);
    setShowSuggestions(false);
    setSuggestionLimited(false);
    setSelectedExactToolName(null);
  }

  function startEditGroup(tool: any) {
    setEditingGroupKey(tool.group_key);
    setEditRow({
      tool_name: tool.tool_name || "",
      daily_rent: tool.daily_rent || 0,
      purchase_cost: tool.purchase_cost || 0,
      category: tool.category || "",
      brand: tool.brand || "",
      color: tool.color || "",
      home_branch: "",
      current_location: "",
      status: tool.status || "Available",
      greasing_due_days: tool.greasing_due_days || 0,
      oil_change_due_days: tool.oil_change_due_days || 0,
      scheduled_service_due_days: tool.scheduled_service_due_days || 0,
      rental_overdue_days: tool.rental_overdue_days || 0,
    });
  }

  async function saveEditGroup(tool: any) {
    const items = tool.grouped_items || [];

    if (items.length === 0) return;

    setLoading(true);

    for (const item of items) {
      const updatedRow = rowForSave({
        ...item,
        tool_name: editRow.tool_name,
        daily_rent: editRow.daily_rent,
        purchase_cost: editRow.purchase_cost,
        category: editRow.category,
        brand: editRow.brand,
        color: editRow.color,
        home_branch: editRow.home_branch || item.home_branch || "",
        current_location:
          editRow.current_location || item.current_location || item.home_branch || "",
        status: editRow.status || item.status || "Available",
        greasing_due_days: editRow.greasing_due_days,
        oil_change_due_days: editRow.oil_change_due_days,
        scheduled_service_due_days: editRow.scheduled_service_due_days,
        rental_overdue_days: editRow.rental_overdue_days,
      });

      const res = await updateTool(item.id, updatedRow);

      if (!res.success) {
        setLoading(false);
        showError(res.message || "Failed to update tool");
        return;
      }
    }

    setLoading(false);
    setEditingGroupKey(null);
    setEditRow({});
    showSuccess("Tool group updated");
    await loadTools(search);
  }

  async function handleDeleteGroup(tool: any) {
    const ok = confirm(
      `Delete all rows for "${tool.tool_name}"? This will delete ${tool.grouped_items.length} branch rows.`
    );

    if (!ok) return;

    setLoading(true);

    for (const item of tool.grouped_items || []) {
      const res = await deleteTool(item.id);

      if (!res.success) {
        setLoading(false);
        showError(res.message || "Failed to delete");
        return;
      }
    }

    setLoading(false);
    showSuccess("Tool group deleted");
    await loadTools(search);
  }

  function startDetailEdit(row: any) {
    setDetailEditingId(row.id);
    setDetailEditRow({
      ...row,
      greasing_due_days: row.greasing_due_days || 0,
      oil_change_due_days: row.oil_change_due_days || 0,
      scheduled_service_due_days: row.scheduled_service_due_days || 0,
      rental_overdue_days: row.rental_overdue_days || 0,
    });
  }

  async function saveDetailEdit() {
    if (!detailEditingId) return;

    const res = await updateTool(detailEditingId, rowForSave(detailEditRow));

    if (!res.success) {
      showError(res.message || "Failed to update tool row");
      return;
    }

    showSuccess(res.message || "Tool row updated successfully");
    setDetailEditingId(null);
    setDetailEditRow({});
    await loadTools(search);
  }

  async function handleDetailDelete(id: number) {
    const ok = confirm("Delete this shop row?");
    if (!ok) return;

    const res = await deleteTool(id);

    if (!res.success) {
      showError(res.message || "Failed to delete tool row");
      return;
    }

    showSuccess(res.message || "Tool row deleted successfully");
    await loadTools(search);
  }

  function handleExcelFile(file: File | null) {
    if (!file) return;

    setImportFileName(file.name);

    const reader = new FileReader();

    reader.onload = (event) => {
      const data = event.target?.result;
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
      });

      const cleanedRows = jsonRows
        .map((row) => {
          const toolName = String(
            row.tool_name || row["Tool Name"] || row.Tool || ""
          ).trim();

          const homeBranch = String(
            row.home_branch || row["Home Branch"] || ""
          ).trim();

          const currentLocation = String(
            row.current_location || row["Current Location"] || ""
          ).trim();

          return rowForSave({
            tool_name: toolName,
            total_qty: Number(row.total_qty || row.Qty || row.qty || 1),
            daily_rent: Number(
              row.daily_rent || row.Rent || row.rent || row["Daily Rent"] || 0
            ),
            purchase_cost: Number(
              row.purchase_cost || row["Purchase Cost"] || row["Purchase Price"] || 0
            ),
            category: String(row.category || row.Category || "").trim(),
            brand: String(row.brand || row.Brand || "").trim(),
            color: String(row.color || row.Color || "").trim(),
            home_branch: homeBranch,
            current_location: currentLocation || homeBranch,
            status: String(row.status || row.Status || "Available").trim(),
            greasing_due_days:
              row.greasing_due_days ||
              row["Greasing (Days)"] ||
              row.Greasing ||
              0,
            oil_change_due_days:
              row.oil_change_due_days ||
              row["Oil Change (Days)"] ||
              row["Oil Change"] ||
              0,
            scheduled_service_due_days:
              row.scheduled_service_due_days ||
              row["Scheduled (Days)"] ||
              row["Scheduled Service"] ||
              row.Scheduled ||
              0,
            rental_overdue_days:
              row.rental_overdue_days ||
              row["Rental Overdue (Days)"] ||
              row["Rental Overdue"] ||
              0,
          });
        })
        .filter((row) => row.tool_name);

      setImportRows(cleanedRows);

      showSuccess(
        `${cleanedRows.length} tools ready to import from ${file.name}`
      );
    };

    reader.readAsArrayBuffer(file);
  }

  async function handleImportTools() {
    if (importRows.length === 0) {
      showWarning("No tools ready to import");
      return;
    }

    setLoading(true);

    const res = await saveTools(importRows.map(rowForSave));

    setLoading(false);

    if (!res.success) {
      showError(res.message || "Failed to import tools");
      return;
    }

    showSuccess(res.message || "Tools imported successfully");
    setImportRows([]);
    setImportFileName("");
    await loadTools(search);
  }


  function downloadToolsExcel() {
    const sheetData = [
      [
        "Tool Name",
        "Qty",
        "Daily Rent",
        "Purchase Cost",
        "Earned",
        "Spent",
        "Profit",
        "Category",
        "Brand",
        "Color",
        "Home Branch",
        "Current Location",
        "Status",
        "Greasing",
        "Oil Change",
        "Scheduled Service",
        "Rental Overdue",
      ],
      ...filteredTools.map((tool: any) => [
        tool.tool_name,
        tool.total_qty,
        Number(tool.daily_rent || 0),
        Number(tool.purchase_cost || 0),
        Number(tool.earned_total || 0),
        Number(tool.spent_total || 0),
        Number(tool.profit_total || 0),
        tool.category,
        tool.brand,
        tool.color,
        tool.home_branch_summary,
        tool.current_location_summary,
        tool.status,
        Number(tool.greasing_due_days || 0),
        Number(tool.oil_change_due_days || 0),
        Number(tool.scheduled_service_due_days || 0),
        Number(tool.rental_overdue_days || 0),
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet["!cols"] = [
      { wch: 42 },
      { wch: 8 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
      { wch: 24 },
      { wch: 28 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tools List");
    XLSX.writeFile(workbook, "T&T_Tools_List.xlsx");
  }

  async function handleHistoryOptionSearch() {
    const term = historySearch.trim();

    setHistoryToolId("");
    setToolHistory([]);
    setHistoryTool(null);

    if (!term) {
      setHistoryOptions([]);
      return;
    }

    setHistoryOptionsLoading(true);

    try {
      const res = await searchToolsForHistory(term);

      if (res.success) {
        setHistoryOptions(res.data || []);

        if (res.limited) {
          showMessage("Showing the first 50 matching tools. Make the search more specific if needed.");
        }
      } else {
        setHistoryOptions([]);
        showError(res.message || "Failed to search tools");
      }
    } finally {
      setHistoryOptionsLoading(false);
    }
  }

  async function handleHistorySearch(toolId: string) {
    setHistoryToolId(toolId);

    if (!toolId) {
      setToolHistory([]);
      setHistoryTool(null);
      return;
    }

    setHistoryLoading(true);
    const res: any = await getToolHistory(Number(toolId));
    setHistoryLoading(false);

    if (res.success) {
      setToolHistory(res.history || []);
      setHistoryTool(res.tool || null);
    } else {
      showError(res.message || "Failed to load tool history");
    }
  }

  return (
    <main>
      <style>{`
        .tools-results-shell {
          overflow-x: auto;
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 12px 30px rgba(15, 42, 95, 0.08);
        }

        .tools-clean-table {
          border-collapse: separate;
          border-spacing: 0;
        }

        .tools-clean-table th,
        .tools-clean-table td {
          text-align: center;
          vertical-align: middle;
          border-right: 1px solid #dbe5f2;
          border-bottom: 1px solid #dbe5f2;
        }

        .tools-clean-table th:last-child,
        .tools-clean-table td:last-child {
          border-right: 0;
        }

        .tools-clean-table thead .tools-group-head th {
          position: sticky;
          top: 0;
          z-index: 5;
          padding: 9px 8px;
          background: #102f67;
          color: #ffffff;
          font-size: 14px;
          font-weight: 950;
          letter-spacing: 0.7px;
          text-transform: uppercase;
        }

        .tools-clean-table thead .tools-column-head th {
          position: sticky;
          top: 37px;
          z-index: 4;
          padding: 12px 8px;
          background: #e8f1ff;
          color: #102f67;
          box-shadow: inset 0 -2px 0 #8fb5ed;
        }

        .tools-clean-table .tool-result-row:nth-of-type(4n + 1) > td {
          background-color: #ffffff;
        }

        .tools-clean-table .tool-result-row:nth-of-type(4n + 3) > td {
          background-color: #f8fbff;
        }

        .tools-clean-table .tool-result-row:hover > td {
          background-color: #edf5ff;
        }

        .tools-clean-table .tool-name-cell {
          text-align: left !important;
        }

        .tools-clean-table input,
        .tools-clean-table select {
          min-height: 38px;
          font-size: 16px;
          font-weight: 800;
          text-align: center;
        }

        .tools-sort-button:hover {
          color: #0057ff !important;
        }

        .tools-clean-table .location-summary-cell {
          white-space: normal !important;
        }

        .tool-result-row > td:nth-child(3) {
          background-image: linear-gradient(rgba(234, 246, 255, 0.74), rgba(234, 246, 255, 0.74));
        }

        .tool-result-row > td:nth-child(4) {
          background-image: linear-gradient(rgba(255, 247, 226, 0.78), rgba(255, 247, 226, 0.78));
        }

        .tool-result-row > td:nth-child(5) {
          background-image: linear-gradient(rgba(232, 250, 239, 0.82), rgba(232, 250, 239, 0.82));
          color: #08783e;
          font-weight: 900;
        }

        .tool-result-row > td:nth-child(6) {
          background-image: linear-gradient(rgba(255, 239, 239, 0.82), rgba(255, 239, 239, 0.82));
          color: #a11b1b;
          font-weight: 900;
        }

        .tool-result-row > td:nth-child(7) {
          background-image: linear-gradient(rgba(239, 247, 255, 0.88), rgba(239, 247, 255, 0.88));
          font-weight: 950;
        }

        .tool-status-pill {
          display: inline-flex;
          min-width: 80px;
          align-items: center;
          justify-content: center;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 15px;
          font-weight: 950;
          line-height: 1;
          border: 1px solid transparent;
        }

        .tool-status-available {
          color: #08783e;
          background: #dcfce7;
          border-color: #86efac;
        }

        .tool-status-rented {
          color: #9a4a00;
          background: #ffedd5;
          border-color: #fdba74;
        }

        .tool-status-service {
          color: #1646a3;
          background: #dbeafe;
          border-color: #93c5fd;
        }

        .tool-status-missing {
          color: #a11212;
          background: #fee2e2;
          border-color: #fca5a5;
        }

        .tools-action-row button {
          min-height: 38px;
          padding: 8px 12px !important;
          font-size: 15px;
          font-weight: 900 !important;
        }

        .tools-empty-row td {
          padding: 34px 18px !important;
          font-size: 18px;
          font-weight: 850;
          color: #52647f;
          background: #f8fbff;
        }

        .tool-live-search-wrap {
          position: relative;
          width: min(100%, 620px);
          z-index: 30;
        }

        .tool-live-search-wrap > input {
          width: 100% !important;
        }

        .tool-live-indicator {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-left: 3px;
          color: #1557b0;
          font-size: 14px;
          font-weight: 900;
        }

        .tool-live-dot {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: #12a150;
          box-shadow: 0 0 0 4px rgba(18, 161, 80, 0.14);
        }

        .tool-live-dot.loading {
          background: #f59e0b;
          box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.15);
          animation: tool-live-pulse 0.9s infinite alternate;
        }

        @keyframes tool-live-pulse {
          from { opacity: 0.45; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1.12); }
        }

        .tool-live-suggestions {
          position: absolute;
          top: calc(100% + 7px);
          left: 0;
          right: 0;
          z-index: 60;
          max-height: 420px;
          overflow-y: auto;
          border: 1px solid #9db9df;
          border-radius: 13px;
          background: #ffffff;
          box-shadow: 0 18px 42px rgba(15, 42, 95, 0.22);
        }

        .tool-live-suggestions-head {
          position: sticky;
          top: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 13px;
          background: #eaf3ff;
          border-bottom: 1px solid #c6d9f1;
          color: #143b75;
          font-size: 14px;
          font-weight: 950;
        }

        .tool-live-suggestion {
          display: grid;
          grid-template-columns: minmax(210px, 1.6fr) minmax(90px, 0.5fr) minmax(180px, 1fr);
          gap: 12px;
          width: 100%;
          padding: 12px 13px;
          border: 0;
          border-bottom: 1px solid #e3eaf4;
          background: #ffffff;
          color: #17233b;
          text-align: left;
          cursor: pointer;
        }

        .tool-live-suggestion:hover,
        .tool-live-suggestion:focus-visible {
          background: #eef6ff;
          outline: none;
        }

        .tool-live-suggestion-name {
          font-size: 17px;
          font-weight: 950;
          line-height: 1.25;
        }

        .tool-live-suggestion-qty {
          align-self: center;
          justify-self: center;
          padding: 5px 9px;
          border-radius: 999px;
          background: #e7f7ed;
          color: #08783e;
          font-size: 14px;
          font-weight: 950;
          white-space: nowrap;
        }

        .tool-live-suggestion-meta {
          font-size: 14px;
          font-weight: 800;
          line-height: 1.4;
          color: #52647f;
        }

        .tool-suggestion-mark {
          padding: 0 1px;
          border-radius: 3px;
          background: #ffe48a;
          color: inherit;
        }

        .tool-card-list {
          display: grid;
          gap: 16px;
          width: 100%;
        }

        .tool-result-card {
          width: 100%;
          overflow: hidden;
          border: 1px solid #b9cde7;
          border-radius: 16px;
          background: #ffffff;
          box-shadow: 0 10px 28px rgba(15, 42, 95, 0.08);
        }

        .tool-result-card:hover {
          border-color: #7ba5dc;
          box-shadow: 0 14px 34px rgba(15, 42, 95, 0.13);
        }

        .tool-card-header {
          display: grid;
          grid-template-columns: minmax(240px, 1fr) auto auto;
          align-items: center;
          gap: 14px;
          padding: 15px 16px;
          background: linear-gradient(90deg, #eaf3ff 0%, #f8fbff 64%, #ffffff 100%);
          border-bottom: 1px solid #cfdef0;
        }

        .tool-card-name {
          margin: 0;
          color: #102f67;
          font-size: 22px;
          font-weight: 1000;
          line-height: 1.22;
          overflow-wrap: anywhere;
        }

        .tool-card-header-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
          gap: 9px;
        }

        .tool-qty-pill {
          display: inline-flex;
          min-width: 70px;
          align-items: center;
          justify-content: center;
          padding: 7px 11px;
          border: 1px solid #9fc0e9;
          border-radius: 999px;
          background: #ffffff;
          color: #173e79;
          font-size: 16px;
          font-weight: 950;
        }

        .tool-card-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        .tool-card-actions button {
          min-height: 40px;
          padding: 8px 13px !important;
          font-size: 15px;
          font-weight: 900 !important;
        }

        .tool-card-body {
          display: grid;
          grid-template-columns:
            minmax(330px, 1.35fr)
            minmax(220px, 0.9fr)
            minmax(240px, 1fr)
            minmax(300px, 1.15fr);
          gap: 12px;
          padding: 14px;
        }

        .tool-info-section {
          min-width: 0;
          overflow: hidden;
          border: 1px solid #d6e2f0;
          border-radius: 12px;
          background: #fbfdff;
        }

        .tool-info-title {
          padding: 8px 11px;
          background: #143f82;
          color: #ffffff;
          font-size: 14px;
          font-weight: 950;
          letter-spacing: 0.45px;
          text-transform: uppercase;
        }

        .tool-info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .tool-info-item {
          min-width: 0;
          padding: 10px 11px;
          border-right: 1px solid #e1e9f3;
          border-bottom: 1px solid #e1e9f3;
        }

        .tool-info-item:nth-child(2n) {
          border-right: 0;
        }

        .tool-info-item:nth-last-child(-n + 2) {
          border-bottom: 0;
        }

        .tool-info-label {
          display: block;
          margin-bottom: 4px;
          color: #60718a;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.25px;
          text-transform: uppercase;
        }

        .tool-info-value {
          display: block;
          color: #14213a;
          font-size: 17px;
          font-weight: 900;
          line-height: 1.28;
          overflow-wrap: anywhere;
        }

        .tool-money-earned .tool-info-value,
        .tool-money-profit-positive .tool-info-value {
          color: #0b8848;
        }

        .tool-money-spent .tool-info-value,
        .tool-money-profit-negative .tool-info-value {
          color: #b42318;
        }

        .tool-card-edit {
          padding: 15px;
        }

        .tool-card-edit-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(180px, 1fr));
          gap: 12px;
        }

        .tool-card-edit-field {
          min-width: 0;
        }

        .tool-card-edit-field label {
          display: block;
          margin-bottom: 5px;
          color: #4b5f7e;
          font-size: 13px;
          font-weight: 950;
          text-transform: uppercase;
        }

        .tool-card-edit-field input,
        .tool-card-edit-field select {
          width: 100%;
          min-height: 42px;
          padding: 8px 10px;
          font-size: 16px;
          font-weight: 800;
        }

        .tool-details-panel {
          padding: 14px;
          border-top: 1px solid #c9d9ec;
          background: #f5f9ff;
        }

        .tool-details-title {
          margin: 0 0 12px;
          color: #173d75;
          font-size: 18px;
          font-weight: 950;
        }

        .tool-details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
          gap: 12px;
        }

        .tool-detail-card {
          overflow: hidden;
          border: 1px solid #cbd9ea;
          border-radius: 12px;
          background: #ffffff;
        }

        .tool-detail-card-head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 10px 11px;
          background: #e9f2ff;
          border-bottom: 1px solid #d1dfef;
        }

        .tool-detail-card-head strong {
          color: #173d75;
          font-size: 16px;
          font-weight: 950;
          overflow-wrap: anywhere;
        }

        .tool-detail-values {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .tool-detail-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          padding: 10px 11px;
          border-top: 1px solid #e0e8f2;
          background: #fafcff;
        }

        .tool-detail-actions button {
          min-height: 38px;
          padding: 7px 12px !important;
          font-size: 14px;
          font-weight: 900 !important;
        }

        .tool-empty-card {
          padding: 34px 18px;
          border: 1px dashed #9db5d3;
          border-radius: 14px;
          background: #f7fbff;
          color: #52647f;
          text-align: center;
          font-size: 18px;
          font-weight: 900;
        }

        @media (max-width: 1450px) {
          .tool-card-body {
            grid-template-columns: repeat(2, minmax(280px, 1fr));
          }

          .tool-card-edit-grid {
            grid-template-columns: repeat(3, minmax(170px, 1fr));
          }
        }

        @media (max-width: 980px) {
          .tool-card-header {
            grid-template-columns: 1fr;
          }

          .tool-card-header-meta,
          .tool-card-actions {
            justify-content: flex-start;
          }

          .tool-card-body {
            grid-template-columns: 1fr;
          }

          .tool-card-edit-grid {
            grid-template-columns: repeat(2, minmax(150px, 1fr));
          }
        }

        @media (max-width: 620px) {
          .tool-card-edit-grid,
          .tool-info-grid,
          .tool-detail-values {
            grid-template-columns: 1fr;
          }

          .tool-info-item {
            border-right: 0;
          }

          .tool-info-item:nth-last-child(-n + 2) {
            border-bottom: 1px solid #e1e9f3;
          }

          .tool-info-item:last-child {
            border-bottom: 0;
          }
        }

        @media (max-width: 900px) {
          .tools-search-controls {
            align-items: stretch !important;
          }

          .tools-search-controls > input,
          .tools-search-controls > select {
            width: 100% !important;
          }
        }
      `}</style>
      <h1>Tools</h1>

      <div className="panel">
        <h2>Tools List</h2>

        <div
          className="tools-search-controls"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <div className="tool-live-search-wrap">
            <input
              placeholder="Start typing tool name, brand, category, shop or status..."
              value={search}
              autoComplete="off"
              onFocus={() => {
                if (search.trim().length >= 2) setShowSuggestions(true);
              }}
              onBlur={() => {
                window.setTimeout(() => setShowSuggestions(false), 180);
              }}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedExactToolName(null);
                setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSearch();
                }

                if (e.key === "Escape") {
                  setShowSuggestions(false);
                }
              }}
              style={{ minHeight: 46, fontSize: 17, fontWeight: 800 }}
            />

            {search.trim().length > 0 && (
              <div className="tool-live-indicator" style={{ marginTop: 8 }}>
                <span
                  className={`tool-live-dot ${
                    suggestionLoading ? "loading" : ""
                  }`}
                />
                {search.trim().length < 2
                  ? "Type one more letter for live matches"
                  : suggestionLoading
                  ? "Finding matching spellings..."
                  : `${toolSuggestions.length} live spelling match(es)`}
              </div>
            )}

            {showSuggestions &&
              search.trim().length >= 2 &&
              (suggestionLoading ||
                toolSuggestions.length > 0 ||
                !suggestionLoading) && (
                <div className="tool-live-suggestions">
                  <div className="tool-live-suggestions-head">
                    <span>LIVE TOOL MATCHES</span>
                    <span>
                      Click one tool to open only that selected tool
                    </span>
                  </div>

                  {suggestionLoading && toolSuggestions.length === 0 ? (
                    <div style={{ padding: 18, fontWeight: 850 }}>
                      Searching matching tool names...
                    </div>
                  ) : toolSuggestions.length === 0 ? (
                    <div style={{ padding: 18, fontWeight: 850 }}>
                      No matching tool spelling found.
                    </div>
                  ) : (
                    toolSuggestions.map((suggestion: any) => (
                      <button
                        type="button"
                        className="tool-live-suggestion"
                        key={String(suggestion.tool_name || "").toLowerCase()}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() =>
                          void chooseLiveSuggestion(suggestion.tool_name)
                        }
                      >
                        <span className="tool-live-suggestion-name">
                          {functionTextWithMatch(suggestion.tool_name)}
                        </span>

                        <span className="tool-live-suggestion-qty">
                          Qty {Number(suggestion.qty || 0)}
                        </span>

                        <span className="tool-live-suggestion-meta">
                          {[
                            (suggestion.brands || []).join(", "),
                            suggestion.category,
                            (suggestion.locations || []).join(", "),
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Tool details available"}
                        </span>
                      </button>
                    ))
                  )}

                </div>
              )}
          </div>

          <button
            className="btn-blue"
            type="button"
            onClick={() => void handleSearch()}
            disabled={searchLoading || !search.trim()}
          >
            {searchLoading ? "Searching..." : "Search"}
          </button>

          <button
            type="button"
            onClick={clearSearch}
            disabled={!search && !hasSearched}
          >
            Clear
          </button>

          <button
            className="btn-blue"
            type="button"
            onClick={downloadToolsExcel}
            disabled={filteredTools.length === 0}
            style={{
              opacity: filteredTools.length === 0 ? 0.55 : 1,
              cursor: filteredTools.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            Download Results
          </button>

          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            style={{ width: 300, minHeight: 44, fontSize: 16, fontWeight: 800 }}
          >
            <option value="All">All Locations</option>

            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}

            {serviceCentres.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            border: "1px solid #cbd5e1",
            background: "#f8fafc",
            borderRadius: 8,
            fontWeight: 850,
            fontSize: 16,
            color: resultLimited ? "#9a3412" : "#334155",
          }}
        >
          {!hasSearched
            ? "Tools are not loaded automatically. Enter a search and click Search."
            : searchLoading
            ? "Searching Supabase..."
            : resultLimited
            ? `Showing the first 50 matching rows. Make the search more specific if the required tool is not visible.`
            : `${filteredTools.length} matching tool item(s) found.`}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <ToolSummaryCard title="Tool Items" value={toolSummary.tools} />
          <ToolSummaryCard title="Qty" value={toolSummary.qty} />
          <ToolSummaryCard title="Purchase" value={`₹${toolSummary.purchase.toFixed(0)}`} />
          <ToolSummaryCard title="Earned" value={`₹${toolSummary.earned.toFixed(0)}`} />
          <ToolSummaryCard title="Spent" value={`₹${toolSummary.spent.toFixed(0)}`} />
          <ToolSummaryCard title="Profit" value={`₹${toolSummary.profit.toFixed(0)}`} danger={toolSummary.profit < 0} success={toolSummary.profit >= 0} />
        </div>


        <div className="tool-card-list">
          {filteredTools.map((tool: any) => {
            const statusClass = String(tool.status || "Available")
              .trim()
              .toLowerCase()
              .replace(/\s+/g, "-");

            const profitValue = Number(tool.profit_total || 0);

            return (
              <article className="tool-result-card" key={tool.group_key}>
                {editingGroupKey === tool.group_key ? (
                  <>
                    <div className="tool-card-header">
                      <h3 className="tool-card-name">Edit {tool.tool_name}</h3>

                      <div className="tool-card-header-meta">
                        <span className="tool-qty-pill">
                          Qty {Number(tool.total_qty || 0)}
                        </span>
                      </div>

                      <div className="tool-card-actions">
                        <button
                          className="btn-green"
                          type="button"
                          onClick={() => saveEditGroup(tool)}
                        >
                          Save Changes
                        </button>

                        <button
                          className="btn-gray"
                          type="button"
                          onClick={() => {
                            setEditingGroupKey(null);
                            setEditRow({});
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>

                    <div className="tool-card-edit">
                      <div className="tool-card-edit-grid">
                        <div className="tool-card-edit-field">
                          <label>Tool Name</label>
                          <input
                            value={editRow.tool_name ?? ""}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                tool_name: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="tool-card-edit-field">
                          <label>Daily Rent</label>
                          <input
                            type="number"
                            value={editRow.daily_rent ?? ""}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                daily_rent: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="tool-card-edit-field">
                          <label>Purchase Cost</label>
                          <input
                            type="number"
                            value={editRow.purchase_cost ?? ""}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                purchase_cost: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="tool-card-edit-field">
                          <label>Category</label>
                          <input
                            value={editRow.category ?? ""}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                category: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="tool-card-edit-field">
                          <label>Brand</label>
                          <input
                            value={editRow.brand ?? ""}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                brand: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="tool-card-edit-field">
                          <label>Color</label>
                          <input
                            value={editRow.color ?? ""}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                color: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="tool-card-edit-field">
                          <label>Home Branch</label>
                          <select
                            value={editRow.home_branch || ""}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                home_branch: event.target.value,
                              })
                            }
                          >
                            <option value="">Keep Same</option>
                            {branches.map((branch) => (
                              <option key={branch}>{branch}</option>
                            ))}
                          </select>
                        </div>

                        <div className="tool-card-edit-field">
                          <label>Current Location</label>
                          <select
                            value={editRow.current_location || ""}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                current_location: event.target.value,
                              })
                            }
                          >
                            <option value="">Keep Same</option>
                            {[...branches, ...serviceCentres].map((location) => (
                              <option key={location}>{location}</option>
                            ))}
                          </select>
                        </div>

                        <div className="tool-card-edit-field">
                          <label>Status</label>
                          <select
                            value={editRow.status || "Available"}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                status: event.target.value,
                              })
                            }
                          >
                            {statuses.map((status) => (
                              <option key={status}>{status}</option>
                            ))}
                          </select>
                        </div>

                        <div className="tool-card-edit-field">
                          <label>Grease Due</label>
                          <input
                            type="number"
                            value={editRow.greasing_due_days ?? 0}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                greasing_due_days: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="tool-card-edit-field">
                          <label>Oil Due</label>
                          <input
                            type="number"
                            value={editRow.oil_change_due_days ?? 0}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                oil_change_due_days: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="tool-card-edit-field">
                          <label>Service Due</label>
                          <input
                            type="number"
                            value={editRow.scheduled_service_due_days ?? 0}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                scheduled_service_due_days: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="tool-card-edit-field">
                          <label>Rental Overdue</label>
                          <input
                            type="number"
                            value={editRow.rental_overdue_days ?? 0}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                rental_overdue_days: event.target.value,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(150px, 1fr))",
                          gap: 10,
                          marginTop: 14,
                        }}
                      >
                        <ToolSummaryCard
                          title="Earned"
                          value={`₹${Number(tool.earned_total || 0).toFixed(0)}`}
                        />
                        <ToolSummaryCard
                          title="Spent"
                          value={`₹${Number(tool.spent_total || 0).toFixed(0)}`}
                        />
                        <ToolSummaryCard
                          title="Profit"
                          value={`₹${profitValue.toFixed(0)}`}
                          danger={profitValue < 0}
                          success={profitValue >= 0}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="tool-card-header">
                      <h3 className="tool-card-name">{tool.tool_name}</h3>

                      <div className="tool-card-header-meta">
                        <span className="tool-qty-pill">
                          Qty {Number(tool.total_qty || 0)}
                        </span>

                        <span
                          className={`tool-status-pill tool-status-${statusClass}`}
                        >
                          {tool.status || "Available"}
                        </span>
                      </div>

                      <div className="tool-card-actions">
                        <button
                          className="btn-gray"
                          type="button"
                          onClick={() =>
                            setOpenDetailsKey(
                              openDetailsKey === tool.group_key
                                ? null
                                : tool.group_key
                            )
                          }
                        >
                          {openDetailsKey === tool.group_key
                            ? "Close Details"
                            : "Details"}
                        </button>

                        <button
                          className="btn-blue"
                          type="button"
                          onClick={() => startEditGroup(tool)}
                        >
                          Edit
                        </button>

                        <button
                          className="btn-red"
                          type="button"
                          onClick={() => handleDeleteGroup(tool)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="tool-card-body">
                      <section className="tool-info-section">
                        <div className="tool-info-title">Financial</div>
                        <div className="tool-info-grid">
                          <div className="tool-info-item">
                            <span className="tool-info-label">Daily Rent</span>
                            <span className="tool-info-value">
                              ₹{Number(tool.daily_rent || 0).toFixed(0)}
                            </span>
                          </div>

                          <div className="tool-info-item">
                            <span className="tool-info-label">Purchase</span>
                            <span className="tool-info-value">
                              ₹{Number(tool.purchase_cost || 0).toFixed(0)}
                            </span>
                          </div>

                          <div className="tool-info-item tool-money-earned">
                            <span className="tool-info-label">Earned</span>
                            <span className="tool-info-value">
                              ₹{Number(tool.earned_total || 0).toFixed(0)}
                            </span>
                          </div>

                          <div className="tool-info-item tool-money-spent">
                            <span className="tool-info-label">Spent</span>
                            <span className="tool-info-value">
                              ₹{Number(tool.spent_total || 0).toFixed(0)}
                            </span>
                          </div>

                          <div
                            className={`tool-info-item ${
                              profitValue >= 0
                                ? "tool-money-profit-positive"
                                : "tool-money-profit-negative"
                            }`}
                            style={{ gridColumn: "1 / -1" }}
                          >
                            <span className="tool-info-label">Profit</span>
                            <span className="tool-info-value">
                              ₹{profitValue.toFixed(0)}
                            </span>
                          </div>
                        </div>
                      </section>

                      <section className="tool-info-section">
                        <div className="tool-info-title">Description</div>
                        <div className="tool-info-grid">
                          <div className="tool-info-item">
                            <span className="tool-info-label">Category</span>
                            <span className="tool-info-value">
                              {tool.category || "-"}
                            </span>
                          </div>

                          <div className="tool-info-item">
                            <span className="tool-info-label">Brand</span>
                            <span className="tool-info-value">
                              {tool.brand || "-"}
                            </span>
                          </div>

                          <div
                            className="tool-info-item"
                            style={{ gridColumn: "1 / -1" }}
                          >
                            <span className="tool-info-label">Color</span>
                            <span className="tool-info-value">
                              {tool.color || "-"}
                            </span>
                          </div>
                        </div>
                      </section>

                      <section className="tool-info-section">
                        <div className="tool-info-title">Placement</div>
                        <div className="tool-info-grid">
                          <div className="tool-info-item">
                            <span className="tool-info-label">Home</span>
                            <span className="tool-info-value">
                              {renderLocationSummary(
                                tool.home_branch_summary
                              )}
                            </span>
                          </div>

                          <div className="tool-info-item">
                            <span className="tool-info-label">Location</span>
                            <span className="tool-info-value">
                              {renderLocationSummary(
                                tool.current_location_summary
                              )}
                            </span>
                          </div>
                        </div>
                      </section>

                      <section className="tool-info-section">
                        <div className="tool-info-title">Maintenance</div>
                        <div className="tool-info-grid">
                          <div className="tool-info-item">
                            <span className="tool-info-label">Grease</span>
                            <span className="tool-info-value">
                              {formatDueCell(tool.greasing_due_days)}
                            </span>
                          </div>

                          <div className="tool-info-item">
                            <span className="tool-info-label">Oil</span>
                            <span className="tool-info-value">
                              {formatDueCell(tool.oil_change_due_days)}
                            </span>
                          </div>

                          <div className="tool-info-item">
                            <span className="tool-info-label">Service</span>
                            <span className="tool-info-value">
                              {formatDueCell(
                                tool.scheduled_service_due_days
                              )}
                            </span>
                          </div>

                          <div className="tool-info-item">
                            <span className="tool-info-label">Overdue</span>
                            <span className="tool-info-value">
                              {formatDueCell(tool.rental_overdue_days)}
                            </span>
                          </div>
                        </div>
                      </section>
                    </div>
                  </>
                )}

                {openDetailsKey === tool.group_key && (
                  <div className="tool-details-panel">
                    <h4 className="tool-details-title">
                      Branch-wise Details: {tool.tool_name}
                    </h4>

                    <div className="tool-details-grid">
                      {(tool.grouped_items || []).map((item: any) => (
                        <div className="tool-detail-card" key={item.id}>
                          <div className="tool-detail-card-head">
                            <strong>{item.tool_name}</strong>
                            <span className="tool-qty-pill">
                              Qty {Number(item.total_qty || 0)}
                            </span>
                          </div>

                          {detailEditingId === item.id ? (
                            <>
                              <div className="tool-card-edit">
                                <div className="tool-card-edit-grid">
                                  <div className="tool-card-edit-field">
                                    <label>Qty</label>
                                    <input
                                      type="number"
                                      value={detailEditRow.total_qty ?? ""}
                                      onChange={(event) =>
                                        setDetailEditRow({
                                          ...detailEditRow,
                                          total_qty: event.target.value,
                                        })
                                      }
                                    />
                                  </div>

                                  <div className="tool-card-edit-field">
                                    <label>Purchase</label>
                                    <input
                                      type="number"
                                      value={detailEditRow.purchase_cost ?? 0}
                                      onChange={(event) =>
                                        setDetailEditRow({
                                          ...detailEditRow,
                                          purchase_cost: event.target.value,
                                        })
                                      }
                                    />
                                  </div>

                                  <div className="tool-card-edit-field">
                                    <label>Home Branch</label>
                                    <select
                                      value={detailEditRow.home_branch || ""}
                                      onChange={(event) =>
                                        setDetailEditRow({
                                          ...detailEditRow,
                                          home_branch: event.target.value,
                                        })
                                      }
                                    >
                                      <option value="">Select</option>
                                      {branches.map((branch) => (
                                        <option key={branch}>{branch}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="tool-card-edit-field">
                                    <label>Current Location</label>
                                    <select
                                      value={
                                        detailEditRow.current_location || ""
                                      }
                                      onChange={(event) =>
                                        setDetailEditRow({
                                          ...detailEditRow,
                                          current_location:
                                            event.target.value,
                                        })
                                      }
                                    >
                                      <option value="">Select</option>
                                      {[...branches, ...serviceCentres].map(
                                        (location) => (
                                          <option key={location}>
                                            {location}
                                          </option>
                                        )
                                      )}
                                    </select>
                                  </div>

                                  <div className="tool-card-edit-field">
                                    <label>Status</label>
                                    <select
                                      value={detailEditRow.status || ""}
                                      onChange={(event) =>
                                        setDetailEditRow({
                                          ...detailEditRow,
                                          status: event.target.value,
                                        })
                                      }
                                    >
                                      {statuses.map((status) => (
                                        <option key={status}>{status}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="tool-card-edit-field">
                                    <label>Grease</label>
                                    <input
                                      type="number"
                                      value={
                                        detailEditRow.greasing_due_days ?? 0
                                      }
                                      onChange={(event) =>
                                        setDetailEditRow({
                                          ...detailEditRow,
                                          greasing_due_days:
                                            event.target.value,
                                        })
                                      }
                                    />
                                  </div>

                                  <div className="tool-card-edit-field">
                                    <label>Oil</label>
                                    <input
                                      type="number"
                                      value={
                                        detailEditRow.oil_change_due_days ?? 0
                                      }
                                      onChange={(event) =>
                                        setDetailEditRow({
                                          ...detailEditRow,
                                          oil_change_due_days:
                                            event.target.value,
                                        })
                                      }
                                    />
                                  </div>

                                  <div className="tool-card-edit-field">
                                    <label>Service</label>
                                    <input
                                      type="number"
                                      value={
                                        detailEditRow.scheduled_service_due_days ??
                                        0
                                      }
                                      onChange={(event) =>
                                        setDetailEditRow({
                                          ...detailEditRow,
                                          scheduled_service_due_days:
                                            event.target.value,
                                        })
                                      }
                                    />
                                  </div>

                                  <div className="tool-card-edit-field">
                                    <label>Rental Overdue</label>
                                    <input
                                      type="number"
                                      value={
                                        detailEditRow.rental_overdue_days ?? 0
                                      }
                                      onChange={(event) =>
                                        setDetailEditRow({
                                          ...detailEditRow,
                                          rental_overdue_days:
                                            event.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="tool-detail-actions">
                                <button
                                  className="btn-green"
                                  type="button"
                                  onClick={saveDetailEdit}
                                >
                                  Save
                                </button>

                                <button
                                  className="btn-gray"
                                  type="button"
                                  onClick={() => {
                                    setDetailEditingId(null);
                                    setDetailEditRow({});
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="tool-detail-values">
                                <div className="tool-info-item">
                                  <span className="tool-info-label">
                                    Purchase
                                  </span>
                                  <span className="tool-info-value">
                                    ₹
                                    {Number(
                                      item.purchase_cost || 0
                                    ).toFixed(0)}
                                  </span>
                                </div>

                                <div className="tool-info-item">
                                  <span className="tool-info-label">
                                    Status
                                  </span>
                                  <span className="tool-info-value">
                                    {item.status || "-"}
                                  </span>
                                </div>

                                <div className="tool-info-item">
                                  <span className="tool-info-label">Home</span>
                                  <span className="tool-info-value">
                                    {item.home_branch || "-"}
                                  </span>
                                </div>

                                <div className="tool-info-item">
                                  <span className="tool-info-label">
                                    Location
                                  </span>
                                  <span className="tool-info-value">
                                    {item.current_location || "-"}
                                  </span>
                                </div>

                                <div className="tool-info-item">
                                  <span className="tool-info-label">
                                    Grease
                                  </span>
                                  <span className="tool-info-value">
                                    {formatDueCell(
                                      item.greasing_due_days
                                    )}
                                  </span>
                                </div>

                                <div className="tool-info-item">
                                  <span className="tool-info-label">Oil</span>
                                  <span className="tool-info-value">
                                    {formatDueCell(
                                      item.oil_change_due_days
                                    )}
                                  </span>
                                </div>

                                <div className="tool-info-item">
                                  <span className="tool-info-label">
                                    Service
                                  </span>
                                  <span className="tool-info-value">
                                    {formatDueCell(
                                      item.scheduled_service_due_days
                                    )}
                                  </span>
                                </div>

                                <div className="tool-info-item">
                                  <span className="tool-info-label">
                                    Overdue
                                  </span>
                                  <span className="tool-info-value">
                                    {formatDueCell(
                                      item.rental_overdue_days
                                    )}
                                  </span>
                                </div>
                              </div>

                              <div className="tool-detail-actions">
                                <button
                                  className="btn-blue"
                                  type="button"
                                  onClick={() => startDetailEdit(item)}
                                >
                                  Edit
                                </button>

                                <button
                                  className="btn-red"
                                  type="button"
                                  onClick={() =>
                                    handleDetailDelete(item.id)
                                  }
                                >
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}

          {filteredTools.length === 0 && (
            <div className="tool-empty-card">
              {!hasSearched
                ? "Enter a search above. No tools are loaded automatically."
                : searchLoading
                ? "Searching..."
                : "No matching tools found"}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <h2>Tool Search & Full Movement History</h2>

        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input
            placeholder="Search tool for movement history..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleHistoryOptionSearch();
              }
            }}
            style={{ width: 420 }}
          />

          <button
            className="btn-blue"
            type="button"
            onClick={() => void handleHistoryOptionSearch()}
            disabled={historyOptionsLoading || !historySearch.trim()}
          >
            {historyOptionsLoading ? "Searching..." : "Find Tool"}
          </button>

          <select
            value={historyToolId}
            onChange={(e) => handleHistorySearch(e.target.value)}
            style={{ width: 420 }}
            disabled={historyOptions.length === 0}
          >
            <option value="">
              {historyOptions.length === 0
                ? "Search first, then select tool"
                : "Select Tool"}
            </option>
            {historyOptions.map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.tool_name}
                {tool.current_location ? ` - ${tool.current_location}` : ""}
              </option>
            ))}
          </select>
        </div>

        {historyLoading && <strong>Loading history...</strong>}

        {historyTool && (
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              padding: 14,
              marginBottom: 14,
              fontWeight: 700,
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            <div>Tool: {historyTool.tool_name}</div>
            <div>Home Branch: {historyTool.home_branch || "-"}</div>
            <div>Current Location: {historyTool.current_location || "-"}</div>
            <div>Status: {historyTool.status || "-"}</div>
            <div>Total Service Cost: ₹{historyTool.total_service_cost || 0}</div>
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>From</th>
              <th>To</th>
              <th>Service Centre</th>
              <th>Complaint / Note</th>
              <th>Work Done</th>
              <th>Cost</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {toolHistory.map((row, index) => (
              <tr key={index}>
                <td>{row.date || "-"}</td>
                <td>{row.type || "-"}</td>
                <td>{row.from_location || "-"}</td>
                <td>{row.to_location || "-"}</td>
                <td>{row.service_centre || "-"}</td>
                <td>{row.note || "-"}</td>
                <td>{row.work_done || "-"}</td>
                <td>{row.cost ? `₹${row.cost}` : "-"}</td>
                <td>{row.status || "-"}</td>
              </tr>
            ))}

            {historyToolId && toolHistory.length === 0 && !historyLoading && (
              <tr>
                <td colSpan={9}>No movement history found</td>
              </tr>
            )}

            {!historyToolId && (
              <tr>
                <td colSpan={9}>Select a tool to see full history</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>Bulk Import Tools From Excel</h2>

        <p style={{ marginTop: 0 }}>
          Excel columns: Tool Name, Qty, Daily Rent, Purchase Cost, Category, Brand, Color,
          Home Branch, Current Location, Status, Greasing, Oil Change,
          Scheduled Service, Rental Overdue
        </p>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleExcelFile(e.target.files?.[0] || null)}
            style={{ maxWidth: 420 }}
          />

          <button
            className="btn-green"
            onClick={handleImportTools}
            disabled={loading || importRows.length === 0}
          >
            {loading ? "Importing..." : `Import ${importRows.length} Tools`}
          </button>

          {importFileName && <strong>{importFileName}</strong>}
        </div>
      </div>

      <div className="panel">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Add New Tools</h2>
            <p style={{ margin: "5px 0 0", color: "#64748b", fontWeight: 700 }}>
              The entry table stays hidden until you need to add tools.
            </p>
          </div>

          <button
            className={showAddTools ? "btn-gray" : "btn-blue"}
            type="button"
            onClick={() => setShowAddTools((current) => !current)}
          >
            {showAddTools ? "Close Add Tools" : "+ Add Tools"}
          </button>
        </div>

        {showAddTools && (
          <>
            <div style={{ marginTop: 16 }}>
              <button
                className="btn-gray"
                onClick={() =>
                  setRows([
                    ...rows,
                    ...Array.from({ length: 5 }, () => ({ ...emptyTool })),
                  ])
                }
              >
                + Add 5 Rows
              </button>

        <button
          className="btn-gray"
          style={{ marginLeft: 8 }}
          onClick={() =>
            setRows(Array.from({ length: 10 }, () => ({ ...emptyTool })))
          }
        >
          Clear Table
        </button>

        <button
          className="btn-blue"
          style={{ marginLeft: 8 }}
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Tools"}
        </button>

        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table className="tools-clean-table" style={{ minWidth: 1500, tableLayout: "fixed", width: "100%" }}>
            <thead>
              <tr>
                <th>No</th>
                <th>Tool Name</th>
                <th>Qty</th>
                <th>Daily Rent</th>
                <th>Purchase Cost</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Color</th>
                <th>Home Branch</th>
                <th>Current Location</th>
                <th>Status</th>
                <th>Greasing</th>
                <th>Oil Change</th>
                <th>Scheduled</th>
                <th>Rental Overdue</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>

                  <td>
                    <input
                      value={r.tool_name}
                      onChange={(e) =>
                        changeRow(i, "tool_name", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={r.total_qty}
                      onChange={(e) =>
                        changeRow(i, "total_qty", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={r.daily_rent}
                      onChange={(e) =>
                        changeRow(i, "daily_rent", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={r.purchase_cost}
                      onChange={(e) =>
                        changeRow(i, "purchase_cost", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      value={r.category}
                      onChange={(e) =>
                        changeRow(i, "category", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      value={r.brand}
                      onChange={(e) => changeRow(i, "brand", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      value={r.color}
                      onChange={(e) => changeRow(i, "color", e.target.value)}
                    />
                  </td>

                  <td>
                    <select
                      value={r.home_branch}
                      onChange={(e) =>
                        changeRow(i, "home_branch", e.target.value)
                      }
                    >
                      <option value="">Select</option>
                      {branches.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <select
                      value={r.current_location}
                      onChange={(e) =>
                        changeRow(i, "current_location", e.target.value)
                      }
                    >
                      <option value="">Select</option>
                      {branches.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <select
                      value={r.status}
                      onChange={(e) => changeRow(i, "status", e.target.value)}
                    >
                      {statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <input
                      type="number"
                      placeholder="Days"
                      value={r.greasing_due_days}
                      onChange={(e) =>
                        changeRow(i, "greasing_due_days", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      placeholder="Days"
                      value={r.oil_change_due_days}
                      onChange={(e) =>
                        changeRow(i, "oil_change_due_days", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      placeholder="Days"
                      value={r.scheduled_service_due_days}
                      onChange={(e) =>
                        changeRow(
                          i,
                          "scheduled_service_due_days",
                          e.target.value
                        )
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      placeholder="Days"
                      value={r.rental_overdue_days}
                      onChange={(e) =>
                        changeRow(i, "rental_overdue_days", e.target.value)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function ToolSummaryCard({ title, value, danger = false, success = false }: any) {
  return (
    <div
      style={{
        border: "2px solid #bfdbfe",
        background: danger ? "#fef2f2" : success ? "#f0fdf4" : "#eff6ff",
        borderRadius: 18,
        padding: "24px 22px",
        minHeight: 145,
        fontWeight: 1000,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
      }}
    >
      <div
        style={{
          fontSize: 24,
          lineHeight: 1.05,
          color: "#475569",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 50,
          lineHeight: 1.05,
          marginTop: 8,
          color: danger ? "#dc2626" : success ? "#16a34a" : "#0f2a5f",
        }}
      >
        {value}
      </div>
    </div>
  );
}
