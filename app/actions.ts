"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import {
  calcRentalAmount as commonCalcRentalAmount,
  countDays as commonCountDays,
  buildCustomerBalanceRows,
  calcSystemTotals,
} from "./calculations";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function calcDays(start: string, end?: string | null, avoidSundays = false) {
  return commonCountDays(start, end, avoidSundays);
}

function calcRentalAmount(r: any) {
  return commonCalcRentalAmount(r);
}

function buildCustomerBalances(
  customers: any[],
  rentals: any[],
  payments: any[]
) {
  return buildCustomerBalanceRows(customers, rentals, payments).map((row: any) => {
    const sourceCustomer = customers.find(
      (customer: any) =>
        String(customer.id || "") === String(row.id || row.customer_id || "") ||
        String(customer.mobile || "").trim() === String(row.mobile || "").trim()
    );

    return {
      ...row,
      rating: Number(row.rating ?? sourceCustomer?.rating ?? 10),
      rental_total: row.total_business || row.business || 0,
      received_total: row.total_paid || row.received || 0,
      discount_total: row.total_discount || row.discount || 0,
      balance: row.balance || 0,
    };
  });
}

/* DASHBOARD */

export async function getDashboardStats(filters?: {
  businessDate?: string;
  collectionDate?: string;
  balanceMonth?: string;
  serviceMonth?: string;
  shopSummaryDate?: string;
  shopSummaryMonth?: string;
}) {
  const branches = ["Karuvannur", "Ollur", "Kachery", "Mulayam Rd", "Pattikkad"];

  const toolsRes = await supabase.from("tools").select("*");
  const rentalsRes = await supabase.from("rentals").select("*");
  const paymentsRes = await supabase.from("payments").select("*");
  const servicesRes = await supabase.from("services").select("*");
  const customersRes = await supabase.from("customers").select("*");
  const archivedBusinessRes = await supabase
    .from("archived_business_monthly")
    .select("*");
  const archivedToolRes = await supabase
    .from("archived_tool_monthly")
    .select("*");
  const archivedShopRes = await supabase
    .from("archived_shop_monthly")
    .select("*");

  const tools = toolsRes.error ? [] : toolsRes.data || [];
  const rentals = rentalsRes.error ? [] : rentalsRes.data || [];
  const payments = paymentsRes.error ? [] : paymentsRes.data || [];
  const services = servicesRes.error ? [] : servicesRes.data || [];
  const customers = customersRes.error ? [] : customersRes.data || [];
  const archivedBusiness = archivedBusinessRes.error
    ? []
    : archivedBusinessRes.data || [];
  const archivedTool = archivedToolRes.error
    ? []
    : archivedToolRes.data || [];
  const archivedShop = archivedShopRes.error
    ? []
    : archivedShopRes.data || [];

  const today = todayISO();
  const todayDate = new Date(today);
  const monthStart = today.slice(0, 7);

  const businessDate = filters?.businessDate || today;
  const collectionDate = filters?.collectionDate || today;
  const balanceMonth = filters?.balanceMonth || monthStart;
  const serviceMonth = filters?.serviceMonth || monthStart;
  const shopSummaryDate = filters?.shopSummaryDate || today;
  const shopSummaryMonth = filters?.shopSummaryMonth || monthStart;

  function isoDate(value: any) {
    return String(value || "").slice(0, 10);
  }

  function isSunday(dateValue: string) {
    const date = new Date(`${dateValue}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date.getDay() === 0;
  }

  function dateWithinRental(rental: any, dateValue: string) {
    const start = isoDate(rental.start_date || rental.date || rental.rental_date);
    const end = isoDate(
      rental.end_date || rental.return_date || rental.closed_date || today
    );

    if (!start || !dateValue) return false;
    return dateValue >= start && dateValue <= end;
  }

  function rentalDailyBusinessForDate(rental: any, dateValue: string) {
    if (!dateWithinRental(rental, dateValue)) return 0;

    if (
      rental.avoid_sundays !== false &&
      isSunday(dateValue) &&
      !rental.is_transport_charge
    ) {
      return 0;
    }

    if (rental.is_transport_charge) {
      const transportDate = isoDate(
        rental.transport_date || rental.start_date || rental.date
      );
      return transportDate === dateValue
        ? Number(rental.transport_amount || rental.total_amount || rental.daily_rate || 0)
        : 0;
    }

    return Math.max(Number(rental.qty || 1), 1) * Number(rental.daily_rate || 0);
  }


  function rentalActiveOnDate(rental: any, dateValue: string) {
    if (rental.is_transport_charge) return false;

    const start = isoDate(
      rental.start_date || rental.date || rental.rental_date
    );
    const end = isoDate(
      rental.end_date || rental.return_date || rental.closed_date
    );

    if (!start || start > dateValue) return false;
    if (end && end < dateValue) return false;

    return true;
  }

  function rentalBusinessThroughDate(rental: any, dateValue: string) {
    const start = isoDate(
      rental.start_date || rental.date || rental.rental_date
    );
    const actualEnd = isoDate(
      rental.end_date || rental.return_date || rental.closed_date
    );

    if (!start || start > dateValue) return 0;

    const effectiveEnd =
      actualEnd && actualEnd < dateValue ? actualEnd : dateValue;

    let total = 0;
    const cursor = new Date(`${start}T00:00:00`);
    const finish = new Date(`${effectiveEnd}T00:00:00`);

    while (cursor <= finish) {
      const day = cursor.toISOString().slice(0, 10);
      total += rentalDailyBusinessForDate(rental, day);
      cursor.setDate(cursor.getDate() + 1);
    }

    return total;
  }

  function monthRange(monthValue: string) {
    const [year, month] = String(monthValue || "").split("-").map(Number);
    if (!year || !month) {
      return { from: `${monthStart}-01`, to: today };
    }

    const lastDay = new Date(year, month, 0).getDate();
    return {
      from: `${monthValue}-01`,
      to: `${monthValue}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  function rentalBusinessForMonth(rental: any, monthValue: string) {
    const range = monthRange(monthValue);
    const start = isoDate(rental.start_date || rental.date || rental.rental_date);
    const end = isoDate(
      rental.end_date || rental.return_date || rental.closed_date || today
    );

    if (!start) return 0;

    const effectiveStart = start > range.from ? start : range.from;
    const effectiveEnd = end < range.to ? end : range.to;

    if (effectiveStart > effectiveEnd) return 0;

    let total = 0;
    const cursor = new Date(`${effectiveStart}T00:00:00`);
    const finish = new Date(`${effectiveEnd}T00:00:00`);

    while (cursor <= finish) {
      const dateValue = cursor.toISOString().slice(0, 10);
      total += rentalDailyBusinessForDate(rental, dateValue);
      cursor.setDate(cursor.getDate() + 1);
    }

    return total;
  }

  const systemTotals = calcSystemTotals(customers, rentals, payments);

  const selectedMonthArchivedBusiness = archivedBusiness
    .filter((row: any) =>
      isoDate(row.month_start).startsWith(balanceMonth)
    )
    .reduce(
      (sum: number, row: any) =>
        sum + Number(row.rental_business || 0),
      0
    );

  const selectedMonthRentalBusiness =
    rentals.reduce(
      (sum: number, rental: any) =>
        sum + rentalBusinessForMonth(rental, balanceMonth),
      0
    ) + selectedMonthArchivedBusiness;

  const selectedMonthOpeningBalance = payments
    .filter((payment: any) =>
      isoDate(payment.effective_date || payment.payment_date || payment.created_at).startsWith(
        balanceMonth
      )
    )
    .reduce((sum: number, payment: any) => {
      const type = String(payment.entry_type || "payment").toLowerCase();
      const amount = Math.abs(Number(payment.amount || 0));
      if (type === "opening_due") return sum + amount;
      if (type === "opening_credit") return sum - amount;
      return sum;
    }, 0);

  const selectedMonthReceived = payments
    .filter((payment: any) =>
      isoDate(payment.effective_date || payment.payment_date || payment.created_at).startsWith(
        balanceMonth
      )
    )
    .reduce((sum: number, payment: any) => {
      const type = String(payment.entry_type || "payment").toLowerCase();
      if (type === "opening_due" || type === "opening_credit") return sum;
      return sum + Number(payment.amount || 0) + Number(payment.discount || 0);
    }, 0);

  const pendingBalance = Math.max(
    selectedMonthOpeningBalance +
      selectedMonthRentalBusiness -
      selectedMonthReceived,
    0
  );

  const shopStats = branches.map((shop) => {
    const shopRentals = rentals.filter(
      (rental: any) => String(rental.shop || rental.branch || "").trim() === shop
    );
    const shopPayments = payments.filter(
      (payment: any) =>
        String(payment.shop || payment.branch || "").trim() === shop
    );

    const shopArchivedBusiness = archivedBusiness.filter(
      (row: any) =>
        String(row.shop || "").trim() === shop
    );

    const selectedDateBusiness = shopRentals.reduce(
      (sum: number, rental: any) =>
        sum + rentalDailyBusinessForDate(rental, shopSummaryDate),
      0
    );

    const selectedMonthBusiness =
      shopRentals.reduce(
        (sum: number, rental: any) =>
          sum + rentalBusinessForMonth(rental, shopSummaryMonth),
        0
      ) +
      shopArchivedBusiness
        .filter((row: any) =>
          isoDate(row.month_start).startsWith(shopSummaryMonth)
        )
        .reduce(
          (sum: number, row: any) =>
            sum + Number(row.rental_business || 0),
          0
        );

    const selectedMonthCollections =
      shopPayments
        .filter((payment: any) => {
          const type = String(payment.entry_type || "payment").toLowerCase();
          const date = isoDate(
            payment.payment_date ||
              payment.effective_date ||
              payment.date ||
              payment.created_at
          );

          return (
            type !== "opening_due" &&
            type !== "opening_credit" &&
            date.startsWith(shopSummaryMonth)
          );
        })
        .reduce(
          (sum: number, payment: any) =>
            sum + Number(payment.amount || 0),
          0
        ) +
      shopArchivedBusiness
        .filter((row: any) =>
          isoDate(row.month_start).startsWith(shopSummaryMonth)
        )
        .reduce(
          (sum: number, row: any) =>
            sum + Number(row.payments_received || 0),
          0
        );

    const selectedMonthPaymentRoundOff = shopPayments
      .filter((payment: any) => {
        const type = String(payment.entry_type || "payment").toLowerCase();
        const date = isoDate(
          payment.payment_date ||
            payment.effective_date ||
            payment.date ||
            payment.created_at
        );

        return (
          type !== "opening_due" &&
          type !== "opening_credit" &&
          date.startsWith(shopSummaryMonth)
        );
      })
      .reduce(
        (sum: number, payment: any) =>
          sum + Number(payment.discount || 0),
        0
      );

    const selectedMonthRentalRoundOff = shopRentals
      .filter((rental: any) => {
        const date = isoDate(
          rental.end_date ||
            rental.return_date ||
            rental.start_date ||
            rental.created_at
        );
        return date.startsWith(shopSummaryMonth);
      })
      .reduce(
        (sum: number, rental: any) =>
          sum + Number(rental.discount || 0),
        0
      );

    const selectedMonthArchivedRoundOff =
      shopArchivedBusiness
        .filter((row: any) =>
          isoDate(row.month_start).startsWith(shopSummaryMonth)
        )
        .reduce(
          (sum: number, row: any) =>
            sum + Number(row.round_off || 0),
          0
        );

    const selectedMonthRoundOff =
      selectedMonthPaymentRoundOff +
      selectedMonthRentalRoundOff +
      selectedMonthArchivedRoundOff;

    const businessAsOnDate = shopRentals.reduce(
      (sum: number, rental: any) =>
        sum + rentalBusinessThroughDate(rental, shopSummaryDate),
      0
    );

    let openingBalanceAsOnDate = 0;
    let collectionsAsOnDate = 0;
    let paymentRoundOffAsOnDate = 0;

    shopPayments.forEach((payment: any) => {
      const date = isoDate(
        payment.effective_date ||
          payment.payment_date ||
          payment.date ||
          payment.created_at
      );

      if (!date || date > shopSummaryDate) return;

      const type = String(payment.entry_type || "payment").toLowerCase();
      const amount = Math.abs(Number(payment.amount || 0));

      if (type === "opening_due") {
        openingBalanceAsOnDate += amount;
      } else if (type === "opening_credit") {
        openingBalanceAsOnDate -= amount;
      } else {
        collectionsAsOnDate += Number(payment.amount || 0);
        paymentRoundOffAsOnDate += Number(payment.discount || 0);
      }
    });

    const rentalRoundOffAsOnDate = shopRentals
      .filter((rental: any) => {
        const date = isoDate(
          rental.end_date ||
            rental.return_date ||
            rental.start_date ||
            rental.created_at
        );
        return Boolean(date && date <= shopSummaryDate);
      })
      .reduce(
        (sum: number, rental: any) =>
          sum + Number(rental.discount || 0),
        0
      );

    const pendingBalanceAsOnDate = Math.max(
      openingBalanceAsOnDate +
        businessAsOnDate -
        collectionsAsOnDate -
        paymentRoundOffAsOnDate -
        rentalRoundOffAsOnDate,
      0
    );

    const activeRentalsOnDate = shopRentals.filter((rental: any) =>
      rentalActiveOnDate(rental, shopSummaryDate)
    ).length;

    return {
      shop,
      todayBusiness: selectedDateBusiness,
      selectedDateBusiness,
      businessTillNow: businessAsOnDate,
      monthBusiness: selectedMonthBusiness,
      collections: selectedMonthCollections,
      roundOff: selectedMonthRoundOff,
      pendingBalance: pendingBalanceAsOnDate,
      monthBalance: pendingBalanceAsOnDate,
      activeRentals: activeRentalsOnDate,
    };
  });

  function daysSince(dateValue: any) {
    if (!dateValue) return null;
    const d = new Date(String(dateValue).slice(0, 10));
    if (Number.isNaN(d.getTime())) return null;
    return Math.floor(
      (todayDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    );
  }


  function continuousCalendarDays(startDate: any) {
    const elapsed = daysSince(startDate);
    return elapsed === null ? 0 : elapsed + 1;
  }

  function isActiveRental(row: any) {
    const status = String(row?.status || "").trim().toLowerCase();
    return (
      !row?.end_date &&
      !row?.return_date &&
      (status === "active" ||
        status === "live" ||
        status === "rented" ||
        status === "ongoing" ||
        status === "")
    );
  }

  function maintenanceAlert(
    tool: any,
    type: string,
    lastDate: any,
    dueDaysValue: any,
    color: string
  ) {
    const dueDays = Number(dueDaysValue || 0);
    const elapsed = daysSince(lastDate);

    if (!dueDays || elapsed === null) return null;

    const daysLeft = dueDays - elapsed;

    if (daysLeft > 3) return null;

    return {
      type,
      color,
      level: daysLeft < 0 ? "danger" : daysLeft === 0 ? "today" : "warning",
      tool_name: tool.tool_name || "",
      location: tool.current_location || tool.home_branch || "",
      daysLeft,
      message:
        daysLeft < 0
          ? `${tool.tool_name} ${type.toLowerCase()} overdue by ${Math.abs(
              daysLeft
            )} day(s)`
          : daysLeft === 0
          ? `${tool.tool_name} ${type.toLowerCase()} due today`
          : `${tool.tool_name}: ${daysLeft} day(s) left for ${type.toLowerCase()}`,
    };
  }

  const maintenanceAlerts = tools
    .flatMap((tool: any) => [
      maintenanceAlert(
        tool,
        "Greasing",
        tool.last_greasing_date,
        tool.greasing_due_days,
        "yellow"
      ),
      maintenanceAlert(
        tool,
        "Oil Change",
        tool.last_oil_change_date,
        tool.oil_change_due_days,
        "blue"
      ),
      maintenanceAlert(
        tool,
        "Scheduled Service",
        tool.last_scheduled_service_date,
        tool.scheduled_service_due_days,
        "orange"
      ),
    ])
    .filter(Boolean)
    .sort((a: any, b: any) => Number(a.daysLeft) - Number(b.daysLeft));

  const rentalOverdueAlerts: any[] = [];

  rentals
    .filter((r: any) => isActiveRental(r))
    .forEach((r: any) => {
      const tool = tools.find((t: any) => Number(t.id) === Number(r.tool_id));
      if (!tool) return;

      const overdueDays = Number(tool.rental_overdue_days || 0);
      if (!overdueDays) return;

      const days = continuousCalendarDays(r.start_date);

      if (days > overdueDays) {
        const customer = customers.find(
          (c: any) => Number(c.id) === Number(r.customer_id)
        );

        rentalOverdueAlerts.push({
          type: "Rental Overdue",
          level: "danger",
          tool_name: tool.tool_name,
          customer: customer
            ? `${customer.customer_name} - ${customer.mobile}`
            : "Unknown",
          shop: r.shop || "",
          days,
          overdueDays,
          message: `${tool.tool_name} is rented for ${days} day(s). Limit is ${overdueDays}.`,
        });
      }
    });


  const HIGH_PENDING_LIMIT = 10000;
  const LARGE_DUE_BEFORE_NEW_RENTAL_LIMIT = 5000;
  const SERVICE_DELAY_DAYS = 10;
  const LONG_RENTAL_DAYS = 10;
  const HIGH_ROUND_OFF_LIMIT = 500;
  const REPEATED_ROUND_OFF_COUNT = 3;
  const ROUND_OFF_LOOKBACK_DAYS = 30;

  function rowDate(row: any, ...fields: string[]) {
    for (const field of fields) {
      const value = row?.[field];
      if (value) return String(value).slice(0, 10);
    }
    return "";
  }

  function previousDate(dateValue: string) {
    const date = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateValue;
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
  }

  function paymentEntryType(payment: any) {
    return String(payment?.entry_type || "payment").trim().toLowerCase();
  }

  function customerMatchesRow(customer: any, row: any) {
    const customerId = String(customer?.id || "").trim();
    const rowCustomerId = String(row?.customer_id || "").trim();
    const customerMobile = String(customer?.mobile || "").trim();
    const rowMobile = String(row?.mobile || row?.customer_mobile || "").trim();

    return Boolean(
      (customerId && rowCustomerId && customerId === rowCustomerId) ||
      (customerMobile && rowMobile && customerMobile === rowMobile)
    );
  }

  function customerForRental(rental: any) {
    return customers.find((customer: any) => customerMatchesRow(customer, rental));
  }

  function toolForRental(rental: any) {
    return tools.find((tool: any) => Number(tool.id) === Number(rental.tool_id));
  }

  function customerLabel(customer: any) {
    if (!customer) return "Unknown customer";
    const name = customer.customer_name || customer.name || "Unknown customer";
    const mobile = String(customer.mobile || "").trim();
    return mobile ? `${name} - ${mobile}` : name;
  }

  function customerFinancials(customer: any) {
    const customerRentals = rentals.filter((row: any) =>
      customerMatchesRow(customer, row)
    );
    const customerPayments = payments.filter((row: any) =>
      customerMatchesRow(customer, row)
    );

    const rentalBusiness = customerRentals.reduce(
      (sum: number, rental: any) => sum + calcRentalAmount(rental),
      0
    );

    let openingBalance = 0;
    let received = 0;
    let roundOff = 0;

    customerPayments.forEach((payment: any) => {
      const type = paymentEntryType(payment);
      const amount = Math.abs(Number(payment.amount || 0));

      if (type === "opening_due") {
        openingBalance += amount;
        return;
      }

      if (type === "opening_credit") {
        openingBalance -= amount;
        return;
      }

      received += Number(payment.amount || 0);
      roundOff += Number(payment.discount || 0);
    });

    return {
      customer,
      rentals: customerRentals,
      payments: customerPayments,
      rentalBusiness,
      openingBalance,
      received,
      roundOff,
      balance: openingBalance + rentalBusiness - received - roundOff,
    };
  }

  const customerFinancialRows = customers.map((customer: any) =>
    customerFinancials(customer)
  );

  function financialRowForCustomer(customer: any) {
    if (!customer) return null;
    return customerFinancialRows.find(
      (row: any) => String(row.customer?.id || "") === String(customer.id || "")
    );
  }

  function balanceBeforeDate(customer: any, beforeDate: string) {
    if (!customer || !beforeDate) return 0;

    const cutOff = previousDate(beforeDate);
    let openingBalance = 0;
    let received = 0;
    let roundOff = 0;

    const customerPayments = payments.filter(
      (payment: any) =>
        customerMatchesRow(customer, payment) &&
        rowDate(
          payment,
          "effective_date",
          "payment_date",
          "date",
          "created_at"
        ) <= cutOff
    );

    customerPayments.forEach((payment: any) => {
      const type = paymentEntryType(payment);
      const amount = Math.abs(Number(payment.amount || 0));

      if (type === "opening_due") {
        openingBalance += amount;
      } else if (type === "opening_credit") {
        openingBalance -= amount;
      } else {
        received += Number(payment.amount || 0);
        roundOff += Number(payment.discount || 0);
      }
    });

    const businessBeforeDate = rentals
      .filter((rental: any) => {
        if (!customerMatchesRow(customer, rental)) return false;
        const startDate = rowDate(rental, "start_date", "date", "rental_date");
        return Boolean(startDate && startDate <= cutOff);
      })
      .reduce((sum: number, rental: any) => {
        const actualEnd = rowDate(
          rental,
          "end_date",
          "return_date",
          "closed_date"
        );
        const calculatedEnd =
          actualEnd && actualEnd < cutOff ? actualEnd : cutOff;

        return (
          sum +
          calcRentalAmount({
            ...rental,
            end_date: calculatedEnd,
            return_date: calculatedEnd,
          })
        );
      }, 0);

    return openingBalance + businessBeforeDate - received - roundOff;
  }

  function oldestUnpaidAge(financial: any) {
    if (!financial || Number(financial.balance || 0) <= 0) return null;

    const charges: Array<{ date: string; amount: number }> = [];

    financial.payments.forEach((payment: any) => {
      if (paymentEntryType(payment) !== "opening_due") return;

      const amount = Math.abs(Number(payment.amount || 0));
      if (amount <= 0) return;

      charges.push({
        date:
          rowDate(
            payment,
            "effective_date",
            "payment_date",
            "date",
            "created_at"
          ) || today,
        amount,
      });
    });

    financial.rentals.forEach((rental: any) => {
      const amount = calcRentalAmount(rental);
      if (amount <= 0) return;

      charges.push({
        date:
          rowDate(rental, "start_date", "date", "rental_date", "created_at") ||
          today,
        amount,
      });
    });

    charges.sort((a, b) => a.date.localeCompare(b.date));

    let credits =
      financial.received +
      financial.roundOff +
      Math.abs(
        financial.payments
          .filter((payment: any) => paymentEntryType(payment) === "opening_credit")
          .reduce(
            (sum: number, payment: any) =>
              sum + Math.abs(Number(payment.amount || 0)),
            0
          )
      );

    for (const charge of charges) {
      if (credits >= charge.amount) {
        credits -= charge.amount;
        continue;
      }

      const age = daysSince(charge.date);
      return age === null ? null : age + 1;
    }

    return null;
  }

  const criticalRedFlags: any[] = [];

  // 1. Whatever the tool, show every live rental continuously held for more than 10 calendar days.
  rentals
    .filter((rental: any) => isActiveRental(rental))
    .forEach((rental: any) => {
      const days = continuousCalendarDays(
        rowDate(rental, "start_date", "date", "rental_date")
      );
      if (days <= LONG_RENTAL_DAYS) return;

      const tool = toolForRental(rental);
      const customer = customerForRental(rental);

      criticalRedFlags.push({
        type: "Rental over 10 days",
        level: days >= 30 ? "critical" : "danger",
        subject:
          tool?.tool_name ||
          rental.outside_item_name ||
          rental.tool_name ||
          "Rental item",
        customer: customerLabel(customer),
        shop: rental.shop || customer?.shop || "",
        days,
        amount: 0,
        message: `Active continuously for ${days} calendar day(s).`,
      });
    });

  // 2. Customers with a current positive balance of ₹10,000 or more.
  customerFinancialRows
    .filter((row: any) => Number(row.balance || 0) >= HIGH_PENDING_LIMIT)
    .forEach((row: any) => {
      criticalRedFlags.push({
        type: "High pending balance",
        level:
          Number(row.balance || 0) >= HIGH_PENDING_LIMIT * 2
            ? "critical"
            : "danger",
        subject:
          row.customer.customer_name || row.customer.name || "Customer",
        customer: row.customer.mobile || "",
        shop: row.customer.shop || row.customer.branch || "",
        days: 0,
        amount: Number(row.balance || 0),
        message: `Current unpaid balance is ₹${Number(row.balance || 0).toFixed(
          0
        )}.`,
      });
    });

  // 3. Find the oldest charge that remains unpaid after FIFO allocation.
  customerFinancialRows.forEach((row: any) => {
    const age = oldestUnpaidAge(row);
    if (age === null || age < 30) return;

    const bucket = age >= 90 ? "90+ days" : age >= 60 ? "60+ days" : "30+ days";

    criticalRedFlags.push({
      type: `Long pending ${bucket}`,
      level: age >= 90 ? "critical" : "danger",
      subject:
        row.customer.customer_name || row.customer.name || "Customer",
      customer: row.customer.mobile || "",
      shop: row.customer.shop || row.customer.branch || "",
      days: age,
      amount: Number(row.balance || 0),
      message: `The oldest amount still unpaid is ${age} day(s) old.`,
    });
  });

  // 4. Tools whose status is marked Missing.
  tools
    .filter(
      (tool: any) =>
        String(tool.status || "").trim().toLowerCase() === "missing"
    )
    .forEach((tool: any) => {
      criticalRedFlags.push({
        type: "Tool missing",
        level: "critical",
        subject: tool.tool_name || "Tool",
        customer: "",
        shop: tool.current_location || tool.home_branch || "",
        days: 0,
        amount: 0,
        message: "Tool status is marked as Missing.",
      });
    });

  // 5. Open service records not returned for more than 10 calendar days.
  services
    .filter((service: any) => {
      const status = String(service.status || "").trim().toLowerCase();
      return (
        !service.date_in &&
        status !== "completed" &&
        status !== "returned"
      );
    })
    .forEach((service: any) => {
      const days = continuousCalendarDays(
        rowDate(service, "date_out", "created_at")
      );
      if (days <= SERVICE_DELAY_DAYS) return;

      const tool = tools.find(
        (item: any) => Number(item.id) === Number(service.tool_id)
      );

      criticalRedFlags.push({
        type: "Service delayed",
        level: days >= 30 ? "critical" : "danger",
        subject: tool?.tool_name || "Tool",
        customer: service.service_centre || "",
        shop: service.active_branch || service.home_branch || "",
        days,
        amount: Number(service.cost || service.amount || 0),
        message: `Not returned from service after ${days} calendar day(s).`,
      });
    });

  // 6. Return/end date exists, but the status still says live/active.
  rentals
    .filter((rental: any) => {
      const status = String(rental.status || "").trim().toLowerCase();
      const hasReturnDate = Boolean(rental.end_date || rental.return_date);
      return (
        hasReturnDate &&
        ["active", "live", "rented", "ongoing"].includes(status)
      );
    })
    .forEach((rental: any) => {
      const tool = toolForRental(rental);
      const customer = customerForRental(rental);

      criticalRedFlags.push({
        type: "Returned but still live",
        level: "critical",
        subject:
          tool?.tool_name ||
          rental.outside_item_name ||
          rental.tool_name ||
          "Rental item",
        customer: customerLabel(customer),
        shop: rental.shop || customer?.shop || "",
        days: 0,
        amount: 0,
        message: "Return date exists, but rental status is still live.",
      });
    });

  // 7. The same individual tool (stock quantity 1) appears in multiple live rentals.
  const activeRentalsByTool = new Map<number, any[]>();

  rentals
    .filter(
      (rental: any) =>
        isActiveRental(rental) &&
        !rental.is_outside_rent &&
        Number(rental.tool_id || 0) > 0
    )
    .forEach((rental: any) => {
      const toolId = Number(rental.tool_id);
      activeRentalsByTool.set(toolId, [
        ...(activeRentalsByTool.get(toolId) || []),
        rental,
      ]);
    });

  activeRentalsByTool.forEach((rows, toolId) => {
    const tool = tools.find((item: any) => Number(item.id) === toolId);
    const totalQty = Math.max(Number(tool?.total_qty || 1), 1);

    if (totalQty !== 1 || rows.length < 2) return;

    const customerNames = rows
      .map((row: any) => customerLabel(customerForRental(row)))
      .filter(Boolean)
      .join(" | ");

    criticalRedFlags.push({
      type: "Duplicate individual rental",
      level: "critical",
      subject: tool?.tool_name || "Individual tool",
      customer: customerNames || `${rows.length} active rental records`,
      shop: Array.from(
        new Set(rows.map((row: any) => row.shop).filter(Boolean))
      ).join(", "),
      days: 0,
      amount: 0,
      message: `This one individual tool is live in ${rows.length} rental records at the same time.`,
    });
  });

  // 8. At the time of a new rental, the customer already owed ₹5,000 or more.
  rentals
    .filter((rental: any) => isActiveRental(rental))
    .forEach((rental: any) => {
      const customer = customerForRental(rental);
      const rentalStart = rowDate(
        rental,
        "start_date",
        "date",
        "rental_date"
      );
      if (!customer || !rentalStart) return;

      const priorBalance = balanceBeforeDate(customer, rentalStart);
      if (priorBalance < LARGE_DUE_BEFORE_NEW_RENTAL_LIMIT) return;

      const tool = toolForRental(rental);

      criticalRedFlags.push({
        type: "Large due before new rental",
        level:
          priorBalance >= HIGH_PENDING_LIMIT ? "critical" : "danger",
        subject: customerLabel(customer),
        customer:
          tool?.tool_name ||
          rental.outside_item_name ||
          rental.tool_name ||
          "Rental item",
        shop: rental.shop || customer.shop || "",
        days: continuousCalendarDays(rentalStart),
        amount: priorBalance,
        message: `Customer already owed ₹${priorBalance.toFixed(
          0
        )} before this rental started on ${rentalStart}.`,
      });
    });

  // 9. Repeated round-off or unusually high payment/rental discount in the last 30 days.
  const roundOffCutoff = new Date(todayDate);
  roundOffCutoff.setDate(
    roundOffCutoff.getDate() - ROUND_OFF_LOOKBACK_DAYS
  );
  const roundOffCutoffISO = roundOffCutoff.toISOString().slice(0, 10);

  const roundOffEntries: any[] = [];

  payments.forEach((payment: any) => {
    const amount = Number(payment.discount || 0);
    const date = rowDate(
      payment,
      "payment_date",
      "effective_date",
      "date",
      "created_at"
    );

    if (
      paymentEntryType(payment) === "opening_due" ||
      paymentEntryType(payment) === "opening_credit" ||
      amount <= 0 ||
      !date ||
      date < roundOffCutoffISO
    ) {
      return;
    }

    roundOffEntries.push({
      customer_id: payment.customer_id,
      mobile: payment.mobile || payment.customer_mobile || "",
      customer_name: payment.customer_name || "",
      shop: payment.shop || payment.branch || "",
      amount,
      date,
      source: "Payment round-off",
    });
  });

  rentals.forEach((rental: any) => {
    const amount = Number(rental.discount || 0);
    const date = rowDate(
      rental,
      "end_date",
      "return_date",
      "start_date",
      "created_at"
    );

    if (amount <= 0 || !date || date < roundOffCutoffISO) return;

    const customer = customerForRental(rental);

    roundOffEntries.push({
      customer_id: rental.customer_id,
      mobile: customer?.mobile || rental.mobile || "",
      customer_name:
        customer?.customer_name ||
        customer?.name ||
        rental.customer_name ||
        "",
      shop: rental.shop || customer?.shop || "",
      amount,
      date,
      source: "Rental discount",
    });
  });

  const roundOffByCustomer = new Map<string, any[]>();

  roundOffEntries.forEach((entry: any) => {
    const key =
      String(entry.customer_id || "").trim() ||
      String(entry.mobile || "").trim() ||
      String(entry.customer_name || "").trim();

    if (!key) return;

    roundOffByCustomer.set(key, [
      ...(roundOffByCustomer.get(key) || []),
      entry,
    ]);
  });

  roundOffByCustomer.forEach((rows) => {
    const totalRoundOff = rows.reduce(
      (sum: number, row: any) => sum + Number(row.amount || 0),
      0
    );
    const highestSingle = rows.reduce(
      (highest: number, row: any) =>
        Math.max(highest, Number(row.amount || 0)),
      0
    );

    if (
      rows.length < REPEATED_ROUND_OFF_COUNT &&
      highestSingle < HIGH_ROUND_OFF_LIMIT
    ) {
      return;
    }

    const sample = rows[0];

    criticalRedFlags.push({
      type: "Round-off warning",
      level:
        highestSingle >= HIGH_ROUND_OFF_LIMIT ||
        totalRoundOff >= HIGH_ROUND_OFF_LIMIT * 2
          ? "critical"
          : "danger",
      subject: sample.customer_name || "Customer",
      customer: sample.mobile || "",
      shop: sample.shop || "",
      days: 0,
      amount: totalRoundOff,
      message: `${rows.length} round-off/discount entr${
        rows.length === 1 ? "y" : "ies"
      } totalling ₹${totalRoundOff.toFixed(
        0
      )} in the last ${ROUND_OFF_LOOKBACK_DAYS} days. Highest single entry: ₹${highestSingle.toFixed(
        0
      )}.`,
    });
  });

  const nearRedFlags: any[] = [];

  function addNearFlag(row: any) {
    if (!row) return;

    nearRedFlags.push({
      ...row,
      level: "near",
      isNear: true,
    });
  }

  // 1. Closest active rental to the 10-day overdue limit.
  const nearestOverdueRental = rentals
    .filter((rental: any) => isActiveRental(rental))
    .map((rental: any) => {
      const days = continuousCalendarDays(
        rowDate(rental, "start_date", "date", "rental_date")
      );
      const tool = toolForRental(rental);
      const customer = customerForRental(rental);

      return {
        type: "Rental over 10 days",
        subject:
          tool?.tool_name ||
          rental.outside_item_name ||
          rental.tool_name ||
          "Rental item",
        customer: customerLabel(customer),
        shop: rental.shop || customer?.shop || "",
        days,
        amount: 0,
        message:
          days > LONG_RENTAL_DAYS
            ? `Already above the limit at ${days} calendar day(s).`
            : `Closest live rental is ${days} day(s); red flag starts after ${LONG_RENTAL_DAYS} days.`,
      };
    })
    .sort((a: any, b: any) => Number(b.days || 0) - Number(a.days || 0))[0];

  addNearFlag(nearestOverdueRental);

  // 2. Highest current positive balance below/nearest to ₹10,000.
  const nearestHighDue = customerFinancialRows
    .filter((row: any) => Number(row.balance || 0) > 0)
    .sort(
      (a: any, b: any) =>
        Number(b.balance || 0) - Number(a.balance || 0)
    )[0];

  if (nearestHighDue) {
    addNearFlag({
      type: "High pending balance",
      subject:
        nearestHighDue.customer.customer_name ||
        nearestHighDue.customer.name ||
        "Customer",
      customer: nearestHighDue.customer.mobile || "",
      shop:
        nearestHighDue.customer.shop ||
        nearestHighDue.customer.branch ||
        "",
      days: 0,
      amount: Number(nearestHighDue.balance || 0),
      message: `Highest current due is ₹${Number(
        nearestHighDue.balance || 0
      ).toFixed(0)}; high-due flag starts at ₹${HIGH_PENDING_LIMIT}.`,
    });
  }

  // 3. Oldest currently unpaid amount nearest to 30 days.
  const nearestOldDue = customerFinancialRows
    .map((row: any) => ({
      row,
      age: oldestUnpaidAge(row),
    }))
    .filter(
      (item: any) =>
        item.age !== null &&
        Number(item.row.balance || 0) > 0
    )
    .sort((a: any, b: any) => Number(b.age || 0) - Number(a.age || 0))[0];

  if (nearestOldDue) {
    addNearFlag({
      type: "Long pending near",
      subject:
        nearestOldDue.row.customer.customer_name ||
        nearestOldDue.row.customer.name ||
        "Customer",
      customer: nearestOldDue.row.customer.mobile || "",
      shop:
        nearestOldDue.row.customer.shop ||
        nearestOldDue.row.customer.branch ||
        "",
      days: Number(nearestOldDue.age || 0),
      amount: Number(nearestOldDue.row.balance || 0),
      message: `Oldest unpaid amount is ${Number(
        nearestOldDue.age || 0
      )} day(s) old; long-pending flag starts at 30 days.`,
    });
  }

  // 4. Closest tool-status risk when no tool is marked Missing.
  const missingStatusScores: Record<string, number> = {
    damaged: 5,
    inactive: 4,
    unavailable: 3,
    service: 2,
    "in service": 2,
    available: 0,
  };

  const nearestMissingTool = tools
    .map((tool: any) => {
      const status = String(tool.status || "Available")
        .trim()
        .toLowerCase();

      return {
        tool,
        status,
        score: missingStatusScores[status] ?? 1,
      };
    })
    .sort((a: any, b: any) => Number(b.score) - Number(a.score))[0];

  if (nearestMissingTool) {
    addNearFlag({
      type: "Tool missing",
      subject: nearestMissingTool.tool.tool_name || "Tool",
      customer: `Current status: ${
        nearestMissingTool.tool.status || "Available"
      }`,
      shop:
        nearestMissingTool.tool.current_location ||
        nearestMissingTool.tool.home_branch ||
        "",
      days: 0,
      amount: 0,
      message:
        nearestMissingTool.status === "available"
          ? "No missing or risky-status tools. An available tool is shown as the nearest current item."
          : `No tool is marked Missing. Closest current watch status is ${
              nearestMissingTool.tool.status || "Unknown"
            }.`,
    });
  }

  // 5. Longest open service record nearest to the 10-day delay limit.
  const nearestServiceDelay = services
    .filter((service: any) => {
      const status = String(service.status || "").trim().toLowerCase();
      return (
        !service.date_in &&
        status !== "completed" &&
        status !== "returned"
      );
    })
    .map((service: any) => {
      const days = continuousCalendarDays(
        rowDate(service, "date_out", "created_at")
      );
      const tool = tools.find(
        (item: any) => Number(item.id) === Number(service.tool_id)
      );

      return {
        type: "Service delayed",
        subject: tool?.tool_name || "Tool",
        customer: service.service_centre || "",
        shop: service.active_branch || service.home_branch || "",
        days,
        amount: Number(service.cost || service.amount || 0),
        message:
          days > SERVICE_DELAY_DAYS
            ? `Already above the service-delay limit at ${days} day(s).`
            : `Longest open service is ${days} day(s); delay flag starts after ${SERVICE_DELAY_DAYS} days.`,
      };
    })
    .sort((a: any, b: any) => Number(b.days || 0) - Number(a.days || 0))[0];

  addNearFlag(nearestServiceDelay);

  // 6. Most recent correctly closed return, nearest comparison for status mismatch.
  const nearestReturnedStatus = rentals
    .filter((rental: any) => Boolean(rental.end_date || rental.return_date))
    .map((rental: any) => {
      const tool = toolForRental(rental);
      const customer = customerForRental(rental);
      const returnDate = rowDate(
        rental,
        "end_date",
        "return_date",
        "closed_date"
      );

      return {
        type: "Returned but still live",
        subject:
          tool?.tool_name ||
          rental.outside_item_name ||
          rental.tool_name ||
          "Rental item",
        customer: customerLabel(customer),
        shop: rental.shop || customer?.shop || "",
        days: 0,
        amount: 0,
        returnDate,
        message: `Latest returned record is dated ${
          returnDate || "-"
        } and currently has status ${rental.status || "Not set"}.`,
      };
    })
    .sort((a: any, b: any) =>
      String(b.returnDate || "").localeCompare(
        String(a.returnDate || "")
      )
    )[0];

  addNearFlag(nearestReturnedStatus);

  // 7. Individual tool with the highest current live-rental count.
  const nearestDuplicateTool = Array.from(activeRentalsByTool.entries())
    .map(([toolId, rows]: any) => {
      const tool = tools.find(
        (item: any) => Number(item.id) === Number(toolId)
      );
      const totalQty = Math.max(Number(tool?.total_qty || 1), 1);

      return {
        tool,
        rows,
        totalQty,
      };
    })
    .filter((item: any) => item.totalQty === 1)
    .sort(
      (a: any, b: any) =>
        Number(b.rows.length || 0) - Number(a.rows.length || 0)
    )[0];

  if (nearestDuplicateTool) {
    addNearFlag({
      type: "Duplicate individual rental",
      subject:
        nearestDuplicateTool.tool?.tool_name || "Individual tool",
      customer: nearestDuplicateTool.rows
        .map((row: any) =>
          customerLabel(customerForRental(row))
        )
        .join(" | "),
      shop: Array.from(
        new Set(
          nearestDuplicateTool.rows
            .map((row: any) => row.shop)
            .filter(Boolean)
        )
      ).join(", "),
      days: 0,
      amount: 0,
      message: `Highest current live count for an individual tool is ${nearestDuplicateTool.rows.length}; duplicate flag starts at 2.`,
    });
  }

  // 8. Highest balance that existed before a currently active rental started.
  const nearDueBeforeRentalCandidates = rentals
    .filter((rental: any) => isActiveRental(rental))
    .map((rental: any) => {
      const customer = customerForRental(rental);
      const rentalStart = rowDate(
        rental,
        "start_date",
        "date",
        "rental_date"
      );
      if (!customer || !rentalStart) return null;

      const priorBalance = balanceBeforeDate(customer, rentalStart);
      const tool = toolForRental(rental);

      return {
        type: "Large due before new rental",
        subject: customerLabel(customer),
        customer:
          tool?.tool_name ||
          rental.outside_item_name ||
          rental.tool_name ||
          "Rental item",
        shop: rental.shop || customer.shop || "",
        days: continuousCalendarDays(rentalStart),
        amount: priorBalance,
        message: `Highest existing due before an active rental was ₹${priorBalance.toFixed(
          0
        )}; flag starts at ₹${LARGE_DUE_BEFORE_NEW_RENTAL_LIMIT}.`,
      };
    })
    .filter(Boolean)
    .sort(
      (a: any, b: any) =>
        Number(b.amount || 0) - Number(a.amount || 0)
    );

  addNearFlag(nearDueBeforeRentalCandidates[0]);

  // 9. Customer with the highest recent round-off activity below/nearest to the limit.
  const nearestRoundOff = Array.from(roundOffByCustomer.values())
    .map((rows: any[]) => {
      const totalRoundOff = rows.reduce(
        (sum: number, row: any) =>
          sum + Number(row.amount || 0),
        0
      );
      const highestSingle = rows.reduce(
        (highest: number, row: any) =>
          Math.max(highest, Number(row.amount || 0)),
        0
      );
      const sample = rows[0];

      return {
        type: "Round-off warning",
        subject: sample.customer_name || "Customer",
        customer: sample.mobile || "",
        shop: sample.shop || "",
        days: 0,
        amount: totalRoundOff,
        count: rows.length,
        highestSingle,
        message: `${rows.length} recent round-off/discount entr${
          rows.length === 1 ? "y" : "ies"
        }, total ₹${totalRoundOff.toFixed(
          0
        )}, highest single ₹${highestSingle.toFixed(
          0
        )}. Warning starts at ${REPEATED_ROUND_OFF_COUNT} entries or ₹${HIGH_ROUND_OFF_LIMIT} in one entry.`,
      };
    })
    .sort((a: any, b: any) => {
      if (Number(b.highestSingle || 0) !== Number(a.highestSingle || 0)) {
        return Number(b.highestSingle || 0) - Number(a.highestSingle || 0);
      }

      if (Number(b.count || 0) !== Number(a.count || 0)) {
        return Number(b.count || 0) - Number(a.count || 0);
      }

      return Number(b.amount || 0) - Number(a.amount || 0);
    })[0];

  addNearFlag(nearestRoundOff);

  const criticalRedFlagsSorted = criticalRedFlags.sort(
    (a: any, b: any) => {
      if (a.level !== b.level) {
        return a.level === "critical" ? -1 : 1;
      }

      if (Number(a.amount || 0) !== Number(b.amount || 0)) {
        return Number(b.amount || 0) - Number(a.amount || 0);
      }

      return Number(b.days || 0) - Number(a.days || 0);
    }
  );

  return {
    totalTools: tools.reduce((sum: number, tool: any) => sum + Math.max(Number(tool.total_qty || 1), 1), 0),
    activeRentals: rentals.filter((r) => isActiveRental(r)).length,
    toolsInService: tools.filter(
      (t) => t.status === "Service" || t.status === "In Service"
    ).length,
    missingTools: tools.filter((t) => t.status === "Missing").length,
    pendingBalance,
    todayBusiness: rentals.reduce(
      (sum: number, rental: any) =>
        sum + rentalDailyBusinessForDate(rental, businessDate),
      0
    ),
    todayCollections: payments
      .filter((payment: any) => {
        const type = String(payment.entry_type || "payment").toLowerCase();
        return (
          type !== "opening_due" &&
          type !== "opening_credit" &&
          isoDate(payment.payment_date || payment.effective_date || payment.created_at) ===
            collectionDate
        );
      })
      .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0),
    serviceCost:
      services
        .filter((service: any) =>
          isoDate(service.date_in || service.date_out || service.created_at).startsWith(
            serviceMonth
          )
        )
        .reduce(
          (sum: number, service: any) =>
            sum + Number(service.cost || service.amount || 0),
          0
        ) +
      archivedTool
        .filter((row: any) =>
          isoDate(row.month_start).startsWith(serviceMonth)
        )
        .reduce(
          (sum: number, row: any) =>
            sum + Number(row.service_cost || 0),
          0
        ),
    archivedShopTotals: archivedShop.filter((row: any) =>
      isoDate(row.month_start).startsWith(shopSummaryMonth)
    ),
    shopStats,
    maintenanceAlerts,
    rentalOverdueAlerts,
    criticalRedFlags: criticalRedFlagsSorted,
    nearRedFlags,
  };
}

/* TOOLS */

export async function getTools(search: string = "") {
  let query = supabase.from("tools").select("*").order("tool_name");

  if (search.trim()) {
    const s = search.trim();
    query = query.or(
      `tool_name.ilike.%${s}%,category.ilike.%${s}%,brand.ilike.%${s}%,color.ilike.%${s}%,home_branch.ilike.%${s}%,current_location.ilike.%${s}%,status.ilike.%${s}%`
    );
  }

  const { data, error } = await query;
  if (error) return { success: false, message: error.message, data: [] };

  return { success: true, message: "Tools loaded", data: data || [] };
}

function cleanToolSearchText(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function cleanToolMetadataSearchTerm(value: string) {
  return cleanToolSearchText(value)
    .replace(/[,%()"'\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toolMetadataOrFilter(search: string) {
  return [
    `category.ilike.%${search}%`,
    `brand.ilike.%${search}%`,
    `color.ilike.%${search}%`,
    `home_branch.ilike.%${search}%`,
    `current_location.ilike.%${search}%`,
    `status.ilike.%${search}%`,
  ].join(",");
}

function mergeToolRows(...rowSets: any[][]) {
  const rowsById = new Map<string, any>();

  for (const rows of rowSets) {
    for (const row of rows || []) {
      const key = String(row.id || `${row.tool_name}-${rowsById.size}`);
      if (!rowsById.has(key)) rowsById.set(key, row);
    }
  }

  return Array.from(rowsById.values()).sort((a: any, b: any) =>
    String(a.tool_name || "").localeCompare(String(b.tool_name || ""))
  );
}

function normalizeToolComparable(value: any) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toolSearchTokens(value: string) {
  return normalizeToolComparable(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function toolSearchAnchor(value: string) {
  const tokens = toolSearchTokens(value);

  return (
    tokens.find(
      (token) =>
        /[a-z]/.test(token) &&
        token.length >= 3 &&
        !["tool", "tools", "item", "items"].includes(token)
    ) ||
    tokens.find((token) => token.length >= 2) ||
    tokens[0] ||
    ""
  );
}

function toolSearchScore(row: any, search: string) {
  const normalizedSearch = normalizeToolComparable(search);
  const tokens = toolSearchTokens(search);
  const toolName = normalizeToolComparable(row?.tool_name);
  const allText = normalizeToolComparable(
    [
      row?.tool_name,
      row?.category,
      row?.brand,
      row?.color,
      row?.home_branch,
      row?.current_location,
      row?.status,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (!normalizedSearch) return 0;
  if (toolName === normalizedSearch) return 10000;
  if (toolName.startsWith(normalizedSearch)) return 9000;
  if (toolName.includes(normalizedSearch)) return 8000;

  const nameMatches = tokens.filter((token) => toolName.includes(token)).length;
  const allMatches = tokens.filter((token) => allText.includes(token)).length;

  return nameMatches * 500 + allMatches * 100;
}

function rankToolRows(rows: any[], search: string) {
  return [...rows]
    .map((row) => ({ row, score: toolSearchScore(row, search) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return String(a.row?.tool_name || "").localeCompare(
        String(b.row?.tool_name || "")
      );
    })
    .map((entry) => entry.row);
}

async function fallbackToolNameRows(
  search: string,
  selectColumns = "*",
  limit = 200
) {
  const anchor = toolSearchAnchor(search);

  if (!anchor) {
    return { data: [] as any[], error: null as any };
  }

  const { data, error } = await supabase
    .from("tools")
    .select(selectColumns)
    .ilike("tool_name", `%${anchor}%`)
    .order("tool_name")
    .limit(limit);

  if (error) return { data: [] as any[], error };

  return {
    data: rankToolRows(data || [], search),
    error: null as any,
  };
}

export async function searchToolsForToolsPage(
  search: string,
  exactToolName = false
) {
  const term = cleanToolSearchText(search);

  if (!term) {
    return {
      success: true,
      message: "Enter a tool search",
      data: [],
      rentals: [],
      services: [],
      limited: false,
    };
  }

  let allMatches: any[] = [];

  if (exactToolName) {
    const exactResult = await supabase
      .from("tools")
      .select("*")
      .ilike("tool_name", term)
      .order("tool_name");

    if (exactResult.error) {
      return {
        success: false,
        message: exactResult.error.message,
        data: [],
        rentals: [],
        services: [],
        limited: false,
      };
    }

    // A clicked suggestion contains the actual saved tool name.
    // Never replace it with nearby/fuzzy matches: only that selected spelling
    // (including duplicate stock rows with the same name) may be returned.
    allMatches = exactResult.data || [];
  } else {
    const metadataTerm = cleanToolMetadataSearchTerm(term);

    const nameRequest = supabase
      .from("tools")
      .select("*")
      .ilike("tool_name", `%${term}%`)
      .order("tool_name")
      .limit(51);

    const metadataRequest = metadataTerm
      ? supabase
          .from("tools")
          .select("*")
          .or(toolMetadataOrFilter(metadataTerm))
          .order("tool_name")
          .limit(51)
      : Promise.resolve({ data: [], error: null } as any);

    const fallbackRequest = fallbackToolNameRows(term, "*", 250);

    const [nameResult, metadataResult, fallbackResult] = await Promise.all([
      nameRequest,
      metadataRequest,
      fallbackRequest,
    ]);

    if (nameResult.error) {
      return {
        success: false,
        message: nameResult.error.message,
        data: [],
        rentals: [],
        services: [],
        limited: false,
      };
    }

    if (metadataResult.error) {
      return {
        success: false,
        message: metadataResult.error.message,
        data: [],
        rentals: [],
        services: [],
        limited: false,
      };
    }

    if (fallbackResult.error) {
      return {
        success: false,
        message: fallbackResult.error.message,
        data: [],
        rentals: [],
        services: [],
        limited: false,
      };
    }

    allMatches = rankToolRows(
      mergeToolRows(
        nameResult.data || [],
        metadataResult.data || [],
        fallbackResult.data || []
      ),
      term
    );
  }

  const limited = !exactToolName && allMatches.length > 50;
  const tools = exactToolName ? allMatches : allMatches.slice(0, 50);
  const toolIds = tools
    .map((tool: any) => Number(tool.id))
    .filter((id: number) => Number.isFinite(id) && id > 0);

  if (toolIds.length === 0) {
    return {
      success: true,
      message: "No matching tools found",
      data: [],
      rentals: [],
      services: [],
      limited,
    };
  }

  const [rentalsRes, servicesRes] = await Promise.all([
    supabase.from("rentals").select("*").in("tool_id", toolIds),
    supabase.from("services").select("*").in("tool_id", toolIds),
  ]);

  return {
    success: true,
    message: limited
      ? "Showing the first 50 matching tool rows"
      : exactToolName
      ? "Matching entries loaded"
      : "Matching tools loaded",
    data: tools,
    rentals: rentalsRes.error ? [] : rentalsRes.data || [],
    services: servicesRes.error ? [] : servicesRes.data || [],
    limited,
  };
}

export async function suggestToolsForToolsPage(search: string) {
  const term = cleanToolSearchText(search);

  if (term.length < 2) {
    return {
      success: true,
      message: "Type at least two letters",
      data: [],
      limited: false,
    };
  }

  const selectColumns =
    "id,tool_name,total_qty,category,brand,home_branch,current_location,status";

  const directRequest = supabase
    .from("tools")
    .select(selectColumns)
    .ilike("tool_name", `%${term}%`)
    .order("tool_name")
    .limit(100);

  const fallbackRequest = fallbackToolNameRows(
    term,
    selectColumns,
    250
  );

  const [directResult, fallbackResult] = await Promise.all([
    directRequest,
    fallbackRequest,
  ]);

  if (directResult.error) {
    return {
      success: false,
      message: directResult.error.message,
      data: [],
      limited: false,
    };
  }

  if (fallbackResult.error) {
    return {
      success: false,
      message: fallbackResult.error.message,
      data: [],
      limited: false,
    };
  }

  const rankedRows = rankToolRows(
    mergeToolRows(
      directResult.data || [],
      fallbackResult.data || []
    ),
    term
  );

  const groups = new Map<string, any>();

  for (const row of rankedRows) {
    const toolName = String(row.tool_name || "").trim();
    if (!toolName) continue;

    const key = toolName.toLowerCase();
    const current =
      groups.get(key) || {
        tool_name: toolName,
        qty: 0,
        row_count: 0,
        category: "",
        brands: new Set<string>(),
        locations: new Set<string>(),
        statuses: new Set<string>(),
        score: toolSearchScore(row, term),
      };

    current.qty += Math.max(Number(row.total_qty || 1), 1);
    current.row_count += 1;
    current.category ||= String(row.category || "").trim();
    current.score = Math.max(
      Number(current.score || 0),
      toolSearchScore(row, term)
    );

    const brand = String(row.brand || "").trim();
    const location = String(
      row.current_location || row.home_branch || ""
    ).trim();
    const status = String(row.status || "").trim();

    if (brand) current.brands.add(brand);
    if (location) current.locations.add(location);
    if (status) current.statuses.add(status);

    groups.set(key, current);
  }

  const suggestions = Array.from(groups.values())
    .map((row: any) => ({
      tool_name: row.tool_name,
      qty: row.qty,
      row_count: row.row_count,
      category: row.category,
      brands: Array.from(row.brands).slice(0, 3),
      locations: Array.from(row.locations).slice(0, 4),
      statuses: Array.from(row.statuses).slice(0, 3),
      score: Number(row.score || 0),
    }))
    .sort((a: any, b: any) => {
      if (a.score !== b.score) return b.score - a.score;
      return String(a.tool_name || "").localeCompare(
        String(b.tool_name || "")
      );
    });

  return {
    success: true,
    message: suggestions.length
      ? "Live matching tool names loaded"
      : "No matching tool names",
    data: suggestions.slice(0, 20),
    limited: suggestions.length > 20 || rankedRows.length >= 100,
  };
}

export async function searchToolsForHistory(search: string) {
  const term = cleanToolSearchText(search);

  if (!term) {
    return {
      success: true,
      message: "Enter a tool search",
      data: [],
      limited: false,
    };
  }

  const directRequest = supabase
    .from("tools")
    .select("*")
    .ilike("tool_name", `%${term}%`)
    .order("tool_name")
    .limit(51);

  const fallbackRequest = fallbackToolNameRows(term, "*", 250);

  const [directResult, fallbackResult] = await Promise.all([
    directRequest,
    fallbackRequest,
  ]);

  if (directResult.error) {
    return {
      success: false,
      message: directResult.error.message,
      data: [],
      limited: false,
    };
  }

  if (fallbackResult.error) {
    return {
      success: false,
      message: fallbackResult.error.message,
      data: [],
      limited: false,
    };
  }

  const matches = rankToolRows(
    mergeToolRows(
      directResult.data || [],
      fallbackResult.data || []
    ),
    term
  );

  return {
    success: true,
    message:
      matches.length > 50
        ? "Showing the first 50 matching tools"
        : "Matching tools loaded",
    data: matches.slice(0, 50),
    limited: matches.length > 50,
  };
}

export async function saveTools(rows: any[]) {
  const filledRows = rows
    .filter((row) => row.tool_name && row.tool_name.trim() !== "")
    .map((row) => ({
      tool_name: row.tool_name.trim(),
      total_qty: Number(row.total_qty || 1),
      daily_rent: Number(row.daily_rent || 0),
      category: row.category || "",
      brand: row.brand || "",
      color: row.color || "",
      home_branch: row.home_branch || "",
      current_location: row.current_location || row.home_branch || "",
      status: row.status || "Available",
      greasing_due_days: Number(row.greasing_due_days || 0),
      oil_change_due_days: Number(row.oil_change_due_days || 0),
      scheduled_service_due_days: Number(row.scheduled_service_due_days || 0),
      rental_overdue_days: Number(row.rental_overdue_days || 0),
    }));

  if (filledRows.length === 0) {
    return { success: false, message: "No tools to save" };
  }

  const { error } = await supabase.from("tools").insert(filledRows);
  if (error) return { success: false, message: error.message };

  revalidatePath("/tools");
  return { success: true, message: "Tools saved successfully" };
}

export async function updateTool(id: number, row: any) {
  const { error } = await supabase
    .from("tools")
    .update({
      tool_name: row.tool_name || "",
      total_qty: Number(row.total_qty || 1),
      daily_rent: Number(row.daily_rent || 0),
      category: row.category || "",
      brand: row.brand || "",
      color: row.color || "",
      home_branch: row.home_branch || "",
      current_location: row.current_location || "",
      status: row.status || "Available",
      greasing_due_days: Number(row.greasing_due_days || 0),
      oil_change_due_days: Number(row.oil_change_due_days || 0),
      scheduled_service_due_days: Number(row.scheduled_service_due_days || 0),
      rental_overdue_days: Number(row.rental_overdue_days || 0),
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/tools");
  return { success: true, message: "Tool updated successfully" };
}

export async function deleteTool(id: number) {
  const { error } = await supabase.from("tools").delete().eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/tools");
  return { success: true, message: "Tool deleted successfully" };
}

/* CUSTOMERS */

export async function getCustomers(search: string = "") {
  const customersRes = await supabase
    .from("customers")
    .select("*")
    .order("customer_name");

  const rentalsRes = await supabase.from("rentals").select("*");
  const paymentsRes = await supabase.from("payments").select("*");
  const archivedRes = await supabase
    .from("archived_business_monthly")
    .select("*");

  if (customersRes.error) {
    return { success: false, message: customersRes.error.message, data: [] };
  }

  if (rentalsRes.error) {
    return { success: false, message: rentalsRes.error.message, data: [] };
  }

  if (paymentsRes.error) {
    return { success: false, message: paymentsRes.error.message, data: [] };
  }

  const archivedRows = archivedRes.error
    ? []
    : archivedRes.data || [];

  let data = buildCustomerBalances(
    customersRes.data || [],
    rentalsRes.data || [],
    paymentsRes.data || []
  ).map((customer: any) => {
    const oldRows = archivedRows.filter(
      (row: any) =>
        Number(row.customer_id || 0) ===
        Number(customer.id || customer.customer_id || 0)
    );
    const archivedBusiness = oldRows.reduce(
      (sum: number, row: any) =>
        sum + Number(row.rental_business || 0),
      0
    );
    const archivedReceived = oldRows.reduce(
      (sum: number, row: any) =>
        sum + Number(row.payments_received || 0),
      0
    );
    const archivedRoundOff = oldRows.reduce(
      (sum: number, row: any) =>
        sum + Number(row.round_off || 0),
      0
    );

    return {
      ...customer,
      archived_business_total: archivedBusiness,
      archived_received_total: archivedReceived,
      archived_round_off_total: archivedRoundOff,
      lifetime_business:
        Number(customer.rental_total || 0) +
        archivedBusiness,
      lifetime_received:
        Number(customer.received_total || 0) +
        archivedReceived,
    };
  });

  if (search.trim()) {
    const s = search.toLowerCase();

    data = data.filter((c) =>
      `${c.customer_name} ${c.mobile} ${c.occupation} ${c.address} ${c.shop}`
        .toLowerCase()
        .includes(s)
    );
  }

  return { success: true, message: "Customers loaded", data };
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

  if (error) return { success: false, message: error.message };

  revalidatePath("/customers");
  return { success: true, message: "Customer updated successfully" };
}

export async function deleteCustomer(id: number) {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/customers");
  return { success: true, message: "Customer deleted successfully" };
}

/* RENTALS */

export async function getRentalPageData() {
  const customersRes = await supabase
    .from("customers")
    .select("*")
    .order("customer_name");

  const toolsRes = await supabase.from("tools").select("*").order("tool_name");

  const rentalsRes = await supabase
    .from("rentals")
    .select("*")
    .order("created_at", { ascending: false });

  if (customersRes.error) {
    return { success: false, message: customersRes.error.message };
  }

  if (toolsRes.error) {
    return { success: false, message: toolsRes.error.message };
  }

  if (rentalsRes.error) {
    return { success: false, message: rentalsRes.error.message };
  }

  return {
    success: true,
    customers: customersRes.data || [],
    tools: toolsRes.data || [],
    rentals: rentalsRes.data || [],
  };
}

function isOutsideRental(row: any) {
  return row?.is_outside_rent === true || row?.is_outside_rent === "true";
}

function hasRentalItem(row: any) {
  return Boolean(
    row?.tool_id ||
      (isOutsideRental(row) &&
        String(row?.outside_item_name || "").trim()),
  );
}

function normalizeShop(value: any) {
  return String(value || "").trim();
}

function isToolUnavailableStatus(value: any) {
  const status = String(value || "").trim().toLowerCase();
  return ["service", "in service", "missing", "inactive", "damaged"].includes(status);
}

function isActiveStockRental(row: any) {
  if (row?.is_transport_charge) return false;
  if (row?.end_date || row?.return_date || row?.closed_date) {
    return false;
  }

  const status = String(row?.status || "Active")
    .trim()
    .toLowerCase();

  return !["returned", "closed", "completed", "cancelled"].includes(
    status,
  );
}

async function validateRentalStock(rows: any[], excludeRentalId?: number) {
  const internalRows = rows.filter(
    (row) => row.customer_id && hasRentalItem(row) && row.start_date && !isOutsideRental(row),
  );

  if (internalRows.length === 0) {
    return { success: true };
  }

  const toolIds = Array.from(
    new Set(internalRows.map((row) => Number(row.tool_id)).filter(Boolean)),
  );

  const [
    { data: tools, error: toolsError },
    { data: rentalRows, error: rentalsError },
  ] = await Promise.all([
    supabase.from("tools").select("*").in("id", toolIds),
    supabase
      .from("rentals")
      .select(
        "id, tool_id, qty, shop, status, end_date, is_transport_charge",
      )
      .is("end_date", null)
      .in("tool_id", toolIds),
  ]);

  const activeRentals = (rentalRows || []).filter(
    isActiveStockRental,
  );

  if (toolsError) return { success: false, message: toolsError.message };
  if (rentalsError) return { success: false, message: rentalsError.message };

  const requestedByTool = new Map<number, number>();

  for (const row of internalRows) {
    const toolId = Number(row.tool_id);
    const tool = (tools || []).find((item: any) => Number(item.id) === toolId);
    const rentalShop = normalizeShop(row.shop);

    if (!tool) {
      return { success: false, message: "Selected tool was not found. Please refresh and try again." };
    }

    const toolName = tool.tool_name || "Selected item";
    const currentLocation = normalizeShop(tool.current_location || tool.home_branch);

    if (!rentalShop) {
      return { success: false, message: `Select the rental shop before renting ${toolName}.` };
    }

    if (currentLocation !== rentalShop) {
      return {
        success: false,
        message: `${toolName} is not available at ${rentalShop}. Current location: ${currentLocation || "Not set"}. Move the item to ${rentalShop} first, then enter the rental.`,
      };
    }

    if (isToolUnavailableStatus(tool.status)) {
      return {
        success: false,
        message: `${toolName} cannot be rented because its status is ${tool.status || "Unavailable"}.`,
      };
    }

    const totalQty = Math.max(Number(tool.total_qty || 1), 1);
    const matchingActiveRentals = activeRentals
      .filter(
        (rental: any) =>
          Number(rental.id) !== Number(excludeRentalId || 0),
      )
      .filter(
        (rental: any) => Number(rental.tool_id) === toolId,
      );
    const alreadyRentedQty = matchingActiveRentals.reduce(
      (sum: number, rental: any) =>
        sum + Math.max(Number(rental.qty || 1), 1),
      0,
    );
    const previousRequested = requestedByTool.get(toolId) || 0;
    const requestedQty = Math.max(Number(row.qty || 1), 1);

    if (totalQty === 1) {
      if (requestedQty !== 1) {
        return {
          success: false,
          message: `${toolName} is an individual tool. Its rental quantity must be 1.`,
        };
      }

      if (alreadyRentedQty > 0) {
        return {
          success: false,
          message: `${toolName} is already on a live rental. The same individual tool cannot be rented twice at the same time.`,
        };
      }

      if (previousRequested > 0) {
        return {
          success: false,
          message: `${toolName} is entered more than once in the current rental entry. An individual tool can be saved only once.`,
        };
      }
    }

    const availableQty = Math.max(
      totalQty - alreadyRentedQty - previousRequested,
      0,
    );

    if (requestedQty > availableQty) {
      return {
        success: false,
        message: `${toolName} does not have enough stock at ${rentalShop}. Available: ${availableQty}, requested: ${requestedQty}. Move stock to ${rentalShop} first or reduce the quantity.`,
      };
    }

    requestedByTool.set(
      toolId,
      previousRequested + requestedQty,
    );
  }

  return { success: true };
}

function cleanRentalRow(row: any) {
  const qty = Number(row.qty || 1);
  const dailyRate = Number(row.daily_rate || 0);
  const discount = Number(row.discount || 0);
  const avoidSundays = row.avoid_sundays !== false;
  const isOutsideRent = isOutsideRental(row);
  const outsideItemName = String(row.outside_item_name || "").trim();
  const outsideShopName = String(row.outside_shop_name || "").trim();

  const totalAmount =
    row.status === "Returned"
      ? Math.max(qty * dailyRate * calcDays(row.start_date, row.end_date, avoidSundays) - discount, 0)
      : 0;

  return {
    customer_id: Number(row.customer_id),
    tool_id: isOutsideRent ? null : Number(row.tool_id),
    is_outside_rent: isOutsideRent,
    outside_item_name: isOutsideRent ? outsideItemName : null,
    outside_shop_name: isOutsideRent ? outsideShopName || null : null,
    qty,
    daily_rate: dailyRate,
    discount,
    start_date: row.start_date,
    end_date: row.end_date || null,
    status: row.status || "Active",
    total_amount: totalAmount,
    payment_status: row.payment_status || "Not Paid",
    shop: row.shop || "",
    avoid_sundays: avoidSundays,
  };
}

export async function saveRental(row: any) {
  if (!row.customer_id || !hasRentalItem(row) || !row.start_date) {
    return {
      success: false,
      message: "Customer, item and start date are required",
    };
  }

  const stockCheck = await validateRentalStock([row]);
  if (!stockCheck.success) return stockCheck;

  const { error } = await supabase.from("rentals").insert(cleanRentalRow(row));

  if (error) return { success: false, message: error.message };

  revalidatePath("/rentals");
  revalidatePath("/customers");
  revalidatePath("/collections");
  revalidatePath("/");
  return { success: true, message: "Rental saved successfully" };
}

function cleanTransportRow(row: any) {
  return {
    customer_id: Number(row.customer_id),
    tool_id: null,
    is_transport_charge: true,
    transport_vehicle_type: String(row.vehicle_type || "Auto").trim() || "Auto",
    transport_trip_type: String(row.trip_type || "Delivery").trim() || "Delivery",
    transport_location: String(row.delivery_location || "").trim() || null,
    transport_amount: Number(row.amount || 0),
    transport_date: row.transport_date,
    transport_notes: String(row.notes || "").trim() || null,
    qty: 1,
    daily_rate: Number(row.amount || 0),
    discount: 0,
    start_date: row.transport_date,
    end_date: row.transport_date,
    status: "Returned",
    total_amount: Number(row.amount || 0),
    payment_status: "Pending",
    shop: row.shop || "",
    avoid_sundays: false,
  };
}

export async function saveRentals(rows: any[], transportRows: any[] = []) {
  const validRows = rows
    .filter(
      (row) => row.customer_id && hasRentalItem(row) && row.start_date
    )
    .map((row) => cleanRentalRow(row));

  const validTransportRows = transportRows
    .filter(
      (row) => row.customer_id && Number(row.amount || 0) > 0 && row.transport_date,
    )
    .map((row) => cleanTransportRow(row));

  const rowsToInsert = [...validRows, ...validTransportRows];

  if (rowsToInsert.length === 0) {
    return { success: false, message: "No valid rentals or transport entries to save" };
  }

  const stockCheck = await validateRentalStock(rows);
  if (!stockCheck.success) return stockCheck;

  const { error } = await supabase.from("rentals").insert(rowsToInsert);

  if (error) return { success: false, message: error.message };

  revalidatePath("/rentals");
  revalidatePath("/customers");
  revalidatePath("/collections");
  revalidatePath("/");
  return {
    success: true,
    message: `${validRows.length} rental(s) and ${validTransportRows.length} transport charge(s) saved successfully`,
  };
}

export async function returnRental(id: number, endDate: string) {
  const { data, error: readError } = await supabase
    .from("rentals")
    .select("*")
    .eq("id", id)
    .single();

  if (readError) return { success: false, message: readError.message };

  const qty = Number(data.qty || 1);
  const dailyRate = Number(data.daily_rate || 0);
  const discount = Number(data.discount || 0);
  const avoidSundays = data.avoid_sundays !== false;

  const totalAmount = Math.max(
    qty * dailyRate * calcDays(data.start_date, endDate, avoidSundays) - discount,
    0
  );

  const { error } = await supabase
    .from("rentals")
    .update({
      end_date: endDate,
      status: "Returned",
      total_amount: totalAmount,
      payment_status: "Pending",
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/rentals");
  revalidatePath("/customers");
  revalidatePath("/collections");
  revalidatePath("/");
  return { success: true, message: "Rental returned successfully" };
}


export async function updateRentalWithAudit(payload: any) {
  const rental = payload?.rental || {};
  const rentalId = Number(rental.id || 0);
  const reason = String(payload?.reason || "").trim();
  const explanation = String(payload?.explanation || "").trim();
  const editedBy = String(payload?.edited_by || "Manager").trim() || "Manager";

  if (!rentalId) return { success: false, message: "Rental id not found" };
  if (!reason) return { success: false, message: "Reason for edit is required" };
  if (explanation.length < 10) {
    return { success: false, message: "Please enter a proper explanation of at least 10 characters" };
  }

  const { data: existing, error: readError } = await supabase
    .from("rentals")
    .select("*")
    .eq("id", rentalId)
    .single();

  if (readError || !existing) {
    return { success: false, message: readError?.message || "Rental not found" };
  }

  let updated: any;

  if (existing.is_transport_charge || rental.is_transport_charge) {
    const amount = Number(rental.transport_amount ?? rental.total_amount ?? 0);
    const transportDate = rental.transport_date || rental.start_date;

    if (!rental.customer_id || !transportDate || amount <= 0) {
      return { success: false, message: "Customer, transport date and amount are required" };
    }

    updated = {
      customer_id: Number(rental.customer_id),
      tool_id: null,
      is_transport_charge: true,
      transport_vehicle_type: String(rental.transport_vehicle_type || "Auto").trim() || "Auto",
      transport_trip_type: String(rental.transport_trip_type || "Delivery").trim() || "Delivery",
      transport_location: String(rental.transport_location || "").trim() || null,
      transport_amount: amount,
      transport_date: transportDate,
      transport_notes: String(rental.transport_notes || "").trim() || null,
      qty: 1,
      daily_rate: amount,
      discount: 0,
      start_date: transportDate,
      end_date: transportDate,
      status: "Returned",
      total_amount: amount,
      payment_status: existing.payment_status || "Pending",
      shop: rental.shop || existing.shop || "",
      avoid_sundays: false,
    };
  } else {
    const status = rental.status === "Returned" ? "Returned" : "Active";
    const isOutsideRent = isOutsideRental(rental);
    const qty = Math.max(Number(rental.qty || 1), 1);
    const dailyRate = Math.max(Number(rental.daily_rate || 0), 0);
    const discount = Math.max(Number(rental.discount || 0), 0);
    const startDate = rental.start_date;
    const endDate = status === "Returned" ? rental.end_date : null;
    const avoidSundays = rental.avoid_sundays !== false;

    if (!rental.customer_id || !startDate) {
      return { success: false, message: "Customer and start date are required" };
    }
    if (!isOutsideRent && !rental.tool_id) {
      return { success: false, message: "Tool is required" };
    }
    if (isOutsideRent && !String(rental.outside_item_name || "").trim()) {
      return { success: false, message: "Outside item name is required" };
    }
    if (status === "Returned" && !endDate) {
      return { success: false, message: "Return date is required for a returned rental" };
    }

    const stockCandidate = {
      ...rental,
      qty,
      shop: rental.shop || "",
      status,
      start_date: startDate,
      is_outside_rent: isOutsideRent,
    };

    if (status === "Active" && !isOutsideRent) {
      const stockCheck = await validateRentalStock([stockCandidate], rentalId);
      if (!stockCheck.success) return stockCheck;
    }

    const totalAmount = status === "Returned"
      ? Math.max(qty * dailyRate * calcDays(startDate, endDate, avoidSundays) - discount, 0)
      : 0;

    updated = {
      customer_id: Number(rental.customer_id),
      tool_id: isOutsideRent ? null : Number(rental.tool_id),
      is_outside_rent: isOutsideRent,
      outside_item_name: isOutsideRent ? String(rental.outside_item_name || "").trim() : null,
      outside_shop_name: isOutsideRent ? String(rental.outside_shop_name || "").trim() || null : null,
      qty,
      daily_rate: dailyRate,
      discount,
      start_date: startDate,
      end_date: endDate || null,
      status,
      total_amount: totalAmount,
      payment_status: status === "Returned" ? (existing.payment_status || "Pending") : (existing.payment_status || "Not Paid"),
      shop: rental.shop || "",
      avoid_sundays: avoidSundays,
    };
  }

  const { error: auditError } = await supabase.from("rental_edit_history").insert({
    rental_id: rentalId,
    previous_values: existing,
    updated_values: updated,
    edit_reason: reason,
    explanation,
    edited_by: editedBy,
  });

  if (auditError) {
    return { success: false, message: `Could not save edit history: ${auditError.message}` };
  }

  const { error: updateError } = await supabase
    .from("rentals")
    .update(updated)
    .eq("id", rentalId);

  if (updateError) return { success: false, message: updateError.message };

  revalidatePath("/rentals");
  revalidatePath("/customers");
  revalidatePath("/payments");
  revalidatePath("/collections");
  revalidatePath("/");

  return {
    success: true,
    message: existing.status === "Returned"
      ? "Returned rental updated and explanation saved"
      : "Rental updated and edit history saved",
  };
}

export async function deleteRental(id: number) {
  const { error } = await supabase.from("rentals").delete().eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/rentals");
  revalidatePath("/customers");
  revalidatePath("/collections");
  revalidatePath("/");
  return { success: true, message: "Rental deleted successfully" };
}

/* PAYMENTS */

export async function getPaymentPageData(search: string = "") {
  const customersRes = await supabase
    .from("customers")
    .select("*")
    .order("customer_name");

  const paymentsRes = await supabase
    .from("payments")
    .select("*")
    .order("payment_date", { ascending: false });

  if (customersRes.error) {
    return { success: false, message: customersRes.error.message };
  }

  if (paymentsRes.error) {
    return { success: false, message: paymentsRes.error.message };
  }

  let payments = paymentsRes.data || [];
  const customers = customersRes.data || [];

  if (search.trim()) {
    const s = search.toLowerCase();

    payments = payments.filter((p: any) => {
      const c = customers.find(
        (x: any) => Number(x.id) === Number(p.customer_id)
      );

      const customerText = c
        ? `${c.customer_name} ${c.mobile} ${c.occupation}`.toLowerCase()
        : "";

      return (
        customerText.includes(s) ||
        String(p.amount || "").includes(s) ||
        String(p.payment_mode || p.mode || "").toLowerCase().includes(s) ||
        String(p.shop || "").toLowerCase().includes(s) ||
        String(p.remarks || "").toLowerCase().includes(s)
      );
    });
  }

  return {
    success: true,
    customers,
    payments,
  };
}

export async function savePayment(row: any) {
  if (!row.customer_id || !row.amount || !row.payment_date) {
    return { success: false, message: "Customer, amount and date are required" };
  }

  const { error } = await supabase.from("payments").insert({
    customer_id: Number(row.customer_id),
    customer_name: row.customer_name || "",
    mobile: row.mobile || "",
    amount: Number(row.amount || 0),
    discount: Number(row.discount || 0),
    payment_mode: row.payment_mode || row.mode || "Cash",
    mode: row.mode || row.payment_mode || "Cash",
    payment_date: row.payment_date,
    remarks: row.remarks || "",
    shop: row.shop || "",
  });

  if (error) return { success: false, message: error.message };

  revalidatePath("/payments");
  revalidatePath("/customers");
  revalidatePath("/collections");
  revalidatePath("/reports");
  revalidatePath("/");
  return { success: true, message: "Payment saved successfully" };
}

export async function updatePayment(id: number, row: any) {
  const { error } = await supabase
    .from("payments")
    .update({
      customer_id: Number(row.customer_id),
      customer_name: row.customer_name || "",
      mobile: row.mobile || "",
      amount: Number(row.amount || 0),
      discount: Number(row.discount || 0),
      payment_mode: row.payment_mode || row.mode || "Cash",
      mode: row.mode || row.payment_mode || "Cash",
      payment_date: row.payment_date,
      remarks: row.remarks || "",
      shop: row.shop || "",
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/payments");
  revalidatePath("/customers");
  revalidatePath("/collections");
  revalidatePath("/reports");
  revalidatePath("/");
  return { success: true, message: "Payment updated successfully" };
}

export async function deletePayment(id: number) {
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/payments");
  revalidatePath("/customers");
  revalidatePath("/collections");
  revalidatePath("/reports");
  revalidatePath("/");
  return { success: true, message: "Payment deleted successfully" };
}

/* COLLECTIONS */

export async function getCollectionsData() {
  const customersRes = await supabase
    .from("customers")
    .select("*")
    .order("customer_name");

  const rentalsRes = await supabase.from("rentals").select("*");
  const paymentsRes = await supabase.from("payments").select("*");

  if (customersRes.error) {
    return { success: false, message: customersRes.error.message };
  }

  if (rentalsRes.error) {
    return { success: false, message: rentalsRes.error.message };
  }

  if (paymentsRes.error) {
    return { success: false, message: paymentsRes.error.message };
  }

  const balances = buildCustomerBalances(
    customersRes.data || [],
    rentalsRes.data || [],
    paymentsRes.data || []
  )
    .filter((c) => Number(c.balance || 0) > 0)
    .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));

  return {
    success: true,
    data: balances,
  };
}

/* SERVICE */

export async function getServicePageData(search: string = "") {
  const toolsRes = await supabase.from("tools").select("*").order("tool_name");

  const servicesRes = await supabase
    .from("services")
    .select("*")
    .order("date_out", { ascending: false });

  const centresRes = await supabase
    .from("service_centres")
    .select("*")
    .order("name");

  if (toolsRes.error) {
    return {
      success: false,
      message: toolsRes.error.message,
      tools: [],
      services: [],
      serviceCentres: [],
    };
  }

  if (servicesRes.error) {
    return {
      success: false,
      message: servicesRes.error.message,
      tools: [],
      services: [],
      serviceCentres: [],
    };
  }

  if (centresRes.error) {
    return {
      success: false,
      message: centresRes.error.message,
      tools: [],
      services: [],
      serviceCentres: [],
    };
  }

  const tools = toolsRes.data || [];
  let services = servicesRes.data || [];

  if (search.trim()) {
    const s = search.toLowerCase();

    services = services.filter((item: any) => {
      const tool = tools.find(
        (t: any) => Number(t.id) === Number(item.tool_id)
      );

      const toolText = tool ? String(tool.tool_name || "").toLowerCase() : "";

      return (
        toolText.includes(s) ||
        String(item.service_centre || "").toLowerCase().includes(s) ||
        String(item.complaint || "").toLowerCase().includes(s) ||
        String(item.work_done || "").toLowerCase().includes(s) ||
        String(item.status || "").toLowerCase().includes(s) ||
        String(item.remarks || "").toLowerCase().includes(s)
      );
    });
  }

  const serviceCentres = (centresRes.data || [])
    .map((c: any) => c.name)
    .filter(Boolean)
    .sort();

  return {
    success: true,
    tools,
    services,
    serviceCentres,
  };
}

export async function addServiceCentre(name: string) {
  if (!name.trim()) {
    return { success: false, message: "Service centre name required" };
  }

  const { error } = await supabase
    .from("service_centres")
    .upsert({ name: name.trim() }, { onConflict: "name" });

  if (error) return { success: false, message: error.message };

  revalidatePath("/service");
  return { success: true, message: "Service centre added successfully" };
}

export async function saveService(row: any) {
  if (!row.tool_id || !row.service_centre || !row.date_out) {
    return {
      success: false,
      message: "Tool, service centre and date out are required",
    };
  }

  const { data: tool } = await supabase
    .from("tools")
    .select("*")
    .eq("id", Number(row.tool_id))
    .single();

  const { error } = await supabase.from("services").insert({
    tool_id: Number(row.tool_id),
    home_branch: tool?.home_branch || "",
    active_branch: tool?.current_location || "",
    service_centre: row.service_centre || "",
    complaint: row.complaint || "",
    work_done: row.work_done || "",
    cost: Number(row.cost || 0),
    date_out: row.date_out,
    date_in: row.date_in || null,
    return_branch: row.return_branch || null,
    status: row.status || "In Service",
    remarks: row.remarks || "",
  });

  if (error) return { success: false, message: error.message };

  const updateToolData: any = {
    status:
      row.status === "Completed" || row.status === "Returned"
        ? "Available"
        : "Service",
    service_status: row.status || "In Service",
  };

  if (
    (row.status === "Completed" || row.status === "Returned") &&
    row.return_branch
  ) {
    updateToolData.current_location = row.return_branch;
  }

  const { error: toolError } = await supabase
    .from("tools")
    .update(updateToolData)
    .eq("id", Number(row.tool_id));

  if (toolError) return { success: false, message: toolError.message };

  revalidatePath("/service");
  revalidatePath("/tools");
  revalidatePath("/");

  return { success: true, message: "Service saved successfully" };
}

export async function saveToServiceRows(rows: any[]) {
  const validRows = rows.filter(
    (row) => row.tool_id && row.service_centre && row.date_out
  );

  if (validRows.length === 0) {
    return { success: false, message: "No valid service entries" };
  }

  for (const row of validRows) {
    const { error } = await supabase.from("services").insert({
      tool_id: Number(row.tool_id),
      home_branch: row.home_branch || "",
      active_branch: row.active_branch || "",
      service_centre: row.service_centre || "",
      complaint: row.complaint || "",
      work_done: "",
      cost: 0,
      date_out: row.date_out,
      date_in: null,
      return_branch: null,
      status: "In Service",
      service_type: row.service_type || "General Repair",
      greasing_done: Boolean(row.greasing_done),
      oil_change_done: Boolean(row.oil_change_done),
      scheduled_service_done: Boolean(row.scheduled_service_done),
      remarks: row.remarks || "",
    });

    if (error) return { success: false, message: error.message };

    const { error: toolError } = await supabase
      .from("tools")
      .update({
        status: "Service",
        service_status: "In Service",
      })
      .eq("id", Number(row.tool_id));

    if (toolError) return { success: false, message: toolError.message };
  }

  revalidatePath("/service");
  revalidatePath("/tools");
  revalidatePath("/");

  return {
    success: true,
    message: `${validRows.length} tools sent to service. Current location not changed.`,
  };
}

export async function saveFromServiceRows(rows: any[]) {
  const filledRows = rows.filter((row) => row.tool_id);

  if (filledRows.length === 0) {
    return { success: false, message: "No service return rows to save" };
  }

  for (const row of filledRows) {
    const { data: existingService } = await supabase
      .from("services")
      .select("*")
      .eq("tool_id", Number(row.tool_id))
      .eq("status", "In Service")
      .order("date_out", { ascending: false })
      .limit(1)
      .maybeSingle();

    const greasingDone = Boolean(row.greasing_done);
    const oilChangeDone = Boolean(row.oil_change_done);
    const scheduledServiceDone = Boolean(row.scheduled_service_done);
    const serviceType = row.service_type || "General Repair";

    if (existingService) {
      const { error } = await supabase
        .from("services")
        .update({
          active_branch:
            row.active_branch || existingService.active_branch || "",
          service_centre:
            row.service_centre || existingService.service_centre || "",
          return_branch: row.return_branch || "",
          work_done: row.work_done || "",
          cost: Number(row.cost || 0),
          date_in: row.date_in,
          status: "Completed",
          service_type: serviceType,
          greasing_done: greasingDone,
          oil_change_done: oilChangeDone,
          scheduled_service_done: scheduledServiceDone,
          remarks: row.remarks || existingService.remarks || "",
        })
        .eq("id", existingService.id);

      if (error) return { success: false, message: error.message };
    } else {
      const { error } = await supabase.from("services").insert({
        tool_id: Number(row.tool_id),
        home_branch: row.home_branch || "",
        active_branch: row.active_branch || "",
        service_centre: row.service_centre || "",
        return_branch: row.return_branch || "",
        complaint: "",
        work_done: row.work_done || "",
        cost: Number(row.cost || 0),
        date_in: row.date_in,
        status: "Completed",
        service_type: serviceType,
        greasing_done: greasingDone,
        oil_change_done: oilChangeDone,
        scheduled_service_done: scheduledServiceDone,
        remarks: row.remarks || "",
      });

      if (error) return { success: false, message: error.message };
    }

    const toolUpdateData: any = {
      status: "Available",
      service_status: "Completed",
      current_location: row.return_branch || "",
    };

    if (greasingDone || serviceType === "Greasing") {
      toolUpdateData.last_greasing_date = row.date_in;
    }

    if (oilChangeDone || serviceType === "Oil Change") {
      toolUpdateData.last_oil_change_date = row.date_in;
    }

    if (scheduledServiceDone || serviceType === "Scheduled Service") {
      toolUpdateData.last_scheduled_service_date = row.date_in;
    }

    const { error: toolError } = await supabase
      .from("tools")
      .update(toolUpdateData)
      .eq("id", Number(row.tool_id));

    if (toolError) return { success: false, message: toolError.message };
  }

  revalidatePath("/service");
  revalidatePath("/");
  revalidatePath("/tools");

  return { success: true, message: "From service saved successfully" };
}

export async function updateService(id: number, row: any) {
  const { error } = await supabase
    .from("services")
    .update({
      tool_id: Number(row.tool_id),
      home_branch: row.home_branch || "",
      active_branch: row.active_branch || "",
      service_centre: row.service_centre || "",
      complaint: row.complaint || "",
      work_done: row.work_done || "",
      cost: Number(row.cost || 0),
      date_out: row.date_out || null,
      date_in: row.date_in || null,
      return_branch: row.return_branch || null,
      status: row.status || "In Service",
      service_type: row.service_type || "General Repair",
      greasing_done: Boolean(row.greasing_done),
      oil_change_done: Boolean(row.oil_change_done),
      scheduled_service_done: Boolean(row.scheduled_service_done),
      remarks: row.remarks || "",
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  const updateToolData: any = {
    status:
      row.status === "Completed" || row.status === "Returned"
        ? "Available"
        : "Service",
    service_status: row.status || "In Service",
  };

  if (
    (row.status === "Completed" || row.status === "Returned") &&
    row.return_branch
  ) {
    updateToolData.current_location = row.return_branch;
  }

  if (row.tool_id) {
    const { error: toolError } = await supabase
      .from("tools")
      .update(updateToolData)
      .eq("id", Number(row.tool_id));

    if (toolError) return { success: false, message: toolError.message };
  }

  revalidatePath("/service");
  revalidatePath("/tools");
  revalidatePath("/");

  return { success: true, message: "Service updated successfully" };
}

export async function deleteService(id: number) {
  const { error } = await supabase.from("services").delete().eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/service");
  revalidatePath("/");

  return { success: true, message: "Service deleted successfully" };
}
export async function saveTool(row: any) {
  return saveTools([row]);
}

export async function getToolHistory(toolId: number) {
  const { data: tool, error: toolError } = await supabase
    .from("tools")
    .select("*")
    .eq("id", toolId)
    .single();

  if (toolError) {
    return { success: false, message: toolError.message };
  }

  const { data: movements } = await supabase
    .from("movements")
    .select("*")
    .eq("tool_id", toolId);

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("tool_id", toolId);

  const { data: archivedHistory } = await supabase
    .from("archived_tool_monthly")
    .select("*")
    .eq("tool_id", toolId);

  const movementHistory =
    movements?.map((m: any) => ({
      date: m.movement_date || m.date || m.created_at || "",
      type: "Shop Movement",
      from_location: m.from_location || m.from_branch || "",
      to_location: m.to_location || m.to_branch || "",
      service_centre: "",
      note: m.remarks || m.note || "",
      work_done: "",
      cost: 0,
      status: m.status || "",
    })) || [];

  const serviceHistory =
    services?.map((s: any) => ({
      date: s.date_in || s.date_out || s.created_at || "",
      type: s.service_type || (s.date_in ? "From Service" : "To Service"),
      from_location: s.date_in ? s.service_centre : s.active_branch,
      to_location: s.date_in ? s.return_branch : s.service_centre,
      service_centre: s.service_centre || "",
      note: s.complaint || s.remarks || "",
      work_done: s.work_done || "",
      cost: Number(s.cost || 0),
      status: s.status || "",
    })) || [];

  const archivedSummaryHistory =
    archivedHistory?.map((row: any) => ({
      date: row.month_start || "",
      type: "Archived Monthly Summary",
      from_location: "",
      to_location: row.shop || "",
      service_centre: "",
      note: `${Number(row.movement_count || 0)} movement(s), ${Number(
        row.service_count || 0
      )} completed service record(s)`,
      work_done: "Old details summarized after six months",
      cost: Number(row.service_cost || 0),
      status: "Archived",
    })) || [];

  const history = [
    ...movementHistory,
    ...serviceHistory,
    ...archivedSummaryHistory,
  ].sort(
    (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  );

  const totalServiceCost = [
    ...serviceHistory,
    ...archivedSummaryHistory,
  ].reduce(
    (sum, row) => sum + Number(row.cost || 0),
    0
  );

  return {
    success: true,
    tool: {
      ...tool,
      total_service_cost: totalServiceCost,
    },
    history,
  };
}
export async function getPaymentsData() {
  const [
    { data: customers, error: customerError },
    { data: rentals, error: rentalError },
    { data: payments, error: paymentError },
  ] = await Promise.all([
    supabase.from("customers").select("*"),
    supabase.from("rentals").select("*"),
    supabase.from("payments").select("*"),
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

  const rows = buildCustomerBalanceRows(
    customers || [],
    rentals || [],
    payments || []
  ).filter((row: any) => Number(row.balance || 0) > 0);

  return { success: true, data: rows };
}