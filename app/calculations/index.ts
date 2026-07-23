// app/calculations/index.ts

export * from "./rental";
export * from "./customer";
export * from "./summary";

export { buildCustomerBalanceRows } from "./customer";

export {
  calculateRentalTotal as calcRentalAmount,
  countRentalDays as countDays,
} from "./rental";

import { calculateRentalTotal, countRentalDays, toNumber } from "./rental";
import { buildCustomerBalanceRows } from "./customer";
import {
  calculateTotalBusiness,
  calculateTotalCollections,
  calculateTotalDiscount,
  calculateTotalBalance,
} from "./summary";

export function calcSystemTotals(
  customers: any[] = [],
  rentals: any[] = [],
  payments: any[] = []
) {
  const totalBusiness = calculateTotalBusiness(rentals);
  const totalCollections = calculateTotalCollections(payments);
  const totalDiscount = calculateTotalDiscount(payments);
  const totalBalance = calculateTotalBalance(customers, rentals, payments);

  return {
    totalBusiness,
    totalCollections,
    totalDiscount,
    totalBalance,

    business: totalBusiness,
    collections: totalCollections,
    received: totalCollections,
    discount: totalDiscount,
    balance: totalBalance,
  };
}

export function rowMobile(row: any) {
  return row?.mobile || row?.customer_mobile || row?.phone || "";
}

export function rowShop(row: any) {
  return row?.shop || row?.branch || row?.home_branch || row?.current_location || "";
}

export function rowToolName(row: any) {
  if (row?.is_transport_charge) {
    const vehicle = row.transport_vehicle_type || "Auto";
    const trip = row.transport_trip_type || "Transport";
    const location = row.transport_location ? ` - ${row.transport_location}` : "";
    return `Transport Cost (${vehicle} - ${trip}${location})`;
  }

  if (row?.is_outside_rent && row?.outside_item_name) {
    return row.outside_item_name;
  }

  return (
    row?.outside_item_name ||
    row?.tool_name ||
    row?.tool ||
    row?.toolName ||
    row?.tools?.tool_name ||
    row?.tools?.name ||
    ""
  );
}

export function calcCustomerTotals(
  customer: any,
  rentals: any[] = [],
  payments: any[] = []
) {
  const mobile = rowMobile(customer);
  const customerId = String(customer?.customer_id || customer?.id || "");

  const customerRentals = rentals.filter(
    (r) => String(r.customer_id || "") === customerId || rowMobile(r) === mobile
  );

  const customerPayments = payments.filter(
    (p) => String(p.customer_id || "") === customerId || rowMobile(p) === mobile
  );

  const totalBusiness = customerRentals.reduce(
    (sum, rental) => sum + calculateRentalTotal(rental),
    0
  );

  const totalPaid = customerPayments.reduce(
    (sum, payment) => sum + toNumber(payment.amount),
    0
  );

  const totalDiscount = customerPayments.reduce(
    (sum, payment) => sum + toNumber(payment.discount),
    0
  );

  return {
    totalBusiness,
    totalPaid,
    totalDiscount,
    balance: totalBusiness - totalPaid - totalDiscount,
    rentals: customerRentals,
    payments: customerPayments,
  };
}