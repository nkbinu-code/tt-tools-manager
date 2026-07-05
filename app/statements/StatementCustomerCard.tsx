"use client";

import { CalendarDays, Phone, Store, UserRound } from "lucide-react";

type Props = {
  customerName: string;
  mobile: string;
  shop: string;
  period: string;
  fromDate?: string;
  toDate?: string;
  showDateRange?: boolean;
};

function safeText(value: any) {
  return value ? String(value) : "-";
}

export default function StatementCustomerCard({
  customerName,
  mobile,
  shop,
  period,
  fromDate,
  toDate,
  showDateRange,
}: Props) {
  return (
    <div style={card}>
      <div style={leftBlock}>
        <div style={avatarCircle}>
          <UserRound size={34} />
        </div>

        <div>
          <div style={labelBlue}>CUSTOMER</div>
          <div style={customerNameStyle}>{safeText(customerName)}</div>
          <div style={subLine}>
            {safeText(mobile)} • {safeText(shop)}
          </div>
        </div>
      </div>

      <div style={infoGrid}>
        <InfoItem icon={<Phone size={22} />} label="Mobile" value={mobile} />
        <InfoItem icon={<Store size={22} />} label="Shop" value={shop} />
        <InfoItem
          icon={<CalendarDays size={22} />}
          label="Period"
          value={
            showDateRange
              ? `${safeText(period)} (${safeText(fromDate)} - ${safeText(toDate)})`
              : period
          }
        />
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value }: any) {
  return (
    <div style={infoItem}>
      <div style={iconBox}>{icon}</div>
      <div>
        <div style={smallLabel}>{label}</div>
        <div style={valueText}>{safeText(value)}</div>
      </div>
    </div>
  );
}

const card: any = {
  display: "grid",
  gridTemplateColumns: "1.25fr 1.75fr",
  gap: 18,
  padding: 20,
  borderRadius: 20,
  background: "linear-gradient(135deg, #f8fbff 0%, #ffffff 100%)",
  border: "1px solid #bfdbfe",
  marginBottom: 22,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
};

const leftBlock: any = {
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const avatarCircle: any = {
  width: 72,
  height: 72,
  borderRadius: "50%",
  background: "#eaf2ff",
  color: "#0057ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
};

const labelBlue: any = {
  color: "#0057ff",
  fontWeight: 950,
  fontSize: 13,
  letterSpacing: "0.08em",
};

const customerNameStyle: any = {
  fontSize: 24,
  fontWeight: 950,
  color: "#0f172a",
  marginTop: 4,
  lineHeight: 1.15,
};

const subLine: any = {
  marginTop: 6,
  color: "#475569",
  fontWeight: 800,
  fontSize: 15,
};

const infoGrid: any = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  alignItems: "stretch",
};

const infoItem: any = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 12px",
  borderRadius: 16,
  background: "#ffffff",
  border: "1px solid #dbeafe",
};

const iconBox: any = {
  width: 42,
  height: 42,
  borderRadius: 12,
  background: "#eff6ff",
  color: "#0057ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
};

const smallLabel: any = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const valueText: any = {
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 950,
  marginTop: 2,
};
