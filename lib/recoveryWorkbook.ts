import "server-only";

import { createHash } from "node:crypto";
import * as XLSX from "xlsx";

export const RECOVERY_FORMAT = "TT_TOOLS_RECOVERY_V2";
export const RECOVERY_FILE_NAME = "TT-Tools-Latest-Recovery.xlsx";

const NULL_CELL = "__TT_NULL__";
const JSON_CELL_PREFIX = "__TT_JSON__:";
const STRING_CELL_PREFIX = "__TT_STRING__:";

export interface RecoveryTableSpec {
  table: string;
  sheet: string;
  columns: string[];
}

export interface RecoveryTableInspection {
  table: string;
  sheet: string;
  rows: number;
  expectedRows: number | null;
  checksum: string;
  expectedChecksum: string;
  valid: boolean;
  errors: string[];
}

export interface RecoveryInspection {
  valid: boolean;
  format: string;
  createdAt: string;
  appName: string;
  totalRows: number;
  tables: RecoveryTableInspection[];
  errors: string[];
}

export type RecoveryPayload = Record<
  string,
  Record<string, unknown>[]
>;

export const RECOVERY_TABLES: RecoveryTableSpec[] = [
  {
    "table": "branches",
    "sheet": "Branches",
    "columns": [
      "id",
      "name",
      "created_at"
    ]
  },
  {
    "table": "customer_arrears",
    "sheet": "Customer Arrears",
    "columns": [
      "id",
      "customer_id",
      "customer_name",
      "mobile",
      "shop",
      "arrears_amount",
      "moved_date",
      "moved_year",
      "reason",
      "remarks",
      "created_at"
    ]
  },
  {
    "table": "customers",
    "sheet": "Customers",
    "columns": [
      "id",
      "customer_name",
      "mobile",
      "address",
      "branch",
      "created_at",
      "notes",
      "shop",
      "occupation",
      "is_active",
      "rating"
    ]
  },
  {
    "table": "expenses",
    "sheet": "Expenses",
    "columns": [
      "id",
      "expense_date",
      "shop",
      "category",
      "description",
      "amount",
      "payment_mode",
      "remarks",
      "created_at"
    ]
  },
  {
    "table": "movements",
    "sheet": "Movements",
    "columns": [
      "id",
      "tool_id",
      "from_location",
      "to_location",
      "qty",
      "movement_date",
      "remarks",
      "created_at",
      "reason"
    ]
  },
  {
    "table": "payments",
    "sheet": "Payments",
    "columns": [
      "id",
      "customer_id",
      "payment_date",
      "amount",
      "payment_mode",
      "remarks",
      "created_at",
      "shop",
      "customer_name",
      "mobile",
      "discount",
      "mode",
      "rental_id",
      "entry_type",
      "effective_date",
      "opening_balance_type"
    ]
  },
  {
    "table": "rental_edit_history",
    "sheet": "Rental Edit History",
    "columns": [
      "id",
      "rental_id",
      "previous_values",
      "updated_values",
      "edit_reason",
      "explanation",
      "edited_by",
      "edited_at"
    ]
  },
  {
    "table": "rentals",
    "sheet": "Rentals",
    "columns": [
      "id",
      "customer_id",
      "tool_id",
      "qty",
      "start_date",
      "end_date",
      "status",
      "daily_rate",
      "discount",
      "total_amount",
      "payment_status",
      "created_at",
      "shop",
      "avoid_sundays",
      "mobile",
      "is_outside_rent",
      "outside_item_name",
      "outside_shop_name",
      "is_transport_charge",
      "transport_vehicle_type",
      "transport_trip_type",
      "transport_location",
      "transport_amount",
      "transport_date",
      "transport_notes"
    ]
  },
  {
    "table": "sale_entries",
    "sheet": "Sale Entries",
    "columns": [
      "id",
      "sale_date",
      "item_id",
      "item_name",
      "shop",
      "qty",
      "purchase_cost",
      "selling_price",
      "total_cost",
      "total_sale",
      "profit",
      "customer_name",
      "remarks",
      "created_at"
    ]
  },
  {
    "table": "sale_items",
    "sheet": "Sale Items",
    "columns": [
      "id",
      "item_name",
      "shop",
      "opening_qty",
      "current_qty",
      "purchase_cost",
      "selling_price",
      "category",
      "remarks",
      "created_at",
      "min_stock"
    ]
  },
  {
    "table": "service_centres",
    "sheet": "Service Centres",
    "columns": [
      "id",
      "name",
      "created_at"
    ]
  },
  {
    "table": "services",
    "sheet": "Services",
    "columns": [
      "id",
      "tool_id",
      "service_centre",
      "complaint",
      "work_done",
      "cost",
      "date_out",
      "date_in",
      "status",
      "remarks",
      "created_at",
      "service_type",
      "from_branch",
      "return_branch",
      "request_remarks",
      "return_remarks",
      "service_types",
      "amount",
      "service_no",
      "tool_name",
      "qty",
      "out_date",
      "return_date"
    ]
  },
  {
    "table": "shop_cash_received",
    "sheet": "Shop Cash Received",
    "columns": [
      "id",
      "received_date",
      "shop",
      "received_from",
      "amount",
      "mode",
      "remarks",
      "created_at"
    ]
  },
  {
    "table": "tools",
    "sheet": "Tools",
    "columns": [
      "id",
      "tool_name",
      "home_branch",
      "current_location",
      "total_qty",
      "daily_rent",
      "created_at",
      "category",
      "brand",
      "color",
      "status",
      "purchase_date",
      "purchase_cost",
      "warranty_till",
      "notes",
      "service_status",
      "last_service_date",
      "service_reminder_1_days",
      "service_reminder_2_days",
      "rental_overdue_days",
      "greasing_due_days",
      "oil_change_due_days",
      "scheduled_service_due_days",
      "last_greasing_date",
      "last_oil_change_date",
      "last_scheduled_service_date",
      "last_breakdown_date"
    ]
  },
  {
    "table": "archived_business_monthly",
    "sheet": "Archived Business",
    "columns": [
      "id",
      "customer_id",
      "customer_name",
      "mobile",
      "shop",
      "month_start",
      "rental_business",
      "payments_received",
      "round_off",
      "opening_due",
      "opening_credit",
      "rental_count",
      "payment_count",
      "first_activity",
      "last_activity",
      "archived_at",
      "last_archive_run_id"
    ]
  },
  {
    "table": "archived_tool_monthly",
    "sheet": "Archived Tool History",
    "columns": [
      "id",
      "tool_id",
      "tool_name",
      "shop",
      "month_start",
      "movement_count",
      "service_count",
      "service_cost",
      "first_activity",
      "last_activity",
      "archived_at",
      "last_archive_run_id"
    ]
  },
  {
    "table": "archived_shop_monthly",
    "sheet": "Archived Shop Totals",
    "columns": [
      "id",
      "shop",
      "month_start",
      "expense_total",
      "expense_count",
      "sales_revenue",
      "sales_cost",
      "sales_profit",
      "sale_count",
      "shop_cash_received",
      "cash_entry_count",
      "first_activity",
      "last_activity",
      "archived_at",
      "last_archive_run_id"
    ]
  }
];

