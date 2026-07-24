import {
  recoveryAuthorizationError,
} from "@/lib/recoveryAuth";
import {
  buildCurrentRecoverySnapshot,
  recordBackupAudit,
} from "@/lib/recoveryData";
import {
  getGoogleDriveStatus,
  uploadWorkbookToDrive,
} from "@/lib/googleDriveBackup";
import {
  extractRecoveryPayload,
} from "@/lib/recoveryWorkbook";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const RESTORE_PHRASE = "RESTORE ALL DATA";

export async function POST(request: Request) {
  const authError =
    recoveryAuthorizationError(request);

  if (authError) {
    return Response.json(
      { error: authError },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const selected = formData.get("file");
    const confirmation = String(
      formData.get("confirmation") || "",
    ).trim();

    if (confirmation !== RESTORE_PHRASE) {
      return Response.json(
        {
          error:
            `Type ${RESTORE_PHRASE} exactly to restore.`,
        },
        { status: 400 },
      );
    }

    if (!selected || typeof selected === "string") {
      return Response.json(
        { error: "Select the verified recovery file." },
        { status: 400 },
      );
    }

    const file = selected as File;

    if (
      !file.name.toLowerCase().endsWith(".xlsx") ||
      file.size > MAX_FILE_SIZE
    ) {
      return Response.json(
        {
          error:
            "Select a valid recovery .xlsx file under 25 MB.",
        },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const { inspection, payload } =
      extractRecoveryPayload(bytes);

    const current =
      await buildCurrentRecoverySnapshot();

    if (current.totalRows > 0) {
      const driveStatus =
        await getGoogleDriveStatus();

      if (!driveStatus.connected) {
        return Response.json(
          {
            error:
              "The current database is not empty. Connect Google Drive before replacing it so a safety copy can be stored first.",
          },
          { status: 400 },
        );
      }

      await uploadWorkbookToDrive({
        workbook: current.workbook,
        totalRows: current.totalRows,
        createdAt: current.createdAt,
        backupType: "pre_restore_safety",
      });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc(
      "tt_restore_snapshot",
      {
        snapshot: payload,
        confirmation_phrase: RESTORE_PHRASE,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    await recordBackupAudit({
      backupType: "excel_restore",
      status: "restore_completed",
      fileName: file.name,
      rowCount: inspection.totalRows,
      details: {
        workbookCreatedAt: inspection.createdAt,
        result: data,
      },
    });

    return Response.json({
      success: true,
      result: data,
      message:
        "Recovery file restored successfully. Reload the app.",
    });
  } catch (error) {
    console.error("Recovery restore failed:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Recovery restore failed.",
      },
      { status: 500 },
    );
  }
}
