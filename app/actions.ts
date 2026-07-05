"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import {
  calcRentalAmount as commonCalcRentalAmount,
  countDays as commonCountDays,
  buildCustomerBalanceRows,
  calcSystemTotals,
} from "./calculations";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function calcDays(start: string, end?: string | null, avoidSundays = false) {
  return commonCountDays(start, end, avoidSundays);
}

function calcRentalAmount(r: any) {
  return commonCalcRentalAmount(r);
}

function buildCustomerBalances(
  customers: any[],
  rentals: any[],
  payments: any[]
) {
  return buildCustomerBalanceRows(customers, rentals, payments).map((row: any) => ({
    ...row,
    rental_total: row.total_business || row.business || 0,
    received_total: row.total_paid || row.received || 0,
    discount_total: row.total_discount || row.discount || 0,
    balance: row.balance || 0,
  }));
}

/* DASHBOARD */

export async function getDashboardStats() {
  const branches = ["Karuvannur", "Ollur", "Kachery", "Mulayam Rd", "Pattikkad"];

  const toolsRes = await supabase.from("tools").select("*");
  const rentalsRes = await supabase.from("rentals").select("*");
  const paymentsRes = await supabase.from("payments").select("*");
  const servicesRes = await supabase.from("services").select("*");
  const customersRes = await supabase.from("customers").select("*");

  const tools = toolsRes.error ? [] : toolsRes.data || [];
  const rentals = rentalsRes.error ? [] : rentalsRes.data || [];
  const payments = paymentsRes.error ? [] : paymentsRes.data || [];
  const services = servicesRes.error ? [] : servicesRes.data || [];
  const customers = customersRes.error ? [] : customersRes.data || [];

  const today = todayISO();
  const todayDate = new Date(today);
  const monthStart = today.slice(0, 7);

  const systemTotals = calcSystemTotals(customers, rentals, payments);
  const pendingBalance = Math.max(systemTotals.balance, 0);

  const shopStats = branches.map((shop) => {
    const shopRentals = rentals.filter((r) => r.shop === shop);
    const shopPayments = payments.filter((p) => p.shop === shop);

    const todayBusiness = shopRentals
      .filter((r) => r.start_date === today || r.end_date === today)
      .reduce((sum, r) => sum + calcRentalAmount(r), 0);

    const businessTillNow = shopRentals.reduce(
      (sum, r) => sum + calcRentalAmount(r),
      0
    );

    const monthRentals = shopRentals.filter(
      (r) =>
        String(r.start_date || "").startsWith(monthStart) ||
        String(r.end_date || "").startsWith(monthStart)
    );

    const monthPayments = shopPayments.filter((p) =>
      String(p.payment_date || "").startsWith(monthStart)
    );

    const monthCustomers = customers.filter((c) => c.shop === shop);

    const monthTotals = calcSystemTotals(
      monthCustomers,
      monthRentals,
      monthPayments
    );

    return {
      shop,
      todayBusiness,
      businessTillNow,
      monthBalance: Math.max(monthTotals.balance, 0),
    };
  });

  function daysSince(dateValue: any) {
    if (!dateValue) return null;
    const d = new Date(String(dateValue).slice(0, 10));
    if (Number.isNaN(d.getTime())) return null;
    return Math.floor(
      (todayDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  function maintenanceAlert(
    tool: any,
    type: string,
    lastDate: any,
    dueDaysValue: any,
    color: string
  ) {
    const dueDays = Number(dueDaysValue || 0);
    const elapsed = daysSince(lastDate);

    if (!dueDays || elapsed === null) return null;

    const daysLeft = dueDays - elapsed;

    if (daysLeft > 3) return null;

    return {
      type,
      color,
      level: daysLeft < 0 ? "danger" : daysLeft === 0 ? "today" : "warning",
      tool_name: tool.tool_name || "",
      location: tool.current_location || tool.home_branch || "",
      daysLeft,
      message:
        daysLeft < 0
          ? `${tool.tool_name} ${type.toLowerCase()} overdue by ${Math.abs(
              daysLeft
            )} day(s)`
          : daysLeft === 0
          ? `${tool.tool_name} ${type.toLowerCase()} due today`
          : `${tool.tool_name}: ${daysLeft} day(s) left for ${type.toLowerCase()}`,
    };
  }

  const maintenanceAlerts = tools
    .flatMap((tool: any) => [
      maintenanceAlert(
        tool,
        "Greasing",
        tool.last_greasing_date,
        tool.greasing_due_days,
        "yellow"
      ),
      maintenanceAlert(
        tool,
        "Oil Change",
        tool.last_oil_change_date,
        tool.oil_change_due_days,
        "blue"
      ),
      maintenanceAlert(
        tool,
        "Scheduled Service",
        tool.last_scheduled_service_date,
        tool.scheduled_service_due_days,
        "orange"
      ),
    ])
    .filter(Boolean)
    .sort((a: any, b: any) => Number(a.daysLeft) - Number(b.daysLeft));

  const rentalOverdueAlerts: any[] = [];

  rentals
    .filter((r: any) => r.status === "Active")
    .forEach((r: any) => {
      const tool = tools.find((t: any) => Number(t.id) === Number(r.tool_id));
      if (!tool) return;

      const overdueDays = Number(tool.rental_overdue_days || 0);
      if (!overdueDays) return;

      const days = calcDays(r.start_date, null, r.avoid_sundays !== false);

      if (days > overdueDays) {
        const customer = customers.find(
          (c: any) => Number(c.id) === Number(r.customer_id)
        );

        rentalOverdueAlerts.push({
          type: "Rental Overdue",
          level: "danger",
          tool_name: tool.tool_name,
          customer: customer
            ? `${customer.customer_name} - ${customer.mobile}`
            : "Unknown",
          shop: r.shop || "",
          days,
          overdueDays,
          message: `${tool.tool_name} is rented for ${days} day(s). Limit is ${overdueDays}.`,
        });
      }
    });

  return {
    totalTools: tools.length,
    activeRentals: rentals.filter((r) => r.status === "Active").length,
    toolsInService: tools.filter(
      (t) => t.status === "Service" || t.status === "In Service"
    ).length,
    missingTools: tools.filter((t) => t.status === "Missing").length,
    pendingBalance,
    todayBusiness: shopStats.reduce((sum, s) => sum + s.todayBusiness, 0),
    todayCollections: payments
      .filter((p) => p.payment_date === today)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    serviceCost: services.reduce(
      (sum, s) => sum + Number(s.cost || s.amount || 0),
      0
    ),
    shopStats,
    maintenanceAlerts,
    rentalOverdueAlerts,
  };
}

/* TOOLS */

export async function getTools(search: string = "") {
  let query = supabase.from("tools").select("*").order("tool_name");

  if (search.trim()) {
    const s = search.trim();
    query = query.or(
      `tool_name.ilike.%${s}%,category.ilike.%${s}%,brand.ilike.%${s}%,color.ilike.%${s}%,home_branch.ilike.%${s}%,current_location.ilike.%${s}%,status.ilike.%${s}%`
    );
  }

  const { data, error } = await query;
  if (error) return { success: false, message: error.message, data: [] };

  return { success: true, message: "Tools loaded", data: data || [] };
}

export async function saveTools(rows: any[]) {
  const filledRows = rows
    .filter((row) => row.tool_name && row.tool_name.trim() !== "")
    .map((row) => ({
      tool_name: row.tool_name.trim(),
      total_qty: Number(row.total_qty || 1),
      daily_rent: Number(row.daily_rent || 0),
      category: row.category || "",
      brand: row.brand || "",
      color: row.color || "",
      home_branch: row.home_branch || "",
      current_location: row.current_location || row.home_branch || "",
      status: row.status || "Available",
      greasing_due_days: Number(row.greasing_due_days || 0),
      oil_change_due_days: Number(row.oil_change_due_days || 0),
      scheduled_service_due_days: Number(row.scheduled_service_due_days || 0),
      rental_overdue_days: Number(row.rental_overdue_days || 0),
    }));

  if (filledRows.length === 0) {
    return { success: false, message: "No tools to save" };
  }

  const { error } = await supabase.from("tools").insert(filledRows);
  if (error) return { success: false, message: error.message };

  revalidatePath("/tools");
  return { success: true, message: "Tools saved successfully" };
}

export async function updateTool(id: number, row: any) {
  const { error } = await supabase
    .from("tools")
    .update({
      tool_name: row.tool_name || "",
      total_qty: Number(row.total_qty || 1),
      daily_rent: Number(row.daily_rent || 0),
      category: row.category || "",
      brand: row.brand || "",
      color: row.color || "",
      home_branch: row.home_branch || "",
      current_location: row.current_location || "",
      status: row.status || "Available",
      greasing_due_days: Number(row.greasing_due_days || 0),
      oil_change_due_days: Number(row.oil_change_due_days || 0),
      scheduled_service_due_days: Number(row.scheduled_service_due_days || 0),
      rental_overdue_days: Number(row.rental_overdue_days || 0),
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/tools");
  return { success: true, message: "Tool updated successfully" };
}

export async function deleteTool(id: number) {
  const { error } = await supabase.from("tools").delete().eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/tools");
  return { success: true, message: "Tool deleted successfully" };
}

/* CUSTOMERS */

export async function getCustomers(search: string = "") {
  const customersRes = await supabase
    .from("customers")
    .select("*")
    .order("customer_name");

  const rentalsRes = await supabase.from("rentals").select("*");
  const paymentsRes = await supabase.from("payments").select("*");

  if (customersRes.error) {
    return { success: false, message: customersRes.error.message, data: [] };
  }

  if (rentalsRes.error) {
    return { success: false, message: rentalsRes.error.message, data: [] };
  }

  if (paymentsRes.error) {
    return { success: false, message: paymentsRes.error.message, data: [] };
  }

  let data = buildCustomerBalances(
    customersRes.data || [],
    rentalsRes.data || [],
    paymentsRes.data || []
  );

  if (search.trim()) {
    const s = search.toLowerCase();

    data = data.filter((c) =>
      `${c.customer_name} ${c.mobile} ${c.occupation} ${c.address} ${c.shop}`
        .toLowerCase()
        .includes(s)
    );
  }

  return { success: true, message: "Customers loaded", data };
}

export async function saveCustomer(row: any) {
  if (!row.customer_name || !row.mobile) {
    return {
      success: false,
      message: "Customer name and mobile are required",
    };
  }

  const mobile = String(row.mobile || "").trim();
  const customerName = String(row.customer_name || "").trim();

  const { data: existing, error: findError } = await supabase
    .from("customers")
    .select("id")
    .eq("mobile", mobile)
    .maybeSingle();

  if (findError) {
    return {
      success: false,
      message: findError.message,
    };
  }

  let error;

  if (existing) {
    ({ error } = await supabase
      .from("customers")
      .update({
        customer_name: customerName,
        occupation: row.occupation || "",
        address: row.address || "",
        shop: row.shop || "",
        notes: row.notes || "",
      })
      .eq("id", existing.id));
  } else {
    ({ error } = await supabase.from("customers").insert({
      customer_name: customerName,
      mobile,
      occupation: row.occupation || "",
      address: row.address || "",
      shop: row.shop || "",
      notes: row.notes || "",
    }));
  }

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/customers");
  revalidatePath("/rentals");

  return {
    success: true,
    message: existing
      ? "Customer updated successfully"
      : "Customer saved successfully",
  };
}

export async function updateCustomer(id: number, row: any) {
  const { error } = await supabase
    .from("customers")
    .update({
      customer_name: row.customer_name || "",
      mobile: row.mobile || "",
      occupation: row.occupation || "",
      address: row.address || "",
      shop: row.shop || "",
      notes: row.notes || "",
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/customers");
  return { success: true, message: "Customer updated successfully" };
}

export async function deleteCustomer(id: number) {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/customers");
  return { success: true, message: "Customer deleted successfully" };
}

/* RENTALS */

export async function getRentalPageData() {
  const customersRes = await supabase
    .from("customers")
    .select("*")
    .order("customer_name");

  const toolsRes = await supabase.from("tools").select("*").order("tool_name");

  const rentalsRes = await supabase
    .from("rentals")
    .select("*")
    .order("created_at", { ascending: false });

  if (customersRes.error) {
    return { success: false, message: customersRes.error.message };
  }

  if (toolsRes.error) {
    return { success: false, message: toolsRes.error.message };
  }

  if (rentalsRes.error) {
    return { success: false, message: rentalsRes.error.message };
  }

  return {
    success: true,
    customers: customersRes.data || [],
    tools: toolsRes.data || [],
    rentals: rentalsRes.data || [],
  };
}

function cleanRentalRow(row: any) {
  const qty = Number(row.qty || 1);
  const dailyRate = Number(row.daily_rate || 0);
  const discount = Number(row.discount || 0);
  const avoidSundays = row.avoid_sundays !== false;

  const totalAmount =
    row.status === "Returned"
      ? Math.max(qty * dailyRate * calcDays(row.start_date, row.end_date, avoidSundays) - discount, 0)
      : 0;

  return {
    customer_id: Number(row.customer_id),
    tool_id: Number(row.tool_id),
    qty,
    daily_rate: dailyRate,
    discount,
    start_date: row.start_date,
    end_date: row.end_date || null,
    status: row.status || "Active",
    total_amount: totalAmount,
    payment_status: row.payment_status || "Not Paid",
    shop: row.shop || "",
    avoid_sundays: avoidSundays,
  };
}

export async function saveRental(row: any) {
  if (!row.customer_id || !row.tool_id || !row.start_date) {
    return {
      success: false,
      message: "Customer, tool and start date are required",
    };
  }

  const { error } = await supabase.from("rentals").insert(cleanRentalRow(row));

  if (error) return { success: false, message: error.message };

  revalidatePath("/rentals");
  revalidatePath("/customers");
  revalidatePath("/collections");
  revalidatePath("/");
  return { success: true, message: "Rental saved successfully" };
}

export async function saveRentals(rows: any[]) {
  const validRows = rows
    .filter((row) => row.customer_id && row.tool_id && row.start_date)
    .map((row) => cleanRentalRow(row));

  if (validRows.length === 0) {
    return { success: false, message: "No valid rentals to save" };
  }

  const { error } = await supabase.from("rentals").insert(validRows);

  if (error) return { success: false, message: error.message };

  revalidatePath("/rentals");
  revalidatePath("/customers");
  revalidatePath("/collections");
  revalidatePath("/");
  return {
    success: true,
    message: `${validRows.length} rentals saved successfully`,
  };
}

export async function returnRental(id: number, endDate: string) {
  const { data, error: readError } = await supabase
    .from("rentals")
    .select("*")
    .eq("id", id)
    .single();

  if (readError) return { success: false, message: readError.message };

  const qty = Number(data.qty || 1);
  const dailyRate = Number(data.daily_rate || 0);
  const discount = Number(data.discount || 0);
  const avoidSundays = data.avoid_sundays !== false;

  const totalAmount = Math.max(
    qty * dailyRate * calcDays(data.start_date, endDate, avoidSundays) - discount,
    0
  );

  const { error } = await supabase
    .from("rentals")
    .update({
      end_date: endDate,
      status: "Returned",
      total_amount: totalAmount,
      payment_status: "Pending",
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/rentals");
  revalidatePath("/customers");
  revalidatePath("/collections");
  revalidatePath("/");
  return { success: true, message: "Rental returned successfully" };
}

export async function deleteRental(id: number) {
  const { error } = await supabase.from("rentals").delete().eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/rentals");
  revalidatePath("/customers");
  revalidatePath("/collections");
  revalidatePath("/");
  return { success: true, message: "Rental deleted successfully" };
}

/* PAYMENTS */

export async function getPaymentPageData(search: string = "") {
  const customersRes = await supabase
    .from("customers")
    .select("*")
    .order("customer_name");

  const paymentsRes = await supabase
    .from("payments")
    .select("*")
    .order("payment_date", { ascending: false });

  if (customersRes.error) {
    return { success: false, message: customersRes.error.message };
  }

  if (paymentsRes.error) {
    return { success: false, message: paymentsRes.error.message };
  }

  let payments = paymentsRes.data || [];
  const customers = customersRes.data || [];

  if (search.trim()) {
    const s = search.toLowerCase();

    payments = payments.filter((p: any) => {
      const c = customers.find(
        (x: any) => Number(x.id) === Number(p.customer_id)
      );

      const customerText = c
        ? `${c.customer_name} ${c.mobile} ${c.occupation}`.toLowerCase()
        : "";

      return (
        customerText.includes(s) ||
        String(p.amount || "").includes(s) ||
        String(p.payment_mode || p.mode || "").toLowerCase().includes(s) ||
        String(p.shop || "").toLowerCase().includes(s) ||
        String(p.remarks || "").toLowerCase().includes(s)
      );
    });
  }

  return {
    success: true,
    customers,
    payments,
  };
}

export async function savePayment(row: any) {
  if (!row.customer_id || !row.amount || !row.payment_date) {
    return { success: false, message: "Customer, amount and date are required" };
  }

  const { error } = await supabase.from("payments").insert({
    customer_id: Number(row.customer_id),
    customer_name: row.customer_name || "",
    mobile: row.mobile || "",
    amount: Number(row.amount || 0),
    discount: Number(row.discount || 0),
    payment_mode: row.payment_mode || row.mode || "Cash",
    mode: row.mode || row.payment_mode || "Cash",
    payment_date: row.payment_date,
    remarks: row.remarks || "",
    shop: row.shop || "",
  });

  if (error) return { success: false, message: error.message };

  revalidatePath("/payments");
  revalidatePath("/customers");
  revalidatePath("/collections");
  revalidatePath("/reports");
  revalidatePath("/");
  return { success: true, message: "Payment saved successfully" };
}

export async function updatePayment(id: number, row: any) {
  const { error } = await supabase
    .from("payments")
    .update({
      customer_id: Number(row.customer_id),
      customer_name: row.customer_name || "",
      mobile: row.mobile || "",
      amount: Number(row.amount || 0),
      discount: Number(row.discount || 0),
      payment_mode: row.payment_mode || row.mode || "Cash",
      mode: row.mode || row.payment_mode || "Cash",
      payment_date: row.payment_date,
      remarks: row.remarks || "",
      shop: row.shop || "",
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/payments");
  revalidatePath("/customers");
  revalidatePath("/collections");
  revalidatePath("/reports");
  revalidatePath("/");
  return { success: true, message: "Payment updated successfully" };
}

export async function deletePayment(id: number) {
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/payments");
  revalidatePath("/customers");
  revalidatePath("/collections");
  revalidatePath("/reports");
  revalidatePath("/");
  return { success: true, message: "Payment deleted successfully" };
}

/* COLLECTIONS */

export async function getCollectionsData() {
  const customersRes = await supabase
    .from("customers")
    .select("*")
    .order("customer_name");

  const rentalsRes = await supabase.from("rentals").select("*");
  const paymentsRes = await supabase.from("payments").select("*");

  if (customersRes.error) {
    return { success: false, message: customersRes.error.message };
  }

  if (rentalsRes.error) {
    return { success: false, message: rentalsRes.error.message };
  }

  if (paymentsRes.error) {
    return { success: false, message: paymentsRes.error.message };
  }

  const balances = buildCustomerBalances(
    customersRes.data || [],
    rentalsRes.data || [],
    paymentsRes.data || []
  )
    .filter((c) => Number(c.balance || 0) > 0)
    .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));

  return {
    success: true,
    data: balances,
  };
}

/* SERVICE */

export async function getServicePageData(search: string = "") {
  const toolsRes = await supabase.from("tools").select("*").order("tool_name");

  const servicesRes = await supabase
    .from("services")
    .select("*")
    .order("date_out", { ascending: false });

  const centresRes = await supabase
    .from("service_centres")
    .select("*")
    .order("name");

  if (toolsRes.error) {
    return {
      success: false,
      message: toolsRes.error.message,
      tools: [],
      services: [],
      serviceCentres: [],
    };
  }

  if (servicesRes.error) {
    return {
      success: false,
      message: servicesRes.error.message,
      tools: [],
      services: [],
      serviceCentres: [],
    };
  }

  if (centresRes.error) {
    return {
      success: false,
      message: centresRes.error.message,
      tools: [],
      services: [],
      serviceCentres: [],
    };
  }

  const tools = toolsRes.data || [];
  let services = servicesRes.data || [];

  if (search.trim()) {
    const s = search.toLowerCase();

    services = services.filter((item: any) => {
      const tool = tools.find(
        (t: any) => Number(t.id) === Number(item.tool_id)
      );

      const toolText = tool ? String(tool.tool_name || "").toLowerCase() : "";

      return (
        toolText.includes(s) ||
        String(item.service_centre || "").toLowerCase().includes(s) ||
        String(item.complaint || "").toLowerCase().includes(s) ||
        String(item.work_done || "").toLowerCase().includes(s) ||
        String(item.status || "").toLowerCase().includes(s) ||
        String(item.remarks || "").toLowerCase().includes(s)
      );
    });
  }

  const serviceCentres = (centresRes.data || [])
    .map((c: any) => c.name)
    .filter(Boolean)
    .sort();

  return {
    success: true,
    tools,
    services,
    serviceCentres,
  };
}

export async function addServiceCentre(name: string) {
  if (!name.trim()) {
    return { success: false, message: "Service centre name required" };
  }

  const { error } = await supabase
    .from("service_centres")
    .upsert({ name: name.trim() }, { onConflict: "name" });

  if (error) return { success: false, message: error.message };

  revalidatePath("/service");
  return { success: true, message: "Service centre added successfully" };
}

export async function saveService(row: any) {
  if (!row.tool_id || !row.service_centre || !row.date_out) {
    return {
      success: false,
      message: "Tool, service centre and date out are required",
    };
  }

  const { data: tool } = await supabase
    .from("tools")
    .select("*")
    .eq("id", Number(row.tool_id))
    .single();

  const { error } = await supabase.from("services").insert({
    tool_id: Number(row.tool_id),
    home_branch: tool?.home_branch || "",
    active_branch: tool?.current_location || "",
    service_centre: row.service_centre || "",
    complaint: row.complaint || "",
    work_done: row.work_done || "",
    cost: Number(row.cost || 0),
    date_out: row.date_out,
    date_in: row.date_in || null,
    return_branch: row.return_branch || null,
    status: row.status || "In Service",
    remarks: row.remarks || "",
  });

  if (error) return { success: false, message: error.message };

  const updateToolData: any = {
    status:
      row.status === "Completed" || row.status === "Returned"
        ? "Available"
        : "Service",
    service_status: row.status || "In Service",
  };

  if (
    (row.status === "Completed" || row.status === "Returned") &&
    row.return_branch
  ) {
    updateToolData.current_location = row.return_branch;
  }

  const { error: toolError } = await supabase
    .from("tools")
    .update(updateToolData)
    .eq("id", Number(row.tool_id));

  if (toolError) return { success: false, message: toolError.message };

  revalidatePath("/service");
  revalidatePath("/tools");
  revalidatePath("/");

  return { success: true, message: "Service saved successfully" };
}

export async function saveToServiceRows(rows: any[]) {
  const validRows = rows.filter(
    (row) => row.tool_id && row.service_centre && row.date_out
  );

  if (validRows.length === 0) {
    return { success: false, message: "No valid service entries" };
  }

  for (const row of validRows) {
    const { error } = await supabase.from("services").insert({
      tool_id: Number(row.tool_id),
      home_branch: row.home_branch || "",
      active_branch: row.active_branch || "",
      service_centre: row.service_centre || "",
      complaint: row.complaint || "",
      work_done: "",
      cost: 0,
      date_out: row.date_out,
      date_in: null,
      return_branch: null,
      status: "In Service",
      service_type: row.service_type || "General Repair",
      greasing_done: Boolean(row.greasing_done),
      oil_change_done: Boolean(row.oil_change_done),
      scheduled_service_done: Boolean(row.scheduled_service_done),
      remarks: row.remarks || "",
    });

    if (error) return { success: false, message: error.message };

    const { error: toolError } = await supabase
      .from("tools")
      .update({
        status: "Service",
        service_status: "In Service",
      })
      .eq("id", Number(row.tool_id));

    if (toolError) return { success: false, message: toolError.message };
  }

  revalidatePath("/service");
  revalidatePath("/tools");
  revalidatePath("/");

  return {
    success: true,
    message: `${validRows.length} tools sent to service. Current location not changed.`,
  };
}

export async function saveFromServiceRows(rows: any[]) {
  const filledRows = rows.filter((row) => row.tool_id);

  if (filledRows.length === 0) {
    return { success: false, message: "No service return rows to save" };
  }

  for (const row of filledRows) {
    const { data: existingService } = await supabase
      .from("services")
      .select("*")
      .eq("tool_id", Number(row.tool_id))
      .eq("status", "In Service")
      .order("date_out", { ascending: false })
      .limit(1)
      .maybeSingle();

    const greasingDone = Boolean(row.greasing_done);
    const oilChangeDone = Boolean(row.oil_change_done);
    const scheduledServiceDone = Boolean(row.scheduled_service_done);
    const serviceType = row.service_type || "General Repair";

    if (existingService) {
      const { error } = await supabase
        .from("services")
        .update({
          active_branch:
            row.active_branch || existingService.active_branch || "",
          service_centre:
            row.service_centre || existingService.service_centre || "",
          return_branch: row.return_branch || "",
          work_done: row.work_done || "",
          cost: Number(row.cost || 0),
          date_in: row.date_in,
          status: "Completed",
          service_type: serviceType,
          greasing_done: greasingDone,
          oil_change_done: oilChangeDone,
          scheduled_service_done: scheduledServiceDone,
          remarks: row.remarks || existingService.remarks || "",
        })
        .eq("id", existingService.id);

      if (error) return { success: false, message: error.message };
    } else {
      const { error } = await supabase.from("services").insert({
        tool_id: Number(row.tool_id),
        home_branch: row.home_branch || "",
        active_branch: row.active_branch || "",
        service_centre: row.service_centre || "",
        return_branch: row.return_branch || "",
        complaint: "",
        work_done: row.work_done || "",
        cost: Number(row.cost || 0),
        date_in: row.date_in,
        status: "Completed",
        service_type: serviceType,
        greasing_done: greasingDone,
        oil_change_done: oilChangeDone,
        scheduled_service_done: scheduledServiceDone,
        remarks: row.remarks || "",
      });

      if (error) return { success: false, message: error.message };
    }

    const toolUpdateData: any = {
      status: "Available",
      service_status: "Completed",
      current_location: row.return_branch || "",
    };

    if (greasingDone || serviceType === "Greasing") {
      toolUpdateData.last_greasing_date = row.date_in;
    }

    if (oilChangeDone || serviceType === "Oil Change") {
      toolUpdateData.last_oil_change_date = row.date_in;
    }

    if (scheduledServiceDone || serviceType === "Scheduled Service") {
      toolUpdateData.last_scheduled_service_date = row.date_in;
    }

    const { error: toolError } = await supabase
      .from("tools")
      .update(toolUpdateData)
      .eq("id", Number(row.tool_id));

    if (toolError) return { success: false, message: toolError.message };
  }

  revalidatePath("/service");
  revalidatePath("/");
  revalidatePath("/tools");

  return { success: true, message: "From service saved successfully" };
}

export async function updateService(id: number, row: any) {
  const { error } = await supabase
    .from("services")
    .update({
      tool_id: Number(row.tool_id),
      home_branch: row.home_branch || "",
      active_branch: row.active_branch || "",
      service_centre: row.service_centre || "",
      complaint: row.complaint || "",
      work_done: row.work_done || "",
      cost: Number(row.cost || 0),
      date_out: row.date_out || null,
      date_in: row.date_in || null,
      return_branch: row.return_branch || null,
      status: row.status || "In Service",
      service_type: row.service_type || "General Repair",
      greasing_done: Boolean(row.greasing_done),
      oil_change_done: Boolean(row.oil_change_done),
      scheduled_service_done: Boolean(row.scheduled_service_done),
      remarks: row.remarks || "",
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  const updateToolData: any = {
    status:
      row.status === "Completed" || row.status === "Returned"
        ? "Available"
        : "Service",
    service_status: row.status || "In Service",
  };

  if (
    (row.status === "Completed" || row.status === "Returned") &&
    row.return_branch
  ) {
    updateToolData.current_location = row.return_branch;
  }

  if (row.tool_id) {
    const { error: toolError } = await supabase
      .from("tools")
      .update(updateToolData)
      .eq("id", Number(row.tool_id));

    if (toolError) return { success: false, message: toolError.message };
  }

  revalidatePath("/service");
  revalidatePath("/tools");
  revalidatePath("/");

  return { success: true, message: "Service updated successfully" };
}

export async function deleteService(id: number) {
  const { error } = await supabase.from("services").delete().eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/service");
  revalidatePath("/");

  return { success: true, message: "Service deleted successfully" };
}
export async function saveTool(row: any) {
  return saveTools([row]);
}

export async function getToolHistory(toolId: number) {
  const { data: tool, error: toolError } = await supabase
    .from("tools")
    .select("*")
    .eq("id", toolId)
    .single();

  if (toolError) {
    return { success: false, message: toolError.message };
  }

  const { data: movements } = await supabase
    .from("movements")
    .select("*")
    .eq("tool_id", toolId);

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("tool_id", toolId);

  const movementHistory =
    movements?.map((m: any) => ({
      date: m.movement_date || m.date || m.created_at || "",
      type: "Shop Movement",
      from_location: m.from_location || m.from_branch || "",
      to_location: m.to_location || m.to_branch || "",
      service_centre: "",
      note: m.remarks || m.note || "",
      work_done: "",
      cost: 0,
      status: m.status || "",
    })) || [];

  const serviceHistory =
    services?.map((s: any) => ({
      date: s.date_in || s.date_out || s.created_at || "",
      type: s.service_type || (s.date_in ? "From Service" : "To Service"),
      from_location: s.date_in ? s.service_centre : s.active_branch,
      to_location: s.date_in ? s.return_branch : s.service_centre,
      service_centre: s.service_centre || "",
      note: s.complaint || s.remarks || "",
      work_done: s.work_done || "",
      cost: Number(s.cost || 0),
      status: s.status || "",
    })) || [];

  const history = [...movementHistory, ...serviceHistory].sort(
    (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  );

  const totalServiceCost = serviceHistory.reduce(
    (sum, row) => sum + Number(row.cost || 0),
    0
  );

  return {
    success: true,
    tool: {
      ...tool,
      total_service_cost: totalServiceCost,
    },
    history,
  };
}
export async function getPaymentsData() {
  const [
    { data: customers, error: customerError },
    { data: rentals, error: rentalError },
    { data: payments, error: paymentError },
  ] = await Promise.all([
    supabase.from("customers").select("*"),
    supabase.from("rentals").select("*"),
    supabase.from("payments").select("*"),
  ]);

  if (customerError) {
    return { success: false, message: customerError.message, data: [] };
  }

  if (rentalError) {
    return { success: false, message: rentalError.message, data: [] };
  }

  if (paymentError) {
    return { success: false, message: paymentError.message, data: [] };
  }

  const rows = buildCustomerBalanceRows(
    customers || [],
    rentals || [],
    payments || []
  ).filter((row: any) => Number(row.balance || 0) > 0);

  return { success: true, data: rows };
}