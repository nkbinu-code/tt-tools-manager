"use client";

import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  getTools,
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

const emptyTool = {
  tool_name: "",
  total_qty: 1,
  daily_rent: 0,
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
  padding: "9px 8px",
  fontWeight: 700,
  lineHeight: 1.2,
  fontSize: 16,
  textAlign: "center" as const,
  verticalAlign: "middle" as const,
};

const strongCellStyle = {
  padding: "9px 8px",
  fontWeight: 850,
  lineHeight: 1.2,
  fontSize: 16,
  textAlign: "center" as const,
  verticalAlign: "middle" as const,
};

const toolNameCellStyle = {
  ...strongCellStyle,
  fontSize: 19,
  fontWeight: 900,
  minWidth: 360,
  maxWidth: 520,
  whiteSpace: "normal" as const,
};

const tableHeadStyle = {
  fontSize: 15,
  fontWeight: 900,
  textAlign: "center" as const,
  whiteSpace: "nowrap" as const,
};

const inputStyle = {
  fontSize: 15,
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
    greasing_due_days: numberValue(row.greasing_due_days),
    oil_change_due_days: numberValue(row.oil_change_due_days),
    scheduled_service_due_days: numberValue(row.scheduled_service_due_days),
    rental_overdue_days: numberValue(row.rental_overdue_days),
  };
}

