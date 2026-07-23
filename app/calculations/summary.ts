import { calculateRentalTotal, toNumber } from "./rental";
import { buildCustomerBalanceRows } from "./customer";

export function calculateTotalBusiness(rentals: any[]) {
  return rentals.reduce((sum, rental) => sum + calculateRentalTotal(rental), 0);
}

export function calculateTotalCollections(payments: any[]) {
  return payments.reduce((sum, payment) => {
    const type = String(payment?.entry_type || "payment").trim().toLowerCase();
    if (type === "opening_due" || type === "opening_credit") return sum;
    return sum + toNumber(payment.amount);
  }, 0);
}

export function calculateTotalDiscount(payments: any[]) {
  return payments.reduce((sum, payment) => sum + toNumber(payment.discount), 0);
}

export function calculateTotalBalance(
  customers: any[],
  rentals: any[],
  payments: any[]
) {
  return buildCustomerBalanceRows(customers, rentals, payments).reduce(
    (sum, row) => sum + toNumber(row.balance),
    0
  );
}

export function getShopFromRow(row: any) {
  return row.shop || row.branch || row.home_branch || row.current_location || "";
}

export function filterByShop(rows: any[], selectedShop: string) {
  if (!selectedShop || selectedShop === "All Shops" || selectedShop === "All") {
    return rows;
  }

  return rows.filter((row) => getShopFromRow(row) === selectedShop);
}