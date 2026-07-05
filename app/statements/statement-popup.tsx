"use client";

import { CalendarDays, Check, ClipboardList, CreditCard, FileText, Hammer, Infinity, Phone, Store, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { StatementPeriod, StatementType } from "./statement-engine";

type StatementPopupProps = {
  onClose: () => void;
  onPreview: (data: {
    type: StatementType;
    period: StatementPeriod;
    fromDate: string;
    toDate: string;
  }) => void;
  customer?: any;
};

const statementTypes: Array<{
  id: StatementType;
  title: string;
  subtitle: string;
  icon: any;
  iconBg: string;
  iconColor: string;
}> = [
  {
    id: "rent",
    title: "Rental Statement",
    subtitle: "Show rental details only",
    icon: Hammer,
    iconBg: "#dcfce7",
    iconColor: "#16a34a",
  },
  {
    id: "payment",
    title: "Payment Statement",
    subtitle: "Show payment details only",
    icon: CreditCard,
    iconBg: "#f3e8ff",
    iconColor: "#7c3aed",
  },
  {
    id: "combined",
    title: "Rental + Payment",
    subtitle: "Show both rental and payment details",
    icon: ClipboardList,
    iconBg: "#dbeafe",
    iconColor: "#0057ff",
  },
];

const periods: Array<{
  id: StatementPeriod;
  title: string;
  icon: any;
  color: string;
}> = [
  { id: "all", title: "All Time", icon: Infinity, color: "#475569" },
  { id: "thisMonth", title: "This Month", icon: CalendarDays, color: "#0057ff" },
  { id: "lastMonth", title: "Last Month", icon: CalendarDays, color: "#f97316" },
  { id: "custom", title: "Custom Date", icon: CalendarDays, color: "#16a34a" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function displayStatementType(type: StatementType) {
  if (type === "rent") return "Rental Statement";
  if (type === "payment") return "Payment Statement";
  return "Rental + Payment";
}

function displayPeriod(period: StatementPeriod) {
  if (period === "all") return "All Time";
  if (period === "thisMonth") return "This Month";
  if (period === "lastMonth") return "Last Month";
  return "Custom Date";
}

export default function StatementPopup({ onClose, onPreview, customer }: StatementPopupProps) {
  const [type, setType] = useState<StatementType>("combined");
  const [period, setPeriod] = useState<StatementPeriod>("thisMonth");
  const [fromDate, setFromDate] = useState(monthStart());
  const [toDate, setToDate] = useState(today());

  const customerName =
    customer?.customer_name || customer?.name || customer?.customer || "Selected customer";
  const customerMobile = customer?.mobile || "-";
  const customerShop = customer?.shop || customer?.branch || "-";

  const canGenerate = useMemo(() => {
    if (period !== "custom") return true;
    return Boolean(fromDate && toDate);
  }, [period, fromDate, toDate]);

  function generate() {
    if (!canGenerate) return;
    onPreview({ type, period, fromDate, toDate });
  }

  return (
    <div style={overlay}>
      <div style={popup}>
        <div style={topHeader}>
          <div style={titleWrap}>
            <div style={titleIconBox}>
              <FileText size={34} />
            </div>
            <div>
              <h2 style={title}>Customer Statement</h2>
              <p style={subtitle}>Generate customer rental/payment statement</p>
            </div>
          </div>

          <button type="button" onClick={onClose} style={closeButton}>
            <X size={34} />
          </button>
        </div>

        <div style={body}>
          <div style={customerCard}>
            <div style={avatarCircle}>
              <UserRound size={44} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={sectionMiniTitle}>CUSTOMER</div>
              <div style={customerNameStyle}>{customerName}</div>

              <div style={customerMetaRow}>
                <span style={metaItem}>
                  <Phone size={22} color="#0057ff" /> {customerMobile}
                </span>
                <span style={divider} />
                <span style={metaItem}>
                  <Store size={22} color="#0057ff" /> {customerShop}
                </span>
              </div>
            </div>
          </div>

          <div style={panel}>
            <h3 style={panelTitle}>STATEMENT TYPE</h3>

            <div style={statementGrid}>
              {statementTypes.map((item) => {
                const Icon = item.icon;
                const selected = type === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id)}
                    style={{
                      ...typeCard,
                      ...(selected ? selectedCard : {}),
                    }}
                  >
                    {selected && (
                      <span style={checkBubble}>
                        <Check size={22} />
                      </span>
                    )}

                    <span
                      style={{
                        ...typeIcon,
                        background: item.iconBg,
                        color: item.iconColor,
                      }}
                    >
                      <Icon size={38} />
                    </span>

                    <span style={{ ...cardTitle, color: selected ? "#0057ff" : "#0f172a" }}>
                      {item.title}
                    </span>
                    <span style={cardSubtitle}>{item.subtitle}</span>
                  </button>
                );
              })}
            </div>

            <div style={sectionLine} />

            <h3 style={panelTitle}>PERIOD</h3>

            <div style={periodGrid}>
              {periods.map((item) => {
                const Icon = item.icon;
                const selected = period === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPeriod(item.id)}
                    style={{
                      ...periodCard,
                      ...(selected ? selectedPeriodCard : {}),
                    }}
                  >
                    {selected && (
                      <span style={periodCheckBubble}>
                        <Check size={20} />
                      </span>
                    )}
                    <Icon size={26} color={item.color} />
                    <span style={{ fontWeight: 950, color: selected ? "#0057ff" : "#334155" }}>
                      {item.title}
                    </span>
                  </button>
                );
              })}
            </div>

            {period === "custom" && (
              <div style={datePanel}>
                <label style={dateLabel}>
                  From Date
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    style={dateInput}
                  />
                </label>

                <label style={dateLabel}>
                  To Date
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    style={dateInput}
                  />
                </label>
              </div>
            )}
          </div>

          <div style={previewBox}>
            <div style={previewTitle}>PREVIEW</div>
            <div style={previewRow}>
              <span>
                Customer: <strong>{customerName}</strong>
              </span>
              <span style={previewDivider} />
              <span>
                Mobile: <strong>{customerMobile}</strong>
              </span>
              <span style={previewDivider} />
              <span>
                Statement: <strong>{displayStatementType(type)}</strong>
              </span>
              <span style={previewDivider} />
              <span>
                Period: <strong>{displayPeriod(period)}</strong>
              </span>
            </div>
          </div>
        </div>

        <div style={footer}>
          <button type="button" onClick={onClose} style={cancelButton}>
            Cancel
          </button>

          <button
            type="button"
            onClick={generate}
            disabled={!canGenerate}
            style={{
              ...generateButton,
              opacity: canGenerate ? 1 : 0.55,
              cursor: canGenerate ? "pointer" : "not-allowed",
            }}
          >
            <FileText size={22} /> Generate Statement
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: any = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.72)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const popup: any = {
  width: "min(1150px, 96vw)",
  maxHeight: "94vh",
  overflow: "auto",
  background: "white",
  borderRadius: 24,
  boxShadow: "0 30px 90px rgba(0,0,0,0.38)",
  border: "1px solid #bfdbfe",
};

