"use server";

import { supabase } from "@/lib/supabase";

export async function getSalesData() {
  const { data: items, error: itemError } = await supabase
    .from("sale_items")
    .select("*")
    .order("item_name", { ascending: true });

  if (itemError) {
    return { success: false, message: itemError.message, items: [], sales: [] };
  }

  const { data: sales, error: saleError } = await supabase
    .from("sale_entries")
    .select("*")
    .order("sale_date", { ascending: false });

  if (saleError) {
    return { success: false, message: saleError.message, items: items || [], sales: [] };
  }

  return {
    success: true,
    items: items || [],
    sales: sales || [],
  };
}

export async function saveSaleItems(rows: any[]) {
  const filled = rows.filter(
    (row) => row.item_name?.trim() && row.shop?.trim()
  );

  if (filled.length === 0) {
    return { success: false, message: "Please enter at least one product" };
  }

  const insertRows = filled.map((row) => ({
    item_name: row.item_name.trim(),
    category: row.category || "",
    shop: row.shop || "",
    current_qty: Number(row.current_qty || 0),
    purchase_cost: Number(row.purchase_cost || 0),
    selling_price: Number(row.selling_price || 0),
    min_stock: Number(row.min_stock || 0),
    remarks: row.remarks || "",
  }));

  const { error } = await supabase.from("sale_items").insert(insertRows);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Products saved successfully" };
}

export async function saveSales(rows: any[]) {
  const filled = rows.filter(
    (row) => row.item_id && Number(row.qty || 0) > 0
  );

  if (filled.length === 0) {
    return { success: false, message: "Please enter at least one sale" };
  }

  for (const row of filled) {
    const { data: item, error: itemError } = await supabase
      .from("sale_items")
      .select("*")
      .eq("id", row.item_id)
      .single();

    if (itemError || !item) {
      return { success: false, message: "Product not found" };
    }

    const qty = Number(row.qty || 0);
    const currentQty = Number(item.current_qty || 0);

    if (qty > currentQty) {
      return {
        success: false,
        message: `${item.item_name} stock is only ${currentQty}`,
      };
    }

    const purchaseCost = Number(item.purchase_cost || 0);
    const sellingPrice = Number(row.selling_price || item.selling_price || 0);
    const totalCost = qty * purchaseCost;
    const totalSale = qty * sellingPrice;
    const profit = totalSale - totalCost;

    const { error: saleError } = await supabase.from("sale_entries").insert({
      sale_date: row.sale_date,
      item_id: item.id,
      item_name: item.item_name,
      shop: row.shop || item.shop,
      qty,
      purchase_cost: purchaseCost,
      selling_price: sellingPrice,
      total_cost: totalCost,
      total_sale: totalSale,
      profit,
      customer_name: row.customer_name || "",
      remarks: row.remarks || "",
    });

    if (saleError) {
      return { success: false, message: saleError.message };
    }

    const { error: stockError } = await supabase
      .from("sale_items")
      .update({ current_qty: currentQty - qty })
      .eq("id", item.id);

    if (stockError) {
      return { success: false, message: stockError.message };
    }
  }

  return { success: true, message: "Sales saved and stock updated" };
}

export async function deleteSaleItem(id: string) {
  const { error } = await supabase.from("sale_items").delete().eq("id", id);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Product deleted" };
}

export async function deleteSaleEntry(id: string) {
  const { error } = await supabase.from("sale_entries").delete().eq("id", id);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Sale entry deleted" };
}