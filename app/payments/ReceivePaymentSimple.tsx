import { Plus, Save } from "lucide-react";

function money(value: any) {
  return `₹${Number(value || 0).toFixed(0)}`;
}

export default function ReceivePaymentSimple({
  rows,
  customers,
  paymentModes,
  onChange,
  onAddRows,
  onSave,
}: any) {
  return (
    <section className="modern-card">
      <div className="section-header">
        <div>
          <h2>Receive Payment</h2>
          <p>Simple payment entry. Type mobile number, then enter amount.</p>
        </div>

        <div className="action-row">
          <button className="btn-gray" type="button" onClick={onAddRows}>
            <Plus size={16} /> Add Rows
          </button>

          <button className="btn-blue" type="button" onClick={onSave}>
            <Save size={16} /> Save
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {rows.map((row: any, index: number) => {
          const hasValue =
            row.mobile ||
            row.customer_name ||
            row.amount ||
            row.discount ||
            row.remarks ||
            index === 0;

          if (!hasValue) return null;

          return (
            <div
              key={index}
              style={{
                border: "1px solid #dbeafe",
                borderRadius: 18,
                padding: 14,
                background: "#ffffff",
                boxShadow: "0 8px 22px rgba(15, 23, 42, 0.06)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 12,
                  alignItems: "end",
                }}
              >
                <label style={{ fontWeight: 900 }}>
                  Date
                  <input
                    type="date"
                    value={row.payment_date}
                    onChange={(e) => onChange(index, "payment_date", e.target.value)}
                    style={{ width: "100%", marginTop: 6 }}
                  />
                </label>

                <label style={{ fontWeight: 900 }}>
                  Mobile
                  <input
                    list="paymentCustomerMobileList"
                    value={row.mobile}
                    onChange={(e) => onChange(index, "mobile", e.target.value)}
                    placeholder="Type mobile"
                    style={{ width: "100%", marginTop: 6 }}
                  />
                </label>

                <label style={{ fontWeight: 900 }}>
                  Customer
                  <input
                    value={row.customer_name}
                    readOnly
                    placeholder="Auto-fill"
                    style={{ width: "100%", marginTop: 6 }}
                  />
                </label>

                <label style={{ fontWeight: 900 }}>
                  Shop
                  <input
                    value={row.shop}
                    readOnly
                    placeholder="Auto-fill"
                    style={{ width: "100%", marginTop: 6 }}
                  />
                </label>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 12,
                  marginTop: 12,
                  alignItems: "end",
                }}
              >
                <div
                  style={{
                    borderRadius: 14,
                    padding: "10px 12px",
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>
                    Outstanding
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 950, color: "#0f172a" }}>
                    {money(row.outstanding)}
                  </div>
                </div>

                <label style={{ fontWeight: 900 }}>
                  Amount Received
                  <input
                    type="number"
                    value={row.amount}
                    onChange={(e) => onChange(index, "amount", e.target.value)}
                    placeholder="0"
                    style={{ width: "100%", marginTop: 6 }}
                  />
                </label>

                <label style={{ fontWeight: 900 }}>
                  Discount
                  <input
                    type="number"
                    value={row.discount}
                    onChange={(e) => onChange(index, "discount", e.target.value)}
                    placeholder="0"
                    style={{ width: "100%", marginTop: 6 }}
                  />
                </label>

                <label style={{ fontWeight: 900 }}>
                  Mode
                  <select
                    value={row.mode}
                    onChange={(e) => onChange(index, "mode", e.target.value)}
                    style={{ width: "100%", marginTop: 6 }}
                  >
                    {paymentModes.map((mode: string) => (
                      <option key={mode}>{mode}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label style={{ display: "block", fontWeight: 900, marginTop: 12 }}>
                Remarks
                <input
                  value={row.remarks}
                  onChange={(e) => onChange(index, "remarks", e.target.value)}
                  placeholder="Optional note"
                  style={{ width: "100%", marginTop: 6 }}
                />
              </label>
            </div>
          );
        })}
      </div>

      <datalist id="paymentCustomerMobileList">
        {customers.map((c: any) => (
          <option key={c.id} value={c.mobile} label={c.customer_name || c.name} />
        ))}
      </datalist>
    </section>
  );
}