const topHeader: any = {
  background: "linear-gradient(135deg, #0057ff 0%, #0042c7 100%)",
  color: "white",
  padding: "26px 32px",
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const titleWrap: any = {
  display: "flex",
  alignItems: "center",
  gap: 20,
};

const titleIconBox: any = {
  width: 72,
  height: 72,
  borderRadius: 18,
  background: "rgba(255,255,255,0.18)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const title: any = {
  margin: 0,
  color: "white",
  fontSize: "clamp(28px, 4vw, 44px)",
  fontWeight: 950,
  letterSpacing: "-0.03em",
};

const subtitle: any = {
  margin: "4px 0 0",
  color: "white",
  fontSize: 20,
  fontWeight: 700,
  opacity: 0.92,
};

const closeButton: any = {
  border: 0,
  background: "transparent",
  color: "white",
  cursor: "pointer",
  padding: 8,
  display: "flex",
};

const body: any = {
  padding: 28,
};

const customerCard: any = {
  border: "1px solid #bfdbfe",
  background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
  borderRadius: 20,
  padding: 28,
  display: "flex",
  alignItems: "center",
  gap: 26,
  marginBottom: 24,
};

const avatarCircle: any = {
  width: 90,
  height: 90,
  borderRadius: "50%",
  background: "#eaf2ff",
  color: "#0057ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
};

const sectionMiniTitle: any = {
  color: "#0057ff",
  fontWeight: 950,
  fontSize: 15,
  letterSpacing: "0.06em",
};

const customerNameStyle: any = {
  fontSize: 30,
  fontWeight: 950,
  color: "#0f172a",
  marginTop: 6,
};

const customerMetaRow: any = {
  marginTop: 16,
  display: "flex",
  alignItems: "center",
  gap: 18,
  flexWrap: "wrap",
  color: "#475569",
  fontSize: 19,
  fontWeight: 750,
};

const metaItem: any = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
};

