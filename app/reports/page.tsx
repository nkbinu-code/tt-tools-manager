"use client";

import {
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { Download, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAppMessage } from "../contexts/AppMessageProvider";

const shops = [
  "All Shops",
  "Karuvannur",
  "Ollur",
  "Kachery",
  "Mulayam Rd",
  "Pattikkad",
];

const reportOptions = [
  {
    value: "day_shop_business",
    label: "Day-wise Shop Business",
  },
  {
    value: "top_customers",
    label: "Top Customers",
  },
  {
    value: "unpaid_customers",
    label: "Top 10 Most Unpaid Customers",
  },
  {
    value: "top_tools",
    label: "Top Tools",
  },
  {
    value: "least_used_tools",
    label: "Least 10 Used Tools",
  },
  {
    value: "least_profit_tools",
    label: "Least Profit Tools",
  },
  {
    value: "tool_profit_analyzer",
    label: "Tool Profit Analyzer",
  },
  {
    value: "expense_report",
    label: "Month-wise Expense Report",
  },
  {
    value: "shop_performance",
    label: "Shop Performance",
  },
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => todayISO().slice(0, 7);

function rupee(value: any) {
  return `₹${Number(value || 0).toFixed(0)}`;
}

function cleanDate(value: any) {
  return String(value || "").slice(0, 10);
}

function rowShop(row: any) {
  return String(
    row?.shop ||
      row?.branch ||
      row?.from_branch ||
      row?.return_branch ||
      ""
  ).trim();
}

function rowMobile(row: any) {
  return String(
    row?.mobile || row?.customer_mobile || row?.phone || ""
  ).trim();
}

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function safeSearch(value: string) {
  return String(value || "")
    .trim()
    .replace(/[,%()"'\\]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function monthRange(month: string) {
  const safeMonth = month || thisMonth();
  const [year, monthNumber] = safeMonth.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();

  return {
    from: `${safeMonth}-01`,
    to: `${safeMonth}-${String(lastDay).padStart(2, "0")}`,
  };
}

function dateInRange(value: any, from: string, to: string) {
  const date = cleanDate(value);
  return Boolean(date && date >= from && date <= to);
}

function rentalOverlapsRange(row: any, from: string, to: string) {
  const start = cleanDate(
    row?.start_date || row?.date || row?.rental_date
  );
  const end = cleanDate(
    row?.end_date || row?.return_date || row?.closed_date
  );

  if (!start || start > to) return false;
  if (end && end < from) return false;

  return true;
}

function isActiveRentalOnDate(row: any, date: string) {
  if (row?.is_transport_charge) return false;

  const start = cleanDate(
    row?.start_date || row?.date || row?.rental_date
  );
  const end = cleanDate(
    row?.end_date || row?.return_date || row?.closed_date
  );
  const status = normalize(row?.status || "active");

  if (!start || start > date) return false;
  if (end && end < date) return false;

  return !["returned", "closed", "completed", "cancelled"].includes(
    status
  );
}

function countRentalDays(
  startValue: any,
  endValue: any,
  avoidSundays = true
) {
  const start = new Date(cleanDate(startValue));
  const end = new Date(cleanDate(endValue));

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return 0;
  }

  let days = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    if (!(avoidSundays && cursor.getDay() === 0)) {
      days += 1;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function rentalAmountWithinRange(
  row: any,
  from: string,
  to: string
) {
  if (row?.is_transport_charge) {
    const transportDate = cleanDate(
      row.transport_date || row.start_date
    );

    return dateInRange(transportDate, from, to)
      ? Number(
          row.transport_amount ||
            row.total_amount ||
            row.daily_rate ||
            0
        )
      : 0;
  }

  if (!rentalOverlapsRange(row, from, to)) return 0;

  const start = cleanDate(row.start_date);
  const savedEnd = cleanDate(row.end_date);
  const effectiveStart = start > from ? start : from;
  const effectiveEnd =
    savedEnd && savedEnd < to ? savedEnd : to;
  const avoidSundays = row.avoid_sundays !== false;
  const days = countRentalDays(
    effectiveStart,
    effectiveEnd,
    avoidSundays
  );

  return Math.max(
    days *
      Math.max(Number(row.qty || 1), 1) *
      Number(row.daily_rate || 0) -
      Number(row.discount || 0),
    0
  );
}

function dailyRentalBusiness(row: any, date: string) {
  if (row?.is_transport_charge) {
    const transportDate = cleanDate(
      row.transport_date || row.start_date
    );

    return transportDate === date
      ? Number(
          row.transport_amount ||
            row.total_amount ||
            row.daily_rate ||
            0
        )
      : 0;
  }

  const start = cleanDate(row.start_date);
  const end = cleanDate(row.end_date);

  if (!start || start > date) return 0;
  if (end && end < date) return 0;

  const selectedDate = new Date(date);
  if (
    row.avoid_sundays !== false &&
    !Number.isNaN(selectedDate.getTime()) &&
    selectedDate.getDay() === 0
  ) {
    return 0;
  }

  return (
    Math.max(Number(row.qty || 1), 1) *
    Number(row.daily_rate || 0)
  );
}

function paymentEntryType(row: any) {
  return normalize(row?.entry_type || "payment");
}

function paymentCollection(row: any) {
  const type = paymentEntryType(row);

  if (type === "opening_due" || type === "opening_credit") {
    return 0;
  }

  return Number(row?.amount || 0);
}

function paymentRoundOff(row: any) {
  const type = paymentEntryType(row);

  if (type === "opening_due" || type === "opening_credit") {
    return 0;
  }

  return Number(row?.discount || 0);
}

function openingBalanceAmount(row: any) {
  const type = paymentEntryType(row);
  const amount = Math.abs(Number(row?.amount || 0));

  if (type === "opening_due") return amount;
  if (type === "opening_credit") return -amount;

  return 0;
}

function serviceDate(row: any) {
  return cleanDate(
    row?.date_in ||
      row?.return_date ||
      row?.date_out ||
      row?.out_date ||
      row?.created_at
  );
}

function toolNameForRow(row: any, toolsById: Map<string, any>) {
  if (row?.is_outside_rent) {
    return String(row?.outside_item_name || "Outside Item");
  }

  const tool = toolsById.get(String(row?.tool_id || ""));

  return String(
    tool?.tool_name ||
      row?.tool_name ||
      row?.tool ||
      "Unknown Tool"
  );
}

function customerForRow(
  row: any,
  customersById: Map<string, any>,
  customersByMobile: Map<string, any>
) {
  return (
    customersById.get(String(row?.customer_id || "")) ||
    customersByMobile.get(rowMobile(row)) ||
    {}
  );
}

function csvSafe(value: any) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

type ShopBusinessRow = {
  shop: string;
  business: number;
  collections: number;
  roundOff: number;
  balance: number;
  active: number;
};

type CustomerReportRow = {
  customer: string;
  mobile: string;
  shop: string;
  business: number;
  collections: number;
  balance: number;
};

type ToolReportSummary = {
  tool: string;
  qty: number;
  location: string;
  times: number;
  days: number;
  revenue: number;
  serviceCost: number;
  purchaseCost: number;
  profit: number;
  roi: number;
};

type ReportResult = {
  title: string;
  subtitle: string;
  headers: string[];
  rows: any[][];
  summary: Array<{
    label: string;
    value: string | number;
    tone?: "normal" | "green" | "red";
  }>;
};

const emptyResult: ReportResult = {
  title: "",
  subtitle: "",
  headers: [],
  rows: [],
  summary: [],
};

export default function ReportsPage() {
  const { setAppMessage } = useAppMessage();

  const [reportType, setReportType] = useState(
    "day_shop_business"
  );
  const [month, setMonth] = useState(thisMonth());
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [shop, setShop] = useState("All Shops");
  const [searchText, setSearchText] = useState("");
  const [result, setResult] =
    useState<ReportResult>(emptyResult);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const selectedReportLabel = useMemo(
    () =>
      reportOptions.find((option) => option.value === reportType)
        ?.label || "Report",
    [reportType]
  );

  const searchPlaceholder = useMemo(() => {
    if (
      reportType === "top_customers" ||
      reportType === "unpaid_customers"
    ) {
      return "Customer name or mobile (optional)";
    }

    if (
      reportType === "top_tools" ||
      reportType === "least_used_tools" ||
      reportType === "least_profit_tools" ||
      reportType === "tool_profit_analyzer"
    ) {
      return "Tool name, brand or category (optional)";
    }

    if (reportType === "expense_report") {
      return "Category, description or payment mode (optional)";
    }

    if (reportType === "shop_performance") {
      return "Shop name (optional)";
    }

    return "The selected date and shop will be searched";
  }, [reportType]);

  function showError(message: string) {
    setAppMessage({
      type: "error",
      title: "Error",
      message,
    });
  }

  async function queryRentalsForRange(
    from: string,
    to: string
  ) {
    let query: any = supabase
      .from("rentals")
      .select("*")
      .lte("start_date", to);

    if (shop !== "All Shops") {
      query = query.eq("shop", shop);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return (data || []).filter((row: any) =>
      rentalOverlapsRange(row, from, to)
    );
  }

  async function queryPaymentsForRange(
    from: string,
    to: string
  ) {
    let query: any = supabase
      .from("payments")
      .select("*")
      .gte("payment_date", from)
      .lte("payment_date", to);

    if (shop !== "All Shops") {
      query = query.eq("shop", shop);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return data || [];
  }

  async function queryTools() {
    let query: any = supabase
      .from("tools")
      .select("*")
      .order("tool_name");

    const search = safeSearch(searchText);

    if (search) {
      query = query.or(
        [
          `tool_name.ilike.%${search}%`,
          `brand.ilike.%${search}%`,
          `category.ilike.%${search}%`,
        ].join(",")
      );
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return data || [];
  }

  async function queryCustomers() {
    let query: any = supabase
      .from("customers")
      .select("*")
      .order("customer_name");

    const search = safeSearch(searchText);

    if (search) {
      query = query.or(
        [
          `customer_name.ilike.%${search}%`,
          `mobile.ilike.%${search}%`,
          `occupation.ilike.%${search}%`,
          `address.ilike.%${search}%`,
        ].join(",")
      );
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return data || [];
  }

  async function loadDayShopBusiness(): Promise<ReportResult> {
    let rentalQuery: any = supabase
      .from("rentals")
      .select("*")
      .lte("start_date", selectedDate);

    let paymentQuery: any = supabase
      .from("payments")
      .select("*")
      .eq("payment_date", selectedDate);

    if (shop !== "All Shops") {
      rentalQuery = rentalQuery.eq("shop", shop);
      paymentQuery = paymentQuery.eq("shop", shop);
    }

    const [
      { data: rentals, error: rentalError },
      { data: payments, error: paymentError },
    ] = await Promise.all([rentalQuery, paymentQuery]);

    if (rentalError) throw new Error(rentalError.message);
    if (paymentError) throw new Error(paymentError.message);

    const selectedShops =
      shop === "All Shops"
        ? shops.filter((item) => item !== "All Shops")
        : [shop];

    const rows: ShopBusinessRow[] = selectedShops.map((shopName: string) => {
      const shopRentals = (rentals || []).filter(
        (row: any) =>
          rowShop(row) === shopName &&
          (row.is_transport_charge
            ? cleanDate(
                row.transport_date || row.start_date
              ) === selectedDate
            : isActiveRentalOnDate(row, selectedDate))
      );
      const shopPayments = (payments || []).filter(
        (row: any) => rowShop(row) === shopName
      );
      const business = shopRentals.reduce(
        (sum: number, row: any) =>
          sum + dailyRentalBusiness(row, selectedDate),
        0
      );
      const collections = shopPayments.reduce(
        (sum: number, row: any) =>
          sum + paymentCollection(row),
        0
      );
      const roundOff = shopPayments.reduce(
        (sum: number, row: any) =>
          sum + paymentRoundOff(row),
        0
      );

      return {
        shop: shopName,
        business,
        collections,
        roundOff,
        balance: business - collections - roundOff,
        active: shopRentals.filter(
          (row: any) => !row.is_transport_charge
        ).length,
      };
    });

    const visibleRows = rows.filter(
      (row) =>
        shop !== "All Shops" ||
        row.business !== 0 ||
        row.collections !== 0 ||
        row.active !== 0
    );

    return {
      title: "Day-wise Shop Business",
      subtitle: `${selectedDate} · ${shop}`,
      headers: [
        "Date",
        "Shop",
        "Business",
        "Collections",
        "Round Off",
        "Balance",
        "Live Rentals",
      ],
      rows: visibleRows.map((row) => [
        selectedDate,
        row.shop,
        rupee(row.business),
        rupee(row.collections),
        rupee(row.roundOff),
        rupee(row.balance),
        row.active,
      ]),
      summary: [
        {
          label: "Business",
          value: rupee(
            visibleRows.reduce(
              (sum, row) => sum + row.business,
              0
            )
          ),
        },
        {
          label: "Collections",
          value: rupee(
            visibleRows.reduce(
              (sum: number, row: ShopBusinessRow) => sum + row.collections,
              0
            )
          ),
          tone: "green",
        },
        {
          label: "Balance",
          value: rupee(
            visibleRows.reduce(
              (sum: number, row: ShopBusinessRow) => sum + row.balance,
              0
            )
          ),
          tone: "red",
        },
      ],
    };
  }

  async function loadCustomerReport(
    unpaidOnly: boolean
  ): Promise<ReportResult> {
    const range = monthRange(month);
    const customers = await queryCustomers();
    const customerIds = customers.map((row: any) => row.id);

    if (customerIds.length === 0) {
      return {
        title: unpaidOnly
          ? "Top 10 Most Unpaid Customers"
          : "Top Customers",
        subtitle: `${month} · ${shop}`,
        headers: unpaidOnly
          ? ["Customer", "Mobile", "Shop", "Outstanding"]
          : [
              "Customer",
              "Mobile",
              "Shop",
              "Business",
              "Collections",
              "Balance",
            ],
        rows: [],
        summary: [],
      };
    }

    let rentalQuery: any = supabase
      .from("rentals")
      .select("*")
      .in("customer_id", customerIds);

    let paymentQuery: any = supabase
      .from("payments")
      .select("*")
      .in("customer_id", customerIds);

    if (shop !== "All Shops" && !unpaidOnly) {
      rentalQuery = rentalQuery.eq("shop", shop);
      paymentQuery = paymentQuery.eq("shop", shop);
    }

    if (!unpaidOnly) {
      rentalQuery = rentalQuery.lte("start_date", range.to);
      paymentQuery = paymentQuery
        .gte("payment_date", range.from)
        .lte("payment_date", range.to);
    }

    const [
      { data: rentalData, error: rentalError },
      { data: paymentData, error: paymentError },
    ] = await Promise.all([rentalQuery, paymentQuery]);

    if (rentalError) throw new Error(rentalError.message);
    if (paymentError) throw new Error(paymentError.message);

    const rentals = unpaidOnly
      ? rentalData || []
      : (rentalData || []).filter((row: any) =>
          rentalOverlapsRange(row, range.from, range.to)
        );
    const payments = paymentData || [];

    const reportCustomers =
      unpaidOnly && shop !== "All Shops"
        ? customers.filter(
            (customer: any) =>
              String(customer.shop || customer.branch || "").trim() ===
              shop
          )
        : customers;

    const rows: CustomerReportRow[] = reportCustomers.map((customer: any) => {
      const customerRentals = rentals.filter(
        (row: any) =>
          String(row.customer_id || "") === String(customer.id)
      );
      const customerPayments = payments.filter(
        (row: any) =>
          String(row.customer_id || "") === String(customer.id)
      );

      const business = customerRentals.reduce(
        (sum: number, row: any) =>
          sum +
          rentalAmountWithinRange(
            row,
            unpaidOnly ? cleanDate(row.start_date) : range.from,
            unpaidOnly ? cleanDate(row.end_date) || todayISO() : range.to
          ),
        0
      );
      const opening = customerPayments.reduce(
        (sum: number, row: any) =>
          sum + openingBalanceAmount(row),
        0
      );
      const collections = customerPayments.reduce(
        (sum: number, row: any) =>
          sum + paymentCollection(row),
        0
      );
      const roundOff = customerPayments.reduce(
        (sum: number, row: any) =>
          sum + paymentRoundOff(row),
        0
      );
      const balance =
        opening + business - collections - roundOff;

      return {
        customer: customer.customer_name || "-",
        mobile: customer.mobile || "-",
        shop: customer.shop || customer.branch || "-",
        business,
        collections,
        balance,
      };
    });

    if (unpaidOnly) {
      const unpaid = rows
        .filter((row: CustomerReportRow) => row.balance > 0)
        .sort((a: CustomerReportRow, b: CustomerReportRow) => b.balance - a.balance)
        .slice(0, 10);

      return {
        title: "Top 10 Most Unpaid Customers",
        subtitle: `Current balance · ${shop}`,
        headers: [
          "Customer",
          "Mobile",
          "Shop",
          "Outstanding",
        ],
        rows: unpaid.map((row: CustomerReportRow) => [
          row.customer,
          row.mobile,
          row.shop,
          rupee(row.balance),
        ]),
        summary: [
          {
            label: "Customers Shown",
            value: unpaid.length,
          },
          {
            label: "Outstanding",
            value: rupee(
              unpaid.reduce(
                (sum, row) => sum + row.balance,
                0
              )
            ),
            tone: "red",
          },
        ],
      };
    }

    const top = rows
      .filter((row: CustomerReportRow) => row.business > 0)
      .sort((a: CustomerReportRow, b: CustomerReportRow) => b.business - a.business)
      .slice(0, 10);

    return {
      title: "Top Customers",
      subtitle: `${month} · ${shop}`,
      headers: [
        "Customer",
        "Mobile",
        "Shop",
        "Business",
        "Collections",
        "Balance",
      ],
      rows: top.map((row: CustomerReportRow) => [
        row.customer,
        row.mobile,
        row.shop,
        rupee(row.business),
        rupee(row.collections),
        rupee(row.balance),
      ]),
      summary: [
        {
          label: "Customers Shown",
          value: top.length,
        },
        {
          label: "Business",
          value: rupee(
            top.reduce((sum: number, row: CustomerReportRow) => sum + row.business, 0)
          ),
        },
        {
          label: "Collections",
          value: rupee(
            top.reduce(
              (sum, row) => sum + row.collections,
              0
            )
          ),
          tone: "green",
        },
      ],
    };
  }

  async function loadToolReport(
    mode:
      | "top"
      | "least_used"
      | "least_profit"
      | "analyzer"
  ): Promise<ReportResult> {
    const range = monthRange(month);
    const [tools, rentals, serviceResult] =
      await Promise.all([
        queryTools(),
        queryRentalsForRange(range.from, range.to),
        supabase.from("services").select("*"),
      ]);

    if (serviceResult.error) {
      throw new Error(serviceResult.error.message);
    }

    const reportTools =
      shop === "All Shops" || mode === "top"
        ? tools
        : tools.filter(
            (tool: any) =>
              String(
                tool.current_location || tool.home_branch || ""
              ).trim() === shop
          );

    const services = (serviceResult.data || []).filter(
      (row: any) =>
        dateInRange(serviceDate(row), range.from, range.to) &&
        (shop === "All Shops" ||
          rowShop(row) === shop ||
          String(row.from_branch || "") === shop)
    );

    const summaries: ToolReportSummary[] = reportTools.map((tool: any) => {
      const toolRentals = rentals.filter(
        (row: any) =>
          !row.is_outside_rent &&
          !row.is_transport_charge &&
          String(row.tool_id || "") === String(tool.id)
      );
      const toolServices = services.filter(
        (row: any) =>
          String(row.tool_id || "") === String(tool.id)
      );
      const revenue = toolRentals.reduce(
        (sum: number, row: any) =>
          sum +
          rentalAmountWithinRange(row, range.from, range.to),
        0
      );
      const serviceCost = toolServices.reduce(
        (sum: number, row: any) =>
          sum + Number(row.cost || row.amount || 0),
        0
      );
      const purchaseCost = Number(tool.purchase_cost || 0);
      const times = toolRentals.length;
      const days = toolRentals.reduce((sum: number, row: any) => {
        const start =
          cleanDate(row.start_date) > range.from
            ? cleanDate(row.start_date)
            : range.from;
        const endDate = cleanDate(row.end_date);
        const end =
          endDate && endDate < range.to ? endDate : range.to;

        return (
          sum +
          countRentalDays(
            start,
            end,
            row.avoid_sundays !== false
          )
        );
      }, 0);
      const profit = revenue - serviceCost - purchaseCost;

      return {
        tool: tool.tool_name || "Unknown Tool",
        qty: Number(tool.total_qty || 1),
        location:
          tool.current_location || tool.home_branch || "-",
        times,
        days,
        revenue,
        serviceCost,
        purchaseCost,
        profit,
        roi:
          purchaseCost + serviceCost > 0
            ? (profit / (purchaseCost + serviceCost)) * 100
            : revenue > 0
            ? 100
            : 0,
      };
    });

    let selected = summaries;
    let title = "Tool Profit Analyzer";
    let subtitle = `${month} · ${shop}`;

    if (mode === "top") {
      selected = summaries
        .filter((row: ToolReportSummary) => row.times > 0)
        .sort((a: ToolReportSummary, b: ToolReportSummary) => b.revenue - a.revenue)
        .slice(0, 10);
      title = "Top Tools";
    } else if (mode === "least_used") {
      selected = summaries
        .sort((a: ToolReportSummary, b: ToolReportSummary) => {
          if (a.times !== b.times) return a.times - b.times;
          return a.revenue - b.revenue;
        })
        .slice(0, 10);
      title = "Least 10 Used Tools";
    } else if (mode === "least_profit") {
      selected = summaries
        .sort((a: ToolReportSummary, b: ToolReportSummary) => a.profit - b.profit)
        .slice(0, 10);
      title = "Least Profit Tools";
    } else {
      selected = summaries
        .sort((a: ToolReportSummary, b: ToolReportSummary) => b.profit - a.profit)
        .slice(0, 100);
      title = "Tool Profit Analyzer";
      subtitle = `${month} · ${shop} · Up to 100 tools`;
    }

    const headers =
      mode === "least_used"
        ? [
            "Tool",
            "Qty",
            "Location",
            "Times Rented",
            "Rental Days",
            "Revenue",
          ]
        : [
            "Tool",
            "Qty",
            "Location",
            "Times Rented",
            "Rental Days",
            "Revenue",
            "Purchase",
            "Service Cost",
            "Profit",
            "ROI %",
          ];

    const rows =
      mode === "least_used"
        ? selected.map((row: ToolReportSummary) => [
            row.tool,
            row.qty,
            row.location,
            row.times,
            row.days,
            rupee(row.revenue),
          ])
        : selected.map((row: ToolReportSummary) => [
            row.tool,
            row.qty,
            row.location,
            row.times,
            row.days,
            rupee(row.revenue),
            rupee(row.purchaseCost),
            rupee(row.serviceCost),
            rupee(row.profit),
            `${Number(row.roi || 0).toFixed(0)}%`,
          ]);

    return {
      title,
      subtitle,
      headers,
      rows,
      summary: [
        {
          label: "Tools Shown",
          value: selected.length,
        },
        {
          label: "Revenue",
          value: rupee(
            selected.reduce(
              (sum: number, row: ToolReportSummary) => sum + row.revenue,
              0
            )
          ),
          tone: "green",
        },
        {
          label: "Profit",
          value: rupee(
            selected.reduce(
              (sum: number, row: ToolReportSummary) => sum + row.profit,
              0
            )
          ),
          tone:
            selected.reduce(
              (sum: number, row: ToolReportSummary) => sum + row.profit,
              0
            ) >= 0
              ? "green"
              : "red",
        },
      ],
    };
  }

  async function loadExpenseReport(): Promise<ReportResult> {
    const range = monthRange(month);
    let query: any = supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", range.from)
      .lte("expense_date", range.to)
      .order("expense_date", { ascending: false });

    if (shop !== "All Shops") {
      query = query.eq("shop", shop);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    const search = normalize(searchText);
    const expenses = (data || []).filter((row: any) => {
      if (!search) return true;

      return normalize(
        `${row.category || ""} ${row.description || ""} ${
          row.payment_mode || ""
        } ${row.remarks || ""}`
      ).includes(search);
    });

    const categoryTotals = new Map<string, number>();

    expenses.forEach((row: any) => {
      const category = row.category || "Other";
      categoryTotals.set(
        category,
        (categoryTotals.get(category) || 0) +
          Number(row.amount || 0)
      );
    });

    return {
      title: "Month-wise Expense Report",
      subtitle: `${month} · ${shop}`,
      headers: [
        "Date",
        "Shop",
        "Category",
        "Description",
        "Amount",
        "Payment Mode",
        "Remarks",
      ],
      rows: expenses.slice(0, 200).map((row: any) => [
        cleanDate(row.expense_date),
        row.shop || "-",
        row.category || "-",
        row.description || "-",
        rupee(row.amount),
        row.payment_mode || "-",
        row.remarks || "-",
      ]),
      summary: [
        {
          label: "Entries",
          value: expenses.length,
        },
        {
          label: "Total Expense",
          value: rupee(
            expenses.reduce(
              (sum: number, row: any) =>
                sum + Number(row.amount || 0),
              0
            )
          ),
          tone: "red",
        },
        {
          label: "Categories",
          value: categoryTotals.size,
        },
      ],
    };
  }

  async function loadShopPerformance(): Promise<ReportResult> {
    const range = monthRange(month);
    const [
      rentals,
      payments,
      { data: expenses, error: expenseError },
      { data: services, error: serviceError },
      { data: tools, error: toolError },
    ] = await Promise.all([
      queryRentalsForRange(range.from, range.to),
      queryPaymentsForRange(range.from, range.to),
      supabase
        .from("expenses")
        .select("*")
        .gte("expense_date", range.from)
        .lte("expense_date", range.to),
      supabase.from("services").select("*"),
      supabase.from("tools").select("*"),
    ]);

    if (expenseError) throw new Error(expenseError.message);
    if (serviceError) throw new Error(serviceError.message);
    if (toolError) throw new Error(toolError.message);

    const search = normalize(searchText);
    const selectedShops = shops
      .filter((item) => item !== "All Shops")
      .filter(
        (item) =>
          (shop === "All Shops" || item === shop) &&
          (!search || normalize(item).includes(search))
      );

    const rows = selectedShops.map((shopName) => {
      const shopRentals = rentals.filter(
        (row: any) => rowShop(row) === shopName
      );
      const shopPayments = payments.filter(
        (row: any) => rowShop(row) === shopName
      );
      const shopExpenses = (expenses || []).filter(
        (row: any) => rowShop(row) === shopName
      );
      const shopServices = (services || []).filter(
        (row: any) =>
          dateInRange(serviceDate(row), range.from, range.to) &&
          (rowShop(row) === shopName ||
            String(row.from_branch || "") === shopName)
      );
      const shopTools = (tools || []).filter(
        (row: any) =>
          String(
            row.current_location || row.home_branch || ""
          ).trim() === shopName
      );
      const business = shopRentals.reduce(
        (sum: number, row: any) =>
          sum +
          rentalAmountWithinRange(row, range.from, range.to),
        0
      );
      const collections = shopPayments.reduce(
        (sum: number, row: any) =>
          sum + paymentCollection(row),
        0
      );
      const roundOff = shopPayments.reduce(
        (sum: number, row: any) =>
          sum + paymentRoundOff(row),
        0
      );
      const expenseTotal = shopExpenses.reduce(
        (sum: number, row: any) =>
          sum + Number(row.amount || 0),
        0
      );
      const serviceCost = shopServices.reduce(
        (sum: number, row: any) =>
          sum + Number(row.cost || row.amount || 0),
        0
      );
      const stockQty = shopTools.reduce(
        (sum: number, row: any) =>
          sum + Math.max(Number(row.total_qty || 1), 1),
        0
      );
      const active = shopRentals.filter((row: any) =>
        isActiveRentalOnDate(row, range.to)
      ).length;
      const net =
        business -
        expenseTotal -
        serviceCost -
        roundOff;

      return {
        shop: shopName,
        business,
        collections,
        roundOff,
        expenseTotal,
        serviceCost,
        net,
        active,
        stockQty,
      };
    });

    return {
      title: "Shop Performance",
      subtitle: `${month}`,
      headers: [
        "Shop",
        "Business",
        "Collections",
        "Round Off",
        "Expenses",
        "Service Cost",
        "Net",
        "Live Rentals",
        "Stock Qty",
      ],
      rows: rows.map((row) => [
        row.shop,
        rupee(row.business),
        rupee(row.collections),
        rupee(row.roundOff),
        rupee(row.expenseTotal),
        rupee(row.serviceCost),
        rupee(row.net),
        row.active,
        row.stockQty,
      ]),
      summary: [
        {
          label: "Business",
          value: rupee(
            rows.reduce((sum, row) => sum + row.business, 0)
          ),
        },
        {
          label: "Collections",
          value: rupee(
            rows.reduce(
              (sum, row) => sum + row.collections,
              0
            )
          ),
          tone: "green",
        },
        {
          label: "Net",
          value: rupee(
            rows.reduce((sum, row) => sum + row.net, 0)
          ),
          tone:
            rows.reduce((sum, row) => sum + row.net, 0) >= 0
              ? "green"
              : "red",
        },
      ],
    };
  }

  async function searchReport() {
    setLoading(true);
    setHasSearched(false);

    try {
      let nextResult: ReportResult;

      switch (reportType) {
        case "day_shop_business":
          nextResult = await loadDayShopBusiness();
          break;
        case "top_customers":
          nextResult = await loadCustomerReport(false);
          break;
        case "unpaid_customers":
          nextResult = await loadCustomerReport(true);
          break;
        case "top_tools":
          nextResult = await loadToolReport("top");
          break;
        case "least_used_tools":
          nextResult = await loadToolReport("least_used");
          break;
        case "least_profit_tools":
          nextResult = await loadToolReport("least_profit");
          break;
        case "tool_profit_analyzer":
          nextResult = await loadToolReport("analyzer");
          break;
        case "expense_report":
          nextResult = await loadExpenseReport();
          break;
        case "shop_performance":
          nextResult = await loadShopPerformance();
          break;
        default:
          nextResult = emptyResult;
      }

      setResult(nextResult);
      setHasSearched(true);
    } catch (error: any) {
      setResult(emptyResult);
      showError(error?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  function clearReport() {
    setResult(emptyResult);
    setHasSearched(false);
    setSearchText("");
  }

  function downloadCsv() {
    if (!hasSearched || result.rows.length === 0) {
      showError("Search and load a report before downloading");
      return;
    }

    const csv = [result.headers, ...result.rows]
      .map((row) => row.map(csvSafe).join(","))
      .join("\n");
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `T&T_${result.title.replaceAll(
      " ",
      "_"
    )}_${reportType === "day_shop_business" ? selectedDate : month}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  const showMonth =
    reportType !== "day_shop_business" &&
    reportType !== "unpaid_customers";

  return (
    <main className="reports-search-page">
      <style>{reportsStyles}</style>

      <h1>Reports</h1>
      <p className="reports-page-subtitle">
        Select one report and search. Other reports remain closed and
        no report data is loaded automatically.
      </p>

      <section className="panel reports-search-panel">
        <div className="reports-search-grid">
          <label>
            Report
            <select
              value={reportType}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                setReportType(event.target.value);
                clearReport();
              }}
            >
              {reportOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {reportType === "day_shop_business" && (
            <label>
              Date
              <input
                type="date"
                value={selectedDate}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setSelectedDate(event.target.value)
                }
              />
            </label>
          )}

          {showMonth && (
            <label>
              Month
              <input
                type="month"
                value={month}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setMonth(event.target.value)
                }
              />
            </label>
          )}

          <label>
            Shop
            <select
              value={shop}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setShop(event.target.value)
              }
            >
              {shops.map((shopName) => (
                <option key={shopName}>{shopName}</option>
              ))}
            </select>
          </label>

          <label className="reports-keyword-field">
            Search
            <input
              value={searchText}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setSearchText(event.target.value)
              }
              placeholder={searchPlaceholder}
              disabled={reportType === "day_shop_business"}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void searchReport();
                }
              }}
            />
          </label>
        </div>

        <div className="reports-search-actions">
          <button
            className="btn-blue"
            type="button"
            onClick={() => void searchReport()}
            disabled={loading}
          >
            <Search size={17} />
            {loading ? "Searching..." : `Search ${selectedReportLabel}`}
          </button>

          <button
            className="btn-gray"
            type="button"
            onClick={clearReport}
          >
            Clear
          </button>

          <button
            className="btn-green"
            type="button"
            onClick={downloadCsv}
            disabled={!hasSearched || result.rows.length === 0}
          >
            <Download size={17} />
            Download Result
          </button>
        </div>
      </section>

      {!hasSearched ? (
        <section className="panel reports-empty-state">
          <strong>{selectedReportLabel}</strong>
          <span>
            Choose the required filters and click Search. Nothing is
            displayed or loaded before that.
          </span>
        </section>
      ) : (
        <>
          <div className="reports-summary-grid">
            {result.summary.map((item: ReportResult["summary"][number]) => (
              <div
                className={`reports-summary-card ${
                  item.tone === "green"
                    ? "reports-summary-green"
                    : item.tone === "red"
                    ? "reports-summary-red"
                    : ""
                }`}
                key={item.label}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <section className="panel reports-result-card">
            <div className="reports-result-header">
              <div>
                <h2>{result.title}</h2>
                <p>{result.subtitle}</p>
              </div>

              <strong>{result.rows.length} row(s)</strong>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {result.headers.map((header: string) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {result.rows.map((row: any[], rowIndex: number) => (
                    <tr key={rowIndex}>
                      {row.map((cell: any, cellIndex: number) => (
                        <td
                          key={cellIndex}
                          className={
                            String(cell).includes("₹")
                              ? "strong"
                              : ""
                          }
                        >
                          {cell === "" || cell === null
                            ? "-"
                            : cell}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {result.rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={Math.max(
                          result.headers.length,
                          1
                        )}
                        className="reports-no-data"
                      >
                        No matching data found for this search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

const reportsStyles = `
  .reports-search-page h1 {
    margin-bottom: 4px;
  }

  .reports-page-subtitle {
    margin: 0 0 18px;
    color: #64748b;
    font-size: 16px;
    font-weight: 800;
  }

  .reports-search-panel {
    border: 1px solid #bdd0e8;
    background: linear-gradient(145deg, #f8fbff, #eef5ff);
  }

  .reports-search-grid {
    display: grid;
    grid-template-columns:
      minmax(220px, 1.2fr)
      minmax(150px, 0.7fr)
      minmax(170px, 0.8fr)
      minmax(260px, 1.4fr);
    gap: 12px;
  }

  .reports-search-grid label {
    display: grid;
    gap: 6px;
    color: #405372;
    font-size: 13px;
    font-weight: 950;
    text-transform: uppercase;
  }

  .reports-search-grid input,
  .reports-search-grid select {
    width: 100%;
    min-height: 45px;
    padding: 9px 11px;
    font-size: 16px;
    font-weight: 850;
    text-transform: none;
  }

  .reports-keyword-field {
    min-width: 0;
  }

  .reports-search-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 15px;
  }

  .reports-search-actions button {
    display: inline-flex;
    min-height: 43px;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 9px 15px;
    font-size: 15px;
    font-weight: 900;
  }

  .reports-empty-state {
    display: grid;
    gap: 7px;
    padding: 34px 20px;
    border: 1px dashed #9bb3d1;
    background: #f8fbff;
    text-align: center;
  }

  .reports-empty-state strong {
    color: #143f82;
    font-size: 22px;
    font-weight: 1000;
  }

  .reports-empty-state span {
    color: #60718a;
    font-size: 16px;
    font-weight: 800;
  }

  .reports-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 11px;
    margin-bottom: 15px;
  }

  .reports-summary-card {
    padding: 14px 15px;
    border: 1px solid #bfd1e8;
    border-radius: 14px;
    background: #eff6ff;
  }

  .reports-summary-card span {
    display: block;
    color: #60718a;
    font-size: 12px;
    font-weight: 950;
    text-transform: uppercase;
  }

  .reports-summary-card strong {
    display: block;
    margin-top: 4px;
    color: #143f82;
    font-size: 25px;
    font-weight: 1000;
  }

  .reports-summary-green {
    border-color: #9cd9b5;
    background: #ecfdf3;
  }

  .reports-summary-green strong {
    color: #0b8848;
  }

  .reports-summary-red {
    border-color: #f3a0a0;
    background: #fff1f1;
  }

  .reports-summary-red strong {
    color: #c62828;
  }

  .reports-result-card {
    overflow: hidden;
  }

  .reports-result-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  .reports-result-header h2 {
    margin: 0;
    color: #143f82;
  }

  .reports-result-header p {
    margin: 4px 0 0;
    color: #64748b;
    font-weight: 800;
  }

  .reports-result-card table {
    width: 100%;
    border-collapse: collapse;
    font-size: 15px;
  }

  .reports-result-card th {
    padding: 11px 9px;
    background: #143f82;
    color: #ffffff;
    font-weight: 950;
    text-align: left;
    white-space: nowrap;
  }

  .reports-result-card td {
    padding: 11px 9px;
    border-bottom: 1px solid #dfe8f2;
    font-weight: 800;
    vertical-align: top;
  }

  .reports-result-card tbody tr:nth-child(even) td {
    background: #f8fbff;
  }

  .reports-result-card td.strong {
    font-weight: 950;
  }

  .reports-no-data {
    padding: 30px !important;
    color: #64748b;
    text-align: center;
    font-size: 17px;
    font-weight: 900 !important;
  }

  @media (max-width: 1100px) {
    .reports-search-grid {
      grid-template-columns: repeat(2, minmax(180px, 1fr));
    }
  }

  @media (max-width: 650px) {
    .reports-search-grid {
      grid-template-columns: 1fr;
    }

    .reports-search-actions button {
      flex: 1 1 160px;
    }
  }
`;
