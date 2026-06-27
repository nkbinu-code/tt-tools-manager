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

  const { error } = await supabase.from("customers").insert({
    customer_name: row.customer_name.trim(),
    mobile: row.mobile.trim(),
    address: row.address || "",
    shop: row.shop || "",
    notes: row.notes || "",
  });

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/customers");

  return {
    success: true,
    message: "Customer saved successfully",
  };
}

export async function updateCustomer(id: number, row: any) {
  if (!id) {
    return {
      success: false,
      message: "Customer ID missing",
    };
  }

  const { error } = await supabase
    .from("customers")
    .update({
      customer_name: row.customer_name || "",
      mobile: row.mobile || "",
      address: row.address || "",
      shop: row.shop || "",
      notes: row.notes || "",
    })
    .eq("id", id);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/customers");

  return {
    success: true,
    message: "Customer updated successfully",
  };
}

export async function deleteCustomer(id: number) {
  if (!id) {
    return {
      success: false,
      message: "Customer ID missing",
    };
  }

  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/customers");

  return {
    success: true,
    message: "Customer deleted successfully",
  };
}