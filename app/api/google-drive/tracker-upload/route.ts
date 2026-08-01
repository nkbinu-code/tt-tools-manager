import {
  recoveryAuthorizationError,
} from "@/lib/recoveryAuth";
import {
  uploadTrackerBackupToDrive,
} from "@/lib/googleDriveBackup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, X-Backup-Password, X-Backup-File-Name, X-Backup-Kind, X-Backup-Modified-At, X-Backup-Sha256",
    "Cache-Control": "no-store",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const authError = recoveryAuthorizationError(request);
  if (authError) {
    return Response.json(
      { error: authError },
      { status: 401, headers: corsHeaders() },
    );
  }

  const contentLength = Number(
    request.headers.get("content-length") || "0",
  );
  if (contentLength > MAX_BACKUP_BYTES) {
    return Response.json(
      { error: "Tracker backup is larger than the 25 MB upload limit." },
      { status: 413, headers: corsHeaders() },
    );
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BACKUP_BYTES) {
    return Response.json(
      { error: bytes.length ? "Tracker backup is too large." : "Tracker backup is empty." },
      { status: 400, headers: corsHeaders() },
    );
  }

  try {
    const result = await uploadTrackerBackupToDrive({
      bytes,
      sourceFileName:
        request.headers.get("x-backup-file-name") || "tracker.ttbackup",
      backupKind:
        request.headers.get("x-backup-kind") || "manual",
      modifiedAt:
        request.headers.get("x-backup-modified-at") ||
        new Date().toISOString(),
    });
    return Response.json(
      {
        ok: true,
        latest: result.latest,
        archive: result.archive,
        uploadedBytes: bytes.length,
      },
      { headers: corsHeaders() },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Drive upload failed.",
      },
      { status: 500, headers: corsHeaders() },
    );
  }
}