function stableJson(value: unknown): string {
  if (value === null || value === undefined) return "null";

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const keys = Object.keys(source).sort();

    return `{${keys
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableJson(source[key])}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function encodeCell(
  value: unknown,
): string | number | boolean {
  if (value === null || value === undefined) return NULL_CELL;

  if (typeof value === "object") {
    return `${JSON_CELL_PREFIX}${stableJson(value)}`;
  }

  if (typeof value === "string") {
    return value.startsWith("__TT_")
      ? `${STRING_CELL_PREFIX}${value}`
      : value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return String(value);
}

function decodeCell(value: unknown): unknown {
  if (value === NULL_CELL) return null;

  if (
    typeof value === "string" &&
    value.startsWith(JSON_CELL_PREFIX)
  ) {
    return JSON.parse(value.slice(JSON_CELL_PREFIX.length));
  }

  if (
    typeof value === "string" &&
    value.startsWith(STRING_CELL_PREFIX)
  ) {
    return value.slice(STRING_CELL_PREFIX.length);
  }

  return value;
}

function normaliseChecksumCell(value: unknown): string {
  if (value === null || value === undefined) return "empty:";

  if (typeof value === "number") {
    return `number:${
      Number.isFinite(value) ? value : String(value)
    }`;
  }

  if (typeof value === "boolean") {
    return `boolean:${value ? "true" : "false"}`;
  }

  return `string:${String(value)}`;
}

function checksumMatrix(matrix: unknown[][]): string {
  const canonical = matrix
    .map((row) =>
      row.map(normaliseChecksumCell).join("\u001f"),
    )
    .join("\u001e");

  return createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex");
}

function rowsToMatrix(
  spec: RecoveryTableSpec,
  rows: Record<string, unknown>[],
): Array<Array<string | number | boolean>> {
  return [
    spec.columns,
    ...rows.map((row) =>
      spec.columns.map((column) =>
        encodeCell(row[column]),
      ),
    ),
  ];
}

function addWorksheet(
  workbook: XLSX.WorkBook,
  name: string,
  matrix: unknown[][],
  widths?: number[],
): void {
  const worksheet = XLSX.utils.aoa_to_sheet(matrix);

  if (widths) {
    worksheet["!cols"] = widths.map((wch) => ({ wch }));
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, name);
}

export function buildRecoveryWorkbook(
  data: RecoveryPayload,
  createdAt = new Date().toISOString(),
): Uint8Array {
  const workbook = XLSX.utils.book_new();

  const tableMatrices = RECOVERY_TABLES.map((spec) => {
    const rows = data[spec.table] || [];
    const matrix = rowsToMatrix(spec, rows);

    return {
      spec,
      rows,
      matrix,
      checksum: checksumMatrix(matrix),
    };
  });

  const totalRows = tableMatrices.reduce(
    (sum, item) => sum + item.rows.length,
    0,
  );

  addWorksheet(
    workbook,
    "Backup Information",
    [
      ["Field", "Value"],
      ["Recovery Format", RECOVERY_FORMAT],
      ["App Name", "T&T Tools Manager"],
      ["Created At", createdAt],
      ["File Name", RECOVERY_FILE_NAME],
      ["Tables Included", RECOVERY_TABLES.length],
      ["Total Data Rows", totalRows],
      ["Backup Type", "Complete current Supabase snapshot"],
      [
        "Archive Rule",
        "Full current/unpaid records plus compact old summaries",
      ],
      [
        "Restore Safety",
        "Transactional restore through tt_restore_snapshot",
      ],
    ],
    [31, 72],
  );

  addWorksheet(
    workbook,
    "Restore Verification",
    [
      ["Table", "Sheet", "Rows", "SHA256 Checksum"],
      ...tableMatrices.map((item) => [
        item.spec.table,
        item.spec.sheet,
        item.rows.length,
        item.checksum,
      ]),
      ["TOTAL", "", totalRows, ""],
    ],
    [30, 30, 14, 70],
  );

  for (const item of tableMatrices) {
    addWorksheet(
      workbook,
      item.spec.sheet,
      item.matrix,
      item.spec.columns.map((column) =>
        Math.min(Math.max(column.length + 3, 14), 36),
      ),
    );
  }

  const output = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
    compression: true,
  });

  return new Uint8Array(output);
}

function sheetMatrix(
  workbook: XLSX.WorkBook,
  sheetName: string,
): unknown[][] {
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) return [];

  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
}

function informationMap(
  matrix: unknown[][],
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const row of matrix.slice(1)) {
    const key = String(row?.[0] ?? "").trim();

    if (key) result[key] = String(row?.[1] ?? "");
  }

  return result;
}

function verificationMap(
  matrix: unknown[][],
): Record<string, { rows: number; checksum: string }> {
  const result: Record<
    string,
    { rows: number; checksum: string }
  > = {};

  for (const row of matrix.slice(1)) {
    const table = String(row?.[0] ?? "").trim();

    if (!table || table === "TOTAL") continue;

    result[table] = {
      rows: Number(row?.[2] ?? 0),
      checksum: String(row?.[3] ?? ""),
    };
  }

  return result;
}

function readWorkbook(
  bytes: ArrayBuffer | Uint8Array,
): XLSX.WorkBook {
  return XLSX.read(bytes, {
    type: "array",
    cellDates: false,
  });
}

function inspectWorkbook(
  workbook: XLSX.WorkBook,
): RecoveryInspection {
  const errors: string[] = [];
  const information = informationMap(
    sheetMatrix(workbook, "Backup Information"),
  );
  const format = information["Recovery Format"] || "";
  const createdAt = information["Created At"] || "";
  const appName = information["App Name"] || "";

  if (format !== RECOVERY_FORMAT) {
    errors.push(
      `Unsupported recovery format. Expected ${RECOVERY_FORMAT}.`,
    );
  }

  const expectedVerification = verificationMap(
    sheetMatrix(workbook, "Restore Verification"),
  );

  const tables = RECOVERY_TABLES.map((spec) => {
    const tableErrors: string[] = [];
    const matrix = sheetMatrix(workbook, spec.sheet);

    if (matrix.length === 0) {
      tableErrors.push(`Missing worksheet: ${spec.sheet}.`);

      return {
        table: spec.table,
        sheet: spec.sheet,
        rows: 0,
        expectedRows:
          expectedVerification[spec.table]?.rows ?? null,
        checksum: "",
        expectedChecksum:
          expectedVerification[spec.table]?.checksum || "",
        valid: false,
        errors: tableErrors,
      };
    }

    const header = (matrix[0] || []).map((value) =>
      String(value ?? "").trim(),
    );

    if (
      header.length !== spec.columns.length ||
      spec.columns.some(
        (column, index) => header[index] !== column,
      )
    ) {
      tableErrors.push(
        `Column structure does not match ${spec.table}.`,
      );
    }

    const rows = Math.max(matrix.length - 1, 0);
    const checksum = checksumMatrix(matrix);
    const expected = expectedVerification[spec.table];

    if (!expected) {
      tableErrors.push(
        `Verification entry is missing for ${spec.table}.`,
      );
    } else {
      if (rows !== expected.rows) {
        tableErrors.push(
          `Row count mismatch: expected ${expected.rows}, found ${rows}.`,
        );
      }

      if (checksum !== expected.checksum) {
        tableErrors.push("Checksum mismatch.");
      }
    }

    return {
      table: spec.table,
      sheet: spec.sheet,
      rows,
      expectedRows: expected?.rows ?? null,
      checksum,
      expectedChecksum: expected?.checksum || "",
      valid: tableErrors.length === 0,
      errors: tableErrors,
    };
  });

  for (const table of tables) {
    errors.push(
      ...table.errors.map(
        (error) => `${table.table}: ${error}`,
      ),
    );
  }

  const totalRows = tables.reduce(
    (sum, table) => sum + table.rows,
    0,
  );
  const expectedTotal = Number(
    information["Total Data Rows"] || 0,
  );

  if (
    Number.isFinite(expectedTotal) &&
    expectedTotal !== totalRows
  ) {
    errors.push(
      `Workbook total row count mismatch: expected ${expectedTotal}, found ${totalRows}.`,
    );
  }

  return {
    valid: errors.length === 0,
    format,
    createdAt,
    appName,
    totalRows,
    tables,
    errors,
  };
}

export function inspectRecoveryWorkbook(
  bytes: ArrayBuffer | Uint8Array,
): RecoveryInspection {
  return inspectWorkbook(readWorkbook(bytes));
}

export function extractRecoveryPayload(
  bytes: ArrayBuffer | Uint8Array,
): {
  inspection: RecoveryInspection;
  payload: RecoveryPayload;
} {
  const workbook = readWorkbook(bytes);
  const inspection = inspectWorkbook(workbook);

  if (!inspection.valid) {
    throw new Error(
      inspection.errors[0] ||
        "The recovery workbook is not valid.",
    );
  }

  const payload: RecoveryPayload = {};

  for (const spec of RECOVERY_TABLES) {
    const matrix = sheetMatrix(workbook, spec.sheet);
    const rows = matrix.slice(1);

    payload[spec.table] = rows
      .filter((row) =>
        row.some(
          (value) =>
            value !== "" &&
            value !== null &&
            value !== undefined,
        ),
      )
      .map((row) => {
        const record: Record<string, unknown> = {};

        spec.columns.forEach((column, index) => {
          record[column] = decodeCell(row[index]);
        });

        return record;
      });
  }

  return { inspection, payload };
}
