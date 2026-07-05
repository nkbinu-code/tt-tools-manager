"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function getCustomers(search: string = "") {
  let query = supabase
    .from("customers")
    .select("*")
    .order("customer_name", { ascending: true });

  if (search && search.trim() !== "") {
    const s = search.trim();
    query = query.or(
      `customer_name.ilike.%${s}%,mobile.ilike.%${s}%,address.ilike.%${s}%,shop.ilike.%${s}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    return {
      success: false,
      message: error.message,
      data: [],
    };
  }

  return {
    success: true,
    message: "Customers loaded",
    data: data || [],
  };
}

export async function saveCustomer(row: any) {
  if (!row.customer_name || !row.mobile) {
    return {
      success: false,
      message: "Customer name and mobile are required",
    };
  }

  const mobile = row.mobile.trim();

  // Check whether customer already exists
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
    // Update existing customer
    ({ error } = await supabase
      .from("customers")
      .update({
        customer_name: row.customer_name || "",
        mobile: row.mobile || "",
        occupation: row.occupation || "",
        address: row.address || "",
        shop: row.shop || "",
        notes: row.notes || "",
      })
      .eq("id", existing.id));
  } else {
    // Insert new customer
    ({ error } = await supabase.from("customers").insert({
      customer_name: row.customer_name.trim(),
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