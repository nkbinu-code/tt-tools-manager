export type StatementType = "rent" | "payment" | "combined";
export type StatementPeriod = "all" | "thisMonth" | "lastMonth" | "custom";

export function formatMoney(value: any) {
  return `₹${Number(value || 0).toFixed(0)}`;
}

export function formatDate(date: any) {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString("en-GB");
}

export function getStatementTitle(type: StatementType) {
  if (type === "rent") return "വാടക വിവരങ്ങൾ";
  if (type === "payment") return "പേയ്മെന്റ് വിവരങ്ങൾ";
  return "വാടക-പേയ്മെന്റ് വിവരങ്ങൾ";
}

export function getDateRange(period: StatementPeriod, fromDate: string, toDate: string) {
  const now = new Date();

  if (period === "thisMonth") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  }

  if (period === "lastMonth") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  }

  if (period === "custom") {
    return { from: fromDate, to: toDate };
  }

  return { from: "", to: "" };
}

export function isWithinRange(date: any, from: string, to: string) {
  const d = String(date || "").slice(0, 10);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}