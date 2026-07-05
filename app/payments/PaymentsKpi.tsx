type PaymentsKpiProps = {
  monthBusiness: number;
  paymentsReceived: number;
  pendingReturned: number;
  totalArrears: number;
  shop: string;
  month: string;
};

function money(value: number) {
  return `₹${Number(value || 0).toFixed(0)}`;
}

function monthLabel(value: string) {
  if (!value) return "Selected month";
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export default function PaymentsKpi({
  monthBusiness,
  paymentsReceived,
  pendingReturned,
  totalArrears,
  shop,
  month,
}: PaymentsKpiProps) {
  const place = shop === "All Shops" ? "All shops" : shop;
  const period = monthLabel(month);

  const cards = [
    {
      title: "Month Business",
      value: money(monthBusiness),
      caption: `${place} • ${period}`,
    },
    {
      title: "Payments Received",
      value: money(paymentsReceived),
      caption: `${place} • ${period}`,
    },
    {
      title: "Pending Returned",
      value: money(pendingReturned),
      caption: "Returned rentals to collect",
    },
    {
      title: "Total Arrears",
      value: money(totalArrears),
      caption: `${place} arrears balance`,
    },
  ];

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        gap: 14,
        margin: "18px 0",
      }}
    >
      {cards.map((card) => (
        <div
          key={card.title}
          style={{
            background: "#ffffff",
            border: "1px solid #dbeafe",
            borderRadius: 18,
            padding: "18px 18px 16px",
            boxShadow: "0 10px 28px rgba(15, 23, 42, 0.07)",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: "#475569",
              marginBottom: 8,
            }}
          >
            {card.title}
          </div>

          <div
            style={{
              fontSize: 30,
              lineHeight: 1,
              fontWeight: 950,
              color: "#0f172a",
              letterSpacing: "-0.04em",
            }}
          >
            {card.value}
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              fontWeight: 800,
              color: "#64748b",
            }}
          >
            {card.caption}
          </div>
        </div>
      ))}
    </section>
  );
}
