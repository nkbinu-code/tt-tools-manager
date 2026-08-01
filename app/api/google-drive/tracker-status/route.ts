import {
  recoveryAuthorizationError,
} from "@/lib/recoveryAuth";
import {
  getTrackerBackupStatus,
} from "@/lib/googleDriveBackup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "X-Backup-Password",
    "Cache-Control": "no-store",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: Request) {
  const authError = recoveryAuthorizationError(request);
  if (authError) {
    return Response.json(
      { error: authError },
      { status: 401, headers: corsHeaders() },
    );
  }

  return Response.json(await getTrackerBackupStatus(), {
    headers: corsHeaders(),
  });
}
