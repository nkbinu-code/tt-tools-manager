"use server";

import { supabase } from "../../lib/supabase";
import {
  buildCustomerBalanceRows,
  calcCustomerTotals,
  countDays,
} from "../calculations";

export async function getBranches() {
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .order("name");

  if (error || !data) {
    return [
      "All Shops",
      "Karuvannur",
      "Ollur",
      "Kachery",
      "Mulayam Rd",
      "Pattikkad",
    ];
  }

  return [
    "All Shops",
    ...(data || []).map((b: any) => b.name || b.branch_name).filter(Boolean),
  ];
}

function getToolNameFromRental(rental: any, tools: any[] = []) {
  const tool = tools.find(
    (t: any) => Number(t.id) === Number(rental.tool_id)
  );

  return (
    rental.tool_name ||
    rental.tool ||
    rental.tools?.tool_name ||
    tool?.tool_name ||
    tool?.name ||
    ""
  );
}

export async function getLedgerData(shop: string = "All Shops") {
  const [
    { data: rentals, error: rentalError },
    { data: payments, error: paymentError },
    { data: customers, error: customerError },
    { data: tools, error: toolError },
  ] = await Promise.all([
    supabase.from("rentals").select("*"),
    supabase.from("payments").select("*"),
    supabase.from("customers").select("*"),
    supabase.from("tools").select("*"),
  ]);

  if (rentalError || paymentError || customerError || toolError) {
    return {
      success: false,
      message:
        rentalError?.message ||
        paymentError?.message ||
        customerError?.message ||
        toolError?.message,
    };
  }

  const filteredRentals =
    shop === "All Shops"
      ? rentals || []
      : (rentals || []).filter(
          (r: any) => (r.shop || r.branch || "") === shop
        );

  const filteredPayments =
    shop === "All Shops"
      ? payments || []
      : (payments || []).filter(
          (p: any) => (p.shop || p.branch || "") === shop
        );

  const balanceRows = buildCustomerBalanceRows(
    customers || [],
    filteredRentals,
    filteredPayments
  );

  const rows = balanceRows.map((customer: any) => {
    const totals = calcCustomerTotals(
      customer,
      filteredRentals,
      filteredPayments
    );

    const toolsList = (totals.rentals || [])
      .map((r: any) => getToolNameFromRental(r, tools || []))
      .filter(Boolean);

    const days = (totals.rentals || []).reduce(
      (sum: number, r: any) =>
        sum +
        countDays(
          r.start_date || r.date || r.rental_date,
          r.end_date || r.return_date,
          r.avoid_sundays !== false
        ),
      0
    );

    return {
      customer: `${customer.customer_name || "-"} - ${customer.mobile || ""}`,
      shop: customer.shop || shop,
      branch: customer.shop || shop,
      tools: [...new Set(toolsList)].join(", "),
      days,
      rent: totals.totalBusiness || 0,
      received: totals.totalPaid || 0,
      discount: totals.totalDiscount || 0,
      balance: totals.balance || 0,
    };
  });

  return {
    success: true,
    data: rows.filter(
      (row: any) =>
        Number(row.rent || 0) > 0 ||
        Number(row.received || 0) > 0 ||
        Number(row.balance || 0) !== 0
    ),
  };
}