"use client";

export default function PaymentsHero({ shop, month }: { shop?: string; month?: string }) {
  return (
    <section className="modern-card" style={{ marginBottom: 22 }}>
      <div className="section-header">
        <div>
          <h2>Payments</h2>
          <p>
            {shop || "All Shops"} {month ? `• ${month}` : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
