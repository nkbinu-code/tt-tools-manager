import {
  recoveryAuthorizationError,
} from "@/lib/recoveryAuth";
import {
  recordBackupAudit,
} from "@/lib/recoveryData";
import {
  inspectRecoveryWorkbook,
} from "@/lib/recoveryWorkbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

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

    if (!selected || typeof selected === "string") {
      return Response.json(
        { error: "Please select an Excel recovery file." },
        { status: 400 },
      );
    }

    const file = selected as File;

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return Response.json(
        { error: "Only .xlsx recovery files are accepted." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        {
          error:
            "The selected file is larger than the 25 MB inspection limit.",
        },
        { status: 400 },
      );
    }

    const inspection = inspectRecoveryWorkbook(
      await file.arrayBuffer(),
    );

    if (inspection.valid) {
      await recordBackupAudit({
        backupType: "uploaded_excel",
        status: "verified_excel",
        fileName: file.name,
        rowCount: inspection.totalRows,
        details: {
          workbookCreatedAt: inspection.createdAt,
          fileSize: file.size,
        },
      });
    }

    return Response.json({
      fileName: file.name,
      fileSize: file.size,
      inspection,
    });
  } catch (error) {
    console.error("Recovery inspection failed:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Recovery inspection failed.",
      },
      { status: 500 },
    );
  }
}
