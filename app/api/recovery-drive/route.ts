import {
  recoveryAuthorizationError,
} from "@/lib/recoveryAuth";
import {
  uploadCurrentRecoveryToDrive,
} from "@/lib/googleDriveBackup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const result =
      await uploadCurrentRecoveryToDrive(
        "automatic_or_manual_drive",
      );

    return Response.json({
      success: true,
      file: result.file,
      totalRows: result.totalRows,
      createdAt: result.createdAt,
      message:
        "Google Drive recovery file updated successfully.",
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Google Drive backup failed.",
      },
      { status: 500 },
    );
  }
}
