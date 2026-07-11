"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { buildCustomerBalanceRows } from "../calculations";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalize(value: any) {
  return String(value || "").trim();
}

function isReturnedRental(rental: any) {
  const status = String(rental.status || "").trim().toLowerCase();

  return (
    status === "returned" ||
    status === "closed" ||
    status === "completed" ||
    Boolean(rental.end_date || rental.return_date || rental.closed_date)
  );
}

function countRentalDays(start: any, end: any, avoidSundays: any = true) {
  if (!start) return 1;

  const startDate = new Date(String(start).slice(0, 10));
  const endDate = new Date(String(end || todayISO()).slice(0, 10));

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 1;
  }

  if (endDate < startDate) return 1;

  const skipSunday =
    avoidSundays === false || avoidSundays === "false" ? false : true;

  let days = 0;
  const d = new Date(startDate);

  while (d <= endDate) {
    const isSunday = d.getDay() === 0;
    if (!(skipSunday && isSunday)) days++;
    d.setDate(d.getDate() + 1);
  }

  return Math.max(days, 1);
}

function hasRentalValue(value: any) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function firstRentalNumber(...values: any[]) {
  const value = values.find(hasRentalValue);
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getRentalRate(rental: any, tool: any = {}) {
  const directRateSource = [
    rental.daily_rate,
    rental.unit_price,
    rental.daily_rent,
    rental.rent,
    rental.rate,
  ].find(hasRentalValue);

  if (directRateSource !== undefined) {
    return firstRentalNumber(directRateSource);
  }

  return firstRentalNumber(
    tool.daily_rent,
    tool.daily_rate,
    tool.rent,
    tool.rate,
    0
  );
}

function getRentalTotalAmount(rental: any, tool: any = {}) {
  const savedTotal = Number(
    rental.total_amount ||
      rental.total ||
      rental.amount ||
      rental.grand_total ||
      rental.rent_total ||
      0
  );

  if (savedTotal > 0) return savedTotal;

  const qty = Number(rental.qty || rental.quantity || 1);
  const rate = getRentalRate(rental, tool);
  const discount = Number(rental.discount || 0);
  const startDate = rental.start_date || rental.date || rental.rental_date;
  const endDate =
    rental.end_date || rental.return_date || rental.closed_date || todayISO();

  const days = countRentalDays(startDate, endDate, rental.avoid_sundays);

  return Math.max(0, qty * rate * days - discount);
}

function findCustomerForRental(rental: any, customersById: any, customersByMobile: any) {
  const customerById = customersById[normalize(rental.customer_id)];
  if (customerById) return customerById;

  return customersByMobile[normalize(rental.mobile || rental.customer_mobile)] || {};
}

function findToolForRental(rental: any, toolsById: any) {
  return toolsById[normalize(rental.tool_id || rental.toolId)] || {};
}

export async function getPaymentsData() {
  const [
    { data: customers, error: customerError },
    { data: rentals, error: rentalError },
    { data: payments, error: paymentError },
    { data: arrears, error: arrearsError },
    { data: tools, error: toolsError },
  ] = await Promise.all([
    supabase.from("customers").select("*"),
    supabase.from("rentals").select("*"),
    supabase.from("payments").select("*"),
    supabase.from("customer_arrears").select("*"),
    supabase.from("tools").select("*"),
  ]);

  if (customerError) return { success: false, message: customerError.message, data: [] };
  if (rentalError) return { success: false, message: rentalError.message, data: [] };
  if (paymentError) return { success: false, message: paymentError.message, data: [] };
  if (arrearsError) return { success: false, message: arrearsError.message, data: [] };
  if (toolsError) return { success: false, message: toolsError.message, data: [] };

  const arrearsByCustomer: any = {};

  (arrears || []).forEach((a: any) => {
    const customerKey = normalize(a.customer_id);
    const mobileKey = normalize(a.mobile);

    if (customerKey) {
      arrearsByCustomer[customerKey] =
        Number(arrearsByCustomer[customerKey] || 0) + Number(a.arrears_amount || 0);
    }

    if (mobileKey) {
      arrearsByCustomer[mobileKey] =
        Number(arrearsByCustomer[mobileKey] || 0) + Number(a.arrears_amount || 0);
    }
  });

  const rows = buildCustomerBalanceRows(
    customers || [],
    rentals || [],
    payments || []
  )
    .map((row: any) => {
      const customerKey = normalize(row.id || row.customer_id);
      const mobileKey = normalize(row.mobile);

      const movedToArrears =
        Number(arrearsByCustomer[customerKey] || 0) +
        Number(arrearsByCustomer[mobileKey] || 0);

      return {
        ...row,
        arrears_amount: movedToArrears,
        balance: Math.max(0, Number(row.balance || 0) - movedToArrears),
      };
    })
    .filter((row: any) => Number(row.balance || 0) > 0);

  const customersById: any = {};
  const customersByMobile: any = {};

  (customers || []).forEach((c: any) => {
    const id = normalize(c.id);
    const mobile = normalize(c.mobile || c.customer_mobile);

    if (id) customersById[id] = c;
    if (mobile) customersByMobile[mobile] = c;
  });

  const toolsById: any = {};

  (tools || []).forEach((t: any) => {
    const id = normalize(t.id);
    if (id) toolsById[id] = t;
  });

  const paymentTotalsByRental: any = {};
  const paymentTotalsByCustomer: any = {};

  (payments || []).forEach((p: any) => {
    const rentalId = normalize(p.rental_id);
    const customerId = normalize(p.customer_id);
    const mobile = normalize(p.mobile || p.customer_mobile);
    const paidAmount = Number(p.amount || 0);
    const discountAmount = Number(p.discount || 0);

    if (rentalId) {
      if (!paymentTotalsByRental[rentalId]) {
        paymentTotalsByRental[rentalId] = { paid: 0, discount: 0 };
      }

      paymentTotalsByRental[rentalId].paid += paidAmount;
      paymentTotalsByRental[rentalId].discount += discountAmount;
    }

    [customerId, mobile].forEach((key) => {
      if (!key) return;

      if (!paymentTotalsByCustomer[key]) {
        paymentTotalsByCustomer[key] = { paid: 0, discount: 0 };
      }

      paymentTotalsByCustomer[key].paid += paidAmount;
      paymentTotalsByCustomer[key].discount += discountAmount;
    });
  });

  const pendingReturnedRentals = (rentals || [])
    .filter((r: any) => isReturnedRental(r))
    .map((r: any) => {
      const rentalId = normalize(r.id || r.rental_id);
      const customer = findCustomerForRental(r, customersById, customersByMobile);
      const tool = findToolForRental(r, toolsById);

      const customerId = normalize(r.customer_id || customer.id);
      const mobile = normalize(customer.mobile || r.mobile || r.customer_mobile);
      const rentalTotals = paymentTotalsByRental[rentalId] || { paid: 0, discount: 0 };

      /*
        Important:
        If payments were saved without rental_id, they should not hide every
        returned rental for that customer. So rental_id payments are used first.
      */
      const amount = getRentalTotalAmount(r, tool);
      const paid = Number(rentalTotals.paid || 0);
      const discount = Number(rentalTotals.discount || 0);
      const balance = Math.max(0, amount - paid - discount);

      return {
        rental_id: r.id || r.rental_id || "",
        customer_id: customerId || "",
        customer_name:
          customer.customer_name ||
          customer.name ||
          r.customer_name ||
          r.name ||
          "",
        mobile,
        tool_id: r.tool_id || "",
        tool_name:
          tool.tool_name ||
          tool.name ||
          r.tool_name ||
          r.tool ||
          r.item_name ||
          "",
        shop:
          r.shop ||
          r.branch ||
          customer.shop ||
          customer.branch ||
          "",
        start_date: r.start_date || r.date || r.rental_date || "",
        end_date: r.end_date || r.return_date || r.closed_date || "",
        return_date: r.return_date || r.end_date || r.closed_date || r.date || "",
        amount,
        paid,
        discount,
        balance,
        payment_status:
          balance <= 0
            ? "Paid"
            : paid > 0 || discount > 0
              ? "Partially Paid"
              : "Pending",
      };
    })
    .filter((r: any) => Number(r.balance || 0) > 0)
    .sort((a: any, b: any) =>
      String(b.return_date || "").localeCompare(String(a.return_date || ""))
    );

  return { success: true, data: rows, pendingReturnedRentals };
}


export async function updatePaymentEntry(input: {
  id: any;
  payment_date?: string;
  rental_id?: any;
  customer_id?: any;
  customer_name?: string;
  mobile?: string;
  shop?: string;
  amount?: number;
  discount?: number;
  mode?: string;
  remarks?: string;
}) {
  const id = normalize(input.id);

  if (!id) {
    return { success: false, message: "Payment id not found" };
  }

  const amount = Number(input.amount || 0);
  const discount = Number(input.discount || 0);

  if (amount <= 0 && discount <= 0) {
    return { success: false, message: "Please enter payment amount or round off" };
  }

  const mode = normalize(input.mode || "Cash");

  const { error } = await supabase
    .from("payments")
    .update({
      payment_date: normalize(input.payment_date) || todayISO(),
      rental_id: input.rental_id || null,
      customer_id: input.customer_id || null,
      customer_name: normalize(input.customer_name),
      mobile: normalize(input.mobile),
      shop: normalize(input.shop),
      amount,
      discount,
      mode,
      payment_mode: mode,
      remarks: normalize(input.remarks),
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/payments");
  revalidatePath("/reports");

  return { success: true, message: "Payment updated" };
}

export async function deletePaymentEntry(idValue: any) {
  const id = normalize(idValue);

  if (!id) {
    return { success: false, message: "Payment id not found" };
  }

  const { error } = await supabase.from("payments").delete().eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/payments");
  revalidatePath("/reports");

  return { success: true, message: "Payment deleted" };
}

export async function moveCustomerBalanceToArrears(input: {
  customer_id?: any;
  customer_name: string;
  mobile: string;
  shop: string;
  amount: number;
  reason?: string;
  remarks?: string;
}) {
  const amount = Number(input.amount || 0);

  if (!amount || amount <= 0) {
    return { success: false, message: "No balance amount to move" };
  }

  const movedDate = new Date().toISOString().slice(0, 10);
  const movedYear = new Date().getFullYear();

  const { error } = await supabase.from("customer_arrears").insert([
    {
      customer_id: input.customer_id || null,
      customer_name: input.customer_name || "",
      mobile: input.mobile || "",
      shop: input.shop || "",
      arrears_amount: amount,
      moved_date: movedDate,
      moved_year: movedYear,
      reason: input.reason || "",
      remarks: input.remarks || "",
    },
  ]);

  if (error) return { success: false, message: error.message };

  revalidatePath("/payments");
  revalidatePath("/reports");

  return { success: true, message: "Balance moved to arrears" };
}
