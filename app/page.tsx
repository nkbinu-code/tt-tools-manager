import {
  Wrench,
  CalendarDays,
  Wallet,
  BarChart3,
  AlertTriangle,
  BadgeIndianRupee,
  BriefcaseBusiness,
  Settings,
} from "lucide-react";
import { getDashboardStats } from "./actions";

export default async function Dashboard() {
  const s: any = await getDashboardStats();

  const maintenanceAlerts = s.maintenanceAlerts || [];
  const rentalOverdueAlerts = s.rentalOverdueAlerts || [];

  const cards = [
    {
      title: "Total Tools",
      value: s.totalTools,
      icon: BriefcaseBusiness,
      color: "#0057ff",
      bg: "#e8f0ff",
    },
    {
      title: "Active Rentals",
      value: s.activeRentals,
      icon: CalendarDays,
      color: "#16a34a",
      bg: "#dcfce7",
    },
    {
      title: "Tools In Service",
      value: s.toolsInService,
      icon: Wrench,
      color: "#7c3aed",
      bg: "#ede9fe",
    },
    {
      title: "Missing Tools",
      value: s.missingTools,
      icon: AlertTriangle,
      color: "#f97316",
      bg: "#ffedd5",
    },
    {
      title: "Pending Balance",
      value: `₹${s.pendingBalance}`,
      icon: BadgeIndianRupee,
      color: "#06b6d4",
      bg: "#cffafe",
    },
    {
      title: "Today's Business",
      value: `₹${s.todayBusiness}`,
      icon: BarChart3,
      color: "#16a34a",
      bg: "#dcfce7",
    },
    {
      title: "Today's Collections",
      value: `₹${s.todayCollections}`,
      icon: Wallet,
      color: "#f59e0b",
      bg: "#fef3c7",
    },
    {
      title: "Service Cost",
      value: `₹${s.serviceCost}`,
      icon: Settings,
      color: "#ef4444",
      bg: "#fee2e2",
    },
  ];

  return (
    <main>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Overview of your tools business</p>

      <div className="kpi-grid">
        {cards.map((card) => (
          <DashboardCard key={card.title} {...card} />
        ))}
      </div>

      <h2 style={{ marginBottom: 18 }}>Maintenance & Rental Alerts</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 22,
          marginBottom: 34,
        }}
      >
        <div className="modern-card">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div
              className="mini-icon"
              style={{ color: "#00bcd4", background: "#dffcff" }}
            >
              <Wrench size={26} />
            </div>
            <h2 style={{ margin: 0 }}>Maintenance Alerts</h2>
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

        <div className="modern-card">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div
              className="mini-icon"
              style={{ color: "#ff2d75", background: "#ffe4ee" }}
            >
              <CalendarDays size={26} />
            </div>
            <h2 style={{ margin: 0 }}>Rental Overdue Alerts</h2>
          </div>

          <div style={{ marginTop: 24, overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Customer</th>
                  <th>Shop</th>
                  <th>Days</th>
                  <th>Limit</th>
                </tr>
              </thead>

              <tbody>
                {rentalOverdueAlerts.map((row: any, index: number) => (
                  <tr key={index}>
                    <td style={{ fontWeight: 900, color: "#dc2626" }}>
                      {row.tool_name}
                    </td>
                    <td>{row.customer}</td>
                    <td>{row.shop || "-"}</td>
                    <td>{row.days}</td>
                    <td>{row.overdueDays}</td>
                  </tr>
                ))}

                {rentalOverdueAlerts.length === 0 && (
                  <tr>
                    <td colSpan={5}>No rental overdue alerts</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="modern-card">
        <h2>Shop Business Summary</h2>

        <table>
          <thead>
            <tr>
              <th>Shop</th>
              <th>Today Business</th>
              <th>Business Till Now</th>
              <th>This Month Balance</th>
            </tr>
          </thead>

          <tbody>
            {s.shopStats.map((row: any) => (
              <tr key={row.shop}>
                <td>{row.shop}</td>
                <td>₹{Number(row.todayBusiness || 0).toFixed(0)}</td>
                <td>₹{Number(row.businessTillNow || 0).toFixed(0)}</td>
                <td
                  style={{
                    fontWeight: 900,
                    color:
                      Number(row.monthBalance || 0) > 0 ? "#dc2626" : "#16a34a",
                  }}
                >
                  ₹{Number(row.monthBalance || 0).toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p
        style={{
          textAlign: "center",
          color: "#64748b",
          fontWeight: 700,
          marginTop: 34,
        }}
      >
        © 2025 T&T Tools Manager. All rights reserved.
      </p>
    </main>
  );
}

function DashboardCard({ title, value, icon: Icon, color, bg }: any) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ background: bg }}>
        <Icon size={24} strokeWidth={2.6} color={color} />
      </div>

      <div style={{ flex: 1 }}>
        <div className="kpi-value" style={{ color }}>
          {value}
        </div>

        <div className="kpi-label">{title}</div>
      </div>
    </div>
  );
}