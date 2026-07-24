import "server-only";

import {
  buildRecoveryWorkbook,
  RECOVERY_FILE_NAME,
  RECOVERY_TABLES,
  type RecoveryPayload,
} from "@/lib/recoveryWorkbook";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const PAGE_SIZE = 1000;

export interface CurrentRecoverySnapshot {
  data: RecoveryPayload;
  workbook: Uint8Array;
  totalRows: number;
  createdAt: string;
  fileName: string;
}

export async function fetchAllRows(
  table: string,
): Promise<Record<string, unknown>[]> {
  const supabase = getSupabaseAdmin();
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(
        `Could not read ${table}: ${error.message}`,
      );
    }

    const page = (data || []) as Record<string, unknown>[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

export async function fetchRecoveryPayload(): Promise<RecoveryPayload> {
  const data: RecoveryPayload = {};

  for (const spec of RECOVERY_TABLES) {
    data[spec.table] = await fetchAllRows(spec.table);
  }

  return data;
}

export async function buildCurrentRecoverySnapshot(): Promise<CurrentRecoverySnapshot> {
  const createdAt = new Date().toISOString();
  const data = await fetchRecoveryPayload();
  const totalRows = Object.values(data).reduce(
    (sum, rows) => sum + rows.length,
    0,
  );

  return {
    data,
    workbook: buildRecoveryWorkbook(data, createdAt),
    totalRows,
    createdAt,
    fileName: RECOVERY_FILE_NAME,
  };
}

export function workbookResponseBody(
  workbook: Uint8Array,
): ArrayBuffer {
  return workbook.buffer.slice(
    workbook.byteOffset,
    workbook.byteOffset + workbook.byteLength,
  ) as ArrayBuffer;
}

export async function recordBackupAudit(input: {
  backupType: string;
  status: string;
  fileName?: string;
  driveFileId?: string | null;
  rowCount?: number;
  details?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("tt_backup_audit")
    .insert({
      backup_type: input.backupType,
      status: input.status,
      file_name: input.fileName || RECOVERY_FILE_NAME,
      drive_file_id: input.driveFileId || null,
      row_count: Number(input.rowCount || 0),
      details: input.details || {},
    });

  if (error) {
    console.error(
      "Backup audit could not be saved:",
      error.message,
    );
  }
}
