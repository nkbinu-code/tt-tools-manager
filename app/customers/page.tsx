"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCustomers,
  saveCustomer,
  updateCustomer,
  deleteCustomer,
} from "./actions";
import { useAppMessage } from "../contexts/AppMessageProvider";

const branches = ["Karuvannur", "Ollur", "Kachery", "Mulayam Rd", "Pattikkad"];

const allShopsLabel = "All Shops";
const allOccupationsLabel = "All Occupations";

function money(value: any) {
  return `₹${Number(value || 0).toFixed(0)}`;
}

function csvSafe(value: any) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadCsvFile(filename: string, header: string[], rows: any[][]) {
  const csv = [header, ...rows]
    .map((row) => row.map(csvSafe).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function formatTransactionDate(value: any) {
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function lastTransactionText(row: any) {
  const date = formatTransactionDate(row?.last_transaction_date);
  const rawText = row?.last_transaction_text || row?.last_transaction_type || "";
  const action = String(rawText || "").replace(/\s*-\s*₹[\d,]+(?:\.\d+)?\s*$/g, "");

  if (!date && !action) return "No transaction";
  if (!date) return action;
  if (!action || action === "No transaction") return date;

  return `${date} - ${action}`;
}



function normalizeRating(value: any) {
  const rating = Number(value ?? 10);
  if (!Number.isFinite(rating)) return 10;
  return Math.min(10, Math.max(1, Math.round(rating)));
}

function ratingColor(value: any) {
  const rating = normalizeRating(value);
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

function ReliabilityBadge({ value }: { value: any }) {
  const rating = normalizeRating(value);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 42,
        padding: "7px 12px",
        borderRadius: 999,
        background: ratingColor(rating),
        color: "#ffffff",
        fontWeight: 1000,
        boxShadow: "0 8px 18px rgba(15,23,42,0.14)",
      }}
    >
      {rating}
    </span>
  );
}

function RatingButtons({ value, onChange }: { value: any; onChange: (value: number) => void }) {
  const current = normalizeRating(value);

  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", minWidth: 170 }}>
      {Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => onChange(rating)}
          title={`Reliability ${rating}/10`}
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            border: current === rating ? "3px solid #0f172a" : "1px solid #e2e8f0",
            background: ratingColor(rating),
            color: "#ffffff",
            fontWeight: 1000,
            cursor: "pointer",
            padding: 0,
          }}
        >
          {rating}
        </button>
      ))}
    </div>
  );
}

type SortKey =
  | "occupation"
  | "rating"
  | "shop"
  | "received_total"
  | "balance"
  | "last_transaction";

type SortDirection = "asc" | "desc";

function sortValue(row: any, key: SortKey) {
  switch (key) {
    case "occupation":
      return String(row.occupation || "").toLowerCase();
    case "rating":
      return normalizeRating(row.rating);
    case "shop":
      return String(row.shop || "").toLowerCase();
    case "received_total":
      return Number(row.received_total || 0);
    case "balance":
      return Number(row.balance || 0);
    case "last_transaction":
      return Number(
        row.last_transaction_sort ||
          (row.last_transaction_date ? new Date(row.last_transaction_date).getTime() : 0),
      );
    default:
      return "";
  }
}

function compareSortValues(a: any, b: any, key: SortKey) {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);

  if (typeof av === "number" && typeof bv === "number") {
    return av - bv;
  }

  return String(av).localeCompare(String(bv));
}

const sortHeaderButtonStyle = {
  border: 0,
  background: "transparent",
  color: "inherit",
  font: "inherit",
  fontWeight: 950,
  cursor: "pointer",
  padding: 0,
  textAlign: "left" as const,
};

const emptyCustomer = {
  customer_name: "",
  mobile: "",
  occupation: "",
  address: "",
  shop: "",
  notes: "",
  rating: 10,
  opening_balance: "",
};