const divider: any = {
  width: 1,
  height: 30,
  background: "#cbd5e1",
};

const panel: any = {
  border: "1px solid #dbeafe",
  borderRadius: 20,
  overflow: "hidden",
  marginBottom: 24,
};

const panelTitle: any = {
  margin: 0,
  padding: "22px 24px 12px",
  color: "#334155",
  fontSize: 22,
  fontWeight: 950,
};

const statementGrid: any = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 24,
  padding: "12px 24px 28px",
};

const typeCard: any = {
  position: "relative",
  border: "1px solid #dbeafe",
  background: "white",
  borderRadius: 18,
  padding: "28px 20px",
  minHeight: 190,
  cursor: "pointer",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  transition: "all 0.18s ease",
};

const selectedCard: any = {
  border: "2px solid #0057ff",
  background: "#f8fbff",
  boxShadow: "0 12px 30px rgba(0, 87, 255, 0.12)",
};

const checkBubble: any = {
  position: "absolute",
  top: 14,
  right: 14,
  width: 34,
  height: 34,
  borderRadius: "50%",
  background: "#0057ff",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const typeIcon: any = {
  width: 76,
  height: 76,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 8,
};

const cardTitle: any = {
  fontSize: 21,
  fontWeight: 950,
};

const cardSubtitle: any = {
  fontSize: 17,
  lineHeight: 1.45,
  color: "#475569",
  fontWeight: 650,
};

const sectionLine: any = {
  height: 1,
  background: "#e2e8f0",
};

const periodGrid: any = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 18,
  padding: "12px 24px 20px",
};

const periodCard: any = {
  position: "relative",
  border: "1px solid #dbeafe",
  background: "white",
  borderRadius: 16,
  padding: "22px 18px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  minHeight: 78,
  fontSize: 18,
};

const selectedPeriodCard: any = {
  border: "2px solid #0057ff",
  background: "#f8fbff",
};

const periodCheckBubble: any = {
  position: "absolute",
  top: 10,
  right: 10,
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: "#0057ff",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const datePanel: any = {
  margin: "0 24px 24px",
  padding: 22,
  borderRadius: 16,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
};

const dateLabel: any = {
  fontSize: 17,
  color: "#334155",
  fontWeight: 800,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const dateInput: any = {
  width: "100%",
  height: 52,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  padding: "0 14px",
  fontSize: 18,
  fontWeight: 800,
};

const previewBox: any = {
  border: "1px solid #bfdbfe",
  background: "#f8fbff",
  borderRadius: 18,
  padding: 22,
};

const previewTitle: any = {
  color: "#0057ff",
  fontSize: 21,
  fontWeight: 950,
  marginBottom: 14,
};

const previewRow: any = {
  display: "flex",
  alignItems: "center",
  gap: 18,
  flexWrap: "wrap",
  fontSize: 17,
  color: "#475569",
  fontWeight: 650,
};

const previewDivider: any = {
  width: 1,
  height: 28,
  background: "#cbd5e1",
};

const footer: any = {
  borderTop: "1px solid #e2e8f0",
  padding: "22px 28px",
  display: "flex",
  justifyContent: "flex-end",
  gap: 18,
  background: "#ffffff",
  borderBottomLeftRadius: 24,
  borderBottomRightRadius: 24,
};

const cancelButton: any = {
  minWidth: 190,
  height: 58,
  borderRadius: 14,
  border: "1px solid #dbeafe",
  background: "white",
  color: "#0f172a",
  fontSize: 20,
  fontWeight: 950,
  cursor: "pointer",
};

const generateButton: any = {
  minWidth: 330,
  height: 58,
  borderRadius: 14,
  border: 0,
  background: "linear-gradient(135deg, #0057ff 0%, #0042c7 100%)",
  color: "white",
  fontSize: 20,
  fontWeight: 950,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  boxShadow: "0 10px 24px rgba(0, 87, 255, 0.22)",
};
