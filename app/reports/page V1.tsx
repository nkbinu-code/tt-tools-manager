"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Printer, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

const shops = [
  "All Shops",
  "Karuvannur",
  "Ollur",
  "Kachery",
  "Mulayam Rd",
  "Pattikkad",
];

const statusOptions = [
  { id: "All Status", label: "All Status" },
  { id: "Live", label: "Live" },
  { id: "Not Paid", label: "Not Paid" },
  { id: "Paid", label: "Paid" },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

function monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function cleanDate(value: any) {
  return String(value || "").slice(0, 10);
}

function formatDate(value: any) {
  const v = cleanDate(value);
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-GB");
}

function rupee(value: any) {
  return `₹${Math.round(Number(value || 0))}`;
}

function rowShop(row: any) {
  return row?.shop || row?.branch || row?.return_branch || row?.active_branch || "";
}

function rowMobile(row: any, customer?: any) {
  return row?.mobile || row?.customer_mobile || row?.phone || customer?.mobile || "";
}

function rentalStart(row: any) {
  return cleanDate(row.start_date || row.date || row.rental_date || row.created_at);
}

function rentalEnd(row: any) {
  return cleanDate(row.end_date || row.return_date || row.closed_date || "");
}

function paymentDate(row: any) {
  return cleanDate(row.payment_date || row.date || row.created_at);
}

function isActiveRental(row: any) {
  const status = String(row?.status || "").toLowerCase();
  return status.includes("active") || status.includes("live") || !rentalEnd(row);
}

function isWithinRange(date: string, fromDate: string, toDate: string) {
  if (!date) return false;
  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  return true;
}

function overlapsRange(start: string, end: string, fromDate: string, toDate: string) {
  if (!start) return false;
  const realEnd = end || toDate || todayISO();
  if (fromDate && realEnd < fromDate) return false;
  if (toDate && start > toDate) return false;
  return true;
}

function countDays(startValue: any, endValue: any, avoidSundays = true) {
  const start = cleanDate(startValue);
  const end = cleanDate(endValue || todayISO());

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

function getReportPeriod(row: any, fromDate: string, toDate: string) {
  const start = rentalStart(row);
  const realEnd = rentalEnd(row) || toDate || todayISO();
  const from = fromDate && start < fromDate ? fromDate : start;
  const to = toDate && realEnd > toDate ? toDate : realEnd;
  return { from, to };
}

function rentalQty(row: any) {
  return Number(row.qty || row.quantity || 1);
}

function rentalRate(row: any, tool: any) {
  return Number(
    row.daily_rate ||
      row.unit_price ||
      row.daily_rent ||
      row.rent ||
      row.rate ||
      tool?.daily_rent ||
      tool?.daily_rate ||
      tool?.rent ||
      0
  );
}

function findCustomer(row: any, customers: any[]) {
  return customers.find(
    (c: any) =>
      String(c.id || "") === String(row.customer_id || "") ||
      (row.mobile && String(c.mobile || "") === String(row.mobile || ""))
  );
}

function findTool(row: any, tools: any[]) {
  return tools.find((t: any) => String(t.id || "") === String(row.tool_id || ""));
}

function displayCustomerName(row: any, customer: any) {
  return row.customer_name || row.name || row.customer || customer?.customer_name || customer?.name || "-";
}

function displayToolName(row: any, tool: any) {
  return row.tool_name || row.tool || row.item_name || row.description || tool?.tool_name || tool?.name || "-";
}

function statusKey(row: StatementRow) {
  if (row.isLive) return "Live";
  if (Number(row.balance || 0) <= 0) return "Paid";
  return "Not Paid";
}

function statusText(row: StatementRow) {
  const status = statusKey(row);
  if (status === "Live") return "🔵 Live";
  if (status === "Paid") return "✅ Paid";
  return "🔴 Not Paid";
}

function statusRank(row: StatementRow) {
  const status = statusKey(row);
  if (status === "Live") return 1;
  if (status === "Not Paid") return 2;
  return 3;
}

type BaseRentalRow = {
  original: any;
  from: string;
  to: string;
  shop: string;
  customerId: string;
  customer: string;
  mobile: string;
  toolId: string;
  tool: string;
  qty: number;
  rate: number;
  days: number;
  grossRent: number;
  rentalDiscount: number;
  isLive: boolean;
};

type StatementRow = {
  from: string;
  to: string;
  shop: string;
  customerId: string;
  customer: string;
  mobile: string;
  toolId: string;
  tool: string;
  qty: number;
  days: number;
  rate: number;
  grossRent: number;
  payment: number;
  discount: number;
  balance: number;
  isLive: boolean;
};

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState(monthStartISO());
  const [toDate, setToDate] = useState(todayISO());
  const [shopFilter, setShopFilter] = useState("All Shops");
  const [customerFilter, setCustomerFilter] = useState("All Customers");
  const [toolFilter, setToolFilter] = useState("All Tools");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [searchText, setSearchText] = useState("");

  const [customers, setCustomers] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [customersRes, rentalsRes, paymentsRes, toolsRes] = await Promise.all([
      supabase.from("customers").select("*"),
      supabase.from("rentals").select("*"),
      supabase.from("payments").select("*"),
      supabase.from("tools").select("*"),
    ]);

    setCustomers(customersRes.data || []);
    setRentals(rentalsRes.data || []);
    setPayments(paymentsRes.data || []);
    setTools(toolsRes.data || []);

    setLoading(false);
    setMessage("Business Statement refreshed");
    setTimeout(() => setMessage(""), 1800);
  }

  const baseRentalRows: BaseRentalRow[] = useMemo(() => {
    return rentals
      .filter((r: any) => {
        const start = rentalStart(r);
        const end = rentalEnd(r);
        const shopOk = shopFilter === "All Shops" || rowShop(r) === shopFilter;
        return shopOk && overlapsRange(start, end, fromDate, toDate);
      })
      .map((r: any) => {
        const customer = findCustomer(r, customers);
        const tool = findTool(r, tools);
        const { from, to } = getReportPeriod(r, fromDate, toDate);
        const avoidSundays = r.avoid_sundays === false || r.avoid_sundays === "false" ? false : true;
        const days = countDays(from, to, avoidSundays);
        const qty = rentalQty(r);
        const rate = rentalRate(r, tool);
        const grossRent = qty * rate * days;

        return {
          original: r,
          from,
          to,
          shop: rowShop(r),
          customerId: String(r.customer_id || customer?.id || ""),
          customer: displayCustomerName(r, customer),
          mobile: rowMobile(r, customer) || "-",
          toolId: String(r.tool_id || tool?.id || ""),
          tool: displayToolName(r, tool),
          qty,
          rate,
          days,
          grossRent,
          rentalDiscount: Number(r.discount || 0),
          isLive: isActiveRental(r),
        };
      });
  }, [rentals, customers, tools, shopFilter, fromDate, toDate]);

  const customerOptions = useMemo(() => {
    const map = new Map<string, string>();

    baseRentalRows.forEach((r: any) => {
      const key = r.customerId || r.mobile || r.customer;
      if (!key) return;
      map.set(key, `${r.customer} (${r.mobile})`);
    });

    return [{ id: "All Customers", label: "All Customers" }, ...Array.from(map).map(([id, label]) => ({ id, label }))];
  }, [baseRentalRows]);

  const toolOptions = useMemo(() => {
    const map = new Map<string, string>();

    baseRentalRows
      .filter((r: any) => customerFilter === "All Customers" || r.customerId === customerFilter || r.mobile === customerFilter)
      .forEach((r: any) => {
        const key = r.toolId || r.tool;
        if (!key) return;
        map.set(key, r.tool);
      });

    return [{ id: "All Tools", label: "All Tools" }, ...Array.from(map).map(([id, label]) => ({ id, label }))];
  }, [baseRentalRows, customerFilter]);

  const filteredRentalRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return baseRentalRows.filter((r: any) => {
      const customerOk = customerFilter === "All Customers" || r.customerId === customerFilter || r.mobile === customerFilter;
      const toolOk = toolFilter === "All Tools" || r.toolId === toolFilter || r.tool === toolFilter;
      const searchOk = !q || `${r.customer} ${r.mobile} ${r.tool} ${r.shop}`.toLowerCase().includes(q);

      return customerOk && toolOk && searchOk;
    });
  }, [baseRentalRows, customerFilter, toolFilter, searchText]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p: any) => {
      const date = paymentDate(p);
      const shopOk = shopFilter === "All Shops" || rowShop(p) === shopFilter;
      return shopOk && isWithinRange(date, fromDate, toDate);
    });
  }, [payments, shopFilter, fromDate, toDate]);

  const statementRows: StatementRow[] = useMemo(() => {
    const paymentGroups = new Map<string, any[]>();

    filteredPayments.forEach((p: any) => {
      const key = String(p.customer_id || rowMobile(p) || "unknown");
      if (!paymentGroups.has(key)) paymentGroups.set(key, []);
      paymentGroups.get(key)?.push(p);
    });

    const groupMap = new Map<string, BaseRentalRow[]>();

    filteredRentalRows.forEach((r: BaseRentalRow) => {
      const customerKey = r.customerId || r.mobile || r.customer;
      const toolKey = r.toolId || r.tool;
      const key = `${customerKey}__${toolKey}__${r.shop}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)?.push(r);
    });

    const groups = Array.from(groupMap.values()).map((items) => {
      const first = items[0];
      const isLive = items.some((r) => r.isLive);
      const from = items.map((r) => r.from).sort()[0];
      const to = isLive ? "LIVE" : items.map((r) => r.to).sort().slice(-1)[0];
      const qty = items.reduce((sum, r) => sum + Number(r.qty || 0), 0);
      const days = items.reduce((sum, r) => sum + Number(r.days || 0), 0);
      const grossRent = items.reduce((sum, r) => sum + Number(r.grossRent || 0), 0);
      const discount = items.reduce((sum, r) => sum + Number(r.rentalDiscount || 0), 0);
      const rate = items.length === 1 ? first.rate : grossRent > 0 && qty > 0 && days > 0 ? grossRent / days / Math.max(1, qty / items.length) : first.rate;

      return {
        from,
        to,
        shop: first.shop,
        customerId: first.customerId,
        customer: first.customer,
        mobile: first.mobile,
        toolId: first.toolId,
        tool: first.tool,
        qty,
        days,
        rate,
        grossRent,
        payment: 0,
        discount,
        balance: 0,
        isLive,
      };
    });

    const customerGrossTotals = new Map<string, number>();
    groups.forEach((g) => {
      const key = String(g.customerId || g.mobile || "unknown");
      customerGrossTotals.set(key, Number(customerGrossTotals.get(key) || 0) + Number(g.grossRent || 0));
    });

    const rows = groups.map((g) => {
      const customerKey = String(g.customerId || g.mobile || "unknown");
      const customerPayments = paymentGroups.get(customerKey) || [];
      const customerPaymentTotal = customerPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const customerPaymentDiscount = customerPayments.reduce((sum, p) => sum + Number(p.discount || 0), 0);
      const customerGross = Number(customerGrossTotals.get(customerKey) || 0);
      const share = customerGross > 0 ? Number(g.grossRent || 0) / customerGross : 1;
      const payment = customerPaymentTotal * share;
      const discount = Number(g.discount || 0) + customerPaymentDiscount * share;
      const balance = Math.max(0, Number(g.grossRent || 0) - payment - discount);

      return {
        ...g,
        payment,
        discount,
        balance,
      };
    });

    return rows
      .filter((row) => statusFilter === "All Status" || statusKey(row) === statusFilter)
      .sort((a, b) => {
        const statusDiff = statusRank(a) - statusRank(b);
        if (statusDiff !== 0) return statusDiff;
        return String(b.from).localeCompare(String(a.from));
      });
  }, [filteredRentalRows, filteredPayments, statusFilter]);

  const totals = useMemo(() => {
    const grossBusiness = statementRows.reduce((sum, r) => sum + Number(r.grossRent || 0), 0);
    const paymentsReceived = statementRows.reduce((sum, r) => sum + Number(r.payment || 0), 0);
    const discount = statementRows.reduce((sum, r) => sum + Number(r.discount || 0), 0);
    const outstanding = statementRows.reduce((sum, r) => sum + Number(r.balance || 0), 0);

    return {
      grossBusiness,
      discount,
      paymentsReceived,
      outstanding,
      records: statementRows.length,
      days: statementRows.reduce((sum, r) => sum + Number(r.days || 0), 0),
      qty: statementRows.reduce((sum, r) => sum + Number(r.qty || 0), 0),
    };
  }, [statementRows]);

  const subtitle = useMemo(() => {
    const parts = [];
    if (shopFilter !== "All Shops") parts.push(`${shopFilter} Shop`);
    if (customerFilter !== "All Customers") {
      const selected = customerOptions.find((c) => c.id === customerFilter)?.label;
      if (selected) parts.push(`Customer: ${selected}`);
    }
    if (toolFilter !== "All Tools") {
      const selected = toolOptions.find((t) => t.id === toolFilter)?.label;
      if (selected) parts.push(`Tool: ${selected}`);
    }
    if (statusFilter !== "All Status") parts.push(`Status: ${statusFilter}`);
    if (parts.length === 0) return "All Shops";
    return parts.join("  •  ");
  }, [shopFilter, customerFilter, toolFilter, statusFilter, customerOptions, toolOptions]);

  function downloadExcel() {
    const sheetData = [
      ["TRIED & TRUE TOOLS"],
      ["BUSINESS STATEMENT"],
      [subtitle],
      [`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`],
      [],
      ["From", "To", "Status", "Customer", "Mobile", "Tool", "Qty", "Days", "Rent", "Discount", "Balance"],
      ...statementRows.map((r) => [
        formatDate(r.from),
        r.to === "LIVE" ? "LIVE" : formatDate(r.to),
        statusText(r),
        r.customer,
        r.mobile,
        r.tool,
        r.qty,
        r.days,
        Math.round(Number(r.rate || 0)),
        Math.round(Number(r.discount || 0)),
        Math.round(Number(r.balance || 0)),
      ]),
      ["TOTAL", "", "", "", "", "", totals.qty, totals.days, totals.grossBusiness, totals.discount, totals.outstanding],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 24 },
      { wch: 14 },
      { wch: 30 },
      { wch: 8 },
      { wch: 8 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
    ];

    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 10 } },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Business Statement");
    XLSX.writeFile(workbook, `Business_Statement_${fromDate}_to_${toDate}.xlsx`);
  }

  function printStatement() {
    window.print();
  }

  return (
    <main>
      <style>{printStyles}</style>

      <section style={statementShellStyle}>
        <div style={statementHeaderStyle}>
          <div>
            <div style={brandStyle}>TRIED & TRUE TOOLS</div>
            <h1 style={titleStyle}>BUSINESS STATEMENT</h1>
            <p style={subtitleStyle}>{subtitle}</p>
            <p style={periodStyle}>Period: {formatDate(fromDate)} to {formatDate(toDate)}</p>
          </div>

          <div style={actionWrapStyle} className="no-print">
            <button className="btn-gray" type="button" onClick={loadData} disabled={loading}>
              <RefreshCw size={16} /> {loading ? "Loading" : "Refresh"}
            </button>
            <button className="btn-blue" type="button" onClick={downloadExcel}>
              <Download size={16} /> Excel
            </button>
            <button className="btn-gray" type="button" onClick={printStatement}>
              <Printer size={16} /> Print
            </button>
          </div>
        </div>

        {message && <div className="modern-message no-print">{message}</div>}

        <div style={filterPanelStyle} className="no-print">
          <label style={filterLabelStyle}>
            From Date
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>

          <label style={filterLabelStyle}>
            To Date
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>

          <label style={filterLabelStyle}>
            Shop
            <select value={shopFilter} onChange={(e) => { setShopFilter(e.target.value); setCustomerFilter("All Customers"); setToolFilter("All Tools"); }}>
              {shops.map((shop) => <option key={shop}>{shop}</option>)}
            </select>
          </label>

          <label style={filterLabelStyle}>
            Customer
            <select value={customerFilter} onChange={(e) => { setCustomerFilter(e.target.value); setToolFilter("All Tools"); }}>
              {customerOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>

          <label style={filterLabelStyle}>
            Tool
            <select value={toolFilter} onChange={(e) => setToolFilter(e.target.value)}>
              {toolOptions.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>

          <label style={filterLabelStyle}>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {statusOptions.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>

          <label style={filterLabelStyle}>
            Search
            <div style={searchBoxStyle}>
              <Search size={16} />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Name / Mobile / Tool"
                style={{ border: 0, padding: 0, outline: "none", width: "100%" }}
              />
            </div>
          </label>
        </div>

        <div style={summaryGridStyle}>
          <SummaryBox title="Total Business" value={rupee(totals.grossBusiness)} />
          <SummaryBox title="Payments" value={rupee(totals.paymentsReceived)} />
          <SummaryBox title="Discount" value={rupee(totals.discount)} />
          <SummaryBox title="Balance" value={rupee(totals.outstanding)} danger />
          <SummaryBox title="Rows" value={totals.records} />
          <SummaryBox title="Days" value={totals.days} />
        </div>

        <div style={tableFrameStyle}>
          <table style={statementTableStyle}>
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Status</th>
                <th>Customer</th>
                <th>Mobile</th>
                <th>Tool</th>
                <th style={{ textAlign: "right" }}>Qty</th>
                <th style={{ textAlign: "right" }}>Days</th>
                <th style={{ textAlign: "right" }}>Rent</th>
                <th style={{ textAlign: "right" }}>Discount</th>
                <th style={{ textAlign: "right" }}>Balance</th>
              </tr>
            </thead>

            <tbody>
              {statementRows.map((row, index) => (
                <tr key={`${row.mobile}-${row.tool}-${row.from}-${index}`}>
                  <td>{formatDate(row.from)}</td>
                  <td style={{ fontWeight: 950, color: row.to === "LIVE" ? "#0057ff" : "#0f172a" }}>
                    {row.to === "LIVE" ? "🔵 LIVE" : formatDate(row.to)}
                  </td>
                  <td style={{ fontWeight: 950 }}>
                    <span
                      style={{
                        ...statusBadgeStyle,
                        ...(statusKey(row) === "Live"
                          ? liveBadgeStyle
                          : statusKey(row) === "Paid"
                          ? paidBadgeStyle
                          : notPaidBadgeStyle),
                      }}
                    >
                      {statusText(row)}
                    </span>
                  </td>
                  <td><strong>{row.customer}</strong></td>
                  <td style={{ fontWeight: 800 }}>{row.mobile}</td>
                  <td>{row.tool}</td>
                  <td style={{ textAlign: "right", fontWeight: 800 }}>{row.qty}</td>
                  <td style={{ textAlign: "right", fontWeight: 800 }}>{row.days}</td>
                  <td style={{ textAlign: "right", fontWeight: 900 }}>{rupee(row.rate)}</td>
                  <td style={{ textAlign: "right", fontWeight: 900 }}>{rupee(row.discount)}</td>
                  <td style={{ textAlign: "right", fontWeight: 950, color: Number(row.balance || 0) > 0 ? "#b91c1c" : "#166534" }}>{rupee(row.balance)}</td>
                </tr>
              ))}

              {statementRows.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", padding: 24, fontWeight: 900 }}>
                    No business statement data found
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot>
              <tr>
                <td colSpan={6}>TOTAL</td>
                <td style={{ textAlign: "right" }}>{totals.qty}</td>
                <td style={{ textAlign: "right" }}>{totals.days}</td>
                <td style={{ textAlign: "right" }}>{rupee(totals.grossBusiness)}</td>
                <td style={{ textAlign: "right" }}>{rupee(totals.discount)}</td>
                <td style={{ textAlign: "right" }}>{rupee(totals.outstanding)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </main>
  );
}

function SummaryBox({ title, value, danger = false }: any) {
  return (
    <div style={{ ...summaryBoxStyle, borderColor: danger ? "#fecaca" : "#bfdbfe", background: danger ? "#fef2f2" : "#eff6ff" }}>
      <div style={{ fontSize: 12, fontWeight: 950, color: "#475569", textTransform: "uppercase" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 1000, color: danger ? "#b91c1c" : "#0f2a5f" }}>{value}</div>
    </div>
  );
}

const statementShellStyle: any = {
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid #bfdbfe",
  boxShadow: "0 18px 45px rgba(15, 42, 95, 0.10)",
  overflow: "hidden",
};

const statementHeaderStyle: any = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  background: "linear-gradient(135deg, #0f2a5f, #0057ff)",
  color: "white",
  padding: "22px 24px",
};

const brandStyle: any = {
  fontSize: 25,
  fontWeight: 1000,
  letterSpacing: 1.6,
  opacity: 0.92,
};

const titleStyle: any = {
  margin: "12px 0 12px",
  fontSize: 76,
  lineHeight: 1.15,
  fontWeight: 1000,
  color: "#ffffff",
  letterSpacing: 1,
};

const subtitleStyle: any = {
  margin: 0,
  fontSize: 30,
  fontWeight: 850,
  opacity: 0.94,
};

const periodStyle: any = {
  margin: "6px 0 0",
  fontSize: 18,
  fontWeight: 800,
  opacity: 0.85,
};

const actionWrapStyle: any = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const filterPanelStyle: any = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(140px, 1fr))",
  gap: 12,
  padding: 18,
  background: "#f8fbff",
  borderBottom: "1px solid #dbeafe",
};

const filterLabelStyle: any = {
  display: "grid",
  gap: 6,
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 950,
};

const searchBoxStyle: any = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  height: 42,
  padding: "0 12px",
  background: "white",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
};

const summaryGridStyle: any = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(130px, 1fr))",
  gap: 12,
  padding: 18,
};

const summaryBoxStyle: any = {
  border: "1px solid #bfdbfe",
  borderRadius: 14,
  padding: "13px 14px",
};

const tableFrameStyle: any = {
  margin: "0 18px 18px",
  overflow: "auto",
  border: "1px solid #0f2a5f",
  borderRadius: 14,
  maxHeight: "70vh",
};

const statementTableStyle: any = {
  width: "100%",
  minWidth: 1080,
  borderCollapse: "collapse",
  fontSize: 14,
};

const statusBadgeStyle: any = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 98,
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 1000,
  border: "1px solid transparent",
};

const liveBadgeStyle: any = {
  color: "#0057ff",
  background: "#eff6ff",
  borderColor: "#bfdbfe",
};

const notPaidBadgeStyle: any = {
  color: "#b91c1c",
  background: "#fef2f2",
  borderColor: "#fecaca",
};

const paidBadgeStyle: any = {
  color: "#166534",
  background: "#f0fdf4",
  borderColor: "#bbf7d0",
};

const printStyles = `
  table th {
    position: sticky;
    top: 0;
    background: #0f2a5f;
    color: white;
    padding: 11px 10px;
    font-weight: 950;
    border: 1px solid #0b214d;
    white-space: nowrap;
  }

  table td {
    padding: 10px;
    border: 1px solid #dbeafe;
    color: #0f172a;
    background: white;
    white-space: nowrap;
  }

  table tbody tr:nth-child(even) td {
    background: #f8fbff;
  }

  table tfoot td {
    position: sticky;
    bottom: 0;
    background: #071735 !important;
    color: white;
    font-size: 15px;
    font-weight: 1000;
    border-color: #071735;
  }

  @media (max-width: 900px) {
    main { padding: 10px !important; }
    .no-print { display: flex; }
  }

  @media print {
    body { background: white !important; }
    main { padding: 0 !important; }
    .no-print { display: none !important; }
    table th { position: static !important; }
    table tfoot td { position: static !important; }
  }
`;
