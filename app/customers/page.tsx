"use client";

import { useEffect, useState } from "react";
import {
  getCustomers,
  saveCustomer,
  updateCustomer,
  deleteCustomer,
} from "../actions";
import { useAppMessage } from "../contexts/AppMessageProvider";

const branches = ["Karuvannur", "Ollur", "Kachery", "Mulayam Rd", "Pattikkad"];

const emptyCustomer = {
  customer_name: "",
  mobile: "",
  occupation: "",
  address: "",
  shop: "",
  notes: "",
};

export default function CustomersPage() {
  const { setAppMessage } = useAppMessage();

  const [customer, setCustomer] = useState<any>({ ...emptyCustomer });
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<any>({});
  const [loading, setLoading] = useState(false);

  function showError(message: string) {
    setAppMessage({ type: "error", title: "Error", message });
  }

  function showSuccess(message: string) {
    setAppMessage({ type: "success", title: "Success", message });
  }

  function showWarning(message: string) {
    setAppMessage({ type: "warning", title: "Warning", message });
  }

  function getCustomerId(row: any) {
    return row.customer_id ?? row.id;
  }

  async function loadCustomers(value = search) {
    const res = await getCustomers(value);

    if (res.success) {
      setCustomers(res.data || []);
    } else {
      showError(res.message || "Failed to load customers");
      console.log(res.message);
    }
  }

  useEffect(() => {
    loadCustomers("");
  }, []);

  function changeCustomer(field: string, value: string) {
    setCustomer({
      ...customer,
      [field]: value,
    });
  }

  async function handleSave() {
    if (!customer.customer_name || !customer.mobile) {
      showWarning("Please enter customer name and mobile number");
      return;
    }

    setLoading(true);
    const res = await saveCustomer(customer);
    setLoading(false);

    if (!res.success) {
      showError(res.message || "Failed to save customer");
      return;
    }

    showSuccess(res.message || "Customer saved successfully");
    setCustomer({ ...emptyCustomer });
    await loadCustomers("");
  }

  async function handleSearch(value: string) {
    setSearch(value);
    await loadCustomers(value);
  }

  function startEdit(row: any) {
    setEditingId(getCustomerId(row));
    setEditRow({ ...row });
  }

  async function saveEdit() {
    if (!editingId) return;

    const res = await updateCustomer(editingId, editRow);

    if (!res.success) {
      showError(res.message || "Failed to update customer");
      return;
    }

    showSuccess(res.message || "Customer updated successfully");
    setEditingId(null);
    setEditRow({});
    await loadCustomers(search);
  }

  async function handleDelete(id: number) {
    const res = await deleteCustomer(id);

    if (!res.success) {
      showError(res.message || "Failed to delete customer");
      return;
    }

    showSuccess(res.message || "Customer deleted successfully");
    await loadCustomers(search);
  }

  return (
    <main>
      <h1>Customers</h1>

      <div className="panel">
        <h2>Add Customer</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 1fr 1fr 2fr 1fr 1.5fr",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <input
            placeholder="Customer Name"
            value={customer.customer_name}
            onChange={(e) => changeCustomer("customer_name", e.target.value)}
          />

          <input
            placeholder="Mobile Number"
            value={customer.mobile}
            onChange={(e) => changeCustomer("mobile", e.target.value)}
          />

          <input
            placeholder="Occupation"
            value={customer.occupation}
            onChange={(e) => changeCustomer("occupation", e.target.value)}
          />

          <input
            placeholder="Address"
            value={customer.address}
            onChange={(e) => changeCustomer("address", e.target.value)}
          />

          <select
            value={customer.shop}
            onChange={(e) => changeCustomer("shop", e.target.value)}
          >
            <option value="">Select Shop</option>
            {branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>

          <input
            placeholder="Notes"
            value={customer.notes}
            onChange={(e) => changeCustomer("notes", e.target.value)}
          />
        </div>

        <button className="btn-blue" onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save Customer"}
        </button>
      </div>

      <div className="panel">
        <h2>Customers List</h2>

        <input
          placeholder="Search customer, mobile, address, shop..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ width: 420, marginBottom: 14 }}
        />

        <table>
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Mobile</th>
              <th>Occupation</th>
              <th>Address</th>
              <th>Shop</th>
              <th>Rental Total</th>
              <th>Received</th>
              <th>Balance</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {customers.map((row, index) => {
              const customerId = getCustomerId(row);

              return (
                <tr
                  key={
                    customerId ??
                    row.mobile ??
                    `${row.customer_name || "customer"}-${index}`
                  }
                >
                  {editingId === customerId ? (
                    <>
                      <td>
                        <input
                          value={editRow.customer_name || ""}
                          onChange={(e) =>
                            setEditRow({
                              ...editRow,
                              customer_name: e.target.value,
                            })
                          }
                        />
                      </td>

                      <td>
                        <input
                          value={editRow.mobile || ""}
                          onChange={(e) =>
                            setEditRow({
                              ...editRow,
                              mobile: e.target.value,
                            })
                          }
                        />
                      </td>

                      <td>
                        <input
                          value={editRow.occupation || ""}
                          onChange={(e) =>
                            setEditRow({
                              ...editRow,
                              occupation: e.target.value,
                            })
                          }
                        />
                      </td>

                      <td>
                        <input
                          value={editRow.address || ""}
                          onChange={(e) =>
                            setEditRow({
                              ...editRow,
                              address: e.target.value,
                            })
                          }
                        />
                      </td>

                      <td>
                        <select
                          value={editRow.shop || ""}
                          onChange={(e) =>
                            setEditRow({
                              ...editRow,
                              shop: e.target.value,
                            })
                          }
                        >
                          <option value="">Select Shop</option>
                          {branches.map((branch) => (
                            <option key={branch} value={branch}>
                              {branch}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <strong>
                          ₹{Number(editRow.rental_total || 0).toFixed(0)}
                        </strong>
                      </td>

                      <td style={{ color: "#16a34a", fontWeight: 700 }}>
                        ₹{Number(editRow.received_total || 0).toFixed(0)}
                      </td>

                      <td
                        style={{
                          color:
                            Number(editRow.balance || 0) > 0
                              ? "#dc2626"
                              : "#16a34a",
                          fontWeight: 800,
                        }}
                      >
                        ₹{Number(editRow.balance || 0).toFixed(0)}
                      </td>

                      <td>
                        <input
                          value={editRow.notes || ""}
                          onChange={(e) =>
                            setEditRow({
                              ...editRow,
                              notes: e.target.value,
                            })
                          }
                        />
                      </td>

                      <td>
                        <button className="btn-green" onClick={saveEdit}>
                          Save
                        </button>

                        <button
                          className="btn-gray"
                          style={{ marginLeft: 6 }}
                          onClick={() => {
                            setEditingId(null);
                            setEditRow({});
                          }}
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{row.customer_name}</td>
                      <td>{row.mobile}</td>
                      <td>{row.occupation}</td>
                      <td>{row.address}</td>
                      <td>{row.shop}</td>

                      <td>
                        <strong>
                          ₹{Number(row.rental_total || 0).toFixed(0)}
                        </strong>
                      </td>

                      <td style={{ color: "#16a34a", fontWeight: 700 }}>
                        ₹{Number(row.received_total || 0).toFixed(0)}
                      </td>

                      <td
                        style={{
                          color:
                            Number(row.balance || 0) > 0
                              ? "#dc2626"
                              : "#16a34a",
                          fontWeight: 800,
                        }}
                      >
                        ₹{Number(row.balance || 0).toFixed(0)}
                      </td>

                      <td>{row.notes}</td>

                      <td>
                        <button
                          className="btn-blue"
                          onClick={() => startEdit(row)}
                        >
                          Edit
                        </button>

                        <button
                          className="btn-red"
                          style={{ marginLeft: 6 }}
                          onClick={() => handleDelete(customerId)}
                          disabled={!customerId}
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}

            {customers.length === 0 && (
              <tr key="no-customers">
                <td colSpan={10}>No customers found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}