import { calculateRentalTotal, toNumber } from "./rental";

export function calculatePaidTotal(payments: any[]) {
  return payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
}

export function calculateDiscountTotal(payments: any[]) {
  return payments.reduce((sum, p) => sum + toNumber(p.discount), 0);
}

export function buildCustomerBalanceRows(
  customers: any[],
  rentals: any[],
  payments: any[]
) {
  return customers.map((customer) => {
    const customerRentals = rentals.filter(
      (r) =>
        String(r.customer_id || "") === String(customer.id || "") ||
        String(r.mobile || "") === String(customer.mobile || "")
    );

    const customerPayments = payments.filter(
      (p) =>
        String(p.customer_id || "") === String(customer.id || "") ||
        String(p.mobile || "") === String(customer.mobile || "")
    );

    const totalBusiness = customerRentals.reduce(
      (sum, rental) => sum + calculateRentalTotal(rental),
      0
    );

    const totalPaid = calculatePaidTotal(customerPayments);
    const totalDiscount = calculateDiscountTotal(customerPayments);
    const balance = totalBusiness - totalPaid - totalDiscount;

    return {
      customer_id: customer.id,
      customer_name: customer.customer_name || customer.name || "",
      mobile: customer.mobile || "",
      shop: customer.shop || customer.branch || "",
      address: customer.address || "",
      occupation: customer.occupation || "",
      total_business: totalBusiness,
      total_paid: totalPaid,
      total_discount: totalDiscount,
      balance,
      rentals: customerRentals,
      payments: customerPayments,
    };
  });
}