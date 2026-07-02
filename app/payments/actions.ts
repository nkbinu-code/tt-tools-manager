"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { buildCustomerBalanceRows } from "../calculations";

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
    const key = String(a.customer_id || a.mobile || "").trim();
    if (!key) return;
    arrearsByCustomer[key] =
      Number(arrearsByCustomer[key] || 0) + Number(a.arrears_amount || 0);
  });

  const rows = buildCustomerBalanceRows(
    customers || [],
    rentals || [],
    payments || []
  )
    .map((row: any) => {
      const key1 = String(row.id || row.customer_id || "").trim();
      const key2 = String(row.mobile || "").trim();

      const movedToArrears =
        Number(arrearsByCustomer[key1] || 0) + Number(arrearsByCustomer[key2] || 0);

      return {
        ...row,
        arrears_amount: movedToArrears,
        balance: Math.max(0, Number(row.balance || 0) - movedToArrears),
      };
    })
    .filter((row: any) => Number(row.balance || 0) > 0);

  const customersById: any = {};
  (customers || []).forEach((c: any) => {
    customersById[String(c.id)] = c;
  });

  const toolsById: any = {};
  (tools || []).forEach((t: any) => {
    toolsById[String(t.id)] = t;
  });

  const paymentTotalsByRental: any = {};

  (payments || []).forEach((p: any) => {
    const rentalId = String(p.rental_id || "").trim();
    if (!rentalId) return;

    if (!paymentTotalsByRental[rentalId]) {
      paymentTotalsByRental[rentalId] = { paid: 0, discount: 0 };
    }

    paymentTotalsByRental[rentalId].paid += Number(p.amount || 0);
    paymentTotalsByRental[rentalId].discount += Number(p.discount || 0);
  });

  const pendingReturnedRentals = (rentals || [])
    .filter((r: any) => String(r.status || "").toLowerCase() === "returned")
    .map((r: any) => {
      const rentalId = String(r.id || "");
      const customer = customersById[String(r.customer_id)] || {};
      const tool = toolsById[String(r.tool_id)] || {};
      const totals = paymentTotalsByRental[rentalId] || { paid: 0, discount: 0 };
      const amount = Number(r.total_amount || 0);
      const paid = Number(totals.paid || 0);
      const discount = Number(totals.discount || 0);
      const balance = Math.max(0, amount - paid - discount);

      return {
        rental_id: r.id,
        customer_id: r.customer_id,
        customer_name: customer.customer_name || customer.name || r.customer_name || "",
        mobile: customer.mobile || r.mobile || "",
        tool_id: r.tool_id,
        tool_name: tool.tool_name || r.tool_name || "",
        shop: r.shop || customer.shop || "",
        start_date: r.start_date || "",
        end_date: r.end_date || "",
        return_date: r.end_date || "",
        amount,
        paid,
        discount,
        balance,
        payment_status:
          balance <= 0 ? "Paid" : paid > 0 || discount > 0 ? "Partially Paid" : "Pending",
      };
    })
    .filter((r: any) => Number(r.balance || 0) > 0)
    .sort((a: any, b: any) => String(b.return_date || "").localeCompare(String(a.return_date || "")));

  return { success: true, data: rows, pendingReturnedRentals };
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

  return { success: true, message: "Balance moved to arrears" };
}
