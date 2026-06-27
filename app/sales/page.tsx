"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  BadgeIndianRupee,
  BarChart3,
  Package,
  AlertTriangle,
  Trash2,
  Download,
} from "lucide-react";
import {
  getSalesData,
  saveSaleItems,
  saveSales,
  deleteSaleItem,
  deleteSaleEntry,
} from "./actions";

const shops = ["Karuvannur", "Ollur", "Kachery", "Mulayam Rd", "Pattikkad"];

const categories = [
  "Cutting Blade",
  "Grinding Disc",
  "Drill Bit",
  "Safety",
  "Consumables",
  "Accessories",
  "Other",
];

const today = () => new Date().toISOString().slice(0, 10);

const emptyProductRow = () => ({
  item_name: "",
  category: "",
  shop: "",
  current_qty: "",
  purchase_cost: "",
  selling_price: "",
  min_stock: "",
  remarks: "",
});

const emptySaleRow = () => ({
  sale_date: today(),
  item_id: "",
  shop: "",
  qty: "",
  selling_price: "",
  customer_name: "",
  remarks: "",
});

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState("Products");
  const [items, setItems] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const [productRows, setProductRows] = useState<any[]>(
    Array.from({ length: 5 }, emptyProductRow)
  );

  const [saleRows, setSaleRows] = useState<any[]>(
    Array.from({ length: 10 }, emptySaleRow)
  );

  const [productSearch, setProductSearch] = useState("");
  const [productShop, setProductShop] = useState("");
  const [productCategory, setProductCategory] = useState("");

  const [saleSearch, setSaleSearch] = useState("");
  const [saleShop, setSaleShop] = useState("");
  const [saleFromDate, setSaleFromDate] = useState("");
  const [saleToDate, setSaleToDate] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const res: any = await getSalesData();

    if (res.success) {
      setItems(res.items || []);
      setSales(res.sales || []);
    } else {
      showMessage(res.message || "Failed to load sales data");
    }
  }

  function showMessage(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(""), 2500);
  }

  function updateProductRow(index: number, field: string, value: string) {
    setProductRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function updateSaleRow(index: number, field: string, value: string) {
    setSaleRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function addProductRows() {
    setProductRows((prev) => [
      ...prev,
      ...Array.from({ length: 5 }, emptyProductRow),
    ]);
  }

  function addSaleRows() {
    setSaleRows((prev) => [
      ...prev,
      ...Array.from({ length: 5 }, emptySaleRow),
    ]);
  }

  function getItemById(id: string) {
    return items.find((item) => item.id === id);
  }

  async function handleSaveProducts() {
    const res: any = await saveSaleItems(productRows);
    showMessage(res.message || "");

    if (res.success) {
      setProductRows(Array.from({ length: 5 }, emptyProductRow));
      await loadData();
    }
  }

  async function handleSaveSales() {
    const res: any = await saveSales(saleRows);
    showMessage(res.message || "");

    if (res.success) {
      setSaleRows(Array.from({ length: 10 }, emptySaleRow));
      await loadData();
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm("Delete this product?")) return;

    const res: any = await deleteSaleItem(id);
    showMessage(res.message || "");
    await loadData();
  }

  async function handleDeleteSale(id: string) {
    if (!confirm("Delete this sale entry? Stock will not automatically return.")) return;

    const res: any = await deleteSaleEntry(id);
    showMessage(res.message || "");
    await loadData();
  }

  const totalSales = sales.reduce((sum, row) => sum + Number(row.total_sale || 0), 0);
  const totalCost = sales.reduce((sum, row) => sum + Number(row.total_cost || 0), 0);
  const totalProfit = totalSales - totalCost;

  const inventoryValue = items.reduce(
    (sum, item) =>
      sum + Number(item.current_qty || 0) * Number(item.purchase_cost || 0),
    0
  );

  const lowStockItems = items.filter(
    (item) => Number(item.current_qty || 0) <= Number(item.min_stock || 0)
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const search = productSearch.toLowerCase();

      const matchSearch =
        !search ||
        String(item.item_name || "").toLowerCase().includes(search) ||
        String(item.category || "").toLowerCase().includes(search);

      const matchShop = !productShop || item.shop === productShop;
      const matchCategory = !productCategory || item.category === productCategory;

      return matchSearch && matchShop && matchCategory;
    });
  }, [items, productSearch, productShop, productCategory]);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const search = saleSearch.toLowerCase();

      const matchSearch =
        !search ||
        String(sale.item_name || "").toLowerCase().includes(search) ||
        String(sale.customer_name || "").toLowerCase().includes(search) ||
        String(sale.remarks || "").toLowerCase().includes(search);

      const matchShop = !saleShop || sale.shop === saleShop;
      const matchFrom = !saleFromDate || String(sale.sale_date || "") >= saleFromDate;
      const matchTo = !saleToDate || String(sale.sale_date || "") <= saleToDate;

      return matchSearch && matchShop && matchFrom && matchTo;
    });
  }, [sales, saleSearch, saleShop, saleFromDate, saleToDate]);

  function downloadSalesCsv() {
    const header = [
      "Date",
      "Product",
      "Shop",
      "Qty",
      "Cost",
      "Sale",
      "Profit",
      "Customer",
      "Remarks",
    ];

    const rows = filteredSales.map((sale) => [
      sale.sale_date || "",
      sale.item_name || "",
      sale.shop || "",
      sale.qty || "",
      sale.total_cost || 0,
      sale.total_sale || 0,
      sale.profit || 0,
      sale.customer_name || "",
      sale.remarks || "",
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "T&T_Sales_History.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <h1 className="page-title">Sales & Inventory</h1>
      <p className="page-subtitle">Manage products, stock, sales and profit</p>

      {message && <div className="modern-message">{message}</div>}

      <div className="kpi-grid">
        <SalesKpi
          title="Total Sales"
          value={`₹${totalSales.toFixed(0)}`}
          icon={ShoppingCart}
          color="#0057ff"
          bg="#e8f0ff"
        />
        <SalesKpi
          title="Total Cost"
          value={`₹${totalCost.toFixed(0)}`}
          icon={BadgeIndianRupee}
          color="#f97316"
          bg="#ffedd5"
        />
        <SalesKpi
          title="Total Profit"
          value={`₹${totalProfit.toFixed(0)}`}
          icon={BarChart3}
          color={totalProfit < 0 ? "#ef4444" : "#16a34a"}
          bg={totalProfit < 0 ? "#fee2e2" : "#dcfce7"}
        />
        <SalesKpi
          title="Inventory Value"
          value={`₹${inventoryValue.toFixed(0)}`}
          icon={Package}
          color="#06b6d4"
          bg="#cffafe"
        />
      </div>

      <div className="modern-card compact-card">
        <div className="tab-row">
          {["Products", "Sales Entry", "Sales History", "Low Stock"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? "btn-blue" : "btn-gray"}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Products" && (
        <>
          <section className="modern-card">
            <SectionHeader
              title="Add Products"
              subtitle="Add sale products and opening stock"
              right={
                <div className="action-row">
                  <button className="btn-gray" onClick={addProductRows}>
                    + Add 5 Rows
                  </button>
                  <button className="btn-blue" onClick={handleSaveProducts}>
                    Save Products
                  </button>
                </div>
              }
            />

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Shop</th>
                    <th>Stock</th>
                    <th>Purchase ₹</th>
                    <th>Selling ₹</th>
                    <th>Min Stock</th>
                    <th>Remarks</th>
                  </tr>
                </thead>

                <tbody>
                  {productRows.map((row, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          value={row.item_name}
                          onChange={(e) =>
                            updateProductRow(index, "item_name", e.target.value)
                          }
                          placeholder="Product"
                        />
                      </td>
                      <td>
                        <select
                          value={row.category}
                          onChange={(e) =>
                            updateProductRow(index, "category", e.target.value)
                          }
                        >
                          <option value="">Category</option>
                          {categories.map((cat) => (
                            <option key={cat}>{cat}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={row.shop}
                          onChange={(e) =>
                            updateProductRow(index, "shop", e.target.value)
                          }
                        >
                          <option value="">Shop</option>
                          {shops.map((shop) => (
                            <option key={shop}>{shop}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.current_qty}
                          onChange={(e) =>
                            updateProductRow(index, "current_qty", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.purchase_cost}
                          onChange={(e) =>
                            updateProductRow(index, "purchase_cost", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.selling_price}
                          onChange={(e) =>
                            updateProductRow(index, "selling_price", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.min_stock}
                          onChange={(e) =>
                            updateProductRow(index, "min_stock", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={row.remarks}
                          onChange={(e) =>
                            updateProductRow(index, "remarks", e.target.value)
                          }
                          placeholder="Remarks"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="modern-card">
            <SectionHeader title="Current Sale Assets" subtitle="Existing sale products and stock" />

            <div className="filter-row">
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search product or category..."
              />
              <select value={productCategory} onChange={(e) => setProductCategory(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat}>{cat}</option>
                ))}
              </select>
              <select value={productShop} onChange={(e) => setProductShop(e.target.value)}>
                <option value="">All Shops</option>
                {shops.map((shop) => (
                  <option key={shop}>{shop}</option>
                ))}
              </select>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Shop</th>
                    <th>Stock</th>
                    <th>Purchase ₹</th>
                    <th>Selling ₹</th>
                    <th>Profit/Unit</th>
                    <th>Min</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredItems.map((item) => {
                    const profitPerUnit =
                      Number(item.selling_price || 0) -
                      Number(item.purchase_cost || 0);

                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.item_name}</strong>
                        </td>
                        <td>{item.category}</td>
                        <td>{item.shop}</td>
                        <td className="text-center strong">{Number(item.current_qty || 0)}</td>
                        <td className="text-right">₹{Number(item.purchase_cost || 0).toFixed(0)}</td>
                        <td className="text-right">₹{Number(item.selling_price || 0).toFixed(0)}</td>
                        <td
                          className="text-right strong"
                          style={{ color: profitPerUnit < 0 ? "#dc2626" : "#16a34a" }}
                        >
                          ₹{profitPerUnit.toFixed(0)}
                        </td>
                        <td className="text-center">{Number(item.min_stock || 0)}</td>
                        <td className="text-center">
                          <button className="icon-delete" onClick={() => handleDeleteProduct(item.id)}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={9}>No products found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeTab === "Sales Entry" && (
        <section className="modern-card">
          <SectionHeader
            title="New Sales Entry"
            subtitle="Stock will reduce automatically after saving"
            right={
              <div className="action-row">
                <button className="btn-gray" onClick={addSaleRows}>
                  + Add 5 Rows
                </button>
                <button className="btn-blue" onClick={handleSaveSales}>
                  Save Sales
                </button>
              </div>
            }
          />

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Shop</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Customer</th>
                  <th>Remarks</th>
                </tr>
              </thead>

              <tbody>
                {saleRows.map((row, index) => {
                  const item = getItemById(row.item_id);
                  const rate = row.selling_price || String(item?.selling_price || "");

                  return (
                    <tr key={index}>
                      <td>
                        <input
                          type="date"
                          value={row.sale_date}
                          onChange={(e) =>
                            updateSaleRow(index, "sale_date", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={row.item_id}
                          onChange={(e) => {
                            const selected = getItemById(e.target.value);
                            updateSaleRow(index, "item_id", e.target.value);
                            updateSaleRow(index, "shop", selected?.shop || "");
                            updateSaleRow(
                              index,
                              "selling_price",
                              String(selected?.selling_price || "")
                            );
                          }}
                        >
                          <option value="">Select Product</option>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.item_name} - {item.shop} - Stock {Number(item.current_qty || 0)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={row.shop}
                          onChange={(e) => updateSaleRow(index, "shop", e.target.value)}
                        >
                          <option value="">Shop</option>
                          {shops.map((shop) => (
                            <option key={shop}>{shop}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.qty}
                          onChange={(e) => updateSaleRow(index, "qty", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={rate}
                          onChange={(e) =>
                            updateSaleRow(index, "selling_price", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={row.customer_name}
                          onChange={(e) =>
                            updateSaleRow(index, "customer_name", e.target.value)
                          }
                          placeholder="Customer"
                        />
                      </td>
                      <td>
                        <input
                          value={row.remarks}
                          onChange={(e) => updateSaleRow(index, "remarks", e.target.value)}
                          placeholder="Remarks"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "Sales History" && (
        <section className="modern-card">
          <SectionHeader
            title="Sales History"
            subtitle="Search, filter and download sales history"
            right={
              <button className="btn-blue" onClick={downloadSalesCsv}>
                <Download size={16} /> Download
              </button>
            }
          />

          <div className="filter-row sales-filter">
            <input type="date" value={saleFromDate} onChange={(e) => setSaleFromDate(e.target.value)} />
            <input type="date" value={saleToDate} onChange={(e) => setSaleToDate(e.target.value)} />
            <select value={saleShop} onChange={(e) => setSaleShop(e.target.value)}>
              <option value="">All Shops</option>
              {shops.map((shop) => (
                <option key={shop}>{shop}</option>
              ))}
            </select>
            <input
              value={saleSearch}
              onChange={(e) => setSaleSearch(e.target.value)}
              placeholder="Search product, customer, remarks..."
            />
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Shop</th>
                  <th>Qty</th>
                  <th>Spent</th>
                  <th>Earned</th>
                  <th>Profit</th>
                  <th>Customer</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{sale.sale_date}</td>
                    <td>
                      <strong>{sale.item_name}</strong>
                    </td>
                    <td>{sale.shop}</td>
                    <td className="text-center">{sale.qty}</td>
                    <td className="text-right red">₹{Number(sale.total_cost || 0).toFixed(0)}</td>
                    <td className="text-right strong">₹{Number(sale.total_sale || 0).toFixed(0)}</td>
                    <td
                      className="text-right strong"
                      style={{ color: Number(sale.profit || 0) < 0 ? "#dc2626" : "#16a34a" }}
                    >
                      ₹{Number(sale.profit || 0).toFixed(0)}
                    </td>
                    <td>{sale.customer_name}</td>
                    <td className="text-center">
                      <button className="icon-delete" onClick={() => handleDeleteSale(sale.id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={9}>No sales found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "Low Stock" && (
        <section className="modern-card">
          <SectionHeader
            title="Low Stock Items"
            subtitle="Items where current stock is less than or equal to minimum stock"
          />

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Shop</th>
                  <th>Current Stock</th>
                  <th>Minimum Stock</th>
                  <th>Required Qty</th>
                </tr>
              </thead>

              <tbody>
                {lowStockItems.map((item) => {
                  const current = Number(item.current_qty || 0);
                  const min = Number(item.min_stock || 0);
                  const required = Math.max(0, min - current);

                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.item_name}</strong>
                      </td>
                      <td>{item.shop}</td>
                      <td className="text-center red strong">{current}</td>
                      <td className="text-center">{min}</td>
                      <td className="text-center strong" style={{ color: "#f97316" }}>
                        {required}
                      </td>
                    </tr>
                  );
                })}

                {lowStockItems.length === 0 && (
                  <tr>
                    <td colSpan={5}>No low stock items</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

function SalesKpi({ title, value, icon: Icon, color, bg }: any) {
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

function SectionHeader({ title, subtitle, right }: any) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}