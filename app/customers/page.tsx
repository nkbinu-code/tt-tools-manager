"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  deleteCustomer,
  saveCustomer,
  searchCustomersForPage,
  suggestCustomersForPage,
  updateCustomer,
} from "./actions";
import { useAppMessage } from "../contexts/AppMessageProvider";

const branches = [
  "Karuvannur",
  "Ollur",
  "Kachery",
  "Mulayam Rd",
  "Pattikkad",
];

const allShopsLabel = "All Shops";
const allOccupationsLabel = "All Occupations";

function money(value: any) {
  return `₹${Number(value || 0).toFixed(0)}`;
}

function csvSafe(value: any) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadCsvFile(
  filename: string,
  header: string[],
  rows: any[][]
) {
  const csv = [header, ...rows]
    .map((row) => row.map(csvSafe).join(","))
    .join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function formatTransactionDate(value: any) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function lastTransactionText(row: any) {
  const date = formatTransactionDate(row?.last_transaction_date);
  const rawText =
    row?.last_transaction_text ||
    row?.last_transaction_type ||
    "";
  const action = String(rawText || "").replace(
    /\s*-\s*₹[\d,]+(?:\.\d+)?\s*$/g,
    ""
  );

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
      className="customer-reliability-pill"
      style={{ background: ratingColor(rating) }}
      title={`Reliability ${rating}/10`}
    >
      {rating}/10
    </span>
  );
}

function RatingButtons({
  value,
  onChange,
}: {
  value: any;
  onChange: (value: number) => void;
}) {
  const current = normalizeRating(value);

  return (
    <div className="customer-rating-buttons">
      {Array.from({ length: 10 }, (_, index) => index + 1).map(
        (rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            title={`Reliability ${rating}/10`}
            style={{
              border:
                current === rating
                  ? "3px solid #0f172a"
                  : "1px solid #e2e8f0",
              background: ratingColor(rating),
            }}
          >
            {rating}
          </button>
        )
      )}
    </div>
  );
}

type SortKey =
  | "customer_name"
  | "mobile"
  | "occupation"
  | "rating"
  | "shop"
  | "opening_balance"
  | "received_total"
  | "balance"
  | "last_transaction";

type SortDirection = "asc" | "desc";

function sortValue(row: any, key: SortKey) {
  switch (key) {
    case "customer_name":
      return String(row.customer_name || "").toLowerCase();
    case "mobile":
      return String(row.mobile || "");
    case "occupation":
      return String(row.occupation || "").toLowerCase();
    case "rating":
      return normalizeRating(row.rating);
    case "shop":
      return String(row.shop || "").toLowerCase();
    case "opening_balance":
      return Number(row.opening_balance || 0);
    case "received_total":
      return Number(row.received_total || 0);
    case "balance":
      return Number(row.balance || 0);
    case "last_transaction":
      return Number(
        row.last_transaction_sort ||
          (row.last_transaction_date
            ? new Date(row.last_transaction_date).getTime()
            : 0)
      );
    default:
      return "";
  }
}

