"use server";

import { supabase } from "@/lib/supabase";

const DEFAULT_BRANCHES = [
  "All Shops",
  "Karuvannur",
  "Ollur",
  "Kachery",
  "Mulayam Rd",
  "Pattikkad",
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function countDays(start: any, end?: any, avoidSundays = false) {
  if (!start) return 1;

  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date(todayISO());

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

function calcRentalAmount(r: any) {
  const qty = Number(r.qty || 1);
  const rate = Number(r.daily_rate || r.daily_rent || 0);
  const discount = Number(r.discount || 0);
  const avoidSundays = r.avoid_sundays !== false;

  if (Number(r.total_amount || 0) > 0) {
    return Number(r.total_amount || 0);
  }

  const days = countDays(r.start_date || r.date, r.end_date, avoidSundays);
  return Math.max(qty * rate * days - discount, 0);
}

export async function getBranches() {
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .order("branch_name");

  if (error || !data || data.length === 0) {
    return DEFAULT_BRANCHES;
  }

  const dbBranches = data
    .map((b: any) => b.branch_name || b.name)
    .filter(Boolean);

  return ["All Shops", ...dbBranches];
}

export async function getReportData(shop: string = "All Shops") {
  const rentalsRes = await supabase
    .from("rentals")
    .select("*")
    .order("start_date", { ascending: false });

  const customersRes = await supabase.from("customers").select("*");
  const toolsRes = await supabase.from("tools").select("*");
  const paymentsRes = await supabase.from("payments").select("*");

  if (rentalsRes.error) return { success: false, message: rentalsRes.error.message };
  if (customersRes.error) return { success: false, message: customersRes.error.message };
  if (toolsRes.error) return { success: false, message: toolsRes.error.message };
  if (paymentsRes.error) return { success: false, message: paymentsRes.error.message };

  let rentals = rentalsRes.data || [];
  const customers = customersRes.data || [];
  const tools = toolsRes.data || [];
  const payments = paymentsRes.data || [];

  if (shop !== "All Shops") {
    rentals = rentals.filter((r: any) => (r.shop || r.branch || "") === shop);
  }

  const rows = rentals.map((r: any) => {
    const customer = customers.find(
      (c: any) => Number(c.id) === Number(r.customer_id)
    );

    const tool = tools.find((t: any) => Number(t.id) === Number(r.tool_id));

    const rent = calcRentalAmount(r);

    const received = payments
      .filter((p: any) => Number(p.customer_id) === Number(r.customer_id))
      .filter((p: any) =>
        shop === "All Shops" ? true : (p.shop || p.branch || "") === shop
      )
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    return {
      date: r.start_date || r.date || "",
      customer: customer?.customer_name || "",
      mobile: customer?.mobile || "",
      tool: tool?.tool_name || "",
      shop: r.shop || r.branch || "",
      days: countDays(
        r.start_date || r.date,
        r.end_date,
        r.avoid_sundays !== false
      ),
      rent,
      received,
      balance: rent - received,
      status: r.status || "",
    };
  });

  const totalRent = rows.reduce((sum, r) => sum + Number(r.rent || 0), 0);
  const totalReceived = rows.reduce((sum, r) => sum + Number(r.received || 0), 0);
  const totalBalance = totalRent - totalReceived;
  const activeRentals = rows.filter((r) => r.status === "Active").length;
  const returnedRentals = rows.filter((r) => r.status === "Returned").length;

  return {
    success: true,
    data: {
      rows,
      summary: {
        totalRent,
        totalReceived,
        totalBalance,
        activeRentals,
        returnedRentals,
      },
    },
  };
}

export async function getExpenseReportData(filters: {
  month: string;
  year: string;
  source?: string;
  shop?: string;
  category?: string;
}) {
  const month = String(filters.month).padStart(2, "0");
  const year = String(filters.year);

  const startDate = `${year}-${month}-01`;
  const endDate = new Date(Number(year), Number(month), 0)
    .toISOString()
    .slice(0, 10);

  const expensesRes = await supabase
    .from("expenses")
    .select("*")
    .gte("expense_date", startDate)
    .lte("expense_date", endDate)
    .order("expense_date", { ascending: false });

  const servicesRes = await supabase
    .from("services")
    .select("*")
    .eq("status", "Returned")
    .gte("return_date", startDate)
    .lte("return_date", endDate)
    .order("return_date", { ascending: false });

  if (expensesRes.error) {
    return { success: false, message: expensesRes.error.message };
  }

  if (servicesRes.error) {
    return { success: false, message: servicesRes.error.message };
  }

  const expenseRows = (expensesRes.data || []).map((row: any) => ({
    source: "Expense Page",
    date: row.expense_date || "",
    shop: row.shop || "",
    category: row.category || "",
    service_centre: "",
    tool: "",
    description: row.description || "",
    work_done: "",
    payment_mode: row.payment_mode || "",
    amount: Number(row.amount || 0),
    remarks: row.remarks || "",
  }));

  const serviceRows = (servicesRes.data || []).map((row: any) => ({
    source: "Service Page",
    date: row.return_date || "",
    shop: row.return_branch || "",
    category: "Service Cost",
    service_centre: row.service_centre || "",
    tool: row.tool_name || "",
    description: row.complaint || "",
    work_done: row.work_done || "",
    payment_mode: "",
    amount: Number(row.amount || 0),
    remarks: row.return_remarks || "",
  }));

  let rows = [...expenseRows, ...serviceRows];

  if (filters.source && filters.source !== "All") {
    rows = rows.filter((r) => r.source === filters.source);
  }

  if (filters.shop && filters.shop !== "All") {
    rows = rows.filter((r) => r.shop === filters.shop);
  }

  if (filters.category && filters.category !== "All") {
    rows = rows.filter((r) => r.category === filters.category);
  }

  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const totalExpense = rows.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );

  const expensePageTotal = rows
    .filter((row) => row.source === "Expense Page")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const servicePageTotal = rows
    .filter((row) => row.source === "Service Page")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return {
    success: true,
    data: {
      rows,
      summary: {
        totalExpense,
        expensePageTotal,
        servicePageTotal,
        totalRows: rows.length,
        startDate,
        endDate,
      },
    },
  };
}