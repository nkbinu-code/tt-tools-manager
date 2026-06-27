"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

type Tool = { id: string; tool_name: string };
type Shop = { id: string; name?: string; shop_name?: string; branch_name?: string };
type ServiceCentre = { id: string; name?: string; centre_name?: string };

type ServiceRow = {
  id: string;
  service_no?: string;
  tool_id: string;
  tool_name: string;
  qty: number;
  from_branch: string;
  service_centre: string;
  complaint: string;
  request_remarks: string;
  out_date: string;
  return_date: string | null;
  return_branch: string | null;
  service_types: string[] | null;
  work_done: string | null;
  amount: number | null;
  return_remarks: string | null;
  status: string;
};

type RequestRow = {
  out_date: string;
  tool_id: string;
  qty: number;
  from_shop: string;
  service_centre: string;
  complaint: string;
  request_remarks: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyRequestRow = (): RequestRow => ({
  out_date: today(),
  tool_id: "",
  qty: 1,
  from_shop: "",
  service_centre: "",
  complaint: "",
  request_remarks: "",
});

export default function ServicePage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [centres, setCentres] = useState<ServiceCentre[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [requestRows, setRequestRows] = useState<RequestRow[]>(
    Array.from({ length: 5 }, emptyRequestRow)
  );

  const [returnOpen, setReturnOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceRow | null>(null);

  const [returnForm, setReturnForm] = useState({
    return_date: today(),
    return_shop: "",
    service_types: [] as string[],
    work_done: "",
    amount: "",
    return_remarks: "",
  });

  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");
  const [historyTool, setHistoryTool] = useState("");
  const [historyCentre, setHistoryCentre] = useState("");
  const [historyReturnShop, setHistoryReturnShop] = useState("");
  const [historyServiceType, setHistoryServiceType] = useState("");
  const [historyFiltered, setHistoryFiltered] = useState(false);
  const [historyRows, setHistoryRows] = useState<ServiceRow[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  function shopName(shop: Shop) {
    return shop.name || shop.shop_name || shop.branch_name || shop.id || "";
  }

  function centreName(centre: ServiceCentre) {
    return centre.name || centre.centre_name || "";
  }

  async function loadData() {
    const [{ data: toolData }, { data: shopData }, { data: centreData }, { data: serviceData }] =
      await Promise.all([
        supabase.from("tools").select("*").order("tool_name"),
        supabase.from("branches").select("*"),
        supabase.from("service_centres").select("*"),
        supabase.from("services").select("*").order("created_at", { ascending: false }),
      ]);

    const defaultShops = [
      { id: "Karuvannur", name: "Karuvannur" },
      { id: "Ollur", name: "Ollur" },
      { id: "Kachery", name: "Kachery" },
      { id: "Mulayam Rd", name: "Mulayam Rd" },
      { id: "Pattikkad", name: "Pattikkad" },
    ];

    setTools(toolData || []);
    setShops(shopData && shopData.length > 0 ? shopData : defaultShops);
    setCentres(centreData || []);
    setServices(serviceData || []);
  }

  function updateRequestRow(index: number, field: keyof RequestRow, value: any) {
    setRequestRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function addFiveRows() {
    setRequestRows((prev) => [...prev, ...Array.from({ length: 5 }, emptyRequestRow)]);
  }

  async function saveServiceRequests() {
    const filledRows = requestRows.filter((r) => r.tool_id && r.from_shop && r.service_centre);

    if (filledRows.length === 0) {
      alert("Please fill at least one service request");
      return;
    }

    const insertRows = filledRows.map((row) => {
      const selectedTool = tools.find((t) => String(t.id) === String(row.tool_id));

      return {
        service_no: `SR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        tool_id: selectedTool?.id,
        tool_name: selectedTool?.tool_name || "",
        qty: Number(row.qty || 1),
        from_branch: row.from_shop,
        service_centre: row.service_centre,
        complaint: row.complaint,
        request_remarks: row.request_remarks,
        out_date: row.out_date,
        status: "In Service",
      };
    });

    const { error } = await supabase.from("services").insert(insertRows);

    if (error) {
      alert(error.message);
      return;
    }

    for (const row of filledRows) {
      await supabase
        .from("tools")
        .update({ current_location: row.service_centre, status: "In Service" })
        .eq("id", row.tool_id);
    }

    setRequestRows(Array.from({ length: 5 }, emptyRequestRow));
    await loadData();
  }

  function openReturnPopup(row: ServiceRow) {
    setSelectedService(row);
    setReturnForm({
      return_date: today(),
      return_shop: row.from_branch || "",
      service_types: [],
      work_done: "",
      amount: "",
      return_remarks: "",
    });
    setReturnOpen(true);
  }

  function toggleServiceType(type: string) {
    setReturnForm((prev) => ({
      ...prev,
      service_types: prev.service_types.includes(type)
        ? prev.service_types.filter((x) => x !== type)
        : [...prev.service_types, type],
    }));
  }

  async function saveReturn() {
    if (!selectedService) return;

    if (!returnForm.return_shop) {
      alert("Please select return shop");
      return;
    }

    const updateTool: any = {
      current_location: returnForm.return_shop,
      status: "Available",
    };

    if (returnForm.service_types.includes("Greasing")) updateTool.last_greasing_date = returnForm.return_date;
    if (returnForm.service_types.includes("Oil Change")) updateTool.last_oil_change_date = returnForm.return_date;
    if (returnForm.service_types.includes("Scheduled Service")) updateTool.last_scheduled_service_date = returnForm.return_date;
    if (returnForm.service_types.includes("Breakdown")) updateTool.last_breakdown_date = returnForm.return_date;

    const { error } = await supabase
      .from("services")
      .update({
        return_date: returnForm.return_date,
        return_branch: returnForm.return_shop,
        service_types: returnForm.service_types,
        work_done: returnForm.work_done,
        amount: Number(returnForm.amount || 0),
        return_remarks: returnForm.return_remarks,
        status: "Returned",
      })
      .eq("id", selectedService.id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("tools").update(updateTool).eq("id", selectedService.tool_id);

    setReturnOpen(false);
    setSelectedService(null);
    await loadData();
  }

  const inService = services.filter((s) => s.status === "In Service");
  const returned = services.filter((s) => s.status === "Returned");

  const latestReturned = returned.slice(0, 15);
  const visibleReturned = historyFiltered ? historyRows : latestReturned;

  function serviceDays(row: ServiceRow) {
    const start = new Date(row.out_date);
    const end = row.return_date ? new Date(row.return_date) : new Date();
    const diff = end.getTime() - start.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  function isThisMonth(date?: string | null) {
    if (!date) return false;
    const d = new Date(date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }

  function applyHistoryFilter() {
    let rows = [...returned];

    if (historyFromDate) rows = rows.filter((r) => String(r.return_date || "") >= historyFromDate);
    if (historyToDate) rows = rows.filter((r) => String(r.return_date || "") <= historyToDate);
    if (historyTool) rows = rows.filter((r) => r.tool_name === historyTool);
    if (historyCentre) rows = rows.filter((r) => r.service_centre === historyCentre);
    if (historyReturnShop) rows = rows.filter((r) => r.return_branch === historyReturnShop);
    if (historyServiceType) rows = rows.filter((r) => (r.service_types || []).includes(historyServiceType));

    setHistoryRows(rows);
    setHistoryFiltered(true);
  }

  function clearHistoryFilter() {
    setHistoryFromDate("");
    setHistoryToDate("");
    setHistoryTool("");
    setHistoryCentre("");
    setHistoryReturnShop("");
    setHistoryServiceType("");
    setHistoryRows([]);
    setHistoryFiltered(false);
  }

  function downloadServiceHistory() {
    const rowsToDownload = historyFiltered ? historyRows : returned;

    if (rowsToDownload.length === 0) {
      alert("No service history to download");
      return;
    }

    const exportRows = rowsToDownload.map((row) => ({
      "Returned Date": row.return_date || "",
      Tool: row.tool_name || "",
      "From Shop": row.from_branch || "",
      "Service Centre": row.service_centre || "",
      "Return Shop": row.return_branch || "",
      "Service Type": (row.service_types || []).join(", "),
      "Work Done": row.work_done || "",
      Amount: Number(row.amount || 0),
      Remarks: row.return_remarks || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Service History");
    XLSX.writeFile(workbook, "T&T_Service_History.xlsx");
  }

  const returnedThisMonth = returned.filter((s) => isThisMonth(s.return_date));
  const thisMonthCost = returnedThisMonth.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const averageDays =
    returnedThisMonth.length > 0
      ? Math.round(returnedThisMonth.reduce((sum, row) => sum + serviceDays(row), 0) / returnedThisMonth.length)
      : 0;
  const maintenanceDone = returnedThisMonth.reduce((sum, row) => sum + Number(row.service_types?.length || 0), 0);

  const uniqueHistoryTools = [...new Set(returned.map((r) => r.tool_name).filter(Boolean))];
  const uniqueHistoryCentres = [...new Set(returned.map((r) => r.service_centre).filter(Boolean))];
  const uniqueHistoryReturnShops = [
    ...new Set(
      returned
        .map((r) => r.return_branch)
        .filter((shop): shop is string => Boolean(shop))
    ),
  ];
  return (
    <main>
      <h1 className="page-title">Service Management</h1>
      <p className="page-subtitle">Service requests, returns and maintenance history</p>

      <div className="kpi-grid">
        <Kpi title="In Service" value={inService.length} />
        <Kpi title="Returned This Month" value={returnedThisMonth.length} />
        <Kpi title="Service Cost" value={`₹${thisMonthCost.toFixed(0)}`} />
        <Kpi title="Average Days" value={averageDays} />
      </div>

      <section className="modern-card">
        <SectionHeader
          title="New Service Request"
          subtitle="Table entry for sending tools to service centre"
          right={
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-gray" onClick={addFiveRows}>+ Add 5</button>
              <button className="btn-blue" onClick={saveServiceRequests}>Save Requests</button>
            </div>
          }
        />

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Tool</th>
                <th>Qty</th>
                <th>From Shop</th>
                <th>Service Centre</th>
                <th>Complaint</th>
                <th>Remarks</th>
              </tr>
            </thead>

            <tbody>
              {requestRows.map((row, index) => (
                <tr key={index}>
                  <td><input type="date" value={row.out_date} onChange={(e) => updateRequestRow(index, "out_date", e.target.value)} /></td>
                  <td>
                    <select value={row.tool_id} onChange={(e) => updateRequestRow(index, "tool_id", e.target.value)}>
                      <option value="">Select Tool</option>
                      {tools.map((tool) => <option key={tool.id} value={tool.id}>{tool.tool_name}</option>)}
                    </select>
                  </td>
                  <td><input type="number" min="1" value={row.qty} onChange={(e) => updateRequestRow(index, "qty", Number(e.target.value))} /></td>
                  <td>
                    <select value={row.from_shop} onChange={(e) => updateRequestRow(index, "from_shop", e.target.value)}>
                      <option value="">Shop</option>
                      {shops.map((shop) => {
                        const name = shopName(shop);
                        return <option key={shop.id} value={name}>{name}</option>;
                      })}
                    </select>
                  </td>
                  <td>
                    <select value={row.service_centre} onChange={(e) => updateRequestRow(index, "service_centre", e.target.value)}>
                      <option value="">Centre</option>
                      {centres.map((centre) => {
                        const name = centreName(centre);
                        return <option key={centre.id} value={name}>{name}</option>;
                      })}
                    </select>
                  </td>
                  <td><input value={row.complaint} onChange={(e) => updateRequestRow(index, "complaint", e.target.value)} placeholder="Complaint" /></td>
                  <td><input value={row.request_remarks} onChange={(e) => updateRequestRow(index, "request_remarks", e.target.value)} placeholder="Remarks" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="modern-card">
        <SectionHeader title="Currently In Service" subtitle="Tools waiting to return from service centre" />

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Tool</th>
                <th>Qty</th>
                <th>From Shop</th>
                <th>Service Centre</th>
                <th>Complaint</th>
                <th>Given Date</th>
                <th>Days</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {inService.map((row) => (
                <tr key={row.id}>
                  <td style={{ fontWeight: 900 }}>{row.tool_name}</td>
                  <td>{row.qty}</td>
                  <td>{row.from_branch}</td>
                  <td>{row.service_centre}</td>
                  <td>{row.complaint || "-"}</td>
                  <td>{row.out_date}</td>
                  <td>{serviceDays(row)}</td>
                  <td>
                    <button className="btn-green" onClick={() => openReturnPopup(row)}>
                      Return
                    </button>
                  </td>
                </tr>
              ))}

              {inService.length === 0 && (
                <tr>
                  <td colSpan={8}>No tools currently in service</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="modern-card">
        <SectionHeader
          title="Returned Service History"
          subtitle={historyFiltered ? "Filtered service history" : "Latest 15 records. Use filter to view more."}
          right={<button className="btn-blue" onClick={downloadServiceHistory}>Download</button>}
        />

        <div style={filterGridStyle}>
          <input type="date" value={historyFromDate} onChange={(e) => setHistoryFromDate(e.target.value)} />
          <input type="date" value={historyToDate} onChange={(e) => setHistoryToDate(e.target.value)} />

          <select value={historyTool} onChange={(e) => setHistoryTool(e.target.value)}>
            <option value="">All Tools</option>
            {uniqueHistoryTools.map((tool) => <option key={tool} value={tool}>{tool}</option>)}
          </select>

          <select value={historyCentre} onChange={(e) => setHistoryCentre(e.target.value)}>
            <option value="">All Centres</option>
            {uniqueHistoryCentres.map((centre) => <option key={centre} value={centre}>{centre}</option>)}
          </select>

          <select value={historyReturnShop} onChange={(e) => setHistoryReturnShop(e.target.value)}>
            <option value="">All Shops</option>
            {uniqueHistoryReturnShops.map((shop) => <option key={shop} value={shop}>{shop}</option>)}
          </select>

          <select value={historyServiceType} onChange={(e) => setHistoryServiceType(e.target.value)}>
            <option value="">All Types</option>
            <option value="Greasing">Greasing</option>
            <option value="Oil Change">Oil Change</option>
            <option value="Scheduled Service">Scheduled Service</option>
            <option value="Breakdown">Breakdown</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button className="btn-blue" onClick={applyHistoryFilter}>Show Report</button>
          <button className="btn-gray" onClick={clearHistoryFilter}>Clear Filter</button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Returned Date</th>
                <th>Tool</th>
                <th>From Shop</th>
                <th>Service Centre</th>
                <th>Return Shop</th>
                <th>Service Type</th>
                <th>Days</th>
                <th>Amount</th>
                <th>Work Done</th>
              </tr>
            </thead>

            <tbody>
              {visibleReturned.map((row) => (
                <tr key={row.id}>
                  <td>{row.return_date}</td>
                  <td style={{ fontWeight: 900 }}>{row.tool_name}</td>
                  <td>{row.from_branch}</td>
                  <td>{row.service_centre}</td>
                  <td>{row.return_branch}</td>
                  <td>{(row.service_types || []).join(", ")}</td>
                  <td>{serviceDays(row)}</td>
                  <td style={{ fontWeight: 900, color: "#dc2626" }}>₹{Number(row.amount || 0).toFixed(0)}</td>
                  <td>{row.work_done || "-"}</td>
                </tr>
              ))}

              {visibleReturned.length === 0 && (
                <tr>
                  <td colSpan={9}>No returned service history</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {returnOpen && selectedService && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <h2>Return From Service</h2>

            <div style={{ marginBottom: 16 }}>
              <strong>{selectedService.tool_name}</strong>
              <p>{selectedService.complaint || "-"}</p>
              <p>{selectedService.service_centre} • From {selectedService.from_branch}</p>
            </div>

            <div style={returnGridStyle}>
              <input type="date" value={returnForm.return_date} onChange={(e) => setReturnForm({ ...returnForm, return_date: e.target.value })} />

              <select value={returnForm.return_shop} onChange={(e) => setReturnForm({ ...returnForm, return_shop: e.target.value })}>
                <option value="">Return Shop</option>
                {shops.map((shop) => {
                  const name = shopName(shop);
                  return <option key={shop.id} value={name}>{name}</option>;
                })}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, margin: "16px 0" }}>
              {["Greasing", "Oil Change", "Scheduled Service", "Breakdown"].map((type) => (
                <label key={type} style={{ fontWeight: 900 }}>
                  <input type="checkbox" checked={returnForm.service_types.includes(type)} onChange={() => toggleServiceType(type)} /> {type}
                </label>
              ))}
            </div>

            <textarea value={returnForm.work_done} onChange={(e) => setReturnForm({ ...returnForm, work_done: e.target.value })} placeholder="Work Done" />

            <div style={returnGridStyle}>
              <input type="number" value={returnForm.amount} onChange={(e) => setReturnForm({ ...returnForm, amount: e.target.value })} placeholder="Amount" />
              <input value={returnForm.return_remarks} onChange={(e) => setReturnForm({ ...returnForm, return_remarks: e.target.value })} placeholder="Remarks" />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="btn-gray" onClick={() => setReturnOpen(false)}>Cancel</button>
              <button className="btn-green" onClick={saveReturn}>Save Return</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Kpi({ title, value }: any) {
  return (
    <div className="kpi-card">
      <div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{title}</div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, right }: any) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", marginBottom: 16 }}>
      <div>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ margin: "4px 0 0", color: "#64748b", fontWeight: 700 }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

const filterGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(140px, 1fr))",
  gap: 10,
  marginBottom: 14,
};

const returnGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginBottom: 12,
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,.7)",
  display: "grid",
  placeItems: "center",
  zIndex: 100,
  padding: 20,
};

const modalStyle: CSSProperties = {
  background: "#fff",
  width: "100%",
  maxWidth: 900,
  borderRadius: 18,
  padding: 24,
};