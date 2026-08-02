"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  searchToolsForToolsPage,
  suggestToolsForToolsPage,
  saveTools,
  updateTool,
  deleteTool,
  getToolHistory,
  moveToolStockForRental,
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
const ALL_TOOLS_SEARCH_TOKEN = "__ALL_TOOLS__";

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
  padding: "6px 4px",
  fontWeight: 750,
  lineHeight: 1.2,
  fontSize: 13,
  textAlign: "center" as const,
  verticalAlign: "middle" as const,
};

const strongCellStyle = {
  padding: "6px 4px",
  fontWeight: 850,
  lineHeight: 1.2,
  fontSize: 13,
  textAlign: "center" as const,
  verticalAlign: "middle" as const,
};

const compactLocationCellStyle = {
  ...strongCellStyle,
  padding: "6px 3px",
  fontSize: 12,
  whiteSpace: "normal" as const,
  overflow: "visible" as const,
  lineHeight: 1.35,
};


const toolNameCellStyle = {
  ...strongCellStyle,
  textAlign: "left" as const,
  fontSize: 15,
  fontWeight: 950,
  minWidth: 0,
  maxWidth: "none",
  whiteSpace: "normal" as const,
};

const tableHeadStyle = {
  fontSize: 12,
  fontWeight: 900,
  textAlign: "center" as const,
  whiteSpace: "nowrap" as const,
};