export default function CustomersPage() {
  const { setAppMessage } = useAppMessage();

  const [customer, setCustomer] = useState<any>({ ...emptyCustomer });
  const [downloadShopFilter, setDownloadShopFilter] = useState(allShopsLabel);
  const [downloadOccupationFilter, setDownloadOccupationFilter] = useState(allOccupationsLabel);

  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("last_transaction");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function showError(message: string) {
    setAppMessage({ type: "error", title: "Error", message });
  }

  function showSuccess(message: string) {
    setAppMessage({ type: "success", title: "Success", message });
  }

  function showWarning(message: string) {
    setAppMessage({ type: "warning", title: "Warning", message });
  }

  function getCustomerId(row: any) {
    return row.customer_id ?? row.id;
  }

  async function loadCustomers(value = search) {
    const res = await getCustomers(value);

    if (res.success) {
      setCustomers(res.data || []);
    } else {
      showError(res.message || "Failed to load customers");
      console.log(res.message);
    }
  }

  useEffect(() => {
    loadCustomers("");
  }, []);

  function changeCustomer(field: string, value: string) {
    setCustomer({
      ...customer,
      [field]: value,
    });
  }

  async function handleSave() {
    if (!customer.customer_name || !customer.mobile) {
      showWarning("Please enter customer name and mobile number");
      return;
    }

    setLoading(true);
    const res = await saveCustomer(customer);
    setLoading(false);

    if (!res.success) {
      showError(res.message || "Failed to save customer");
      return;
    }

    showSuccess(res.message || "Customer saved successfully");
    setCustomer({ ...emptyCustomer });
    await loadCustomers("");
  }

  async function handleSearch(value: string) {
    setSearch(value);
    await loadCustomers(value);
  }

  function startEdit(row: any) {
    setEditingId(getCustomerId(row));
    setEditRow({ ...row });
  }

  async function saveEdit() {
    if (!editingId) return;

    const res = await updateCustomer(editingId, editRow);

    if (!res.success) {
      showError(res.message || "Failed to update customer");
      return;
    }

    showSuccess(res.message || "Customer updated successfully");
    setEditingId(null);
    setEditRow({});
    await loadCustomers(search);
  }

  async function handleDelete(id: number) {
    const res = await deleteCustomer(id);

    if (!res.success) {
      showError(res.message || "Failed to delete customer");
      return;
    }

    showSuccess(res.message || "Customer deleted successfully");
    await loadCustomers(search);
  }

  function changeSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(
      ["received_total", "balance", "last_transaction", "rating"].includes(key)
        ? "desc"
        : "asc",
    );
  }

  function SortHeader({ label, column }: { label: string; column: SortKey }) {
    const active = sortKey === column;
    const arrow = active ? (sortDirection === "asc" ? "▲" : "▼") : "↕";

    return (
      <button
        type="button"
        style={sortHeaderButtonStyle}
        onClick={() => changeSort(column)}
        title={`Sort by ${label}`}
      >
        {label} {arrow}
      </button>
    );
  }


  const occupationOptions = useMemo(() => {
    const occupations = Array.from(
      new Set<string>(
        customers
          .map((row) => String(row.occupation || "").trim())
          .filter(Boolean),
      ),
    ).sort((a: string, b: string) => a.localeCompare(b));

    return [allOccupationsLabel, ...occupations];
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const filtered = customers.filter((row) => {
      const shopOk =
        downloadShopFilter === allShopsLabel || row.shop === downloadShopFilter;
      const occupationOk =
        downloadOccupationFilter === allOccupationsLabel ||
        String(row.occupation || "").trim() === downloadOccupationFilter;

      return shopOk && occupationOk;
    });

    return [...filtered].sort((a, b) => {
      const result = compareSortValues(a, b, sortKey);
      return sortDirection === "asc" ? result : -result;
    });
  }, [customers, downloadShopFilter, downloadOccupationFilter, sortKey, sortDirection]);

  const customerTotals = useMemo(() => {
    return filteredCustomers.reduce(
      (totals, row) => ({
        count: totals.count + 1,
        receivedTotal: totals.receivedTotal + Number(row.received_total || 0),
        balanceTotal: totals.balanceTotal + Number(row.balance || 0),
      }),
      {
        count: 0,
        receivedTotal: 0,
        balanceTotal: 0,
      },
    );
  }, [filteredCustomers]);

  function downloadFilteredCustomers() {
    downloadCsvFile(
      `T&T_Customers_${downloadShopFilter}_${downloadOccupationFilter}.csv`,
      [
        "Customer Name",
        "Mobile",
        "Occupation",
        "Reliability",
        "Address",
        "Shop",
        "Received Total",
        "Pending Balance",
        "Last Transaction",
        "Notes",
      ],
      filteredCustomers.map((row) => [
        row.customer_name,
        row.mobile,
        row.occupation,
        normalizeRating(row.rating),
        row.address,
        row.shop,
        Number(row.received_total || 0).toFixed(0),
        Number(row.balance || 0).toFixed(0),
        lastTransactionText(row),
        row.notes,
      ]),
    );
  }

  return (
    <main>
      <style>{customerTableCompactStyles}</style>
      <h1>Customers</h1>

      <div className="panel">
        <h2>Add Customer</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 1fr 1fr 1.6fr 1fr 1fr 1.4fr",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <input
            placeholder="Customer Name"
            value={customer.customer_name}
            onChange={(e) => changeCustomer("customer_name", e.target.value)}
          />

          <input
            placeholder="Mobile Number"
            value={customer.mobile}
            onChange={(e) => changeCustomer("mobile", e.target.value)}
          />

          <input
            placeholder="Occupation"
            value={customer.occupation}
            onChange={(e) => changeCustomer("occupation", e.target.value)}
          />

          <input
            placeholder="Address"
            value={customer.address}
            onChange={(e) => changeCustomer("address", e.target.value)}
          />

          <select
            value={customer.shop}
            onChange={(e) => changeCustomer("shop", e.target.value)}
          >
            <option value="">Select Shop</option>
            {branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>


          <input
            type="number"
            placeholder="Opening Balance (+ due / - credit)"
            value={customer.opening_balance}
            onChange={(e) => changeCustomer("opening_balance", e.target.value)}
          />
          <input
            placeholder="Notes"
            value={customer.notes}
            onChange={(e) => changeCustomer("notes", e.target.value)}
          />
        </div>

        <button className="btn-blue" onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save Customer"}
        </button>
      </div>

      <div className="panel">
        <h2>Customers List</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 1.4fr) 180px 220px 160px",
            gap: 10,
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <input
            placeholder="Search customer, mobile, address, shop..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: "100%" }}
          />

          <select
            value={downloadShopFilter}
            onChange={(e) => setDownloadShopFilter(e.target.value)}
            title="Filter customers by shop"
          >
            <option>{allShopsLabel}</option>
            {branches.map((branch) => (
              <option key={branch}>{branch}</option>
            ))}
          </select>

          <select
            value={downloadOccupationFilter}
            onChange={(e) => setDownloadOccupationFilter(e.target.value)}
            title="Filter customers by occupation"
          >
            {occupationOptions.map((occupation) => (
              <option key={occupation}>{occupation}</option>
            ))}
          </select>

          <button className="btn-blue" type="button" onClick={downloadFilteredCustomers}>
            Download
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(160px, 1fr))",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div style={customerSummaryCardStyle}>
            <div style={customerSummaryLabelStyle}>Customers</div>
            <div style={customerSummaryValueStyle}>{customerTotals.count}</div>
          </div>
          <div style={customerSummaryCardStyle}>
            <div style={customerSummaryLabelStyle}>Received Total</div>
            <div style={{ ...customerSummaryValueStyle, color: "#16a34a" }}>
              {money(customerTotals.receivedTotal)}
            </div>
          </div>
          <div style={customerSummaryCardStyle}>
            <div style={customerSummaryLabelStyle}>Pending Balance</div>
            <div
              style={{
                ...customerSummaryValueStyle,
                color: customerTotals.balanceTotal > 0 ? "#dc2626" : "#16a34a",
              }}
            >
              {money(customerTotals.balanceTotal)}
            </div>
          </div>
        </div>

        <table className="customer-compact-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Mobile</th>
              <th><SortHeader label="Occupation" column="occupation" /></th>
              <th><SortHeader label="Reliability" column="rating" /></th>
              <th>Address</th>
              <th><SortHeader label="Shop" column="shop" /></th>
              <th>Opening Balance</th>
              <th><SortHeader label="Received Total" column="received_total" /></th>
              <th><SortHeader label="Pending Balance" column="balance" /></th>
              <th><SortHeader label="Last Transaction" column="last_transaction" /></th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredCustomers.map((row, index) => {
              const customerId = getCustomerId(row);

              return (
                <tr
                  key={
                    customerId ??
                    row.mobile ??
                    `${row.customer_name || "customer"}-${index}`
                  }
                >
                  {editingId === customerId ? (
                    <>
                      <td>
                        <input
                          value={editRow.customer_name || ""}
                          onChange={(e) =>
                            setEditRow({
                              ...editRow,
                              customer_name: e.target.value,
                            })
                          }
                        />
                      </td>

                      <td>
                        <input
                          value={editRow.mobile || ""}
                          onChange={(e) =>
                            setEditRow({
                              ...editRow,
                              mobile: e.target.value,
                            })
                          }
                        />
                      </td>

                      <td>
                        <input
                          value={editRow.occupation || ""}
                          onChange={(e) =>
                            setEditRow({
                              ...editRow,
                              occupation: e.target.value,
                            })
                          }
                        />
                      </td>

                      <td>
                        <RatingButtons
                          value={editRow.rating}
                          onChange={(rating) =>
                            setEditRow({
                              ...editRow,
                              rating,
                            })
                          }
                        />
                      </td>

                      <td>
                        <input
                          value={editRow.address || ""}
                          onChange={(e) =>
                            setEditRow({
                              ...editRow,
                              address: e.target.value,
                            })
                          }
                        />
                      </td>

                      <td>
                        <select
                          value={editRow.shop || ""}
                          onChange={(e) =>
                            setEditRow({
                              ...editRow,
                              shop: e.target.value,
                            })
                          }
                        >
                          <option value="">Select Shop</option>
                          {branches.map((branch) => (
                            <option key={branch} value={branch}>
                              {branch}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <input
                          type="number"
                          value={editRow.opening_balance ?? ""}
                          onChange={(e) => setEditRow({ ...editRow, opening_balance: e.target.value })}
                          title="Positive = customer owes; negative = customer credit"
                        />
                      </td>

                      <td style={{ color: "#16a34a", fontWeight: 700 }}>
                        ₹{Number(editRow.received_total || 0).toFixed(0)}
                      </td>

                      <td
                        style={{
                          color:
                            Number(editRow.balance || 0) > 0
                              ? "#dc2626"
                              : "#16a34a",
                          fontWeight: 800,
                        }}
                      >
                        ₹{Number(editRow.balance || 0).toFixed(0)}
                      </td>

                      <td className="last-transaction-cell">
                        {lastTransactionText(editRow)}
                      </td>

                      <td>
                        <input
                          value={editRow.notes || ""}
                          onChange={(e) =>
                            setEditRow({
                              ...editRow,
                              notes: e.target.value,
                            })
                          }
                        />
                      </td>

                      <td className="customer-actions-cell">
                        <div className="customer-actions-wrap">
                          <button className="btn-green" onClick={saveEdit}>
                            Save
                          </button>

                          <button
                            className="btn-gray"
                            onClick={() => {
                              setEditingId(null);
                              setEditRow({});
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{row.customer_name}</td>
                      <td>{row.mobile}</td>
                      <td>{row.occupation}</td>
                      <td>
                        <ReliabilityBadge value={row.rating} />
                      </td>
                      <td>{row.address}</td>
                      <td>{row.shop}</td>
                      <td style={{ fontWeight: 800, color: Number(row.opening_balance || 0) > 0 ? "#dc2626" : Number(row.opening_balance || 0) < 0 ? "#16a34a" : "inherit" }}>
                        ₹{Number(row.opening_balance || 0).toFixed(0)}
                      </td>

                      <td style={{ color: "#16a34a", fontWeight: 700 }}>
                        ₹{Number(row.received_total || 0).toFixed(0)}
                      </td>

                      <td
                        style={{
                          color:
                            Number(row.balance || 0) > 0
                              ? "#dc2626"
                              : "#16a34a",
                          fontWeight: 800,
                        }}
                      >
                        ₹{Number(row.balance || 0).toFixed(0)}
                      </td>

                      <td className="last-transaction-cell">
                        {lastTransactionText(row)}
                      </td>

                      <td>{row.notes}</td>

                      <td className="customer-actions-cell">
                        <div className="customer-actions-wrap">
                          <button
                            className="btn-blue"
                            onClick={() => startEdit(row)}
                          >
                            Edit
                          </button>

                          <button
                            className="btn-red"
                            onClick={() => handleDelete(customerId)}
                            disabled={!customerId}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}

            {filteredCustomers.length === 0 && (
              <tr key="no-customers">
                <td colSpan={11}>No customers found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}


const customerTableCompactStyles = `
  .customer-compact-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .customer-compact-table th,
  .customer-compact-table td {
    padding: 6px 8px;
    line-height: 1.12;
    vertical-align: middle;
  }

  .customer-compact-table th {
    white-space: nowrap;
  }

  .customer-compact-table input,
  .customer-compact-table select {
    padding: 7px 8px;
    font-size: 14px;
    min-height: 36px;
  }

  .customer-compact-table button {
    padding: 7px 10px;
    font-size: 13px;
    line-height: 1;
  }

  .customer-actions-cell {
    white-space: nowrap;
    min-width: 132px;
  }

  .customer-actions-wrap {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .last-transaction-cell {
    font-weight: 800;
    color: #334155;
    white-space: nowrap;
  }
`;

const customerSummaryCardStyle = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 14,
  padding: "13px 14px",
  fontWeight: 900,
};

const customerSummaryLabelStyle = {
  color: "#475569",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase" as const,
};

const customerSummaryValueStyle = {
  color: "#0f2a5f",
  fontSize: 24,
  fontWeight: 1000,
  marginTop: 4,
};
