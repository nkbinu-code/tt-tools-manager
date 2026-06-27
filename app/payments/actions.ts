"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { buildCustomerBalanceRows } from "../calculations";

function customerKey(row: any) {
  return String(row?.customer_id || row?.id || row?.mobile || "").trim();
}

export async function getPaymentsData() {
  const [
    { data: customers, error: customerError },
    { data: rentals, error: rentalError },
    { data: payments, error: paymentError },
    { data: arrears, error: arrearsError },
  ] = await Promise.all([
    supabase.from("customers").select("*"),
    supabase.from("rentals").select("*"),
    supabase.from("payments").select("*"),
    supabase.from("customer_arrears").select("*"),
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

  if (arrearsError) {
    return { success: false, message: arrearsError.message, data: [] };
  }

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

  return { success: true, data: rows };
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

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/payments");

  return { success: true, message: "Balance moved to arrears" };
}
