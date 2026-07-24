import {
  recoveryAuthorizationError,
} from "@/lib/recoveryAuth";
import {
  getGoogleDriveStatus,
} from "@/lib/googleDriveBackup";

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

  return Response.json(
    await getGoogleDriveStatus(),
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
