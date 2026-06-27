"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ExpenseRow = {
  id: string;
  expense_date: string;
  shop: string;
  category: string;
  description: string;
  amount: number;
  payment_mode: string;
  remarks: string;
};

type EntryRow = {
  expense_date: string;
  shop: string;
  category: string;
  description: string;
  amount: string;
  payment_mode: string;
  remarks: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const shops = [
    "Karuvannur",
    "Ollur",
    "Kachery",
    "Mulayam Rd",
    "Pattikkad",
    "Purchase",
    "Other",
  ];

const categories = [
  "Fuel",
  "Salary",
  "Rent",
  "Electricity",
  "Vehicle",
  "Service",
  "Purchase",
  "Food",
  "Other",
];

const paymentModes = ["Cash", "GPay", "Bank", "Card", "Other"];

const emptyRow = (): EntryRow => ({
  expense_date: today(),
  shop: "",
  category: "",
  description: "",
  amount: "",
  payment_mode: "Cash",
  remarks: "",
});

export default function ExpensesPage() {
  const [rows, setRows] = useState<EntryRow[]>(
    Array.from({ length: 5 }, emptyRow)
  );
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false });

    setExpenses(data || []);
  }

  function updateRow(index: number, field: keyof EntryRow, value: string) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function addFiveRows() {
    setRows((prev) => [...prev, ...Array.from({ length: 5 }, emptyRow)]);
  }

  async function saveExpenses() {
    const filledRows = rows.filter(
      (row) => row.shop && row.category && Number(row.amount || 0) > 0
    );

    if (filledRows.length === 0) {
      alert("Please enter at least one expense");
      return;
    }

    const insertRows = filledRows.map((row) => ({
      expense_date: row.expense_date,
      shop: row.shop,
      category: row.category,
      description: row.description,
      amount: Number(row.amount || 0),
      payment_mode: row.payment_mode,
      remarks: row.remarks,
    }));

    const { error } = await supabase.from("expenses").insert(insertRows);

    if (error) {
      alert(error.message);
      return;
    }

    setRows(Array.from({ length: 5 }, emptyRow));
    await loadExpenses();
  }

  async function deleteExpense(id: string) {
    const ok = confirm("Delete this expense?");
    if (!ok) return;

    const { error } = await supabase.from("expenses").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadExpenses();
  }

  const total = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <div className="p-6 space-y-8 bg-slate-100 min-h-screen">
      <h1 className="text-3xl font-bold text-slate-900">Expenses</h1>

      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">New Expenses</h2>

          <button
            onClick={addFiveRows}
            className="bg-slate-800 text-white px-4 py-2 rounded font-bold"
          >
            + Add 5 Rows
          </button>
        </div>

        <div className="overflow-auto">
          <table className="w-full border text-sm">
            <thead className="bg-blue-900 text-white">
              <tr>
                <th className="p-2 border">Date</th>
                <th className="p-2 border">Shop</th>
                <th className="p-2 border">Category</th>
                <th className="p-2 border">Description</th>
                <th className="p-2 border">Amount</th>
                <th className="p-2 border">Mode</th>
                <th className="p-2 border">Remarks</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td className="p-1 border">
                    <input
                      type="date"
                      value={row.expense_date}
                      onChange={(e) =>
                        updateRow(index, "expense_date", e.target.value)
                      }
                      className="border p-2 rounded w-full"
                    />
                  </td>

                  <td className="p-1 border min-w-[150px]">
                    <select
                      value={row.shop}
                      onChange={(e) => updateRow(index, "shop", e.target.value)}
                      className="border p-2 rounded w-full"
                    >
                      <option value="">Shop</option>
                      {shops.map((shop) => (
                        <option key={shop} value={shop}>
                          {shop}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="p-1 border min-w-[150px]">
                    <select
                      value={row.category}
                      onChange={(e) =>
                        updateRow(index, "category", e.target.value)
                      }
                      className="border p-2 rounded w-full"
                    >
                      <option value="">Category</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="p-1 border min-w-[220px]">
                    <input
                      value={row.description}
                      onChange={(e) =>
                        updateRow(index, "description", e.target.value)
                      }
                      className="border p-2 rounded w-full"
                      placeholder="Description"
                    />
                  </td>

                  <td className="p-1 border w-[120px]">
                    <input
                      type="number"
                      value={row.amount}
                      onChange={(e) =>
                        updateRow(index, "amount", e.target.value)
                      }
                      className="border p-2 rounded w-full text-right"
                      placeholder="0"
                    />
                  </td>

                  <td className="p-1 border min-w-[120px]">
                    <select
                      value={row.payment_mode}
                      onChange={(e) =>
                        updateRow(index, "payment_mode", e.target.value)
                      }
                      className="border p-2 rounded w-full"
                    >
                      {paymentModes.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="p-1 border min-w-[180px]">
                    <input
                      value={row.remarks}
                      onChange={(e) =>
                        updateRow(index, "remarks", e.target.value)
                      }
                      className="border p-2 rounded w-full"
                      placeholder="Remarks"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={saveExpenses}
          className="mt-4 bg-blue-700 text-white px-6 py-2 rounded font-bold"
        >
          Save Expenses
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-bold">Expense History</h2>
          <div className="text-xl font-bold text-red-700">
            Total: ₹{total.toFixed(2)}
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full border text-sm">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="p-2 border">Date</th>
                <th className="p-2 border">Shop</th>
                <th className="p-2 border">Category</th>
                <th className="p-2 border">Description</th>
                <th className="p-2 border">Mode</th>
                <th className="p-2 border">Amount</th>
                <th className="p-2 border">Remarks</th>
                <th className="p-2 border">Action</th>
              </tr>
            </thead>

            <tbody>
              {expenses.map((item) => (
                <tr key={item.id}>
                  <td className="p-2 border">{item.expense_date}</td>
                  <td className="p-2 border">{item.shop}</td>
                  <td className="p-2 border">{item.category}</td>
                  <td className="p-2 border">{item.description}</td>
                  <td className="p-2 border">{item.payment_mode}</td>
                  <td className="p-2 border text-right font-bold">
                    ₹{Number(item.amount || 0).toFixed(2)}
                  </td>
                  <td className="p-2 border">{item.remarks}</td>
                  <td className="p-2 border text-center">
                    <button
                      onClick={() => deleteExpense(item.id)}
                      className="bg-red-700 text-white px-3 py-1 rounded font-bold"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {expenses.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-slate-500" colSpan={8}>
                    No expenses added yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}