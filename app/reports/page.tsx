"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  calcRentalAmount,
  calcSystemTotals,
  countDays,
  rowMobile,
  rowShop,
  rowToolName,
} from "../calculations";

const shops = [
  "All Shops",
  "Karuvannur",
  "Ollur",
  "Kachery",
  "Mulayam Rd",
  "Pattikkad",
];

const thisMonth = () => new Date().toISOString().slice(0, 7);

function sameMonth(date: any, month: string) {
  return String(date || "").slice(0, 7) === month;
}

function rowCustomer(row: any) {
  return row.customer_name || row.name || row.customer || "-";
}

export default function ReportsPage() {
  const [month, setMonth] = useState(thisMonth());
  const [shopFilter, setShopFilter] = useState("All Shops");

  const [rentals, setRentals] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [
      { data: rentalData },
      { data: paymentData },
      { data: serviceData },
      { data: toolData },
    ] = await Promise.all([
      supabase.from("rentals").select("*"),
      supabase.from("payments").select("*"),
      supabase.from("services").select("*"),
      supabase.from("tools").select("*"),
    ]);

    setRentals(rentalData || []);
    setPayments(paymentData || []);
    setServices(serviceData || []);
    setTools(toolData || []);
    setMessage("Reports refreshed");
    setTimeout(() => setMessage(""), 2000);
  }

  const filteredRentals = useMemo(() => {
    return rentals.filter((r) => {
      const dateOk = sameMonth(r.date || r.start_date || r.rental_date, month);
      const shopOk = shopFilter === "All Shops" || rowShop(r) === shopFilter;
      return dateOk && shopOk;
    });
  }, [rentals, month, shopFilter]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const dateOk = sameMonth(p.payment_date, month);
      const shopOk = shopFilter === "All Shops" || rowShop(p) === shopFilter;
      return dateOk && shopOk;
    });
  }, [payments, month, shopFilter]);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const dateOk = sameMonth(s.service_date || s.date || s.return_date, month);
      const shopOk = shopFilter === "All Shops" || rowShop(s) === shopFilter;
      return dateOk && shopOk;
    });
  }, [services, month, shopFilter]);

  const systemTotals = calcSystemTotals(filteredRentals, filteredPayments);

  const totalBusiness = systemTotals.business;
  const collections = systemTotals.received;
  const discountTotal = systemTotals.discount;
  const balance = systemTotals.balance;

  const activeRentals = filteredRentals.filter(
    (r) =>
      String(r.status || "").toLowerCase().includes("active") ||
      String(r.status || "").toLowerCase().includes("live") ||
      !r.end_date
  ).length;

  const returnedRentals = filteredRentals.length - activeRentals;

  const shopWiseSummary = useMemo(() => {
    const map: any = {};

    shops
      .filter((s) => s !== "All Shops")
      .forEach((shop) => {
        map[shop] = {
          shop,
          business: 0,
          collections: 0,
          discount: 0,
          balance: 0,
          active: 0,
          returned: 0,
        };
      });

    shops
      .filter((s) => s !== "All Shops")
      .forEach((shop) => {
        const shopRentals = filteredRentals.filter((r) => rowShop(r) === shop);
        const shopPayments = filteredPayments.filter((p) => rowShop(p) === shop);
        const totals = calcSystemTotals(shopRentals, shopPayments);

        map[shop].business = totals.business;
        map[shop].collections = totals.received;
        map[shop].discount = totals.discount;
        map[shop].balance = totals.balance;
        map[shop].active = shopRentals.filter(
          (r) =>
            String(r.status || "").toLowerCase().includes("active") ||
            String(r.status || "").toLowerCase().includes("live") ||
            !r.end_date
        ).length;
        map[shop].returned = shopRentals.length - map[shop].active;
      });

    return Object.values(map);
  }, [filteredRentals, filteredPayments]);

  const dayWiseBusiness = useMemo(() => {
    const map: any = {};

    filteredRentals.forEach((r) => {
      const date = String(r.date || r.start_date || r.rental_date || "").slice(0, 10);
      if (!date) return;
      if (!map[date]) map[date] = { date, rentals: [], payments: [] };
      map[date].rentals.push(r);
    });

    filteredPayments.forEach((p) => {
      const date = String(p.payment_date || "").slice(0, 10);
      if (!date) return;
      if (!map[date]) map[date] = { date, rentals: [], payments: [] };
      map[date].payments.push(p);
    });

    return Object.values(map)
      .map((r: any) => {
        const totals = calcSystemTotals(r.rentals, r.payments);
        return {
          date: r.date,
          business: totals.business,
          collections: totals.received,
          discount: totals.discount,
          balance: totals.balance,
        };
      })
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [filteredRentals, filteredPayments]);

  const dayWiseShopBusiness = useMemo(() => {
    const map: any = {};

    filteredRentals.forEach((r) => {
      const date = String(r.date || r.start_date || r.rental_date || "").slice(0, 10);
      const shop = rowShop(r);
      const key = `${date}-${shop}`;
      if (!date || !shop) return;

      if (!map[key]) map[key] = { date, shop, rentals: [], payments: [] };
      map[key].rentals.push(r);
    });

    filteredPayments.forEach((p) => {
      const date = String(p.payment_date || "").slice(0, 10);
      const shop = rowShop(p);
      const key = `${date}-${shop}`;
      if (!date || !shop) return;

      if (!map[key]) map[key] = { date, shop, rentals: [], payments: [] };
      map[key].payments.push(p);
    });

    return Object.values(map)
      .map((r: any) => {
        const totals = calcSystemTotals(r.rentals, r.payments);
        return {
          date: r.date,
          shop: r.shop,
          business: totals.business,
          collections: totals.received,
          discount: totals.discount,
          balance: totals.balance,
        };
      })
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [filteredRentals, filteredPayments]);

  const customerSummary = useMemo(() => {
    const map: any = {};

    filteredRentals.forEach((r) => {
      const mobile = rowMobile(r);
      const key = mobile || rowCustomer(r);
      if (!key) return;

      if (!map[key]) {
        map[key] = {
          customer: rowCustomer(r),
          mobile,
          shop: rowShop(r),
          rentals: [],
          payments: [],
        };
      }

      map[key].rentals.push(r);
    });

    filteredPayments.forEach((p) => {
      const mobile = rowMobile(p);
      const key = mobile || rowCustomer(p);
      if (!key) return;

      if (!map[key]) {
        map[key] = {
          customer: rowCustomer(p),
          mobile,
          shop: rowShop(p),
          rentals: [],
          payments: [],
        };
      }

      map[key].payments.push(p);
    });

    return Object.values(map).map((r: any) => {
      const totals = calcSystemTotals(r.rentals, r.payments);

      return {
        customer: r.customer,
        mobile: r.mobile,
        shop: r.shop,
        business: totals.business,
        collections: totals.received,
        discount: totals.discount,
        balance: totals.balance,
      };
    });
  }, [filteredRentals, filteredPayments]);

  const topCustomers = [...customerSummary]
    .sort((a: any, b: any) => b.business - a.business)
    .slice(0, 10);

  const unpaidCustomers = [...customerSummary]
    .filter((c: any) => c.balance > 0)
    .sort((a: any, b: any) => b.balance - a.balance)
    .slice(0, 10);

  const toolSummary = useMemo(() => {
    const map: any = {};

    filteredRentals.forEach((r) => {
      const tool = rowToolName(r) || "-";

      if (!map[tool]) {
        map[tool] = {
          tool,
          times: 0,
          days: 0,
          revenue: 0,
          serviceCost: 0,
          profit: 0,
        };
      }

      map[tool].times += 1;
      map[tool].days += countDays(
        r.start_date || r.date || r.rental_date,
        r.end_date || r.return_date,
        r.avoid_sundays !== false
      );
      map[tool].revenue += calcRentalAmount(r);
    });

    filteredServices.forEach((s) => {
      const tool = rowToolName(s) || "-";

      if (!map[tool]) {
        map[tool] = {
          tool,
          times: 0,
          days: 0,
          revenue: 0,
          serviceCost: 0,
          profit: 0,
        };
      }

      map[tool].serviceCost += Number(s.cost || s.amount || 0);
    });

    return Object.values(map).map((r: any) => ({
      ...r,
      profit: r.revenue - r.serviceCost,
      roi:
        r.serviceCost > 0
          ? ((r.revenue - r.serviceCost) / r.serviceCost) * 100
          : 100,
    }));
  }, [filteredRentals, filteredServices, tools]);

  const topTools = [...toolSummary]
    .sort((a: any, b: any) => b.revenue - a.revenue)
    .slice(0, 10);

  const leastUsedTools = [...toolSummary]
    .sort((a: any, b: any) => a.times - b.times)
    .slice(0, 10);

  const problemTools = [...toolSummary]
    .sort((a: any, b: any) => a.profit - b.profit)
    .slice(0, 10);

  const toolProfitAnalyzer = [...toolSummary].sort(
    (a: any, b: any) => b.profit - a.profit
  );

  const monthExpenseReport = useMemo(() => {
    const serviceCost = filteredServices.reduce(
      (sum, s) => sum + Number(s.cost || s.amount || 0),
      0
    );

    return [
      {
        month,
        serviceCost,
        maintenance: serviceCost,
        otherExpense: 0,
        totalExpense: serviceCost,
      },
    ];
  }, [filteredServices, month]);

  const shopPerformance = shopWiseSummary.map((s: any) => ({
    ...s,
    profit: s.business,
    utilization:
      tools.length > 0
        ? Math.round((s.active / Math.max(tools.length, 1)) * 100)
        : 0,
  }));

  function downloadCsv() {
    const header = [
      "Date",
      "Customer",
      "Mobile",
      "Shop",
      "Tool",
      "Qty",
      "Amount",
      "Status",
    ];

    const rows = filteredRentals.map((r) => [
      r.date || r.start_date || r.rental_date,
      rowCustomer(r),
      rowMobile(r),
      rowShop(r),
      rowToolName(r),
      r.qty || r.quantity || 1,
      calcRentalAmount(r),
      r.status,
    ]);

    const csv = [header, ...rows]
      .map((r) =>
        r.map((c) => `"${String(c || "").replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "T&T_Reports.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <h1 className="page-title">Reports</h1>
      <p className="page-subtitle">
        Monthly business, shop, customer and tool performance reports
      </p>

      {message && <div className="modern-message">{message}</div>}

      <div className="kpi-grid">
        <Kpi title="Total Business" value={`₹${totalBusiness.toFixed(0)}`} />
        <Kpi title="Collections" value={`₹${collections.toFixed(0)}`} />
        <Kpi title="Discount" value={`₹${discountTotal.toFixed(0)}`} />
        <Kpi title="Balance" value={`₹${balance.toFixed(0)}`} />
        <Kpi title="Active Rentals" value={activeRentals} />
        <Kpi title="Returned Rentals" value={returnedRentals} />
      </div>

      <section className="modern-card">
        <SectionHeader
          title="Search & Results"
          subtitle="Filter reports by month and shop"
          right={
            <div className="action-row">
              <button className="btn-gray" onClick={loadData}>
                <RefreshCw size={16} /> Refresh
              </button>
              <button className="btn-blue" onClick={downloadCsv}>
                <Download size={16} /> Export
              </button>
            </div>
          }
        />

        <div className="filter-row sales-filter">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />

          <select
            value={shopFilter}
            onChange={(e) => setShopFilter(e.target.value)}
          >
            {shops.map((shop) => (
              <option key={shop}>{shop}</option>
            ))}
          </select>
        </div>
      </section>

      <ReportTable
        title="Shop-wise Summary"
        subtitle="Shop performance summary"
        headers={[
          "Shop",
          "Business",
          "Collections",
          "Discount",
          "Balance",
          "Active Rentals",
          "Returned Rentals",
        ]}
        rows={shopWiseSummary.map((r: any) => [
          r.shop,
          rupee(r.business),
          rupee(r.collections),
          rupee(r.discount),
          rupee(r.balance),
          r.active,
          r.returned,
        ])}
      />

      <ReportTable
        title="Day-wise Business"
        subtitle="Daily business and collection report"
        headers={["Date", "Business", "Collections", "Discount", "Balance"]}
        rows={dayWiseBusiness.map((r: any) => [
          r.date,
          rupee(r.business),
          rupee(r.collections),
          rupee(r.discount),
          rupee(r.balance),
        ])}
      />

      <ReportTable
        title="Day-wise Shop Business"
        subtitle="Daily shop-wise business report"
        headers={["Date", "Shop", "Business", "Collections", "Discount", "Balance"]}
        rows={dayWiseShopBusiness.map((r: any) => [
          r.date,
          r.shop,
          rupee(r.business),
          rupee(r.collections),
          rupee(r.discount),
          rupee(r.balance),
        ])}
      />

      <ReportTable
        title="Top Customers"
        subtitle="Customers who gave highest business"
        headers={[
          "Customer",
          "Mobile",
          "Shop",
          "Business",
          "Collections",
          "Discount",
          "Balance",
        ]}
        rows={topCustomers.map((r: any) => [
          r.customer,
          r.mobile,
          r.shop,
          rupee(r.business),
          rupee(r.collections),
          rupee(r.discount),
          rupee(r.balance),
        ])}
      />

      <ReportTable
        title="Top 10 Most Unpaid Customers"
        subtitle="Customers with highest pending balance"
        headers={["Customer", "Mobile", "Shop", "Outstanding"]}
        rows={unpaidCustomers.map((r: any) => [
          r.customer,
          r.mobile,
          r.shop,
          rupee(r.balance),
        ])}
      />

      <ReportTable
        title="Top Tools"
        subtitle="Most profitable and most used tools"
        headers={["Tool", "Times Rented", "Rental Days", "Revenue"]}
        rows={topTools.map((r: any) => [
          r.tool,
          r.times,
          r.days,
          rupee(r.revenue),
        ])}
      />

      <ReportTable
        title="Least 10 Used Tools"
        subtitle="Tools with lowest rental usage"
        headers={["Tool", "Times Rented", "Revenue"]}
        rows={leastUsedTools.map((r: any) => [
          r.tool,
          r.times,
          rupee(r.revenue),
        ])}
      />

      <ReportTable
        title="Problem Tools / Least Profit Tools"
        subtitle="Tools costing more compared to income"
        headers={["Tool", "Service Cost", "Rental Income", "Net Profit"]}
        rows={problemTools.map((r: any) => [
          r.tool,
          rupee(r.serviceCost),
          rupee(r.revenue),
          rupee(r.profit),
        ])}
      />

      <ReportTable
        title="Tool Profit Analyzer"
        subtitle="Full tool income, cost and profit analysis"
        headers={["Tool", "Rental Income", "Service Cost", "Net Profit", "ROI %"]}
        rows={toolProfitAnalyzer.map((r: any) => [
          r.tool,
          rupee(r.revenue),
          rupee(r.serviceCost),
          rupee(r.profit),
          `${Number(r.roi || 0).toFixed(0)}%`,
        ])}
      />

      <ReportTable
        title="Month-wise Expense Report"
        subtitle="Monthly expense summary"
        headers={[
          "Month",
          "Service Cost",
          "Maintenance",
          "Other Expenses",
          "Total Expense",
        ]}
        rows={monthExpenseReport.map((r: any) => [
          r.month,
          rupee(r.serviceCost),
          rupee(r.maintenance),
          rupee(r.otherExpense),
          rupee(r.totalExpense),
        ])}
      />

      <ReportTable
        title="Shop Performance"
        subtitle="Overall shop comparison"
        headers={[
          "Shop",
          "Business",
          "Profit",
          "Collections",
          "Active Rentals",
          "Utilization %",
        ]}
        rows={shopPerformance.map((r: any) => [
          r.shop,
          rupee(r.business),
          rupee(r.profit),
          rupee(r.collections),
          r.active,
          `${r.utilization}%`,
        ])}
      />
    </main>
  );
}

function rupee(value: any) {
  return `₹${Number(value || 0).toFixed(0)}`;
}

function Kpi({ title, value }: any) {
  return (
    <div className="kpi-card">
      <div style={{ flex: 1 }}>
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{title}</div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, right }: any) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>

      {right}
    </div>
  );
}

function ReportTable({ title, subtitle, headers, rows }: any) {
  return (
    <section className="modern-card">
      <SectionHeader title={title} subtitle={subtitle} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {headers.map((h: string) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row: any[], index: number) => (
              <tr key={index}>
                {row.map((cell: any, i: number) => (
                  <td
                    key={i}
                    className={String(cell).includes("₹") ? "strong" : ""}
                  >
                    {cell || "-"}
                  </td>
                ))}
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={headers.length}>No data found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}