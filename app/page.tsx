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
      title: "Pending Balance\nof the month",
      value: `₹${s.pendingBalance}`,
      icon: BadgeIndianRupee,
      gradient: "linear-gradient(160deg, #38bdf8 0%, #0984c7 50%, #075985 100%)",
      glow: "rgba(56, 189, 248, 0.38)",
      dot: "#bae6fd",
      accent: "BALANCE",
    },
    {
      title: "Today's Business",
      value: `₹${s.todayBusiness}`,
      icon: BarChart3,
      gradient: "linear-gradient(160deg, #24c6b8 0%, #0f887f 48%, #07504c 100%)",
      glow: "rgba(36, 198, 184, 0.36)",
      dot: "#99f6e4",
      accent: "TODAY",
    },
    {
      title: "Today's Collections",
      value: `₹${s.todayCollections}`,
      icon: Wallet,
      gradient: "linear-gradient(160deg, #facc15 0%, #d89d11 48%, #92400e 100%)",
      glow: "rgba(250, 204, 21, 0.38)",
      dot: "#fef3c7",
      accent: "CASH",
    },
    {
      title: "Service Cost\nof the month",
      value: `₹${s.serviceCost}`,
      icon: Settings,
      gradient: "linear-gradient(160deg, #fb7185 0%, #e84867 48%, #9f1239 100%)",
      glow: "rgba(251, 113, 133, 0.40)",
      dot: "#ffe4e6",
      accent: "COST",
    },
  ];

  return (
    <main style={{ paddingBottom: 20 }}>
      <div style={dashboardHeroStyle}>
        <div style={heroGlowOneStyle} />
        <div style={heroGlowTwoStyle} />
        <div style={heroStripeStyle} />

        <div style={heroTopStyle}>
          <div>
            <h1 style={dashboardTitleStyle}>Dashboard</h1>
            <p style={dashboardSubtitleStyle}>Overview of your tools business</p>
          </div>

          <div style={managerBadgeStyle}>
            <span style={managerBadgeDotStyle} />
            T&amp;T Tools Manager
          </div>
        </div>

        <div style={cardStripStyle}>
          {cards.map((card) => (
            <DashboardStripCard key={card.title} {...card} />
          ))}
        </div>
      </div>

      <div className="modern-card" style={shopSummaryCardStyle}>
        <div style={shopSummaryHeaderStyle}>
          <div>
            <h2 style={{ margin: 0, color: "#0f2a5f", fontSize: 34, fontWeight: 1000 }}>
              Shop Business Summary
            </h2>
            <div style={{ color: "#475569", fontSize: 16, fontWeight: 850, marginTop: 4 }}>
              Colorful quick view of each shop performance
            </div>
          </div>
          <div style={shopSummaryBadgeStyle}>SHOP-WISE</div>
        </div>

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


      <h2 style={sectionTitleStyle}>Maintenance & Rental Alerts</h2>

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

        <div className="modern-card" style={creativeCardStyle}>
          <div style={creativeHeaderPinkStyle}>
            <div style={{ ...miniIconCreativeStyle, color: "#ff2d75", background: "#ffe4ee" }}>
              <CalendarDays size={30} />
            </div>
            <div>
              <h2 style={creativeHeaderTitleStyle}>Rental Overdue Alerts</h2>
              <div style={creativeHeaderCaptionStyle}>Long running rentals that need follow-up</div>
            </div>
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

      <p style={footerStyle}>
        © 2025 T&amp;T Tools Manager. All rights reserved.
      </p>
    </main>
  );
}

function DashboardStripCard({ title, value, icon: Icon, gradient, glow, dot, accent }: any) {
  return (
    <div
      style={{
        minHeight: 315,
        borderRadius: "8px 8px 42px 42px",
        padding: "18px 14px 22px",
        background: gradient,
        boxShadow: `0 22px 44px ${glow}, inset 0 1px 0 rgba(255,255,255,0.28)`,
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.22)",
      }}
    >
      <div style={cardShineStyle} />
      <div style={{ ...cardCircleOneStyle, background: dot }} />
      <div style={{ ...cardCircleTwoStyle, background: dot }} />

      <div style={cardAccentPillStyle}>{accent}</div>

      <div style={iconBoxStyle}>
        <Icon size={34} strokeWidth={2.8} color="#ffffff" />
      </div>

      <div style={valueStyle}>{value}</div>

      <div style={captionStyle}>{title}</div>
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
  fontWeight: 1000,
  color: "#183b7a",
  letterSpacing: -1,
};

const dashboardSubtitleStyle: any = {
  margin: "10px 0 0",
  fontSize: 22,
  fontWeight: 900,
  color: "#334155",
};

const managerBadgeStyle: any = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
  background: "linear-gradient(135deg, #3666d6 0%, #183b7a 100%)",
  color: "#ffffff",
  fontWeight: 1000,
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

const cardShineStyle: any = {
  position: "absolute",
  left: -55,
  top: -85,
  width: 155,
  height: 230,
  transform: "rotate(28deg)",
  background: "rgba(255,255,255,0.18)",
};

const cardCircleOneStyle: any = {
  position: "absolute",
  width: 90,
  height: 90,
  right: -44,
  top: 34,
  borderRadius: "50%",
  opacity: 0.2,
};

const cardCircleTwoStyle: any = {
  position: "absolute",
  width: 62,
  height: 62,
  left: -28,
  bottom: 46,
  borderRadius: "50%",
  opacity: 0.18,
};

const cardAccentPillStyle: any = {
  position: "relative",
  zIndex: 1,
  alignSelf: "flex-start",
  fontSize: 13,
  lineHeight: 1,
  letterSpacing: 1.2,
  fontWeight: 1000,
  color: "#ffffff",
  background: "rgba(255,255,255,0.18)",
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: 999,
  padding: "8px 10px",
};

const iconBoxStyle: any = {
  position: "relative",
  zIndex: 1,
  width: 70,
  height: 70,
  borderRadius: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.18)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 12px 22px rgba(0,0,0,0.16)",
};

const valueStyle: any = {
  position: "relative",
  zIndex: 1,
  fontSize: 52,
  lineHeight: 1,
  fontWeight: 1000,
  color: "#ffffff",
  textShadow: "0 10px 22px rgba(0,0,0,0.22)",
  wordBreak: "break-word",
};

const captionStyle: any = {
  position: "relative",
  zIndex: 1,
  fontSize: 24,
  lineHeight: 1.08,
  fontWeight: 1000,
  color: "#ffffff",
  whiteSpace: "pre-line",
  textShadow: "0 6px 14px rgba(0,0,0,0.22)",
};

const sectionTitleStyle: any = {
  margin: "4px 0 18px",
  color: "#0f2a5f",
  fontSize: 32,
  fontWeight: 1000,
};

const alertsGridStyle: any = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
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
  fontWeight: 1000,
};

const creativeHeaderCaptionStyle: any = {
  marginTop: 4,
  color: "#475569",
  fontSize: 15,
  fontWeight: 850,
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
  fontWeight: 1000,
  borderRadius: 999,
  padding: "11px 16px",
  boxShadow: "0 12px 24px rgba(249,115,22,0.24)",
};

const footerStyle: any = {
  textAlign: "center",
  color: "#64748b",
  fontWeight: 700,
  marginTop: 34,
};