function compareSortValues(a: any, b: any, key: SortKey) {
  const first = sortValue(a, key);
  const second = sortValue(b, key);

  if (typeof first === "number" && typeof second === "number") {
    return first - second;
  }

  return String(first).localeCompare(String(second));
}

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

  const [customer, setCustomer] = useState<any>({
    ...emptyCustomer,
  });
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultLimited, setResultLimited] = useState(false);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionLoading, setSuggestionLoading] =
    useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLimited, setSuggestionLimited] =
    useState(false);
  const skipNextSuggestionSearch = useRef(false);

  const [shopFilter, setShopFilter] = useState(allShopsLabel);
  const [occupationFilter, setOccupationFilter] = useState(
    allOccupationsLabel
  );

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const [sortKey, setSortKey] =
    useState<SortKey>("last_transaction");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");

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

  function getCustomerId(row: any) {
    return Number(row.customer_id ?? row.id ?? 0);
  }

  async function loadCustomers(
    value = search,
    exactCustomerId?: number | null
  ) {
    const term = String(value || "").trim();

    if (!term && !exactCustomerId) {
      setCustomers([]);
      setHasSearched(false);
      setResultLimited(false);
      return;
    }

    setSearchLoading(true);

    try {
      const result = await searchCustomersForPage(
        term,
        exactCustomerId || null
      );

      if (!result.success) {
        showError(result.message || "Failed to load customers");
        return;
      }

      setCustomers(result.data || []);
      setHasSearched(true);
      setResultLimited(Boolean(result.limited));
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
      setSuggestions([]);
      setSuggestionLoading(false);
      setSuggestionLimited(false);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setSuggestionLoading(true);

      try {
        const result = await suggestCustomersForPage(term);

        if (cancelled) return;

        if (result.success) {
          setSuggestions(result.data || []);
          setSuggestionLimited(Boolean(result.limited));
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
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

  function changeCustomer(field: string, value: any) {
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

    try {
      const result = await saveCustomer(customer);

      if (!result.success) {
        showError(result.message || "Failed to save customer");
        return;
      }

      showSuccess(
        result.message || "Customer saved successfully"
      );
      setCustomer({ ...emptyCustomer });
      setShowAddCustomer(false);

      if (search.trim()) {
        await loadCustomers(search);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    setShowSuggestions(false);
    await loadCustomers(search, null);
  }

  async function chooseSuggestion(row: any) {
    const customerId = Number(row.id || 0);
    const displayText =
      String(row.mobile || "").trim() ||
      String(row.customer_name || "").trim();

    if (!customerId || !displayText) return;

    skipNextSuggestionSearch.current = true;
    setSearch(displayText);
    setShowSuggestions(false);
    setSuggestions([]);
    await loadCustomers(displayText, customerId);
  }

  async function showAllTypedMatches() {
    setShowSuggestions(false);
    await loadCustomers(search, null);
  }

  function clearSearch() {
    setSearch("");
    setCustomers([]);
    setHasSearched(false);
    setResultLimited(false);
    setSuggestions([]);
    setShowSuggestions(false);
    setSuggestionLimited(false);
    setShopFilter(allShopsLabel);
    setOccupationFilter(allOccupationsLabel);
    setEditingId(null);
    setEditRow({});
  }

  function startEdit(row: any) {
    setEditingId(getCustomerId(row));
    setEditRow({ ...row });
  }

  async function saveEdit() {
    if (!editingId) return;

    setLoading(true);

    try {
      const result = await updateCustomer(editingId, editRow);

      if (!result.success) {
        showError(result.message || "Failed to update customer");
        return;
      }

      showSuccess(
        result.message || "Customer updated successfully"
      );
      setEditingId(null);
      setEditRow({});
      await loadCustomers(search, editingId);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!id) return;

    const confirmed = window.confirm(
      "Delete this customer record? This cannot be undone."
    );

    if (!confirmed) return;

    const result = await deleteCustomer(id);

    if (!result.success) {
      showError(result.message || "Failed to delete customer");
      return;
    }

    showSuccess(
      result.message || "Customer deleted successfully"
    );
    clearSearch();
  }

  const occupationOptions = useMemo(() => {
    const occupations = Array.from(
      new Set<string>(
        customers
          .map((row) => String(row.occupation || "").trim())
          .filter(Boolean)
      )
    ).sort((a: string, b: string) => a.localeCompare(b));

    return [allOccupationsLabel, ...occupations];
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const filtered = customers.filter((row) => {
      const shopMatches =
        shopFilter === allShopsLabel || row.shop === shopFilter;
      const occupationMatches =
        occupationFilter === allOccupationsLabel ||
        String(row.occupation || "").trim() === occupationFilter;

      return shopMatches && occupationMatches;
    });

    return [...filtered].sort((a, b) => {
      const result = compareSortValues(a, b, sortKey);
      return sortDirection === "asc" ? result : -result;
    });
  }, [
    customers,
    shopFilter,
    occupationFilter,
    sortKey,
    sortDirection,
  ]);

  const customerTotals = useMemo(() => {
    return filteredCustomers.reduce(
      (totals, row) => ({
        count: totals.count + 1,
        openingBalance:
          totals.openingBalance +
          Number(row.opening_balance || 0),
        receivedTotal:
          totals.receivedTotal +
          Number(row.received_total || 0),
        balanceTotal:
          totals.balanceTotal + Number(row.balance || 0),
      }),
      {
        count: 0,
        openingBalance: 0,
        receivedTotal: 0,
        balanceTotal: 0,
      }
    );
  }, [filteredCustomers]);

  function downloadFilteredCustomers() {
    if (filteredCustomers.length === 0) {
      showWarning("Search and load customer results first");
      return;
    }

    downloadCsvFile(
      `T&T_Customers_${shopFilter}_${occupationFilter}.csv`,
      [
        "Customer Name",
        "Mobile",
        "Occupation",
        "Reliability",
        "Address",
        "Shop",
        "Opening Balance",
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
        Number(row.opening_balance || 0).toFixed(0),
        Number(row.received_total || 0).toFixed(0),
        Number(row.balance || 0).toFixed(0),
        lastTransactionText(row),
        row.notes,
      ])
    );
  }

  function highlightedText(value: any) {
    const text = String(value || "");
    const term = search.trim();

    if (!term) return text;

    const index = text.toLowerCase().indexOf(term.toLowerCase());

    if (index < 0) return text;

    return (
      <>
        {text.slice(0, index)}
        <mark className="customer-suggestion-mark">
          {text.slice(index, index + term.length)}
        </mark>
        {text.slice(index + term.length)}
      </>
    );
  }

  return (
    <main>
      <style>{customerCardStyles}</style>

      <h1>Customers</h1>

      <div className="panel">
        <div className="customer-panel-heading">
          <div>
            <h2 style={{ margin: 0 }}>Add Customer</h2>
            <p className="customer-panel-description">
              The entry form remains closed until a new customer is
              required.
            </p>
          </div>

          <button
            className={
              showAddCustomer ? "btn-gray" : "btn-blue"
            }
            type="button"
            onClick={() =>
              setShowAddCustomer((current) => !current)
            }
          >
            {showAddCustomer
              ? "Close Add Customer"
              : "+ Add Customer"}
          </button>
        </div>

        {showAddCustomer && (
          <div className="customer-add-area">
            <div className="customer-add-grid">
              <div className="customer-form-field">
                <label>Customer Name</label>
                <input
                  placeholder="Customer Name"
                  value={customer.customer_name}
                  onChange={(event) =>
                    changeCustomer(
                      "customer_name",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="customer-form-field">
                <label>Mobile</label>
                <input
                  placeholder="Mobile Number"
                  value={customer.mobile}
                  onChange={(event) =>
                    changeCustomer("mobile", event.target.value)
                  }
                />
              </div>

              <div className="customer-form-field">
                <label>Occupation</label>
                <input
                  placeholder="Occupation"
                  value={customer.occupation}
                  onChange={(event) =>
                    changeCustomer(
                      "occupation",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="customer-form-field">
                <label>Shop</label>
                <select
                  value={customer.shop}
                  onChange={(event) =>
                    changeCustomer("shop", event.target.value)
                  }
                >
                  <option value="">Select Shop</option>
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              </div>

              <div className="customer-form-field customer-wide-field">
                <label>Address</label>
                <input
                  placeholder="Address"
                  value={customer.address}
                  onChange={(event) =>
                    changeCustomer(
                      "address",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="customer-form-field">
                <label>Opening Balance</label>
                <input
                  type="number"
                  placeholder="+ due / - credit"
                  value={customer.opening_balance}
                  onChange={(event) =>
                    changeCustomer(
                      "opening_balance",
                      event.target.value
                    )
                  }
                  title="Positive = customer owes; negative = customer credit"
                />
              </div>

              <div className="customer-form-field customer-wide-field">
                <label>Notes</label>
                <input
                  placeholder="Notes"
                  value={customer.notes}
                  onChange={(event) =>
                    changeCustomer("notes", event.target.value)
                  }
                />
              </div>

              <div className="customer-form-field customer-rating-field">
                <label>Reliability</label>
                <RatingButtons
                  value={customer.rating}
                  onChange={(rating) =>
                    changeCustomer("rating", rating)
                  }
                />
              </div>
            </div>

            <button
              className="btn-blue"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Customer"}
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Customers List</h2>

        <div className="customer-search-controls">
          <div className="customer-live-search-wrap">
            <input
              placeholder="Start typing customer name, mobile, occupation, address, shop or notes..."
              value={search}
              autoComplete="off"
              onFocus={() => {
                if (search.trim().length >= 2) {
                  setShowSuggestions(true);
                }
              }}
              onBlur={() => {
                window.setTimeout(
                  () => setShowSuggestions(false),
                  180
                );
              }}
              onChange={(event) => {
                setSearch(event.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSearch();
                }

                if (event.key === "Escape") {
                  setShowSuggestions(false);
                }
              }}
            />

            {search.trim().length > 0 && (
              <div className="customer-live-indicator">
                <span
                  className={`customer-live-dot ${
                    suggestionLoading ? "loading" : ""
                  }`}
                />
                {search.trim().length < 2
                  ? "Type one more letter or number for live matches"
                  : suggestionLoading
                  ? "Finding matching customers..."
                  : `${suggestions.length} live customer match(es)`}
              </div>
            )}

            {showSuggestions && search.trim().length >= 2 && (
              <div className="customer-live-suggestions">
                <div className="customer-live-suggestions-head">
                  <span>LIVE CUSTOMER MATCHES</span>
                  <span>Click a customer to open the record</span>
                </div>

                {suggestionLoading && suggestions.length === 0 ? (
                  <div className="customer-suggestion-message">
                    Searching matching customers...
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="customer-suggestion-message">
                    No matching customer found.
                  </div>
                ) : (
                  suggestions.map((suggestion: any) => (
                    <button
                      type="button"
                      className="customer-live-suggestion"
                      key={suggestion.id}
                      onMouseDown={(event) =>
                        event.preventDefault()
                      }
                      onClick={() =>
                        void chooseSuggestion(suggestion)
                      }
                    >
                      <span className="customer-suggestion-main">
                        <strong>
                          {highlightedText(
                            suggestion.customer_name
                          )}
                        </strong>
                        <small>
                          {highlightedText(suggestion.mobile)}
                        </small>
                      </span>

                      <ReliabilityBadge
                        value={suggestion.rating}
                      />

                      <span className="customer-suggestion-meta">
                        {[
                          suggestion.occupation,
                          suggestion.shop,
                          suggestion.address,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Customer details available"}
                      </span>
                    </button>
                  ))
                )}

                <button
                  type="button"
                  className="customer-show-all-matches"
                  onMouseDown={(event) =>
                    event.preventDefault()
                  }
                  onClick={() => void showAllTypedMatches()}
                >
                  Show all matches containing “{search.trim()}”
                  {suggestionLimited
                    ? " (more matches available)"
                    : ""}
                </button>
              </div>
            )}
          </div>

          <button
            className="btn-blue"
            type="button"
            onClick={() => void handleSearch()}
            disabled={searchLoading}
          >
            {searchLoading ? "Searching..." : "Search"}
          </button>

          <button
            className="btn-gray"
            type="button"
            onClick={clearSearch}
          >
            Clear
          </button>

          <button
            className="btn-blue"
            type="button"
            onClick={downloadFilteredCustomers}
            disabled={filteredCustomers.length === 0}
          >
            Download Results
          </button>

          <select
            value={shopFilter}
            onChange={(event) =>
              setShopFilter(event.target.value)
            }
            title="Filter loaded customers by shop"
          >
            <option>{allShopsLabel}</option>
            {branches.map((branch) => (
              <option key={branch}>{branch}</option>
            ))}
          </select>

          <select
            value={occupationFilter}
            onChange={(event) =>
              setOccupationFilter(event.target.value)
            }
            title="Filter loaded customers by occupation"
          >
            {occupationOptions.map((occupation) => (
              <option key={occupation}>{occupation}</option>
            ))}
          </select>
        </div>

        <div className="customer-search-result-note">
          {!hasSearched
            ? "No customers are loaded automatically. Search to view a customer."
            : resultLimited
            ? "Showing the first 50 matching customers."
            : `${filteredCustomers.length} customer result(s)`}
        </div>

        <div className="customer-summary-grid">
          <div className="customer-summary-card">
            <span>Customers</span>
            <strong>{customerTotals.count}</strong>
          </div>

          <div className="customer-summary-card">
            <span>Opening Balance</span>
            <strong
              className={
                customerTotals.openingBalance > 0
                  ? "money-danger"
                  : customerTotals.openingBalance < 0
                  ? "money-success"
                  : ""
              }
            >
              {money(customerTotals.openingBalance)}
            </strong>
          </div>

          <div className="customer-summary-card">
            <span>Received Total</span>
            <strong className="money-success">
              {money(customerTotals.receivedTotal)}
            </strong>
          </div>

          <div className="customer-summary-card">
            <span>Pending Balance</span>
            <strong
              className={
                customerTotals.balanceTotal > 0
                  ? "money-danger"
                  : "money-success"
              }
            >
              {money(customerTotals.balanceTotal)}
            </strong>
          </div>
        </div>


        <div className="customer-card-list">
          {filteredCustomers.map((row: any) => {
            const customerId = getCustomerId(row);
            const openingBalance = Number(
              row.opening_balance || 0
            );
            const pendingBalance = Number(row.balance || 0);

            return (
              <article
                className="customer-result-card"
                key={customerId || row.mobile}
              >
                {editingId === customerId ? (
                  <>
                    <div className="customer-card-header">
                      <div>
                        <h3 className="customer-card-name">
                          Edit {row.customer_name}
                        </h3>
                        <div className="customer-card-mobile">
                          {row.mobile}
                        </div>
                      </div>

                      <ReliabilityBadge value={editRow.rating} />

                      <div className="customer-card-actions">
                        <button
                          className="btn-green"
                          type="button"
                          onClick={saveEdit}
                          disabled={loading}
                        >
                          {loading ? "Saving..." : "Save Changes"}
                        </button>

                        <button
                          className="btn-gray"
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditRow({});
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>

                    <div className="customer-card-edit">
                      <div className="customer-edit-grid">
                        <div className="customer-form-field">
                          <label>Customer Name</label>
                          <input
                            value={editRow.customer_name || ""}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                customer_name: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="customer-form-field">
                          <label>Mobile</label>
                          <input
                            value={editRow.mobile || ""}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                mobile: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="customer-form-field">
                          <label>Occupation</label>
                          <input
                            value={editRow.occupation || ""}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                occupation: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="customer-form-field">
                          <label>Shop</label>
                          <select
                            value={editRow.shop || ""}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                shop: event.target.value,
                              })
                            }
                          >
                            <option value="">Select Shop</option>
                            {branches.map((branch) => (
                              <option key={branch}>
                                {branch}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="customer-form-field customer-edit-wide">
                          <label>Address</label>
                          <input
                            value={editRow.address || ""}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                address: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="customer-form-field">
                          <label>Opening Balance</label>
                          <input
                            type="number"
                            value={editRow.opening_balance ?? ""}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                opening_balance:
                                  event.target.value,
                              })
                            }
                            title="Positive = customer owes; negative = customer credit"
                          />
                        </div>

                        <div className="customer-form-field customer-edit-wide">
                          <label>Notes</label>
                          <input
                            value={editRow.notes || ""}
                            onChange={(event) =>
                              setEditRow({
                                ...editRow,
                                notes: event.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="customer-form-field customer-rating-field">
                          <label>Reliability</label>
                          <RatingButtons
                            value={editRow.rating}
                            onChange={(rating) =>
                              setEditRow({
                                ...editRow,
                                rating,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="customer-card-header">
                      <div>
                        <h3 className="customer-card-name">
                          {row.customer_name || "Customer"}
                        </h3>
                        <div className="customer-card-mobile">
                          {row.mobile || "No mobile"}
                        </div>
                      </div>

                      <div className="customer-card-header-meta">
                        <ReliabilityBadge value={row.rating} />
                        <span className="customer-shop-pill">
                          {row.shop || "No Shop"}
                        </span>
                      </div>

                      <div className="customer-card-actions">
                        <button
                          className="btn-blue"
                          type="button"
                          onClick={() => startEdit(row)}
                        >
                          Edit
                        </button>

                        <button
                          className="btn-red"
                          type="button"
                          onClick={() =>
                            handleDelete(customerId)
                          }
                          disabled={!customerId}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="customer-card-body">
                      <div className="customer-account-card-grid">
                        <div
                          className={`customer-account-card ${
                            openingBalance > 0
                              ? "customer-account-opening-due"
                              : openingBalance < 0
                              ? "customer-account-opening-credit"
                              : ""
                          }`}
                        >
                          <span className="customer-account-card-label">
                            Opening Balance
                          </span>
                          <strong>{money(openingBalance)}</strong>
                          <small>
                            {openingBalance > 0
                              ? "Amount due from customer"
                              : openingBalance < 0
                              ? "Customer credit"
                              : "No opening balance"}
                          </small>
                        </div>

                        <div className="customer-account-card customer-account-received">
                          <span className="customer-account-card-label">
                            Received Total
                          </span>
                          <strong>{money(row.received_total)}</strong>
                          <small>Total amount received</small>
                        </div>

                        <div
                          className={`customer-account-card ${
                            pendingBalance > 0
                              ? "customer-account-pending"
                              : "customer-account-clear"
                          }`}
                        >
                          <span className="customer-account-card-label">
                            Pending Balance
                          </span>
                          <strong>{money(pendingBalance)}</strong>
                          <small>
                            {pendingBalance > 0
                              ? "Payment still pending"
                              : "No pending balance"}
                          </small>
                        </div>
                      </div>

                      <div className="customer-detail-card-grid">
                        <section className="customer-detail-card">
                          <div className="customer-detail-card-title">
                            Customer Details
                          </div>

                          <div className="customer-detail-card-body">
                            <div className="customer-detail-row">
                              <span>Occupation</span>
                              <strong>{row.occupation || "-"}</strong>
                            </div>

                            <div className="customer-detail-row">
                              <span>Shop</span>
                              <strong>{row.shop || "-"}</strong>
                            </div>

                            <div className="customer-detail-row">
                              <span>Reliability</span>
                              <ReliabilityBadge value={row.rating} />
                            </div>
                          </div>
                        </section>

                        <section className="customer-detail-card">
                          <div className="customer-detail-card-title">
                            Address
                          </div>

                          <div className="customer-detail-card-body">
                            <div className="customer-address-card-text">
                              {row.address || "-"}
                            </div>
                          </div>
                        </section>

                        <section className="customer-detail-card">
                          <div className="customer-detail-card-title">
                            Activity
                          </div>

                          <div className="customer-detail-card-body">
                            <div className="customer-detail-row customer-detail-row-stack">
                              <span>Last Transaction</span>
                              <strong>{lastTransactionText(row)}</strong>
                            </div>

                            <div className="customer-detail-row customer-detail-row-stack">
                              <span>Notes</span>
                              <strong>{row.notes || "-"}</strong>
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>
                  </>
                )}
              </article>
            );
          })}

          {filteredCustomers.length === 0 && (
            <div className="customer-empty-card">
              {!hasSearched
                ? "Enter a search above. No customers are loaded automatically."
                : searchLoading
                ? "Searching..."
                : "No matching customers found"}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const customerCardStyles = `
  .customer-panel-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  .customer-panel-description {
    margin: 5px 0 0;
    color: #64748b;
    font-weight: 750;
  }

  .customer-add-area {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #d7e2f0;
  }

  .customer-add-grid,
  .customer-edit-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(180px, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }

  .customer-form-field {
    min-width: 0;
  }

  .customer-form-field label {
    display: block;
    margin-bottom: 5px;
    color: #4b5f7e;
    font-size: 13px;
    font-weight: 950;
    text-transform: uppercase;
  }

  .customer-form-field input,
  .customer-form-field select {
    width: 100%;
    min-height: 43px;
    padding: 8px 10px;
    font-size: 16px;
    font-weight: 800;
  }

  .customer-wide-field,
  .customer-edit-wide {
    grid-column: span 2;
  }

  .customer-rating-field {
    grid-column: span 2;
  }

  .customer-rating-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .customer-rating-buttons button {
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 8px;
    color: #ffffff;
    font-weight: 1000;
    cursor: pointer;
  }

  .customer-search-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 11px;
    margin-bottom: 10px;
  }

  .customer-search-controls > button,
  .customer-search-controls > select {
    min-height: 46px;
    font-size: 15px;
    font-weight: 850;
  }

  .customer-live-search-wrap {
    position: relative;
    width: min(100%, 620px);
    z-index: 30;
  }

  .customer-live-search-wrap > input {
    width: 100%;
    min-height: 46px;
    padding: 9px 12px;
    font-size: 17px;
    font-weight: 800;
  }

  .customer-live-indicator {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin: 8px 0 0 3px;
    color: #1557b0;
    font-size: 14px;
    font-weight: 900;
  }

  .customer-live-dot {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: #12a150;
    box-shadow: 0 0 0 4px rgba(18, 161, 80, 0.14);
  }

  .customer-live-dot.loading {
    background: #f59e0b;
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.15);
    animation: customer-live-pulse 0.9s infinite alternate;
  }

  @keyframes customer-live-pulse {
    from {
      opacity: 0.45;
      transform: scale(0.9);
    }

    to {
      opacity: 1;
      transform: scale(1.12);
    }
  }

  .customer-live-suggestions {
    position: absolute;
    top: calc(100% + 7px);
    left: 0;
    right: 0;
    z-index: 60;
    max-height: 430px;
    overflow-y: auto;
    border: 1px solid #9db9df;
    border-radius: 13px;
    background: #ffffff;
    box-shadow: 0 18px 42px rgba(15, 42, 95, 0.22);
  }

  .customer-live-suggestions-head {
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

  .customer-live-suggestion {
    display: grid;
    grid-template-columns: minmax(180px, 1.3fr) auto minmax(220px, 1.2fr);
    align-items: center;
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

  .customer-live-suggestion:hover,
  .customer-live-suggestion:focus-visible {
    background: #eef6ff;
    outline: none;
  }

  .customer-suggestion-main {
    display: grid;
    gap: 3px;
  }

  .customer-suggestion-main strong {
    font-size: 17px;
    font-weight: 950;
    line-height: 1.2;
  }

  .customer-suggestion-main small {
    color: #31557f;
    font-size: 14px;
    font-weight: 850;
  }

  .customer-suggestion-meta {
    color: #52647f;
    font-size: 14px;
    font-weight: 800;
    line-height: 1.35;
  }

  .customer-suggestion-message {
    padding: 18px;
    font-weight: 850;
  }

  .customer-suggestion-mark {
    padding: 0 1px;
    border-radius: 3px;
    background: #ffe48a;
    color: inherit;
  }

  .customer-show-all-matches {
    position: sticky;
    bottom: 0;
    width: 100%;
    padding: 12px 14px;
    border: 0;
    border-top: 1px solid #b9cce7;
    background: #143f82;
    color: #ffffff;
    font-size: 15px;
    font-weight: 950;
    cursor: pointer;
  }

  .customer-show-all-matches:hover {
    background: #0d326d;
  }

  .customer-search-result-note {
    margin-bottom: 13px;
    color: #52647f;
    font-size: 15px;
    font-weight: 850;
  }

  .customer-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 11px;
    margin-bottom: 15px;
  }

  .customer-summary-card {
    padding: 13px 14px;
    border: 1px solid #bfdbfe;
    border-radius: 14px;
    background: #eff6ff;
  }

  .customer-summary-card span {
    display: block;
    color: #475569;
    font-size: 12px;
    font-weight: 950;
    text-transform: uppercase;
  }

  .customer-summary-card strong {
    display: block;
    margin-top: 4px;
    color: #0f2a5f;
    font-size: 25px;
    font-weight: 1000;
  }

  .money-success {
    color: #16a34a !important;
  }

  .money-danger {
    color: #dc2626 !important;
  }

  .customer-card-list {
    display: grid;
    gap: 16px;
    width: 100%;
  }

  .customer-result-card {
    width: 100%;
    overflow: hidden;
    border: 1px solid #b9cde7;
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 10px 28px rgba(15, 42, 95, 0.08);
  }

  .customer-result-card:hover {
    border-color: #7ba5dc;
    box-shadow: 0 14px 34px rgba(15, 42, 95, 0.13);
  }

  .customer-card-header {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) auto auto;
    align-items: center;
    gap: 14px;
    padding: 15px 16px;
    background: linear-gradient(
      90deg,
      #eaf3ff 0%,
      #f8fbff 64%,
      #ffffff 100%
    );
    border-bottom: 1px solid #cfdef0;
  }

  .customer-card-name {
    margin: 0;
    color: #102f67;
    font-size: 22px;
    font-weight: 1000;
    line-height: 1.22;
    overflow-wrap: anywhere;
  }

  .customer-card-mobile {
    margin-top: 4px;
    color: #31557f;
    font-size: 16px;
    font-weight: 900;
  }

  .customer-card-header-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 9px;
  }

  .customer-reliability-pill,
  .customer-shop-pill {
    display: inline-flex;
    min-width: 72px;
    align-items: center;
    justify-content: center;
    padding: 7px 11px;
    border-radius: 999px;
    color: #ffffff;
    font-size: 15px;
    font-weight: 950;
    white-space: nowrap;
  }

  .customer-shop-pill {
    border: 1px solid #9fc0e9;
    background: #ffffff;
    color: #173e79;
  }

  .customer-card-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }

  .customer-card-actions button {
    min-height: 40px;
    padding: 8px 13px !important;
    font-size: 15px;
    font-weight: 900 !important;
  }

  .customer-card-body {
    display: grid;
    gap: 14px;
    padding: 14px;
  }

  .customer-account-card-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(220px, 1fr));
    gap: 12px;
  }

  .customer-account-card {
    min-width: 0;
    padding: 15px 16px;
    border: 1px solid #bfd1e8;
    border-radius: 14px;
    background: linear-gradient(145deg, #f7fbff, #eef5ff);
    box-shadow: 0 7px 18px rgba(15, 42, 95, 0.07);
  }

  .customer-account-card-label {
    display: block;
    color: #52647f;
    font-size: 13px;
    font-weight: 950;
    letter-spacing: 0.35px;
    text-transform: uppercase;
  }

  .customer-account-card strong {
    display: block;
    margin-top: 5px;
    color: #102f67;
    font-size: 29px;
    font-weight: 1000;
    line-height: 1.05;
  }

  .customer-account-card small {
    display: block;
    margin-top: 7px;
    color: #64748b;
    font-size: 13px;
    font-weight: 800;
  }

  .customer-account-opening-due {
    border-color: #f6a5a5;
    background: linear-gradient(145deg, #fff8f8, #feecec);
  }

  .customer-account-opening-due strong,
  .customer-account-pending strong {
    color: #c62828;
  }

  .customer-account-opening-credit {
    border-color: #97ddb2;
    background: linear-gradient(145deg, #f4fff8, #e7faee);
  }

  .customer-account-opening-credit strong,
  .customer-account-received strong,
  .customer-account-clear strong {
    color: #10934f;
  }

  .customer-account-received {
    border-color: #9cd9b5;
    background: linear-gradient(145deg, #f5fff9, #e9f9ef);
  }

  .customer-account-pending {
    border-color: #f3a0a0;
    background: linear-gradient(145deg, #fff8f8, #feecec);
  }

  .customer-account-clear {
    border-color: #9cd9b5;
    background: linear-gradient(145deg, #f5fff9, #e9f9ef);
  }

  .customer-detail-card-grid {
    display: grid;
    grid-template-columns:
      minmax(250px, 0.9fr)
      minmax(310px, 1.2fr)
      minmax(330px, 1.3fr);
    gap: 12px;
  }

  .customer-detail-card {
    min-width: 0;
    overflow: hidden;
    border: 1px solid #d2dfef;
    border-radius: 13px;
    background: #ffffff;
    box-shadow: 0 6px 16px rgba(15, 42, 95, 0.05);
  }

  .customer-detail-card-title {
    padding: 9px 12px;
    background: #143f82;
    color: #ffffff;
    font-size: 14px;
    font-weight: 950;
    letter-spacing: 0.45px;
    text-transform: uppercase;
  }

  .customer-detail-card-body {
    display: grid;
  }

  .customer-detail-row {
    display: grid;
    grid-template-columns: minmax(100px, 0.75fr) minmax(0, 1.25fr);
    align-items: center;
    gap: 10px;
    padding: 11px 12px;
    border-bottom: 1px solid #e3ebf4;
  }

  .customer-detail-row:last-child {
    border-bottom: 0;
  }

  .customer-detail-row > span {
    color: #60718a;
    font-size: 13px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .customer-detail-row > strong {
    color: #14213a;
    font-size: 17px;
    font-weight: 900;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .customer-detail-row-stack {
    grid-template-columns: 1fr;
    gap: 5px;
    align-items: start;
  }

  .customer-address-card-text {
    min-height: 116px;
    padding: 14px;
    color: #14213a;
    font-size: 18px;
    font-weight: 850;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .customer-card-edit {
    padding: 15px;
  }

  .customer-empty-card {
    padding: 34px 18px;
    border: 1px dashed #9db5d3;
    border-radius: 14px;
    background: #f7fbff;
    color: #52647f;
    text-align: center;
    font-size: 18px;
    font-weight: 900;
  }

  @media (max-width: 1300px) {
    .customer-detail-card-grid {
      grid-template-columns: repeat(2, minmax(280px, 1fr));
    }

    .customer-add-grid,
    .customer-edit-grid {
      grid-template-columns: repeat(3, minmax(170px, 1fr));
    }
  }

  @media (max-width: 900px) {
    .customer-card-header {
      grid-template-columns: 1fr;
    }

    .customer-card-header-meta,
    .customer-card-actions {
      justify-content: flex-start;
    }

    .customer-account-card-grid,
    .customer-detail-card-grid {
      grid-template-columns: 1fr;
    }

    .customer-add-grid,
    .customer-edit-grid {
      grid-template-columns: repeat(2, minmax(150px, 1fr));
    }

    .customer-search-controls > select,
    .customer-search-controls > button {
      flex: 1 1 150px;
    }
  }

  @media (max-width: 620px) {
    .customer-add-grid,
    .customer-edit-grid,
    .customer-live-suggestion {
      grid-template-columns: 1fr;
    }

    .customer-wide-field,
    .customer-edit-wide,
    .customer-rating-field {
      grid-column: auto;
    }

    .customer-detail-row {
      grid-template-columns: 1fr;
      align-items: start;
    }

    .customer-live-suggestions-head {
      display: grid;
    }
  }
`;
