import {
  recoveryAuthorizationError,
} from "@/lib/recoveryAuth";
import {
  buildCurrentRecoverySnapshot,
  recordBackupAudit,
  workbookResponseBody,
} from "@/lib/recoveryData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError =
    recoveryAuthorizationError(request);

  if (authError) {
    return Response.json(
      { error: authError },
      { status: 401 },
    );
  }

  try {
    const snapshot =
      await buildCurrentRecoverySnapshot();

    await recordBackupAudit({
      backupType: "manual_download",
      status: "generated",
      fileName: snapshot.fileName,
      rowCount: snapshot.totalRows,
      details: {
        snapshotCreatedAt: snapshot.createdAt,
      },
    });

    return new Response(
      workbookResponseBody(snapshot.workbook),
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition":
            `attachment; filename="${snapshot.fileName}"`,
          "Cache-Control": "no-store, max-age=0",
          Pragma: "no-cache",
        },
      },
    );
  } catch (error) {
    console.error("Recovery backup failed:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Recovery backup failed.",
      },
      { status: 500 },
    );
  }
}