const inputStyle = {
  fontSize: 13,
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
  const [toolTypeFilter, setToolTypeFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [homeBranchFilter, setHomeBranchFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [quickFilter, setQuickFilter] = useState("All");
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
  const [historyOptions, setHistoryOptions] = useState<any[]>([]);
  const [toolHistory, setToolHistory] = useState<any[]>([]);
  const [historyTool, setHistoryTool] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultLimited, setResultLimited] = useState(false);
  const [toolSuggestions, setToolSuggestions] = useState<any[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAddTools, setShowAddTools] = useState(false);
  const [transferGroup, setTransferGroup] = useState<any>(null);
  const [transferForm, setTransferForm] = useState({ sourceId: "", toShop: "", qty: 1, reason: "Manual stock transfer" });
  const [transferSaving, setTransferSaving] = useState(false);
  const categorySelectRef = useRef<HTMLSelectElement | null>(null);
  const searchRequestIdRef = useRef(0);
  const suggestionRequestIdRef = useRef(0);

  async function loadTools(value = search) {
    const term = String(value || "").trim();

    if (!term) {
      setTools([]);
      setRentals([]);
      setServiceRows([]);
      setHasSearched(false);
      setResultLimited(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    setSearchLoading(true);

    try {
      const res = await searchToolsForToolsPage(term, false);
      if (requestId !== searchRequestIdRef.current) return;

      setHasSearched(true);

      if (res.success) {
        const matchingTools = res.data || [];
        setTools(matchingTools);
        setRentals(res.rentals || []);
        setServiceRows(res.services || []);
        setHistoryOptions(matchingTools);
        setResultLimited(Boolean(res.limited));

        if (
          historyToolId &&
          !matchingTools.some(
            (tool: any) => String(tool.id || "") === String(historyToolId)
          )
        ) {
          setHistoryToolId("");
          setToolHistory([]);
          setHistoryTool(null);
        }
      } else {
        setTools([]);
        setRentals([]);
        setServiceRows([]);
        setResultLimited(false);
        showError(res.message || "Failed to search tools");
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setSearchLoading(false);
      }
    }
  }

  useEffect(() => {
    const term = search.trim();

    if (!term) {
      searchRequestIdRef.current += 1;
      setTools([]);
      setRentals([]);
      setServiceRows([]);
      setHasSearched(false);
      setSearchLoading(false);
      return;
    }

    const timer = window.setTimeout(() => {
      void loadTools(term);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const term = search.trim();

    if (!term) {
      suggestionRequestIdRef.current += 1;
      setToolSuggestions([]);
      setSuggestionLoading(false);
      setShowSuggestions(false);
      return;
    }

    setToolSuggestions([]);
    setSuggestionLoading(false);
    setShowSuggestions(false);
  }, [search]);

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

  function locationMatchesShop(value: any, shop: string) {
    if (shop === "All") return true;
    const text = String(value || "").trim().toLowerCase();
    const aliases: Record<string, string[]> = {
      Karuvannur: ["karuvannur", "kvr"],
      Ollur: ["ollur", "olr"],
      Kachery: ["kachery", "kch"],
      "Mulayam Rd": ["mulayam rd", "mulayam", "mly"],
      Pattikkad: ["pattikkad", "ptk"],
    };
    return (aliases[shop] || [shop.toLowerCase()]).some((alias) =>
      new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`, "i").test(text),
    );
  }

  function displayShopName(value: any) {
    return branches.find((branch) => locationMatchesShop(value, branch)) || String(value || "Not set");
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
      const selectedQty = items
        .filter((item) => {
          const value = field === "home_branch" ? item.home_branch : locationName(item);
          return locationMatchesShop(value, locationFilter);
        })
        .reduce((sum, item) => sum + Number(item.total_qty || 1), 0);
      if (selectedQty <= 0) return "-";
      return `${locationFilter}(${selectedQty})`;
    }

    return locations
      .map((loc) => {
        const qty = Number(dist[loc] || 0);
        return `${loc}(${qty})`;
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

  function shopStockForTool(tool: any, branch: string) {
    const items = tool?.grouped_items || [];
    const home = items
      .filter((item: any) => locationMatchesShop(item.home_branch, branch))
      .reduce((sum: number, item: any) => sum + Math.max(Number(item.total_qty || 1), 1), 0);
    const current = items
      .filter((item: any) => locationMatchesShop(locationName(item), branch))
      .reduce((sum: number, item: any) => sum + Math.max(Number(item.total_qty || 1), 1), 0);
    return { home, current };
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
        tool_type: items.some((item: any) => Number(item.total_qty || 1) > 1)
          ? "Quantity"
          : "Individual",
        service_due: items.some((item: any) =>
          toolDueValues(item).some((value) => value < 0)
        ),
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
    if (sortKey !== key) return " ↕";
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

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          groupedTools
            .map((tool: any) => String(tool.category || "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => String(a).localeCompare(String(b))),
    [groupedTools]
  );

  const filterCounts = useMemo(() => {
    const matchesStatus = (tool: any, status: string) =>
      (tool.grouped_items || []).some(
        (item: any) =>
          String(item.status || "Available").trim().toLowerCase() ===
          status.toLowerCase()
      );

    return {
      all: groupedTools.length,
      available: groupedTools.filter((tool: any) =>
        matchesStatus(tool, "Available")
      ).length,
      rented: groupedTools.filter((tool: any) => matchesStatus(tool, "Rented"))
        .length,
      service: groupedTools.filter((tool: any) =>
        matchesStatus(tool, "Service")
      ).length,
      missing: groupedTools.filter((tool: any) =>
        matchesStatus(tool, "Missing")
      ).length,
      serviceDue: groupedTools.filter((tool: any) => tool.service_due).length,
      categories: categoryOptions.length,
    };
  }, [groupedTools, categoryOptions]);

  const filteredTools = useMemo(() => {
    const matchesStatus = (tool: any, status: string) =>
      (tool.grouped_items || []).some(
        (item: any) =>
          String(item.status || "Available").trim().toLowerCase() ===
          status.toLowerCase()
      );

    const base = groupedTools.filter((tool: any) => {
      if (toolTypeFilter !== "All" && tool.tool_type !== toolTypeFilter) {
        return false;
      }

      if (
        categoryFilter !== "All" &&
        String(tool.category || "").trim() !== categoryFilter
      ) {
        return false;
      }

      if (
        homeBranchFilter !== "All" &&
        !(tool.grouped_items || []).some(
          (item: any) => item.home_branch === homeBranchFilter
        )
      ) {
        return false;
      }

      if (
        locationFilter !== "All" &&
        !(tool.grouped_items || []).some((item: any) => {
          return (
            locationMatchesShop(item.current_location, locationFilter) ||
            locationMatchesShop(item.service_centre, locationFilter) ||
            locationMatchesShop(item.physical_location, locationFilter) ||
            locationMatchesShop(item.display_location, locationFilter)
          );
        })
      ) {
        return false;
      }

      if (statusFilter !== "All" && !matchesStatus(tool, statusFilter)) {
        return false;
      }

      if (quickFilter === "Service Due" && !tool.service_due) return false;
      if (
        ["Available", "Rented", "Service", "Missing"].includes(quickFilter) &&
        !matchesStatus(tool, quickFilter)
      ) {
        return false;
      }

      return true;
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
  }, [
    groupedTools,
    toolTypeFilter,
    categoryFilter,
    homeBranchFilter,
    locationFilter,
    statusFilter,
    quickFilter,
    sortKey,
    sortDirection,
  ]);

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
      showWarning("Start typing a tool name or click All Tools");
      return;
    }

    // The Search button always performs a broad search. Suggestions remain
    // optional shortcuts for opening one exact saved tool name.
    await loadTools(term);
  }

  async function showAllTools() {
    setSearch("");
    setToolTypeFilter("All");
    setCategoryFilter("All");
    setHomeBranchFilter("All");
    setLocationFilter("All");
    setStatusFilter("All");
    setQuickFilter("All");
    await loadTools(ALL_TOOLS_SEARCH_TOKEN);
  }

  function clearSearch() {
    searchRequestIdRef.current += 1;
    setSearch("");
    setTools([]);
    setRentals([]);
    setServiceRows([]);
    setHistoryOptions([]);
    setHistoryToolId("");
    setToolHistory([]);
    setHistoryTool(null);
    setHasSearched(false);
    setResultLimited(false);
    setToolTypeFilter("All");
    setCategoryFilter("All");
    setHomeBranchFilter("All");
    setLocationFilter("All");
    setStatusFilter("All");
    setQuickFilter("All");
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

    const original = tools.find((row: any) => Number(row.id) === Number(detailEditingId));
    const qtyChanged = Number(original?.total_qty || 0) !== Number(detailEditRow.total_qty || 0);
    const locationChanged = String(original?.current_location || "") !== String(detailEditRow.current_location || "");
    let changeReason = "";
    if (qtyChanged || locationChanged) {
      changeReason = window.prompt(
        qtyChanged
          ? `Quantity will change from ${Number(original?.total_qty || 0)} to ${Number(detailEditRow.total_qty || 0)}. Enter the reason:`
          : `Location will change from ${original?.current_location || "Not set"} to ${detailEditRow.current_location || "Not set"}. Enter the reason:`,
        qtyChanged ? "Physical stock correction" : "Tool transfer",
      )?.trim() || "";
      if (!changeReason) {
        showWarning("A reason is required. Nothing was changed.");
        return;
      }
      if (!window.confirm("Save this change? Existing rentals and all other quantities will remain unchanged.")) return;
    }

    const res = await updateTool(detailEditingId, rowForSave({ ...detailEditRow, _change_reason: changeReason }));

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

  function openTransfer(tool: any, preferredSourceId?: number) {
    const source = (tool.grouped_items || []).find((item: any) => Number(item.id) === Number(preferredSourceId)) ||
      (tool.grouped_items || []).find((item: any) => Number(item.total_qty || 0) > 0) || tool.grouped_items?.[0];
    setTransferGroup(tool);
    setTransferForm({
      sourceId: String(source?.id || ""),
      toShop: branches.find((branch) => branch !== source?.current_location) || "",
      qty: 1,
      reason: "Manual stock transfer",
    });
  }

  async function saveTransfer() {
    const source = transferGroup?.grouped_items?.find((item: any) => String(item.id) === transferForm.sourceId);
    if (!source || !transferForm.toShop) return showWarning("Select the From shop and To shop");
    const fromShop = displayShopName(source.current_location || source.home_branch || "");
    const qty = Math.max(Number(transferForm.qty || 0), 0);
    const available = Math.max(Number(source.total_qty || 0), 0);
    if (!qty) return showWarning("Enter the quantity to move");
    if (qty > available) return showWarning(`${fromShop} has only ${available}`);
    if (fromShop === transferForm.toShop) return showWarning("From shop and To shop cannot be the same");
    if (!transferForm.reason.trim()) return showWarning("Enter the movement reason");

    setTransferSaving(true);
    const result = await moveToolStockForRental(Number(source.id), transferForm.toShop, qty, transferForm.reason.trim());
    setTransferSaving(false);
    if (!result.success) return showError(result.message || "Transfer failed");
    showSuccess(`${qty} ${transferGroup.tool_name} moved from ${fromShop} to ${transferForm.toShop}`);
    setTransferGroup(null);
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
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 12px 30px rgba(15, 42, 95, 0.08);
        }

        .tools-clean-table {
          width: 100%;
          max-width: 100%;
          table-layout: fixed;
          border-collapse: separate;
          border-spacing: 0;
        }

        .tools-clean-table th,
        .tools-clean-table td {
          min-width: 0;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .tools-main-table .tools-column-head th {
          top: 0;
          padding: 7px 3px;
          font-size: 11px;
          line-height: 1.15;
          white-space: normal;
        }

        .tools-main-table th:nth-child(1) { width: 14%; }
        .tools-main-table th:nth-child(2) { width: 6%; }
        .tools-main-table th:nth-child(3),
        .tools-main-table th:nth-child(4),
        .tools-main-table th:nth-child(5),
        .tools-main-table th:nth-child(6),
        .tools-main-table th:nth-child(7) { width: 6%; }
        .tools-main-table th:nth-child(8) { width: 11%; }
        .tools-main-table th:nth-child(9) { width: 7%; }
        .tools-main-table th:nth-child(10) { width: 10%; }
        .tools-main-table th:nth-child(11) { width: 22%; }

        .tools-main-table td {
          padding: 6px 3px !important;
          font-size: 12px !important;
          line-height: 1.18 !important;
          white-space: normal !important;
        }

        .tools-main-table .tool-name-cell {
          min-width: 0 !important;
          max-width: none !important;
          font-size: 14px !important;
          color: #ffffff !important;
          text-shadow: 0 1px 1px rgba(0,0,0,.18) !important;
        }

        .tools-main-table .tool-color-0 { background:#4f6bed !important; }
        .tools-main-table .tool-color-1 { background:#2ea7d7 !important; }
        .tools-main-table .tool-color-2 { background:#42c174 !important; }
        .tools-main-table .tool-color-3 { background:#f5c338 !important; color:#28323f !important; text-shadow:none !important; }
        .tools-main-table .tool-color-4 { background:#f68a2e !important; }
        .tools-main-table .tool-color-5 { background:#e84b55 !important; }
        .tools-main-table .tool-name-cell .tool-compact-meta { color:inherit !important; opacity:.86; }

        .tools-main-table input,
        .tools-main-table select,
        .tools-detail-table input,
        .tools-detail-table select {
          width: 100% !important;
          min-width: 0 !important;
          min-height: 30px !important;
          padding: 3px 2px !important;
          font-size: 12px !important;
        }

        .tools-main-table .tool-status-pill {
          width: 100%;
          min-width: 0;
          padding: 4px 2px;
          font-size: 11px;
          line-height: 1.1;
          white-space: normal;
        }

        .tools-main-table .tools-action-row {
          gap: 4px !important;
        }

        .tools-main-table .tools-action-row button,
        .tools-detail-table button {
          flex: 1 1 42px;
          min-width: 0;
          min-height: 29px;
          padding: 4px 5px !important;
          font-size: 11px;
          white-space: normal;
        }

        .tool-stack {
          display: grid;
          gap: 5px;
          text-align: left;
        }

        .tool-stack-line {
          display: flex;
          justify-content: space-between;
          gap: 7px;
          padding-bottom: 3px;
          border-bottom: 1px dashed #dbe5f2;
        }

        .tool-stack-line:last-child { border-bottom: 0; padding-bottom: 0; }
        .tool-stack-label { color: #64748b; font-size: 10px; font-weight: 850; }
        .tool-stack-value { color: #102f67; font-weight: 950; text-align: right; }
        .tool-stack.compact-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap:4px; }
        .tool-stack.compact-grid .tool-stack-line { display:grid; gap:1px; padding:3px; border:0; border-radius:5px; background:#f8fafc; }
        .tool-stack.compact-grid .tool-stack-value { text-align:left; }

        .shop-matrix-cell { padding: 5px 2px !important; }
        .shop-current { display:block; font-size:16px; font-weight:1000; color:#0b4aa2; }
        .shop-home { display:block; margin-top:2px; font-size:10px; font-weight:850; color:#64748b; }
        .tool-compact-meta { margin-top:4px; color:#52647f; font-size:11px; font-weight:800; }

        .tools-detail-table,
        .tools-history-table {
          width: 100%;
          max-width: 100%;
          table-layout: fixed;
        }

        .tools-detail-table th,
        .tools-detail-table td,
        .tools-history-table th,
        .tools-history-table td {
          padding: 6px 4px !important;
          font-size: 12px !important;
          line-height: 1.2;
          white-space: normal;
          overflow-wrap: anywhere;
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
          top: 0;
          z-index: 4;
          padding: 12px 8px;
          background: #e8f1ff;
          color: #102f67;
          box-shadow: inset 0 -2px 0 #8fb5ed;
        }

        .tools-main-table .tools-column-head th { color:#ffffff !important; box-shadow:none !important; }
        .tools-main-table .tools-column-head th:nth-child(1) { background:#4f6bed !important; }
        .tools-main-table .tools-column-head th:nth-child(2) { background:#2ea7d7 !important; }
        .tools-main-table .tools-column-head th:nth-child(3) { background:#4f6bed !important; }
        .tools-main-table .tools-column-head th:nth-child(4) { background:#2ea7d7 !important; }
        .tools-main-table .tools-column-head th:nth-child(5) { background:#42c174 !important; }
        .tools-main-table .tools-column-head th:nth-child(6) { background:#f5c338 !important; color:#28323f !important; }
        .tools-main-table .tools-column-head th:nth-child(7) { background:#f68a2e !important; }
        .tools-main-table .tools-column-head th:nth-child(8) { background:#7c5ce5 !important; }
        .tools-main-table .tools-column-head th:nth-child(9) { background:#42c174 !important; }
        .tools-main-table .tools-column-head th:nth-child(10) { background:#f5c338 !important; color:#28323f !important; }
        .tools-main-table .tools-column-head th:nth-child(11) { background:#e84b55 !important; }
        .tools-main-table .tools-column-head .tools-sort-button { color:inherit !important; }

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

        .tools-sort-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .tools-sort-button:hover {
          color: #0057ff !important;
        }

        .tool-detail-row > td {
          border-top: 2px solid #8fb5ed;
          border-bottom: 2px solid #8fb5ed !important;
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

        .tools-search-panel {
          margin-bottom: 18px;
          padding: 18px;
          border: 2px solid #8eb9ea;
          border-radius: 16px;
          background: linear-gradient(180deg, #eaf4ff 0%, #dcecff 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
        }

        .tools-search-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 14px;
        }

        .tools-search-title-row h2 {
          margin: 0;
          color: #123a73;
          font-size: 24px;
          font-weight: 1000;
        }

        .tools-search-version {
          margin-top: 4px;
          color: #315b8f;
          font-size: 13px;
          font-weight: 950;
          letter-spacing: 0.35px;
        }

        .tools-filter-cards {
          display: grid;
          grid-template-columns: repeat(7, minmax(110px, 1fr));
          gap: 9px;
          margin-bottom: 14px;
        }

        .tools-filter-card {
          min-height: 70px;
          padding: 9px 10px;
          border: 1px solid #8fb5df;
          border-radius: 11px;
          background: #ffffff;
          color: #173d75;
          cursor: pointer;
          text-align: left;
        }

        .tools-filter-card.active {
          border-color: #1d5db5;
          background: #e8f2ff;
          box-shadow: inset 0 0 0 1px #1d5db5;
        }

        .tools-filter-card-label {
          display: block;
          font-size: 13px;
          font-weight: 950;
          text-transform: uppercase;
        }

        .tools-filter-card-value {
          display: block;
          margin-top: 4px;
          font-size: 24px;
          font-weight: 1000;
          line-height: 1;
        }

        .tools-search-main-row {
          display: grid;
          grid-template-columns: minmax(320px, 1fr) auto;
          gap: 12px;
          align-items: start;
          margin-bottom: 12px;
        }

        .tools-search-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .tools-search-actions button {
          min-height: 46px;
          padding: 9px 14px !important;
          font-weight: 950 !important;
          white-space: nowrap;
        }

        .tool-live-search-wrap {
          width: 100%;
        }

        .tool-live-search-wrap > input,
        .tools-unified-filter-grid select {
          border: 2px solid #8aaed8 !important;
          background: #ffffff !important;
          color: #102f67 !important;
          box-shadow: 0 2px 6px rgba(15, 47, 103, 0.06);
        }

        .tool-live-suggestions {
          position: absolute;
          top: 52px;
          left: 0;
          right: 0;
          z-index: 80;
          max-height: 430px;
          overflow-y: auto;
          border: 2px solid #4f83c5;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 18px 42px rgba(15, 42, 95, 0.22);
        }

        .tool-live-suggestions-head {
          position: sticky;
          top: 0;
          z-index: 2;
          display: grid;
          grid-template-columns: minmax(220px, 1.7fr) 90px 150px minmax(170px, 1fr);
          gap: 10px;
          padding: 10px 12px;
          border-bottom: 1px solid #b8cce6;
          background: #dcecff;
          color: #123a73;
          font-size: 13px;
          font-weight: 1000;
          text-transform: uppercase;
        }

        .tool-live-suggestion-row {
          display: grid;
          grid-template-columns: minmax(220px, 1.7fr) 90px 150px minmax(170px, 1fr);
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          border: 0;
          border-bottom: 1px solid #e1eaf5;
          background: #ffffff;
          color: #17233b;
          text-align: left;
          cursor: pointer;
        }

        .tool-live-suggestion-row:hover,
        .tool-live-suggestion-row:focus-visible {
          background: #edf6ff;
          outline: none;
        }

        .tool-live-suggestion-row strong {
          color: #123a73;
          font-size: 16px;
          font-weight: 1000;
        }

        .tool-live-suggestion-row span {
          align-self: center;
          font-size: 14px;
          font-weight: 800;
        }

        .tool-live-suggestions-empty {
          padding: 16px;
          color: #52647f;
          font-weight: 850;
        }

        .tools-summary-strip {
          display: grid;
          grid-template-columns: repeat(6, minmax(120px, 1fr));
          overflow: hidden;
          margin-top: 12px;
          border: 1px solid #9dbce0;
          border-radius: 11px;
          background: #ffffff;
        }

        .tools-summary-item {
          padding: 10px 12px;
          border-right: 1px solid #cbdcf0;
        }

        .tools-summary-item:last-child {
          border-right: 0;
        }

        .tools-summary-label {
          display: block;
          color: #60718a;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
        }

        .tools-summary-value {
          display: block;
          margin-top: 3px;
          color: #0d3670;
          font-size: 21px;
          font-weight: 1000;
        }

        .tools-summary-value.positive { color: #0b8848; }
        .tools-summary-value.negative { color: #b42318; }

        .tools-unified-filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 10px;
          width: 100%;
          margin-top: 12px;
        }

        .tools-unified-filter-grid select {
          width: 100%;
          min-height: 44px;
          font-size: 15px;
          font-weight: 800;
        }

        .tools-history-section {
          margin-top: 20px;
          padding-top: 18px;
          border-top: 2px solid #cbd5e1;
        }

        .tools-history-table-wrap {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }

        @media (max-width: 1200px) {
          .tools-filter-cards {
            grid-template-columns: repeat(4, minmax(120px, 1fr));
          }

          .tools-search-main-row {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .tools-search-panel { padding: 12px; }
          .tools-filter-cards { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
          .tools-search-actions button { flex: 1 1 140px; }
          .tools-summary-strip { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
          .tools-summary-item { border-bottom: 1px solid #cbdcf0; }
          .tool-live-suggestions-head,
          .tool-live-suggestion-row {
            grid-template-columns: minmax(180px, 1fr) 70px;
          }
          .tool-live-suggestions-head span:nth-child(n+3),
          .tool-live-suggestion-row span:nth-child(n+3) { display: none; }
        }
      `}</style>
      <h1>Tools</h1>

      {transferGroup && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15,23,42,.58)", display: "grid", placeItems: "center", padding: 20 }}>
          <div style={{ width: "min(620px, 96vw)", background: "white", borderRadius: 16, padding: 22, boxShadow: "0 24px 70px rgba(0,0,0,.28)" }}>
            <h2 style={{ margin: 0, color: "#123b73" }}>Move Tool / Quantity Equipment</h2>
            <p style={{ fontWeight: 900, fontSize: 18 }}>{transferGroup.tool_name}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label style={{ fontWeight: 850 }}>From shop
                <select value={transferForm.sourceId} onChange={(e) => setTransferForm({ ...transferForm, sourceId: e.target.value })} style={{ width: "100%", minHeight: 44 }}>
                  {(transferGroup.grouped_items || []).filter((item: any) => Number(item.total_qty || 0) > 0).map((item: any) => (
                    <option key={item.id} value={item.id}>{displayShopName(item.current_location || item.home_branch)} — Available {Number(item.total_qty || 0)}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontWeight: 850 }}>To shop
                <select value={transferForm.toShop} onChange={(e) => setTransferForm({ ...transferForm, toShop: e.target.value })} style={{ width: "100%", minHeight: 44 }}>
                  <option value="">Select shop</option>
                  {branches.map((branch) => <option key={branch}>{branch}</option>)}
                </select>
              </label>
              <label style={{ fontWeight: 850 }}>Quantity to move
                <input type="number" min={1} value={transferForm.qty} onChange={(e) => setTransferForm({ ...transferForm, qty: Number(e.target.value) })} style={{ width: "100%", minHeight: 44 }} />
              </label>
              <label style={{ fontWeight: 850 }}>Reason
                <input value={transferForm.reason} onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })} style={{ width: "100%", minHeight: 44 }} />
              </label>
            </div>
            <div style={{ marginTop: 14, padding: 12, background: "#eff6ff", borderRadius: 10, fontWeight: 800 }}>
              This reduces the From-shop quantity and adds the same quantity to the To shop. The overall total will not change.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button className="btn-gray" type="button" onClick={() => setTransferGroup(null)} disabled={transferSaving}>Cancel</button>
              <button className="btn-green" type="button" onClick={() => void saveTransfer()} disabled={transferSaving}>{transferSaving ? "Moving..." : "Confirm Movement"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="tools-search-panel">
          <div className="tools-search-title-row">
            <div>
              <h2>Find Tools</h2>
            </div>
          </div>

        <div className="tools-search-main-row">
          <div className="tool-live-search-wrap">
            <input
              placeholder="Search tool name or tool number..."
              value={search}
              autoComplete="off"
              onChange={(e) => setSearch(e.target.value)}
              style={{ minHeight: 48, fontSize: 17, fontWeight: 850 }}
            />
          </div>

          <div className="tools-search-actions">
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              aria-label="Filter tools by shop"
              style={{ minHeight: 48, minWidth: 210, fontSize: 16, fontWeight: 850 }}
            >
              <option value="All">All Shops</option>
              {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
            </select>
            <button type="button" onClick={clearSearch} disabled={!search && locationFilter === "All"}>
              Clear
            </button>
          </div>
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
            ? "Enter a search or click Show All Tools."
            : searchLoading
            ? "Searching all saved tool rows..."
            : `${filteredTools.length} grouped tool item(s) shown from ${tools.length} matching saved row(s).`}
        </div>

        <div className="tools-summary-strip">
          <div className="tools-summary-item"><span className="tools-summary-label">Tool Items</span><span className="tools-summary-value">{toolSummary.tools}</span></div>
          <div className="tools-summary-item"><span className="tools-summary-label">Qty</span><span className="tools-summary-value">{toolSummary.qty}</span></div>
          <div className="tools-summary-item"><span className="tools-summary-label">Purchase</span><span className="tools-summary-value">₹{toolSummary.purchase.toFixed(0)}</span></div>
          <div className="tools-summary-item"><span className="tools-summary-label">Earned</span><span className="tools-summary-value positive">₹{toolSummary.earned.toFixed(0)}</span></div>
          <div className="tools-summary-item"><span className="tools-summary-label">Spent</span><span className="tools-summary-value negative">₹{toolSummary.spent.toFixed(0)}</span></div>
          <div className="tools-summary-item"><span className="tools-summary-label">Profit</span><span className={`tools-summary-value ${toolSummary.profit < 0 ? "negative" : "positive"}`}>₹{toolSummary.profit.toFixed(0)}</span></div>
        </div>
        </div>

        <div className="tools-results-shell">
          <table className="tools-clean-table tools-main-table">
            <thead>
              <tr className="tools-column-head">
                <th>{sortableHeader("Tool Name", "tool_name", { textAlign: "left" })}</th>
                <th>{sortableHeader("Stock & Rent", "total_qty", {})}</th>
                <th>Karuvannur</th>
                <th>Ollur</th>
                <th>Kachery</th>
                <th>Mulayam Rd</th>
                <th>Pattikkad</th>
                <th>{sortableHeader("Money", "profit_total", {})}</th>
                <th>{sortableHeader("Status", "status", {})}</th>
                <th>{sortableHeader("Maintenance", "scheduled_service_due_days", {})}</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredTools.map((tool: any, toolIndex: number) => {
                const statusClass = String(tool.status || "Available")
                  .trim()
                  .toLowerCase()
                  .replace(/\s+/g, "-");
                const profitValue = Number(tool.profit_total || 0);
                const isEditing = editingGroupKey === tool.group_key;

                return (
                  <React.Fragment key={tool.group_key}>
                    <tr className="tool-result-row">
                      <td
                        className={`tool-name-cell tool-color-${toolIndex % 6}`}
                        style={{
                          ...toolNameDueStyle(tool),
                          minWidth: 0,
                          maxWidth: "none",
                          fontSize: 14,
                        }}
                      >
                        {isEditing ? (
                          <div className="tool-stack">
                            <input value={editRow.tool_name ?? ""} onChange={(e) => setEditRow({ ...editRow, tool_name: e.target.value })} style={{ width: "100%", textAlign: "left" }} />
                            <input value={editRow.category ?? ""} placeholder="Category" onChange={(e) => setEditRow({ ...editRow, category: e.target.value })} />
                            <input value={editRow.brand ?? ""} placeholder="Brand" onChange={(e) => setEditRow({ ...editRow, brand: e.target.value })} />
                            <input value={editRow.color ?? ""} placeholder="Color" onChange={(e) => setEditRow({ ...editRow, color: e.target.value })} />
                          </div>
                        ) : (
                          <>
                            <div>{tool.tool_name}</div>
                            <div className="tool-compact-meta">{tool.category || "-"} · {tool.brand || "-"} · {tool.color || "-"}</div>
                          </>
                        )}
                      </td>
                      <td style={cellStyle}>
                        <div className="tool-stack compact-grid">
                          <div className="tool-stack-line"><span className="tool-stack-label">QTY</span><span className="tool-stack-value">{Number(tool.total_qty || 0)}</span></div>
                          <div className="tool-stack-line"><span className="tool-stack-label">RENT</span><span className="tool-stack-value">{isEditing ? <input type="number" value={editRow.daily_rent ?? 0} onChange={(e) => setEditRow({ ...editRow, daily_rent: e.target.value })} /> : `₹${Number(tool.daily_rent || 0).toFixed(0)}`}</span></div>
                        </div>
                      </td>
                      {branches.map((branch) => {
                        const stock = shopStockForTool(tool, branch);
                        return (
                          <td key={branch} className="shop-matrix-cell">
                            <span className="shop-current">{stock.current}</span>
                            <span className="shop-home">Home {stock.home}</span>
                          </td>
                        );
                      })}
                      <td style={cellStyle}>
                        <div className="tool-stack compact-grid">
                          <div className="tool-stack-line"><span className="tool-stack-label">PURCHASE</span><span className="tool-stack-value">{isEditing ? <input type="number" value={editRow.purchase_cost ?? 0} onChange={(e) => setEditRow({ ...editRow, purchase_cost: e.target.value })} /> : `₹${Number(tool.purchase_cost || 0).toFixed(0)}`}</span></div>
                          <div className="tool-stack-line"><span className="tool-stack-label">EARNED</span><span className="tool-stack-value" style={{ color: "#08783e" }}>₹{Number(tool.earned_total || 0).toFixed(0)}</span></div>
                          <div className="tool-stack-line"><span className="tool-stack-label">SPENT</span><span className="tool-stack-value" style={{ color: "#b42318" }}>₹{Number(tool.spent_total || 0).toFixed(0)}</span></div>
                          <div className="tool-stack-line"><span className="tool-stack-label">PROFIT</span><span className="tool-stack-value" style={{ color: profitValue < 0 ? "#b42318" : "#08783e" }}>₹{profitValue.toFixed(0)}</span></div>
                        </div>
                      </td>
                      <td style={cellStyle}>
                        <span className={`tool-status-pill tool-status-${statusClass}`}>{tool.status || "Available"}</span>
                      </td>
                      <td style={cellStyle}>
                        <div className="tool-stack">
                          <div className="tool-stack-line"><span className="tool-stack-label">GREASE</span><span className="tool-stack-value">{isEditing ? <input type="number" value={editRow.greasing_due_days ?? 0} onChange={(e) => setEditRow({ ...editRow, greasing_due_days: e.target.value })} /> : formatDueCell(tool.greasing_due_days)}</span></div>
                          <div className="tool-stack-line"><span className="tool-stack-label">OIL</span><span className="tool-stack-value">{isEditing ? <input type="number" value={editRow.oil_change_due_days ?? 0} onChange={(e) => setEditRow({ ...editRow, oil_change_due_days: e.target.value })} /> : formatDueCell(tool.oil_change_due_days)}</span></div>
                          <div className="tool-stack-line"><span className="tool-stack-label">SERVICE</span><span className="tool-stack-value">{isEditing ? <input type="number" value={editRow.scheduled_service_due_days ?? 0} onChange={(e) => setEditRow({ ...editRow, scheduled_service_due_days: e.target.value })} /> : formatDueCell(tool.scheduled_service_due_days)}</span></div>
                          <div className="tool-stack-line"><span className="tool-stack-label">OVERDUE</span><span className="tool-stack-value">{isEditing ? <input type="number" value={editRow.rental_overdue_days ?? 0} onChange={(e) => setEditRow({ ...editRow, rental_overdue_days: e.target.value })} /> : formatDueCell(tool.rental_overdue_days)}</span></div>
                        </div>
                      </td>
                      <td style={cellStyle}>
                        <div className="tools-action-row" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
                          {isEditing ? (
                            <>
                              <button className="btn-green" type="button" onClick={() => saveEditGroup(tool)}>Save</button>
                              <button className="btn-gray" type="button" onClick={() => { setEditingGroupKey(null); setEditRow({}); }}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button className="btn-gray" type="button" onClick={() => setOpenDetailsKey(openDetailsKey === tool.group_key ? null : tool.group_key)}>
                                {openDetailsKey === tool.group_key
                                  ? "Close"
                                  : tool.tool_type === "Quantity"
                                  ? "▦ Qty & Locations"
                                  : (tool.grouped_items || []).length > 1
                                  ? "▦ Numbers & Locations"
                                  : "▦ Details"}
                              </button>
                              <button className="btn-blue" type="button" onClick={() => startEditGroup(tool)}>✎ Edit</button>
                              <button className="btn-green" type="button" onClick={() => openTransfer(tool)}>⇄ Move</button>
                              <button
                                className="btn-gray"
                                type="button"
                                onClick={() => {
                                  const firstId = tool.grouped_items?.[0]?.id;
                                  if (firstId) void handleHistorySearch(String(firstId));
                                  window.setTimeout(() => document.querySelector(".tools-history-section")?.scrollIntoView({ behavior: "smooth" }), 100);
                                }}
                              >
                                ◷ History
                              </button>
                              <button className="btn-red" type="button" onClick={() => handleDeleteGroup(tool)}>⌫ Delete</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {openDetailsKey === tool.group_key && (
                      <tr className="tool-detail-row">
                        <td colSpan={11} style={{ padding: 14, background: "#eef6ff" }}>
                          <div style={{ marginBottom: 10, textAlign: "left", fontSize: 17, fontWeight: 950, color: "#173d75" }}>
                            Branch-wise Details: {tool.tool_name}
                          </div>
                          <div className="tools-results-shell" style={{ boxShadow: "none" }}>
                            <table className="tools-clean-table tools-detail-table">
                              <thead>
                                <tr className="tools-column-head">
                                  <th>Tool Row</th><th>Qty</th><th>Purchase</th><th>Home</th><th>Current</th><th>Status</th><th>Grease</th><th>Oil</th><th>Service</th><th>Overdue</th><th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(tool.grouped_items || []).map((item: any) => {
                                  const editingDetail = detailEditingId === item.id;
                                  return (
                                    <tr key={item.id}>
                                      <td style={{ ...cellStyle, textAlign: "left", fontWeight: 900 }}>
                                        {item.tool_name}{item.tool_number || item.tool_no || item.number ? ` · No. ${item.tool_number || item.tool_no || item.number}` : ""}
                                      </td>
                                      <td style={cellStyle}>{editingDetail ? <input type="number" value={detailEditRow.total_qty ?? 0} onChange={(e) => setDetailEditRow({ ...detailEditRow, total_qty: e.target.value })} style={{ width: 70 }} /> : Number(item.total_qty || 0)}</td>
                                      <td style={cellStyle}>{editingDetail ? <input type="number" value={detailEditRow.purchase_cost ?? 0} onChange={(e) => setDetailEditRow({ ...detailEditRow, purchase_cost: e.target.value })} style={{ width: 90 }} /> : `₹${Number(item.purchase_cost || 0).toFixed(0)}`}</td>
                                      <td style={cellStyle}>{editingDetail ? <select value={detailEditRow.home_branch || ""} onChange={(e) => setDetailEditRow({ ...detailEditRow, home_branch: e.target.value })}>{branches.map((branch) => <option key={branch}>{branch}</option>)}</select> : item.home_branch || "-"}</td>
                                      <td style={cellStyle}>{editingDetail ? <select value={detailEditRow.current_location || ""} onChange={(e) => setDetailEditRow({ ...detailEditRow, current_location: e.target.value })}>{[...branches, ...serviceCentres].map((location) => <option key={location}>{location}</option>)}</select> : item.current_location || "-"}</td>
                                      <td style={cellStyle}>{editingDetail ? <select value={detailEditRow.status || "Available"} onChange={(e) => setDetailEditRow({ ...detailEditRow, status: e.target.value })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select> : item.status || "-"}</td>
                                      <td style={cellStyle}>{editingDetail ? <input type="number" value={detailEditRow.greasing_due_days ?? 0} onChange={(e) => setDetailEditRow({ ...detailEditRow, greasing_due_days: e.target.value })} style={{ width: 70 }} /> : formatDueCell(item.greasing_due_days)}</td>
                                      <td style={cellStyle}>{editingDetail ? <input type="number" value={detailEditRow.oil_change_due_days ?? 0} onChange={(e) => setDetailEditRow({ ...detailEditRow, oil_change_due_days: e.target.value })} style={{ width: 70 }} /> : formatDueCell(item.oil_change_due_days)}</td>
                                      <td style={cellStyle}>{editingDetail ? <input type="number" value={detailEditRow.scheduled_service_due_days ?? 0} onChange={(e) => setDetailEditRow({ ...detailEditRow, scheduled_service_due_days: e.target.value })} style={{ width: 70 }} /> : formatDueCell(item.scheduled_service_due_days)}</td>
                                      <td style={cellStyle}>{editingDetail ? <input type="number" value={detailEditRow.rental_overdue_days ?? 0} onChange={(e) => setDetailEditRow({ ...detailEditRow, rental_overdue_days: e.target.value })} style={{ width: 70 }} /> : formatDueCell(item.rental_overdue_days)}</td>
                                      <td style={cellStyle}>
                                        <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                                          {editingDetail ? (
                                            <>
                                              <button className="btn-green" type="button" onClick={saveDetailEdit}>Save</button>
                                              <button className="btn-gray" type="button" onClick={() => { setDetailEditingId(null); setDetailEditRow({}); }}>Cancel</button>
                                            </>
                                          ) : (
                                            <>
                                              <button className="btn-blue" type="button" onClick={() => startDetailEdit(item)}>Edit</button>
                                              <button className="btn-green" type="button" onClick={() => openTransfer(tool, item.id)}>Move</button>
                                              <button className="btn-red" type="button" onClick={() => handleDetailDelete(item.id)}>Delete</button>
                                            </>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredTools.length === 0 && (
                <tr className="tools-empty-row">
                  <td colSpan={11}>
                    {!hasSearched
                      ? "Start typing in the search box or click Show All Tools."
                      : searchLoading
                      ? "Searching every saved tool..."
                      : "No tools match the selected search and filters"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="tools-history-section">
          <h2 style={{ marginTop: 0 }}>Full Movement History</h2>
          <p style={{ marginTop: -4, color: "#64748b", fontWeight: 750 }}>
            Select History from any tool row to see movements, rentals, repairs and costs.
          </p>

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

        <div className="tools-history-table-wrap">
          <table className="tools-history-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Qty</th>
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
                <td>{Number(row.qty || 0) || "-"}</td>
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
                <td colSpan={10}>No movement, rental or service history found</td>
              </tr>
            )}

            {!historyToolId && (
              <tr>
                <td colSpan={10}>Select History from a tool row</td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
        </div>
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

function ToolFilterCard({ title, value, active = false, onClick }: any) {
  return (
    <button
      type="button"
      className={`tools-filter-card${active ? " active" : ""}`}
      onClick={onClick}
    >
      <span className="tools-filter-card-label">{title}</span>
      <span className="tools-filter-card-value">{value}</span>
    </button>
  );
}
