"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function safeNumber(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function firstNumber(row: any, keys: string[]) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") {
      const n = Number(row[key]);
      if (Number.isFinite(n)) return n;
    }
  }

  return 0;
}

function rowMobile(row: any) {
  return String(row?.mobile || row?.customer_mobile || row?.phone || "").trim();
}

function countDays(startValue: any, endValue?: any, avoidSundays = true) {
  if (!startValue) return 1;

  const start = new Date(String(startValue).slice(0, 10));
  const end = endValue
    ? new Date(String(endValue).slice(0, 10))
    : new Date(todayISO());

  if (Number.isNaN(start.getTime())) return 1;
  if (Number.isNaN(end.getTime())) return 1;
  if (end < start) return 1;

  let count = 0;
  const d = new Date(start);

  while (d <= end) {
    const isSunday = d.getDay() === 0;

    if (!(avoidSundays && isSunday)) {
      count++;
    }

    d.setDate(d.getDate() + 1);
  }

  return Math.max(count, 1);
}

function calcRentalAmount(row: any) {
  const qty = firstNumber(row, ["qty", "quantity"]) || 1;
  const rate = firstNumber(row, ["daily_rate", "daily_rent", "rate"]);
  const discount = firstNumber(row, ["discount", "discount_amount"]);
  const avoidSundays = row?.avoid_sundays !== false;
  const status = String(row?.status || "").toLowerCase();

  if (status === "returned" && safeNumber(row?.total_amount) > 0) {
    return safeNumber(row.total_amount);
  }

  const days = countDays(
    row?.start_date || row?.date || row?.rental_date,
    row?.end_date || row?.return_date,
    avoidSundays,
  );

  return Math.max(qty * rate * days - discount, 0);
}

function calcPaymentAmount(row: any) {
  return firstNumber(row, [
    "amount",
    "payment_amount",
    "received_amount",
    "paid_amount",
    "collection_amount",
  ]);
}

function calcPaymentDiscount(row: any) {
  return firstNumber(row, ["discount", "discount_amount"]);
}

function belongsToCustomer(row: any, customer: any) {
  const customerId = String(customer?.id || customer?.customer_id || "").trim();
  const rowCustomerId = String(row?.customer_id || "").trim();

  const customerMobile = String(customer?.mobile || "").trim();
  const dataMobile = rowMobile(row);

  const customerName = normalizeText(customer?.customer_name || customer?.name);
  const dataName = normalizeText(rowCustomerName(row));

  return (
    (customerId && rowCustomerId && rowCustomerId === customerId) ||
    (customerMobile && dataMobile && dataMobile === customerMobile) ||
    (!rowCustomerId && !dataMobile && customerName && dataName && dataName === customerName)
  );
}


function rowCustomerName(row: any) {
  return String(row?.customer_name || row?.name || row?.customer || "").trim();
}

function normalizeText(value: any) {
  return String(value || "").trim().toLowerCase();
}

function dateValue(value: any) {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;

  return d;
}

function firstDate(row: any, keys: string[]) {
  for (const key of keys) {
    const d = dateValue(row?.[key]);
    if (d) return d;
  }

  return null;
}

function dateKey(value: Date | null) {
  if (!value) return "";
  return value.toISOString();
}

function addTransaction(
  list: any[],
  date: Date | null,
  type: string,
  amount = 0,
) {
  if (!date) return;

  list.push({
    date,
    type,
    amount,
    sortTime: date.getTime(),
  });
}