export default function ToolsPage() {
  const { setAppMessage } = useAppMessage();

  const [rows, setRows] = useState<any[]>(
    Array.from({ length: 10 }, () => ({ ...emptyTool }))
  );

  const [tools, setTools] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("All");
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
  const [toolHistory, setToolHistory] = useState<any[]>([]);
  const [historyTool, setHistoryTool] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function loadTools(value = search) {
    const res = await getTools(value);

    if (res.success) {
      setTools(res.data || []);
    } else {
      showError(res.message || "Failed to load tools");
    }
  }

  useEffect(() => {
    loadTools("");
  }, []);

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

    const locations = Object.keys(dist);

    if (locations.length === 0) return "-";

    if (locationFilter !== "All") {
      const selectedQty = Number(dist[locationFilter] || 0);
      if (selectedQty <= 0) return "-";
      return selectedQty > 1 ? `${locationFilter} : ${selectedQty}` : locationFilter;
    }

    if (locations.length === 1) {
      const loc = locations[0];
      const qty = Number(dist[loc] || 0);
      return qty > 1 ? `${loc} : ${qty}` : loc;
    }

    return locations
      .map((loc) => `${shortNames[loc] || loc}: ${dist[loc]}`)
      .join("   ");
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

      return {
        ...group,
        total_qty: totalQty,
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
  }, [tools, locationFilter]);

  const filteredTools = groupedTools.filter((tool: any) => {
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

  const historyOptions = tools.filter((tool) => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;

    return (
      String(tool.tool_name || "").toLowerCase().includes(q) ||
      String(tool.home_branch || "").toLowerCase().includes(q) ||
      String(tool.current_location || "").toLowerCase().includes(q) ||
      String(tool.service_centre || "").toLowerCase().includes(q) ||
      String(tool.physical_location || "").toLowerCase().includes(q) ||
      String(tool.brand || "").toLowerCase().includes(q) ||
      String(tool.category || "").toLowerCase().includes(q)
    );
  });

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
    await loadTools("");
  }

  async function handleSearch(value: string) {
    setSearch(value);
    await loadTools(value);
  }

  function startEditGroup(tool: any) {
    setEditingGroupKey(tool.group_key);
    setEditRow({
      tool_name: tool.tool_name || "",
      daily_rent: tool.daily_rent || 0,
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
    await loadTools("");
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
        .tools-clean-table th,
        .tools-clean-table td {
          text-align: center;
          vertical-align: middle;
        }

        .tools-clean-table input,
        .tools-clean-table select {
          font-size: 15px;
          font-weight: 800;
          text-align: center;
        }
      `}</style>
      <h1>Tools</h1>

      <div className="panel">
        <h2>Tools List</h2>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 14,
            alignItems: "center",
          }}
        >
          <input
            placeholder="Search tool, brand, category..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: 420 }}
          />

          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            style={{ width: 280 }}
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

        <div style={{ overflowX: "auto" }}>
          <table
            className="tools-clean-table"
            style={{
              fontSize: 16,
              minWidth: 1500,
              tableLayout: "fixed",
              width: "100%",
            }}
          >
            <thead>
              <tr>
                <th style={{ ...tableHeadStyle, width: 390 }}>Tool Name</th>
                <th style={{ ...tableHeadStyle, width: 70 }}>Qty</th>
                <th style={{ ...tableHeadStyle, width: 105 }}>Rent</th>
                <th style={{ ...tableHeadStyle, width: 120 }}>Category</th>
                <th style={{ ...tableHeadStyle, width: 115 }}>Brand</th>
                <th style={{ ...tableHeadStyle, width: 90 }}>Color</th>
                <th style={{ ...tableHeadStyle, width: 150 }}>Home Branch</th>
                <th style={{ ...tableHeadStyle, width: 170 }}>Current Location</th>
                <th style={{ ...tableHeadStyle, width: 105 }}>Status</th>
                <th style={{ ...tableHeadStyle, width: 85 }}>Greasing</th>
                <th style={{ ...tableHeadStyle, width: 95 }}>Oil</th>
                <th style={{ ...tableHeadStyle, width: 105 }}>Service</th>
                <th style={{ ...tableHeadStyle, width: 110 }}>Overdue</th>
                <th style={{ ...tableHeadStyle, width: 205 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredTools.map((tool: any) => (
                <React.Fragment key={tool.group_key}>
                  <tr>
                    {editingGroupKey === tool.group_key ? (
                      <>
                        <td style={cellStyle}>
                          <input
                            style={inputStyle}
                            value={editRow.tool_name ?? ""}
                            onChange={(e) =>
                              setEditRow({
                                ...editRow,
                                tool_name: e.target.value,
                              })
                            }
                          />
                        </td>

                        <td style={cellStyle}>{tool.total_qty}</td>

                        <td style={cellStyle}>
                          <input
                            style={inputStyle}
                            type="number"
                            value={editRow.daily_rent ?? ""}
                            onChange={(e) =>
                              setEditRow({
                                ...editRow,
                                daily_rent: e.target.value,
                              })
                            }
                          />
                        </td>

                        <td style={cellStyle}>
                          <input
                            style={inputStyle}
                            value={editRow.category ?? ""}
                            onChange={(e) =>
                              setEditRow({
                                ...editRow,
                                category: e.target.value,
                              })
                            }
                          />
                        </td>

                        <td style={cellStyle}>
                          <input
                            style={inputStyle}
                            value={editRow.brand ?? ""}
                            onChange={(e) =>
                              setEditRow({
                                ...editRow,
                                brand: e.target.value,
                              })
                            }
                          />
                        </td>

                        <td style={cellStyle}>
                          <input
                            style={inputStyle}
                            value={editRow.color ?? ""}
                            onChange={(e) =>
                              setEditRow({
                                ...editRow,
                                color: e.target.value,
                              })
                            }
                          />
                        </td>

                        <td style={strongCellStyle}>
                          <select
                            style={inputStyle}
                            value={editRow.home_branch || ""}
                            onChange={(e) =>
                              setEditRow({
                                ...editRow,
                                home_branch: e.target.value,
                              })
                            }
                          >
                            <option value="">Keep Same</option>
                            {branches.map((b) => (
                              <option key={b}>{b}</option>
                            ))}
                          </select>
                        </td>

                        <td style={strongCellStyle}>
                          <select
                            style={inputStyle}
                            value={editRow.current_location || ""}
                            onChange={(e) =>
                              setEditRow({
                                ...editRow,
                                current_location: e.target.value,
                              })
                            }
                          >
                            <option value="">Keep Same</option>
                            {[...branches, ...serviceCentres].map((b) => (
                              <option key={b}>{b}</option>
                            ))}
                          </select>
                        </td>

                        <td style={cellStyle}>
                          <select
                            style={inputStyle}
                            value={editRow.status || "Available"}
                            onChange={(e) =>
                              setEditRow({
                                ...editRow,
                                status: e.target.value,
                              })
                            }
                          >
                            {statuses.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </td>

                        <td style={cellStyle}>
                          <input
                            type="number"
                            value={editRow.greasing_due_days ?? 0}
                            onChange={(e) =>
                              setEditRow({
                                ...editRow,
                                greasing_due_days: e.target.value,
                              })
                            }
                          />
                        </td>

                        <td style={cellStyle}>
                          <input
                            type="number"
                            value={editRow.oil_change_due_days ?? 0}
                            onChange={(e) =>
                              setEditRow({
                                ...editRow,
                                oil_change_due_days: e.target.value,
                              })
                            }
                          />
                        </td>

                        <td style={cellStyle}>
                          <input
                            type="number"
                            value={editRow.scheduled_service_due_days ?? 0}
                            onChange={(e) =>
                              setEditRow({
                                ...editRow,
                                scheduled_service_due_days: e.target.value,
                              })
                            }
                          />
                        </td>

                        <td style={cellStyle}>
                          <input
                            type="number"
                            value={editRow.rental_overdue_days ?? 0}
                            onChange={(e) =>
                              setEditRow({
                                ...editRow,
                                rental_overdue_days: e.target.value,
                              })
                            }
                          />
                        </td>

                        <td style={{ padding: "4px" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              className="btn-green"
                              onClick={() => saveEditGroup(tool)}
                              style={{
                                fontWeight: 800,
                                padding: "6px 10px",
                                lineHeight: 1,
                              }}
                            >
                              Save
                            </button>

                            <button
                              className="btn-gray"
                              onClick={() => {
                                setEditingGroupKey(null);
                                setEditRow({});
                              }}
                              style={{
                                fontWeight: 800,
                                padding: "6px 10px",
                                lineHeight: 1,
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={toolNameCellStyle}>{tool.tool_name}</td>
                        <td style={cellStyle}>{tool.total_qty}</td>
                        <td style={cellStyle}>₹{tool.daily_rent}</td>
                        <td style={cellStyle}>{tool.category}</td>
                        <td style={cellStyle}>{tool.brand}</td>
                        <td style={cellStyle}>{tool.color}</td>
                        <td style={strongCellStyle}>
                          {tool.home_branch_summary}
                        </td>
                        <td style={strongCellStyle}>
                          {tool.current_location_summary}
                        </td>
                        <td style={cellStyle}>{tool.status}</td>
                        <td style={cellStyle}>{tool.greasing_due_days || 0}</td>
                        <td style={cellStyle}>
                          {tool.oil_change_due_days || 0}
                        </td>
                        <td style={cellStyle}>
                          {tool.scheduled_service_due_days || 0}
                        </td>
                        <td style={cellStyle}>
                          {tool.rental_overdue_days || 0}
                        </td>

                        <td style={{ padding: "4px" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              alignItems: "center",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <button
                              className="btn-gray"
                              onClick={() =>
                                setOpenDetailsKey(
                                  openDetailsKey === tool.group_key
                                    ? null
                                    : tool.group_key
                                )
                              }
                              style={{
                                fontWeight: 800,
                                padding: "6px 10px",
                                lineHeight: 1,
                              }}
                            >
                              Details
                            </button>

                            <button
                              className="btn-blue"
                              onClick={() => startEditGroup(tool)}
                              style={{
                                fontWeight: 800,
                                padding: "6px 10px",
                                lineHeight: 1,
                              }}
                            >
                              Edit
                            </button>

                            <button
                              className="btn-red"
                              onClick={() => handleDeleteGroup(tool)}
                              style={{
                                fontWeight: 800,
                                padding: "6px 10px",
                                lineHeight: 1,
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>

                  {openDetailsKey === tool.group_key && (
                    <tr>
                      <td colSpan={14} style={{ padding: 0 }}>
                        <div
                          style={{
                            background: "#f8fafc",
                            border: "1px solid #cbd5e1",
                            padding: 10,
                          }}
                        >
                          <strong style={{ fontSize: 17 }}>Branch-wise Details: {tool.tool_name}</strong>

                          <table className="tools-clean-table" style={{ marginTop: 10, fontSize: 15, width: "100%" }}>
                            <thead>
                              <tr>
                                <th>Branch Row</th>
                                <th>Qty</th>
                                <th>Home Branch</th>
                                <th>Current Location</th>
                                <th>Status</th>
                                <th>Greasing</th>
                                <th>Oil Change</th>
                                <th>Scheduled</th>
                                <th>Rental Overdue</th>
                                <th>Actions</th>
                              </tr>
                            </thead>

                            <tbody>
                              {tool.grouped_items.map((item: any) => (
                                <tr key={item.id}>
                                  {detailEditingId === item.id ? (
                                    <>
                                      <td>{item.tool_name}</td>

                                      <td>
                                        <input
                                          type="number"
                                          value={detailEditRow.total_qty ?? ""}
                                          onChange={(e) =>
                                            setDetailEditRow({
                                              ...detailEditRow,
                                              total_qty: e.target.value,
                                            })
                                          }
                                        />
                                      </td>

                                      <td>
                                        <select
                                          value={detailEditRow.home_branch || ""}
                                          onChange={(e) =>
                                            setDetailEditRow({
                                              ...detailEditRow,
                                              home_branch: e.target.value,
                                            })
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
                                          value={
                                            detailEditRow.current_location || ""
                                          }
                                          onChange={(e) =>
                                            setDetailEditRow({
                                              ...detailEditRow,
                                              current_location: e.target.value,
                                            })
                                          }
                                        >
                                          <option value="">Select</option>
                                          {[...branches, ...serviceCentres].map(
                                            (b) => (
                                              <option key={b}>{b}</option>
                                            )
                                          )}
                                        </select>
                                      </td>

                                      <td>
                                        <select
                                          value={detailEditRow.status || ""}
                                          onChange={(e) =>
                                            setDetailEditRow({
                                              ...detailEditRow,
                                              status: e.target.value,
                                            })
                                          }
                                        >
                                          {statuses.map((s) => (
                                            <option key={s}>{s}</option>
                                          ))}
                                        </select>
                                      </td>

                                      <td>
                                        <input
                                          type="number"
                                          value={
                                            detailEditRow.greasing_due_days ?? 0
                                          }
                                          onChange={(e) =>
                                            setDetailEditRow({
                                              ...detailEditRow,
                                              greasing_due_days: e.target.value,
                                            })
                                          }
                                        />
                                      </td>

                                      <td>
                                        <input
                                          type="number"
                                          value={
                                            detailEditRow.oil_change_due_days ?? 0
                                          }
                                          onChange={(e) =>
                                            setDetailEditRow({
                                              ...detailEditRow,
                                              oil_change_due_days: e.target.value,
                                            })
                                          }
                                        />
                                      </td>

                                      <td>
                                        <input
                                          type="number"
                                          value={
                                            detailEditRow.scheduled_service_due_days ??
                                            0
                                          }
                                          onChange={(e) =>
                                            setDetailEditRow({
                                              ...detailEditRow,
                                              scheduled_service_due_days:
                                                e.target.value,
                                            })
                                          }
                                        />
                                      </td>

                                      <td>
                                        <input
                                          type="number"
                                          value={
                                            detailEditRow.rental_overdue_days ??
                                            0
                                          }
                                          onChange={(e) =>
                                            setDetailEditRow({
                                              ...detailEditRow,
                                              rental_overdue_days: e.target.value,
                                            })
                                          }
                                        />
                                      </td>

                                      <td>
                                        <button
                                          className="btn-green"
                                          onClick={saveDetailEdit}
                                          style={{
                                            fontWeight: 800,
                                            padding: "6px 10px",
                                            lineHeight: 1,
                                          }}
                                        >
                                          Save
                                        </button>

                                        <button
                                          className="btn-gray"
                                          onClick={() => {
                                            setDetailEditingId(null);
                                            setDetailEditRow({});
                                          }}
                                          style={{
                                            marginLeft: 6,
                                            fontWeight: 800,
                                            padding: "6px 10px",
                                            lineHeight: 1,
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td>{item.tool_name}</td>
                                      <td>{item.total_qty}</td>
                                      <td>{item.home_branch}</td>
                                      <td>{item.current_location}</td>
                                      <td>{item.status}</td>
                                      <td>{item.greasing_due_days || 0}</td>
                                      <td>{item.oil_change_due_days || 0}</td>
                                      <td>
                                        {item.scheduled_service_due_days || 0}
                                      </td>
                                      <td>{item.rental_overdue_days || 0}</td>
                                      <td>
                                        <button
                                          className="btn-blue"
                                          onClick={() => startDetailEdit(item)}
                                          style={{
                                            fontWeight: 800,
                                            padding: "6px 10px",
                                            lineHeight: 1,
                                          }}
                                        >
                                          Edit
                                        </button>

                                        <button
                                          className="btn-red"
                                          onClick={() =>
                                            handleDetailDelete(item.id)
                                          }
                                          style={{
                                            marginLeft: 6,
                                            fontWeight: 800,
                                            padding: "6px 10px",
                                            lineHeight: 1,
                                          }}
                                        >
                                          Delete
                                        </button>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}

              {filteredTools.length === 0 && (
                <tr>
                  <td colSpan={14}>No tools found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2>Tool Search & Full Movement History</h2>

        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input
            placeholder="Type tool name, branch, brand, category..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            style={{ width: 420 }}
          />

          <select
            value={historyToolId}
            onChange={(e) => handleHistorySearch(e.target.value)}
            style={{ width: 420 }}
          >
            <option value="">Select Tool</option>
            {historyOptions.map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.tool_name}
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
          Excel columns: Tool Name, Qty, Daily Rent, Category, Brand, Color,
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
    </main>
  );
}
