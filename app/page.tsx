"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Wrench,
  CalendarDays,
  Wallet,
  BarChart3,
  AlertTriangle,
  BadgeIndianRupee,
  BriefcaseBusiness,
  Settings,
  Store,
  Printer,
  Repeat2,
  Users,
  HandCoins,
  DatabaseBackup,
} from "lucide-react";
import { getDashboardStats } from "./actions";


export default function Dashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const dayBeforeYesterday = new Date(Date.now() - 2 * 86400000)
    .toISOString()
    .slice(0, 10);
  const currentMonth = today.slice(0, 7);

  const [businessDate, setBusinessDate] = useState(today);
  const [collectionDate, setCollectionDate] = useState(today);
  const [balanceMonth, setBalanceMonth] = useState(currentMonth);
  const [serviceMonth, setServiceMonth] = useState(currentMonth);
  const [shopSummaryDate, setShopSummaryDate] = useState(today);
  const [shopSummaryMonth, setShopSummaryMonth] = useState(currentMonth);
  const [s, setStats] = useState<any>({
    totalTools: 0,
    activeRentals: 0,
    toolsInService: 0,
    missingTools: 0,
    pendingBalance: 0,
    todayBusiness: 0,
    todayCollections: 0,
    serviceCost: 0,
    shopStats: [],
    maintenanceAlerts: [],
    criticalRedFlags: [],
    nearRedFlags: [],
  });

  useEffect(() => {
    let cancelled = false;

    getDashboardStats({
      businessDate,
      collectionDate,
      balanceMonth,
      serviceMonth,
      shopSummaryDate,
      shopSummaryMonth,
    }).then((data: any) => {
      if (!cancelled) setStats(data || {});
    });

    return () => {
      cancelled = true;
    };
  }, [
    businessDate,
    collectionDate,
    balanceMonth,
    serviceMonth,
    shopSummaryDate,
    shopSummaryMonth,
  ]);

  const maintenanceAlerts = s.maintenanceAlerts || [];
  const rentalOverdueAlerts = s.rentalOverdueAlerts || [];
  const criticalRedFlags = s.criticalRedFlags || [];
  const nearRedFlags = s.nearRedFlags || [];

  const redFlagColumns = [
    {
      key: "OVERDUE",
      title: "Overdue Rentals",
      match: (row: any) => row.type === "Rental over 10 days",
    },
    {
      key: "HIGH DUE",
      title: "High Pending Balance",
      match: (row: any) => row.type === "High pending balance",
    },
    {
      key: "OLD DUE",
      title: "Long-Pending Customers",
      match: (row: any) => String(row.type || "").startsWith("Long pending"),
    },
    {
      key: "MISSING",
      title: "Missing Tools",
      match: (row: any) => row.type === "Tool missing",
    },
    {
      key: "SERVICE",
      title: "Service Delays",
      match: (row: any) => row.type === "Service delayed",
    },
    {
      key: "STILL LIVE",
      title: "Returned But Still Live",
      match: (row: any) => row.type === "Returned but still live",
    },
    {
      key: "DUPLICATE",
      title: "Same Tool Rented Twice",
      match: (row: any) => row.type === "Duplicate individual rental",
    },
    {
      key: "DUE + RENT",
      title: "Large Due With Active Rental",
      match: (row: any) => row.type === "Large due before new rental",
    },
    {
      key: "ROUND OFF",
      title: "Repeated / High Round-Off",
      match: (row: any) => row.type === "Round-off warning",
    },
  ].map((column) => {
    const actualRows = criticalRedFlags.filter(column.match);
    const nearestRows = nearRedFlags.filter(column.match);

    return {
      ...column,
      actualRows,
      nearestRows,
      rows:
        actualRows.length > 0
          ? actualRows
          : nearestRows.slice(0, 1),
      hasActual: actualRows.length > 0,
      isNearOnly:
        actualRows.length === 0 && nearestRows.length > 0,
    };
  });

  const shopSummaryRows = s.shopStats || [];

  const shopSummaryTotals = useMemo(
    () =>
      shopSummaryRows.reduce(
        (totals: any, row: any) => ({
          todayBusiness:
            totals.todayBusiness + Number(row.selectedDateBusiness || row.todayBusiness || 0),
          monthBusiness:
            totals.monthBusiness + Number(row.monthBusiness || 0),
          collections:
            totals.collections + Number(row.collections || 0),
          roundOff:
            totals.roundOff + Number(row.roundOff || 0),
          pendingBalance:
            totals.pendingBalance + Number(row.pendingBalance || row.monthBalance || 0),
          activeRentals:
            totals.activeRentals + Number(row.activeRentals || 0),
        }),
        {
          todayBusiness: 0,
          monthBusiness: 0,
          collections: 0,
          roundOff: 0,
          pendingBalance: 0,
          activeRentals: 0,
        },
      ),
    [shopSummaryRows],
  );

  const cards = [
    {
      title: "Total Stock Qty",
      value: s.totalTools,
      icon: BriefcaseBusiness,
      gradient: "linear-gradient(160deg, #5b7cff 0%, #2946b8 48%, #16306f 100%)",
      glow: "rgba(91, 124, 255, 0.40)",
      dot: "#bfdbfe",
      accent: "STOCK",
    },
    {
      title: "Active Rentals",
      value: s.activeRentals,
      icon: CalendarDays,
      gradient: "linear-gradient(160deg, #20d48a 0%, #0f9f63 50%, #06613f 100%)",
      glow: "rgba(32, 212, 138, 0.38)",
      dot: "#bbf7d0",
      accent: "LIVE",
    },
    {
      title: "Tools In Service",
      value: s.toolsInService,
      icon: Wrench,
      gradient: "linear-gradient(160deg, #a879e6 0%, #7c4bc0 48%, #4b237c 100%)",
      glow: "rgba(168, 121, 230, 0.40)",
      dot: "#ddd6fe",
      accent: "SERVICE",
    },
    {
      title: "Missing Tools",
      value: s.missingTools,
      icon: AlertTriangle,
      gradient: "linear-gradient(160deg, #ff6b6b 0%, #df3f43 50%, #941b1f 100%)",
      glow: "rgba(255, 107, 107, 0.42)",
      dot: "#fecaca",
      accent: "CHECK",
    },
    {
      title: "Pending Balance of the month",
      value: `${s.pendingBalance}`,
      control: (
        <input
          type="month"
          value={balanceMonth}
          onChange={(e) => setBalanceMonth(e.target.value)}
          style={cardControlStyle}
          aria-label="Select balance month"
        />
      ),
      icon: BadgeIndianRupee,
      gradient: "linear-gradient(160deg, #38bdf8 0%, #0984c7 50%, #075985 100%)",
      glow: "rgba(56, 189, 248, 0.38)",
      dot: "#bae6fd",
      accent: "BALANCE",
    },
    {
      title: "Today's Business",
      value: `${s.todayBusiness}`,
      control: (
        <select
          value={businessDate}
          onChange={(e) => setBusinessDate(e.target.value)}
          style={cardControlStyle}
          aria-label="Select business day"
        >
          <option value={today}>Today</option>
          <option value={yesterday}>Yesterday</option>
          <option value={dayBeforeYesterday}>DBY</option>
        </select>
      ),
      icon: BarChart3,
      gradient: "linear-gradient(160deg, #24c6b8 0%, #0f887f 48%, #07504c 100%)",
      glow: "rgba(36, 198, 184, 0.36)",
      dot: "#99f6e4",
      accent: "TODAY",
    },
    {
      title: "Today's Collections",
      value: `${s.todayCollections}`,
      control: (
        <select
          value={collectionDate}
          onChange={(e) => setCollectionDate(e.target.value)}
          style={cardControlStyle}
          aria-label="Select collection day"
        >
          <option value={today}>Today</option>
          <option value={yesterday}>Yesterday</option>
          <option value={dayBeforeYesterday}>DBY</option>
        </select>
      ),
      icon: Wallet,
      gradient: "linear-gradient(160deg, #facc15 0%, #d89d11 48%, #92400e 100%)",
      glow: "rgba(250, 204, 21, 0.38)",
      dot: "#fef3c7",
      accent: "CASH",
    },
    {
      title: "Service Cost of the month",
      value: `${s.serviceCost}`,
      control: (
        <input
          type="month"
          value={serviceMonth}
          onChange={(e) => setServiceMonth(e.target.value)}
          style={cardControlStyle}
          aria-label="Select service month"
        />
      ),
      icon: Settings,
      gradient: "linear-gradient(160deg, #fb7185 0%, #e84867 48%, #9f1239 100%)",
      glow: "rgba(251, 113, 133, 0.40)",
      dot: "#ffe4e6",
      accent: "COST",
    },
  ];

  return (
    <main style={{ paddingBottom: 20 }}>
      <style>{`
        @keyframes criticalFlash {
          0%, 100% {
            box-shadow:
              0 0 10px rgba(255, 0, 43, 0.55),
              0 0 24px rgba(255, 0, 43, 0.35),
              inset 0 0 18px rgba(255,255,255,0.08);
            border-color: #ff1744;
            filter: brightness(1);
          }
          50% {
            box-shadow:
              0 0 18px rgba(255, 0, 43, 0.95),
              0 0 42px rgba(255, 0, 43, 0.75),
              0 0 78px rgba(255, 0, 43, 0.45),
              inset 0 0 22px rgba(255,255,255,0.18);
            border-color: #ffea00;
            filter: brightness(1.22);
          }
        }

        @keyframes redFlagShimmer {
          0% {
            transform: translateX(-140%);
          }
          100% {
            transform: translateX(180%);
          }
        }

        @keyframes redFlagTextPulse {
          0%, 100% {
            text-shadow:
              0 0 4px rgba(255,255,255,0.85),
              0 0 10px rgba(255, 23, 68, 0.85);
          }
          50% {
            text-shadow:
              0 0 8px rgba(255,255,255,1),
              0 0 18px rgba(255, 23, 68, 1),
              0 0 30px rgba(255, 234, 0, 0.75);
          }
        }

        @keyframes alertDotPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.35);
            opacity: 0.58;
          }
        }

        .critical-flash-card {
          animation: criticalFlash 1.25s ease-in-out infinite;
        }

        .critical-alert-dot {
          animation: alertDotPulse 1s ease-in-out infinite;
        }

        .red-flag-column-grid {
          display: grid;
          grid-template-columns: repeat(9, minmax(105px, 1fr));
          gap: 8px;
          align-items: start;
        }

        .red-flag-column {
          position: relative;
          border: 2px solid #ff1744;
          border-radius: 18px;
          background:
            radial-gradient(circle at 50% 10%, rgba(255, 234, 0, 0.18), rgba(255, 234, 0, 0) 34%),
            linear-gradient(180deg, #ff1744 0%, #d50000 52%, #7f0000 100%);
          box-shadow:
            0 0 12px rgba(255, 23, 68, 0.52),
            0 14px 28px rgba(127, 0, 0, 0.26);
          overflow: hidden;
          transition: transform 0.22s ease, box-shadow 0.22s ease;
        }

        .red-flag-column::before {
          content: "";
          position: absolute;
          top: -15%;
          bottom: -15%;
          width: 42%;
          left: -55%;
          transform: skewX(-18deg);
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0),
            rgba(255,255,255,0.72),
            rgba(255,255,255,0)
          );
          pointer-events: none;
        }

        .red-flag-column-active::before {
          animation: redFlagShimmer 1.8s linear infinite;
        }

        .red-flag-column-active {
          animation: criticalFlash 1.25s ease-in-out infinite;
        }

        .red-flag-column[open] {
          grid-column: 1 / -1;
          animation: none;
          background:
            radial-gradient(circle at 100% 0%, rgba(255, 234, 0, 0.22), rgba(255, 234, 0, 0) 34%),
            linear-gradient(180deg, #fff5f7 0%, #ffffff 100%);
          box-shadow:
            0 0 22px rgba(255, 23, 68, 0.62),
            0 24px 52px rgba(127, 0, 0, 0.28);
        }

        .red-flag-column summary {
          min-height: 150px;
          padding: 16px 8px 12px;
          cursor: pointer;
          list-style: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          text-align: center;
          user-select: none;
        }

        .red-flag-column summary::-webkit-details-marker {
          display: none;
        }

        .red-flag-word {
          position: relative;
          z-index: 1;
          font-family: "Arial Narrow", "Roboto Condensed", "Segoe UI", sans-serif;
          font-size: clamp(24px, 2vw, 36px);
          line-height: 0.92;
          font-weight: 1000;
          letter-spacing: -1px;
          color: #ffffff;
          word-break: normal;
          animation: redFlagTextPulse 1.15s ease-in-out infinite;
        }

        .red-flag-count {
          position: relative;
          z-index: 1;
          min-width: 46px;
          height: 46px;
          padding: 0 10px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffea00;
          color: #7f0000;
          border: 2px solid rgba(255,255,255,0.9);
          box-shadow:
            0 0 10px rgba(255,234,0,0.85),
            0 0 20px rgba(255,234,0,0.55);
          font-size: 24px;
          font-weight: 1000;
        }

        .red-flag-column:not(.red-flag-column-active) {
          background:
            linear-gradient(180deg, #64748b 0%, #334155 100%);
          border-color: #94a3b8;
          box-shadow: 0 10px 24px rgba(51, 65, 85, 0.18);
        }

        .red-flag-column:not(.red-flag-column-active) .red-flag-word {
          color: #f8fafc;
          animation: none;
          text-shadow: none;
        }

        .red-flag-column:not(.red-flag-column-active) .red-flag-count {
          background: #e2e8f0;
          color: #334155;
          box-shadow: none;
          border-color: #ffffff;
        }


        .red-flag-column-near {
          background:
            radial-gradient(circle at 50% 8%, rgba(255,255,255,0.82), rgba(255,255,255,0) 38%),
            linear-gradient(180deg, #fffdf3 0%, #fff7dc 52%, #f6e7bd 100%) !important;
          border-color: #ead7a3 !important;
          box-shadow:
            0 10px 24px rgba(156, 120, 40, 0.12),
            inset 0 1px 0 rgba(255,255,255,0.9) !important;
        }

        .red-flag-column-near .red-flag-word {
          color: #7c5a1f !important;
          animation: none !important;
          text-shadow: 0 1px 0 rgba(255,255,255,0.95) !important;
        }

        .red-flag-column-near .red-flag-count {
          background: linear-gradient(180deg, #ffffff 0%, #fff3c7 100%) !important;
          color: #7c5a1f !important;
          border-color: #ead7a3 !important;
          box-shadow: 0 5px 12px rgba(156,120,40,0.14) !important;
        }

        .red-flag-column-old-due .red-flag-word {
          color: #ffe500 !important;
          text-shadow:
            0 2px 0 #7f0000,
            0 0 6px rgba(127, 0, 0, 0.95),
            0 0 13px rgba(255, 229, 0, 0.72) !important;
        }

        .red-flag-column-old-due[open] .red-flag-word {
          color: #8b1e1e !important;
          animation: none !important;
          text-shadow:
            0 1px 0 #ffffff,
            0 0 2px rgba(139, 30, 30, 0.22) !important;
        }


        .red-flag-expanded {
          padding: 0 16px 18px;
        }

        .red-flag-expanded-title {
          color: #7f1d1d;
          font-size: 28px;
          font-weight: 1000;
          margin: 4px 0 14px;
        }

        .red-flag-empty {
          padding: 24px;
          border-radius: 14px;
          background: #f0fdf4;
          color: #15803d;
          font-size: 18px;
          font-weight: 900;
          text-align: center;
        }

        @media (max-width: 1250px) {
          .red-flag-column-grid {
            grid-template-columns: repeat(5, minmax(120px, 1fr));
          }
        }

        @media (max-width: 760px) {
          .red-flag-column-grid {
            grid-template-columns: repeat(2, minmax(130px, 1fr));
          }
        }

        .shop-business-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          padding: 18px 22px;
          border-radius: 18px;
          color: #173b67;
          background:
            radial-gradient(circle at 12% 0%, rgba(255,255,255,0.95), rgba(255,255,255,0) 34%),
            linear-gradient(115deg, #fffdf4 0%, #f7f1dd 45%, #eaf5ff 100%);
          border: 1px solid #d9e3ed;
          box-shadow:
            0 12px 28px rgba(35, 66, 104, 0.12),
            inset 0 1px 0 rgba(255,255,255,0.95);
        }

        .shop-business-title-wrap {
          display: flex;
          align-items: center;
          gap: 13px;
          white-space: nowrap;
        }

        .shop-business-title-wrap h2 {
          margin: 0;
          font-family: "Roboto Condensed", "Arial Narrow", sans-serif;
          font-size: clamp(27px, 2.6vw, 43px);
          line-height: 1;
          font-weight: 900;
          letter-spacing: -1px;
          color: #173b67;
        }

        .shop-business-controls {
          display: flex;
          align-items: stretch;
          gap: 12px;
        }

        .shop-business-control,
        .shop-business-print {
          min-height: 64px;
          border: 0;
          border-radius: 12px;
          background: #ffffff;
          color: #111827;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          border: 1px solid #d7e1eb;
          box-shadow: 0 7px 16px rgba(35, 66, 104, 0.10);
        }

        .shop-business-control span {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .shop-business-control small {
          font-size: 14px;
          line-height: 1;
          font-weight: 900;
        }

        .shop-business-control input {
          width: 178px;
          border: 0;
          padding: 0;
          background: transparent;
          color: #111827;
          font-size: 15px;
          font-weight: 900;
          outline: none;
        }

        .shop-business-print {
          cursor: pointer;
          font-size: 16px;
          font-weight: 950;
          white-space: nowrap;
        }

        .shop-business-print:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 20px rgba(35, 66, 104, 0.16);
        }

        .shop-summary-table-wrap {
          width: calc(100% - 32px);
          margin-left: 16px;
          margin-right: 16px;
          overflow-x: auto;
          border-radius: 14px;
          border: 1px solid #c9d3e3;
        }

        .shop-summary-table {
          width: 100%;
          min-width: 1080px;
          margin: 0;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: fixed;
          overflow: hidden;
        }

        .shop-summary-table th {
          height: 59px;
          padding: 12px 10px;
          border-right: 1px solid rgba(255,255,255,0.72);
          background: linear-gradient(180deg, #dc001d 0%, #bf001b 100%);
          color: #ffffff;
          font-family: "Roboto Condensed", "Arial Narrow", sans-serif;
          font-size: 16px;
          line-height: 1.05;
          font-weight: 950;
          text-align: center;
        }

        .shop-summary-table td {
          height: 76px;
          padding: 10px 13px;
          border-right: 1px solid #d4d9e2;
          border-bottom: 1px solid #d4d9e2;
          font-family: "Roboto Condensed", "Arial Narrow", sans-serif;
          font-size: 25px;
          line-height: 1;
          font-weight: 950;
          text-align: center;
        }

        .shop-summary-table th:first-child,
        .shop-summary-table td:first-child {
          width: 240px;
        }

        .shop-summary-shop-cell {
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
        }

        .shop-summary-rank {
          width: 39px;
          height: 39px;
          flex: 0 0 39px;
          border-radius: 9px;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 950;
          box-shadow: inset 0 -4px 8px rgba(0,0,0,0.15);
        }

        .shop-summary-shop-cell > span:last-child {
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 5px;
        }

        .shop-summary-shop-cell strong {
          font-size: 24px;
          line-height: 1;
          white-space: nowrap;
        }

        .shop-summary-shop-cell small {
          border-radius: 5px;
          padding: 4px 7px;
          color: #ffffff;
          font-size: 13px;
          line-height: 1;
          font-weight: 950;
        }

        .shop-active-rental-cell {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .shop-summary-table tfoot td {
          height: 63px;
          border: 0;
          background: linear-gradient(180deg, #063466 0%, #062653 100%);
          color: #ffffff;
          font-size: 24px;
          font-weight: 950;
        }

        .shop-summary-legend {
          display: grid;
          width: calc(100% - 32px);
          margin-left: 16px;
          margin-right: 16px;
          margin-bottom: 16px;
          grid-template-columns: repeat(6, minmax(145px, 1fr));
          margin-top: 17px;
          padding: 13px 10px;
          border: 1px solid #e2e8f0;
          border-radius: 13px;
          background: #ffffff;
          box-shadow: 0 8px 18px rgba(15, 42, 95, 0.06);
        }

        .shop-summary-legend-item {
          min-width: 0;
          display: grid;
          grid-template-columns: 43px minmax(0, 1fr);
          gap: 9px;
          align-items: start;
          padding: 5px 10px;
          border-right: 1px solid #e2e8f0;
        }

        .shop-summary-legend-item:last-child {
          border-right: 0;
        }

        .shop-summary-legend-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .shop-summary-legend-title {
          font-family: "Roboto Condensed", "Arial Narrow", sans-serif;
          font-size: 13px;
          line-height: 1.05;
          font-weight: 950;
        }

        .shop-summary-legend-text {
          margin-top: 5px;
          color: #1f2937;
          font-size: 11px;
          line-height: 1.25;
          font-weight: 700;
        }

        @media (max-width: 1350px) {
          .shop-business-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .shop-business-controls {
            width: 100%;
          }

          .shop-business-control {
            flex: 1;
          }

          .shop-summary-metric-grid {
            grid-template-columns: repeat(3, minmax(180px, 1fr));
          }

          .shop-summary-legend {
            grid-template-columns: repeat(3, minmax(180px, 1fr));
          }

          .shop-summary-legend-item:nth-child(3) {
            border-right: 0;
          }
        }

        @media (max-width: 800px) {
          .shop-business-controls {
            flex-direction: column;
          }

          .shop-business-control input {
            width: 100%;
          }

          .shop-summary-metric-grid {
            grid-template-columns: 1fr;
          }

          .shop-summary-legend {
            grid-template-columns: 1fr;
          }

          .shop-summary-legend-item {
            border-right: 0;
            border-bottom: 1px solid #e2e8f0;
          }

          .shop-summary-legend-item:last-child {
            border-bottom: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .critical-flash-card,
          .critical-alert-dot {
            animation: none !important;
          }
        }
      `}</style>

      <div style={dashboardHeroStyle}>
        <div style={heroGlowOneStyle} />
        <div style={heroGlowTwoStyle} />
        <div style={heroStripeStyle} />

        <div style={heroTopStyle}>
          <div>
            <h1 style={dashboardTitleStyle}>Dashboard</h1>
            <p style={dashboardSubtitleStyle}>Overview of your tools business</p>
          </div>

          <div style={heroActionGroupStyle}>
            <a href="/backup-recovery" style={backupRecoveryLinkStyle}>
              <DatabaseBackup size={20} />
              Backup &amp; Restore
            </a>

            <div style={managerBadgeStyle}>
              <span style={managerBadgeDotStyle} />
              T&amp;T Tools Manager
            </div>
          </div>
        </div>

        <div style={cardStripStyle}>
          {cards.map((card) => (
            <DashboardStripCard key={card.title} {...card} />
          ))}
        </div>
      </div>

      <section style={shopBusinessSectionStyle}>
        <div className="shop-business-header">
          <div className="shop-business-title-wrap">
            <Store size={37} strokeWidth={2.6} />
            <h2>SHOP BUSINESS SUMMARY</h2>
          </div>

          <div className="shop-business-controls">
            <label className="shop-business-control">
              <CalendarDays size={24} />
              <span>
                <small>Date</small>
                <input
                  type="date"
                  value={shopSummaryDate}
                  onChange={(event) => setShopSummaryDate(event.target.value)}
                />
              </span>
            </label>

            <label className="shop-business-control">
              <CalendarDays size={24} />
              <span>
                <small>Period</small>
                <input
                  type="month"
                  value={shopSummaryMonth}
                  onChange={(event) => setShopSummaryMonth(event.target.value)}
                />
              </span>
            </label>

            <button
              type="button"
              className="shop-business-print"
              onClick={() => window.print()}
            >
              <Printer size={24} />
              Print / Export
            </button>
          </div>
        </div>

        <div className="shop-summary-table-wrap">
          <table className="shop-summary-table">
            <thead>
              <tr>
                <th>SHOP</th>
                <th>TODAY&apos;S BUSINESS</th>
                <th>THIS MONTH BUSINESS</th>
                <th>COLLECTIONS</th>
                <th>ROUND OFF</th>
                <th>PENDING BALANCE</th>
                <th>ACTIVE RENTALS</th>
              </tr>
            </thead>

            <tbody>
              {shopSummaryRows.map((row: any, index: number) => {
                const theme = shopSummaryTheme(row.shop);

                return (
                  <tr
                    key={row.shop}
                    style={{ background: theme.rowBackground }}
                  >
                    <td>
                      <div className="shop-summary-shop-cell">
                        <span
                          className="shop-summary-rank"
                          style={{ background: theme.strong }}
                        >
                          {index + 1}
                        </span>
                        <span>
                          <strong style={{ color: theme.strong }}>
                            {row.shop}
                          </strong>
                        </span>
                      </div>
                    </td>
                    <td style={{ color: theme.strong }}>
                      {formatIndianNumber(
                        row.selectedDateBusiness || row.todayBusiness,
                      )}
                    </td>
                    <td style={{ color: theme.strong }}>
                      {formatIndianNumber(row.monthBusiness)}
                    </td>
                    <td style={{ color: "#07852f" }}>
                      {formatIndianNumber(row.collections)}
                    </td>
                    <td style={{ color: "#f97316" }}>
                      {formatIndianNumber(row.roundOff)}
                    </td>
                    <td style={{ color: "#dc1018" }}>
                      {formatIndianNumber(
                        row.pendingBalance || row.monthBalance,
                      )}
                    </td>
                    <td style={{ color: "#6216a5" }}>
                      <span className="shop-active-rental-cell">
                        {formatIndianNumber(row.activeRentals)}
                        <Users size={25} fill="currentColor" />
                      </span>
                    </td>
                  </tr>
                );
              })}

              {shopSummaryRows.length === 0 && (
                <tr>
                  <td colSpan={7}>No shop summary data</td>
                </tr>
              )}
            </tbody>

            <tfoot>
              <tr>
                <td>TOTAL</td>
                <td>{formatIndianNumber(shopSummaryTotals.todayBusiness)}</td>
                <td>{formatIndianNumber(shopSummaryTotals.monthBusiness)}</td>
                <td style={{ color: "#9cff71" }}>
                  {formatIndianNumber(shopSummaryTotals.collections)}
                </td>
                <td style={{ color: "#ff9d24" }}>
                  {formatIndianNumber(shopSummaryTotals.roundOff)}
                </td>
                <td style={{ color: "#ff4c5a" }}>
                  {formatIndianNumber(shopSummaryTotals.pendingBalance)}
                </td>
                <td style={{ color: "#e3a4ff" }}>
                  {formatIndianNumber(shopSummaryTotals.activeRentals)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="shop-summary-legend">
          <ShopSummaryLegend
            icon={BriefcaseBusiness}
            title="TODAY'S BUSINESS"
            text="Business generated on the selected date"
            tone="#175ac8"
          />
          <ShopSummaryLegend
            icon={CalendarDays}
            title="THIS MONTH BUSINESS"
            text="Total rental business in the selected month"
            tone="#175ac8"
          />
          <ShopSummaryLegend
            icon={HandCoins}
            title="COLLECTIONS"
            text="Payments collected in the selected month"
            tone="#07852f"
          />
          <ShopSummaryLegend
            icon={Repeat2}
            title="ROUND OFF"
            text="Total round off in the selected month"
            tone="#f97316"
          />
          <ShopSummaryLegend
            icon={Wallet}
            title="PENDING BALANCE"
            text="Outstanding balance as on the selected date"
            tone="#dc1018"
          />
          <ShopSummaryLegend
            icon={Users}
            title="ACTIVE RENTALS"
            text="Rentals active on the selected date"
            tone="#6216a5"
          />
        </div>
      </section>

      <section style={{ marginBottom: 30 }}>
        <div style={criticalFlagsHeaderStyle}>
          <div style={criticalFlagsTitleWrapStyle}>
            <span
              className={criticalRedFlags.length > 0 ? "critical-alert-dot" : ""}
              style={{
                ...criticalFlagsDotStyle,
                background: criticalRedFlags.length > 0 ? "#ef4444" : "#22c55e",
              }}
            />
            <div>
              <h2 style={criticalFlagsTitleStyle}>Critical Red Flags</h2>
              <div style={criticalFlagsCaptionStyle}>
                Click any column to expand and see its complete details
              </div>
            </div>
          </div>

          <div
            style={{
              ...criticalFlagsCountStyle,
              background:
                criticalRedFlags.length > 0
                  ? "linear-gradient(135deg, #ef4444 0%, #991b1b 100%)"
                  : "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
            }}
          >
            {criticalRedFlags.length}
          </div>
        </div>

        <div className="red-flag-column-grid">
          {redFlagColumns.map((column) => (
            <details
              key={column.key}
              className={[
                column.hasActual
                  ? "red-flag-column red-flag-column-active"
                  : column.isNearOnly
                  ? "red-flag-column red-flag-column-near"
                  : "red-flag-column",
                column.key === "OLD DUE" ? "red-flag-column-old-due" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <summary>
                <div className="red-flag-word">{column.key}</div>
                <div className="red-flag-count">
                  {column.rows.length}
                </div>
              </summary>

              <div className="red-flag-expanded">
                <div className="red-flag-expanded-title">
                  {column.title}
                </div>

                {column.rows.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Tool / Customer</th>
                          <th>Customer / Detail</th>
                          <th>Shop</th>
                          <th>Days</th>
                          <th>Amount</th>
                          <th>Warning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {column.rows.map((row: any, index: number) => (
                          <tr key={`${column.key}-${row.subject}-${index}`}>
                            <td
                              style={{
                                fontWeight: 950,
                                color: row.isNear ? "#b45309" : "#991b1b",
                              }}
                            >
                              {row.subject || "-"}
                            </td>
                            <td>{row.customer || "-"}</td>
                            <td>{row.shop || "-"}</td>
                            <td>{Number(row.days || 0) > 0 ? row.days : "-"}</td>
                            <td>
                              {Number(row.amount || 0) > 0
                                ? `₹${Number(row.amount || 0).toFixed(0)}`
                                : "-"}
                            </td>
                            <td>{row.isNear ? "-" : row.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="red-flag-empty">
                    No {column.title.toLowerCase()} found
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>

      <h2 style={sectionTitleStyle}>Maintenance Alerts</h2>

      <div style={alertsGridStyle}>
        <div className="modern-card" style={creativeCardStyle}>
          <div style={creativeHeaderBlueStyle}>
            <div style={{ ...miniIconCreativeStyle, color: "#00bcd4", background: "#dffcff" }}>
              <Wrench size={30} />
            </div>
            <div>
              <h2 style={creativeHeaderTitleStyle}>Maintenance Alerts</h2>
              <div style={creativeHeaderCaptionStyle}>Service, greasing and oil-change reminders</div>
            </div>
          </div>

          <div style={{ marginTop: 24, overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Tool</th>
                  <th>Location</th>
                  <th>Alert</th>
                </tr>
              </thead>

              <tbody>
                {maintenanceAlerts.map((row: any, index: number) => (
                  <tr key={index}>
                    <td
                      style={{
                        fontWeight: 900,
                        color:
                          row.level === "danger"
                            ? "#dc2626"
                            : row.color === "blue"
                            ? "#2563eb"
                            : row.color === "orange"
                            ? "#ea580c"
                            : "#ca8a04",
                      }}
                    >
                      {row.type}
                    </td>
                    <td>{row.tool_name}</td>
                    <td>{row.location || "-"}</td>
                    <td>{row.message}</td>
                  </tr>
                ))}

                {maintenanceAlerts.length === 0 && (
                  <tr>
                    <td colSpan={4}>No maintenance alerts</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <p style={footerStyle}>
        © 2025 T&amp;T Tools Manager. All rights reserved.
      </p>
    </main>
  );
}

function formatIndianNumber(value: any) {
  return Math.round(Number(value || 0)).toLocaleString("en-IN");
}

function formatShortDate(value: string) {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMonthLabel(value: string) {
  if (!value) return "-";

  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function shopSummaryTheme(shop: string) {
  const themes: Record<string, any> = {
    "Mulayam Rd": {
      strong: "#175ac8",
      rowBackground: "linear-gradient(90deg, #e9f3ff 0%, #f7fbff 100%)",
    },
    Ollur: {
      strong: "#14851d",
      rowBackground: "linear-gradient(90deg, #ebfaec 0%, #f8fff7 100%)",
    },
    Karuvannur: {
      strong: "#f3740b",
      rowBackground: "linear-gradient(90deg, #fff3dc 0%, #fffaf0 100%)",
    },
    Kachery: {
      strong: "#dd1457",
      rowBackground: "linear-gradient(90deg, #ffeaf2 0%, #fff7fa 100%)",
    },
    Pattikkad: {
      strong: "#5b1999",
      rowBackground: "linear-gradient(90deg, #f1eaff 0%, #faf7ff 100%)",
    },
  };

  return (
    themes[shop] || {
      strong: "#175ac8",
      rowBackground: "linear-gradient(90deg, #eef5ff 0%, #ffffff 100%)",
    }
  );
}

function ShopSummaryLegend({
  icon: Icon,
  title,
  text,
  tone,
}: any) {
  return (
    <div className="shop-summary-legend-item">
      <div
        className="shop-summary-legend-icon"
        style={{
          color: tone,
          background: `${tone}16`,
        }}
      >
        <Icon size={24} strokeWidth={2.5} />
      </div>
      <div>
        <div className="shop-summary-legend-title" style={{ color: tone }}>
          {title}
        </div>
        <div className="shop-summary-legend-text">{text}</div>
      </div>
    </div>
  );
}

function autoValueFontSize(value: any) {
  const length = String(value ?? "").length;

  if (length === 1) return "clamp(86px, 8.5vw, 150px)";
  if (length === 2) return "clamp(72px, 7vw, 122px)";
  if (length === 3) return "clamp(60px, 5.8vw, 100px)";
  if (length <= 5) return "clamp(46px, 4.6vw, 78px)";
  if (length <= 7) return "clamp(38px, 3.8vw, 66px)";
  if (length <= 9) return "clamp(31px, 3.1vw, 54px)";
  return "clamp(25px, 2.5vw, 44px)";
}

function autoTitleFontSize(title: any) {
  const length = String(title ?? "").length;

  if (length <= 14) return "clamp(15px, 1.45vw, 24px)";
  if (length <= 20) return "clamp(13px, 1.25vw, 21px)";
  if (length <= 27) return "clamp(11px, 1.05vw, 18px)";
  return "clamp(10px, 0.9vw, 16px)";
}

function DashboardStripCard({
  title,
  value,
  gradient,
  glow,
  dot,
  accent,
  control,
}: any) {
  return (
    <div
      style={{
        minHeight: 315,
        borderRadius: "8px 8px 42px 42px",
        padding: "18px 14px 22px",
        background: gradient,
        boxShadow: `0 16px 30px ${glow}`,
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.14)",
      }}
    >

      <div
        style={{
          ...captionStyle,
          fontSize: autoTitleFontSize(title),
        }}
      >
        {title}
      </div>

      <div style={cardAccentPillStyle}>{accent}</div>

      {control && <div style={cardControlWrapStyle}>{control}</div>}

      <div
        style={{
          ...valueStyle,
          fontSize: autoValueFontSize(value),
        }}
      >
        {value}
      </div>
    </div>
  );
}

const dashboardHeroStyle: any = {
  position: "relative",
  overflow: "hidden",
  background:
    "radial-gradient(circle at 8% 15%, rgba(0,87,255,0.14) 0%, rgba(0,87,255,0) 26%), linear-gradient(180deg, #ffffff 0%, #eef6ff 100%)",
  border: "1px solid #dbeafe",
  borderRadius: 24,
  padding: "24px 18px 28px",
  boxShadow: "0 24px 50px rgba(15, 42, 95, 0.14)",
  marginBottom: 28,
};

const heroGlowOneStyle: any = {
  position: "absolute",
  width: 260,
  height: 260,
  borderRadius: "50%",
  background: "rgba(34, 197, 94, 0.12)",
  right: 90,
  top: -120,
};

const heroGlowTwoStyle: any = {
  position: "absolute",
  width: 220,
  height: 220,
  borderRadius: "50%",
  background: "rgba(236, 72, 153, 0.12)",
  left: "42%",
  bottom: -130,
};

const heroStripeStyle: any = {
  position: "absolute",
  inset: "auto -60px -80px auto",
  width: 360,
  height: 180,
  transform: "rotate(-18deg)",
  background: "linear-gradient(90deg, rgba(250,204,21,0.16), rgba(0,87,255,0.08))",
  borderRadius: 60,
};

const heroTopStyle: any = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 20,
  paddingTop: 6,
};

const dashboardTitleStyle: any = {
  margin: 0,
  fontSize: 54,
  lineHeight: 1,
  fontWeight: 800,
  color: "#183b7a",
  letterSpacing: -1,
};

const dashboardSubtitleStyle: any = {
  margin: "10px 0 0",
  fontSize: 22,
  fontWeight: 900,
  color: "#334155",
};

const heroActionGroupStyle: any = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  gap: 10,
};

const backupRecoveryLinkStyle: any = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
  minHeight: 48,
  border: "1px solid #c9d8ee",
  borderRadius: 999,
  padding: "11px 17px",
  color: "#173b74",
  background:
    "linear-gradient(135deg, #ffffff 0%, #eef5ff 100%)",
  boxShadow: "0 12px 24px rgba(36, 70, 162, 0.12)",
  fontSize: 16,
  fontWeight: 950,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const managerBadgeStyle: any = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
  background: "linear-gradient(135deg, #3666d6 0%, #183b7a 100%)",
  color: "#ffffff",
  fontWeight: 800,
  fontSize: 17,
  padding: "13px 20px",
  borderRadius: 999,
  boxShadow: "0 16px 28px rgba(36, 70, 162, 0.30)",
  whiteSpace: "nowrap",
  marginTop: 4,
};

const managerBadgeDotStyle: any = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#22c55e",
  boxShadow: "0 0 0 5px rgba(34,197,94,0.18)",
};

const cardStripStyle: any = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "repeat(8, minmax(150px, 1fr))",
  gap: 8,
  alignItems: "stretch",
};




const cardAccentPillStyle: any = {
  position: "relative",
  zIndex: 1,
  alignSelf: "center",
  fontSize: 12,
  lineHeight: 1,
  letterSpacing: 1.2,
  fontWeight: 900,
  color: "#ffffff",
  background: "rgba(255,255,255,0.16)",
  border: "1px solid rgba(255,255,255,0.20)",
  borderRadius: 999,
  padding: "7px 10px",
  marginTop: 8,
};


const cardControlWrapStyle: any = {
  position: "relative",
  zIndex: 2,
  width: "100%",
  marginTop: 10,
};

const cardControlStyle: any = {
  width: "100%",
  minHeight: 34,
  border: "1px solid rgba(255,255,255,0.55)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.94)",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 900,
  padding: "6px 8px",
  outline: "none",
};

const valueStyle: any = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  padding: "0 4px",
  fontFamily: '"Roboto Condensed", "Arial Narrow", "Helvetica Condensed", "Segoe UI", sans-serif',
  lineHeight: 1,
  fontWeight: 800,
  letterSpacing: -2.2,
  color: "#ffffff",
  whiteSpace: "nowrap",
  overflow: "visible",
  textAlign: "center",
  marginTop: "auto",
  marginBottom: 0,
};

const captionStyle: any = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  padding: "0 2px",
  fontFamily: '"Roboto Condensed", "Arial Narrow", "Helvetica Condensed", "Segoe UI", sans-serif',
  lineHeight: 1,
  fontWeight: 800,
  letterSpacing: -0.8,
  color: "rgba(255,255,255,0.98)",
  whiteSpace: "nowrap",
  overflow: "visible",
  minHeight: 28,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  textAlign: "center",
};

const sectionTitleStyle: any = {
  margin: "4px 0 18px",
  color: "#0f2a5f",
  fontSize: 32,
  fontWeight: 800,
};

const alertsGridStyle: any = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 22,
  marginBottom: 34,
};

const creativeCardStyle: any = {
  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  border: "1px solid #bfdbfe",
  boxShadow: "0 18px 38px rgba(15, 42, 95, 0.10)",
};

const creativeHeaderBlueStyle: any = {
  display: "flex",
  gap: 14,
  alignItems: "center",
  padding: 14,
  borderRadius: 20,
  background: "linear-gradient(135deg, #e0f2fe 0%, #eff6ff 100%)",
  border: "1px solid #bae6fd",
};

const creativeHeaderPinkStyle: any = {
  display: "flex",
  gap: 14,
  alignItems: "center",
  padding: 14,
  borderRadius: 20,
  background: "linear-gradient(135deg, #ffe4e6 0%, #fff1f2 100%)",
  border: "1px solid #fecdd3",
};

const miniIconCreativeStyle: any = {
  width: 58,
  height: 58,
  borderRadius: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 10px 20px rgba(15, 23, 42, 0.10)",
};

const creativeHeaderTitleStyle: any = {
  margin: 0,
  color: "#0f2a5f",
  fontSize: 28,
  fontWeight: 800,
};

const creativeHeaderCaptionStyle: any = {
  marginTop: 4,
  color: "#475569",
  fontSize: 15,
  fontWeight: 850,
};

const shopBusinessSectionStyle: any = {
  marginBottom: 30,
  padding: 0,
  borderRadius: 20,
  background: "#f8fafc",
  border: "1px solid #d8e0ec",
  boxShadow: "0 20px 46px rgba(15, 42, 95, 0.12)",
  overflow: "hidden",
};

const shopSummaryCardStyle: any = {
  background:
    "radial-gradient(circle at 100% 0%, rgba(250,204,21,0.16), rgba(250,204,21,0) 26%), linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  border: "1px solid #bfdbfe",
  boxShadow: "0 18px 38px rgba(15, 42, 95, 0.10)",
};

const shopSummaryHeaderStyle: any = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  marginBottom: 18,
};

const shopSummaryBadgeStyle: any = {
  background: "linear-gradient(135deg, #facc15 0%, #f97316 100%)",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 800,
  borderRadius: 999,
  padding: "11px 16px",
  boxShadow: "0 12px 24px rgba(249,115,22,0.24)",
};

const criticalFlagsCardStyle: any = {
  background:
    "radial-gradient(circle at 100% 0%, rgba(239,68,68,0.14), rgba(239,68,68,0) 30%), linear-gradient(180deg, #fff7f7 0%, #ffffff 100%)",
  border: "2px solid #fecaca",
  boxShadow: "0 18px 38px rgba(220, 38, 38, 0.14)",
  marginBottom: 30,
};

const criticalFlagsHeaderStyle: any = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 18,
};

const criticalFlagsTitleWrapStyle: any = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const criticalFlagsDotStyle: any = {
  width: 18,
  height: 18,
  borderRadius: "50%",
  flex: "0 0 auto",
  boxShadow: "0 0 0 7px rgba(239,68,68,0.12)",
};

const criticalFlagsTitleStyle: any = {
  margin: 0,
  color: "#ff1744",
  fontSize: 38,
  fontWeight: 800,
  letterSpacing: -0.8,
  textShadow:
    "0 0 6px rgba(255,255,255,0.95), 0 0 14px rgba(255,23,68,0.75)",
};

const criticalFlagsCaptionStyle: any = {
  marginTop: 5,
  color: "#991b1b",
  fontSize: 17,
  fontWeight: 900,
};

const criticalFlagsCountStyle: any = {
  minWidth: 60,
  height: 60,
  padding: "0 14px",
  borderRadius: 18,
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 30,
  fontWeight: 800,
  boxShadow: "0 12px 24px rgba(153,27,27,0.24)",
};

const criticalTypeBadgeStyle: any = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  color: "#ffffff",
  padding: "7px 11px",
  fontSize: 13,
  lineHeight: 1.1,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const footerStyle: any = {
  textAlign: "center",
  color: "#64748b",
  fontWeight: 700,
  marginTop: 34,
};