function buildLastTransaction(customerRentals: any[], customerPayments: any[]) {
  const transactions: any[] = [];

  for (const rental of customerRentals || []) {
    addTransaction(
      transactions,
      firstDate(rental, ["start_date", "rental_date", "date", "created_at"]),
      "Tool Taken",
      calcRentalAmount(rental),
    );

    const status = String(rental?.status || "").toLowerCase();
    const returnedDate = firstDate(rental, [
      "end_date",
      "return_date",
      "returned_date",
      "closed_date",
    ]);

    if (returnedDate || status === "returned") {
      addTransaction(
        transactions,
        returnedDate || firstDate(rental, ["updated_at", "created_at"]),
        "Tool Returned",
        calcRentalAmount(rental),
      );
    }
  }

  for (const payment of customerPayments || []) {
    addTransaction(
      transactions,
      firstDate(payment, [
        "payment_date",
        "paid_date",
        "collection_date",
        "date",
        "created_at",
      ]),
      "Money Received",
      calcPaymentAmount(payment),
    );
  }

  transactions.sort((a, b) => b.sortTime - a.sortTime);
  const last = transactions[0];

  if (!last) {
    return {
      last_transaction_date: "",
      last_transaction_type: "",
      last_transaction_amount: 0,
      last_transaction_text: "No transaction",
      last_transaction_sort: 0,
    };
  }

  return {
    last_transaction_date: dateKey(last.date),
    last_transaction_type: last.type,
    last_transaction_amount: last.amount,
    last_transaction_text: last.type,
    last_transaction_sort: last.sortTime,
  };
}

function buildCustomerActualBalance(customer: any, rentals: any[], payments: any[]) {
  const customerRentals = (rentals || []).filter((row) =>
    belongsToCustomer(row, customer),
  );

  const customerPayments = (payments || []).filter((row) =>
    belongsToCustomer(row, customer),
  );

  const rentalTotal = customerRentals.reduce(
    (sum, row) => sum + calcRentalAmount(row),
    0,
  );

  const receivedTotal = customerPayments.reduce(
    (sum, row) => sum + calcPaymentAmount(row),
    0,
  );

  const discountTotal = customerPayments.reduce(
    (sum, row) => sum + calcPaymentDiscount(row),
    0,
  );

  const lastTransaction = buildLastTransaction(customerRentals, customerPayments);

  return {
    ...customer,
    customer_id: customer.id,
    received_total: receivedTotal,
    discount_total: discountTotal,
    balance: rentalTotal - receivedTotal - discountTotal,
    ...lastTransaction,
  };
}

export async function getCustomers(search: string = "") {
  const customersRes = await supabase
    .from("customers")
    .select("*")
    .order("customer_name", { ascending: true });

  const rentalsRes = await supabase.from("rentals").select("*");
  const paymentsRes = await supabase.from("payments").select("*");

  if (customersRes.error) {
    return {
      success: false,
      message: customersRes.error.message,
      data: [],
    };
  }

  if (rentalsRes.error) {
    return {
      success: false,
      message: rentalsRes.error.message,
      data: [],
    };
  }

  if (paymentsRes.error) {
    return {
      success: false,
      message: paymentsRes.error.message,
      data: [],
    };
  }

  let data = (customersRes.data || []).map((customer) =>
    buildCustomerActualBalance(
      customer,
      rentalsRes.data || [],
      paymentsRes.data || [],
    ),
  );

  if (search && search.trim() !== "") {
    const s = search.trim().toLowerCase();

    data = data.filter((row) =>
      `${row.customer_name || ""} ${row.mobile || ""} ${row.occupation || ""} ${row.address || ""} ${row.shop || ""}`
        .toLowerCase()
        .includes(s),
    );
  }

  return {
    success: true,
    message: "Customers loaded",
    data,
  };
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
        mobile,
        occupation: row.occupation || "",
        address: row.address || "",
        shop: row.shop || "",
        notes: row.notes || "",
        rating: Number(row.rating || 10),
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
      rating: Number(row.rating || 10),
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
  revalidatePath("/payments");
  revalidatePath("/collections");
  revalidatePath("/reports");
  revalidatePath("/");

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
      rating: Number(row.rating || 10),
    })
    .eq("id", id);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/customers");
  revalidatePath("/rentals");
  revalidatePath("/payments");
  revalidatePath("/collections");
  revalidatePath("/reports");
  revalidatePath("/");

  return {
    success: true,
    message: "Customer updated successfully",
  };
}

export async function deleteCustomer(id: number) {
  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/customers");
  revalidatePath("/rentals");
  revalidatePath("/payments");
  revalidatePath("/collections");
  revalidatePath("/reports");
  revalidatePath("/");

  return {
    success: true,
    message: "Customer deleted successfully",
  };
}
