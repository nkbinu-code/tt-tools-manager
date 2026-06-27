"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const shops = [
  "All Shops",
  "Karuvannur",
  "Ollur",
  "Kachery",
  "Mulayam Rd",
  "Pattikkad",
];

const reminderTypes = [
  "All",
  "Greasing",
  "Oil Change",
  "Scheduled Service",
];

function daysBetween(date: any) {
  if (!date) return 99999;
  const oldDate = new Date(date);
  const now = new Date();
  const diff = now.getTime() - oldDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function RemindersPage() {
  const [tools, setTools] = useState<any[]>([]);
  const [shopFilter, setShopFilter] = useState("All Shops");
  const [typeFilter, setTypeFilter] = useState("All");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTools();
  }, []);

  async function loadTools() {
    const { data, error } = await supabase
      .from("tools")
      .select("*")
      .order("tool_name", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setTools(data || []);
  }

  const reminders = useMemo(() => {
    const list: any[] = [];

    tools.forEach((tool) => {
      const shop = tool.current_location || tool.home_branch || "";

      const greasingDays = Number(tool.greasing_due_days || 0);
      const oilDays = Number(tool.oil_change_due_days || 0);
      const serviceDays = Number(tool.scheduled_service_due_days || 0);

      const lastGreasingDays = daysBetween(tool.last_greasing_date);
      const lastOilDays = daysBetween(tool.last_oil_change_date);
      const lastServiceDays = daysBetween(tool.last_scheduled_service_date);

      if (greasingDays > 0 && lastGreasingDays >= greasingDays) {
        list.push({
          id: `${tool.id}-greasing`,
          tool_id: tool.id,
          tool_name: tool.tool_name,
          shop,
          type: "Greasing",
          last_date: tool.last_greasing_date,
          due_days: greasingDays,
          days_passed: lastGreasingDays,
        });
      }

      if (oilDays > 0 && lastOilDays >= oilDays) {
        list.push({
          id: `${tool.id}-oil`,
          tool_id: tool.id,
          tool_name: tool.tool_name,
          shop,
          type: "Oil Change",
          last_date: tool.last_oil_change_date,
          due_days: oilDays,
          days_passed: lastOilDays,
        });
      }

      if (serviceDays > 0 && lastServiceDays >= serviceDays) {
        list.push({
          id: `${tool.id}-service`,
          tool_id: tool.id,
          tool_name: tool.tool_name,
          shop,
          type: "Scheduled Service",
          last_date: tool.last_scheduled_service_date,
          due_days: serviceDays,
          days_passed: lastServiceDays,
        });
      }
    });

    return list.filter((r) => {
      const shopOk = shopFilter === "All Shops" || r.shop === shopFilter;
      const typeOk = typeFilter === "All" || r.type === typeFilter;
      return shopOk && typeOk;
    });
  }, [tools, shopFilter, typeFilter]);

  const greasingCount = reminders.filter((r) => r.type === "Greasing").length;
  const oilCount = reminders.filter((r) => r.type === "Oil Change").length;
  const serviceCount = reminders.filter(
    (r) => r.type === "Scheduled Service"
  ).length;

  async function markDone(row: any) {
    const today = new Date().toISOString().slice(0, 10);

    let updateData: any = {};

    if (row.type === "Greasing") {
      updateData.last_greasing_date = today;
    }

    if (row.type === "Oil Change") {
      updateData.last_oil_change_date = today;
    }

    if (row.type === "Scheduled Service") {
      updateData.last_scheduled_service_date = today;
    }

    const { error } = await supabase
      .from("tools")
      .update(updateData)
      .eq("id", row.tool_id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`${row.type} marked done`);
    await loadTools();
    setTimeout(() => setMessage(""), 2500);
  }

  return (
    <main>
      <h1 className="page-title">Reminders</h1>
      <p className="page-subtitle">
        Greasing, oil change and scheduled service reminders
      </p>

      {message && <div className="modern-message">{message}</div>}

      <div className="kpi-grid">
        <Kpi title="Total Reminders" value={reminders.length} />
        <Kpi title="Greasing Due" value={greasingCount} />
        <Kpi title="Oil Change Due" value={oilCount} />
        <Kpi title="Service Due" value={serviceCount} />
      </div>

      <section className="modern-card">
        <div className="section-header">
          <div>
            <h2>Reminder Filters</h2>
            <p>Filter reminders by shop and service type</p>
          </div>
        </div>

        <div className="filter-row">
          <select
            value={shopFilter}
            onChange={(e) => setShopFilter(e.target.value)}
          >
            {shops.map((shop) => (
              <option key={shop}>{shop}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            {reminderTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="modern-card">
        <div className="section-header">
          <div>
            <h2>Due Reminders</h2>
            <p>Tools that need greasing, oil change or scheduled service</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tool</th>
                <th>Shop</th>
                <th>Reminder</th>
                <th>Last Done</th>
                <th>Due Days</th>
                <th>Days Passed</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {reminders.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.tool_name}</strong>
                  </td>
                  <td>{row.shop || "-"}</td>
                  <td>
                    <strong>{row.type}</strong>
                  </td>
                  <td>{row.last_date || "Not entered"}</td>
                  <td>{row.due_days}</td>
                  <td className="strong">{row.days_passed}</td>
                  <td>
                    <button
                      className="btn-blue"
                      onClick={() => markDone(row)}
                    >
                      Mark Done
                    </button>
                  </td>
                </tr>
              ))}

              {reminders.length === 0 && (
                <tr>
                  <td colSpan={7}>No reminders due</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
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