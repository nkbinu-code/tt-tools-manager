"use client";

import { useEffect, useMemo, useState } from "react";
import { getBranches, getLedgerData } from "./actions";

export default function LedgerPage() {
  const [branches, setBranches] = useState<string[]>(["All Shops"]);
  const [selectedShop, setSelectedShop] = useState("All Shops");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadLedger(shop = selectedShop) {
    setLoading(true);

    const result = await getLedgerData(shop);

    if (result.success) {
      setRows(Array.isArray(result.data) ? result.data : []);
    } else {
      alert(result.message || "Could not load ledger");
    }

    setLoading(false);
  }

  useEffect(() => {
    async function load() {
      const b = await getBranches();
      setBranches(b);
      await loadLedger("All Shops");
    }

    load();
  }, []);

  const safeRows = Array.isArray(rows) ? rows : [];

  const totals = useMemo(() => {
    return safeRows.reduce(
      (acc, row) => {
        acc.rent += Number(row.rent || 0);
        acc.received += Number(row.received || 0);
        acc.discount += Number(row.discount || 0);
        acc.balance += Number(row.balance || 0);
        return acc;
      },
      { rent: 0, received: 0, discount: 0, balance: 0 }
    );
  }, [safeRows]);

  return (
    <main>
      <h1 className="page-title">Ledger</h1>
      <p className="page-subtitle">
        Customer-wise rent, received amount, discount and balance
      </p>

      <div className="modern-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <h2 style={{ margin: 0 }}>Customer Ledger</h2>

          <select
            value={selectedShop}
            onChange={(e) => {
              setSelectedShop(e.target.value);
              loadLedger(e.target.value);
            }}
            style={{ width: 260, fontWeight: 800 }}
          >
            {branches.map((shop) => (
              <option key={shop} value={shop}>
                {shop}
              </option>
            ))}
          </select>
        </div>

        {loading && <p style={{ fontWeight: 800 }}>Loading...</p>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Shop</th>
                <th>Tools</th>
                <th>Days</th>
                <th>Rent</th>
                <th>Received</th>
                <th>Discount</th>
                <th>Balance</th>
              </tr>
            </thead>

            <tbody>
              {safeRows.map((row, index) => (
                <tr key={`${row.customer}-${row.shop}-${index}`}>
                  <td>
                    <strong>{row.customer}</strong>
                  </td>
                  <td>{row.shop || row.branch}</td>
                  <td>{row.tools || "-"}</td>
                  <td style={{ textAlign: "center" }}>{row.days || 0}</td>
                  <td style={{ textAlign: "right" }}>
                    ₹{Number(row.rent || 0).toFixed(0)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    ₹{Number(row.received || 0).toFixed(0)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    ₹{Number(row.discount || 0).toFixed(0)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontWeight: 900,
                      color:
                        Number(row.balance || 0) > 500
                          ? "#dc2626"
                          : Number(row.balance || 0) > 0
                          ? "#ea580c"
                          : "#16a34a",
                    }}
                  >
                    ₹{Number(row.balance || 0).toFixed(0)}
                  </td>
                </tr>
              ))}

              {safeRows.length > 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "right", fontWeight: 950 }}>
                    Total
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 950 }}>
                    ₹{totals.rent.toFixed(0)}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 950 }}>
                    ₹{totals.received.toFixed(0)}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 950 }}>
                    ₹{totals.discount.toFixed(0)}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 950 }}>
                    ₹{totals.balance.toFixed(0)}
                  </td>
                </tr>
              )}

              {safeRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 20 }}>
                    No ledger data found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}