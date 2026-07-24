import {
  createRecoverySessionToken,
  recoverySessionCookie,
  validateRecoveryPassword,
} from "@/lib/recoveryAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const password =
    request.headers.get("x-backup-password") || "";
  const error = validateRecoveryPassword(password);

  if (error) {
    return Response.json(
      { error },
      {
        status: error.includes("not configured")
          ? 500
          : 401,
      },
    );
  }

  return Response.json(
    {
      success: true,
      message:
        "Backup Administrator access enabled on this device.",
    },
    {
      headers: {
        "Set-Cookie": recoverySessionCookie(
          createRecoverySessionToken(),
        ),
        "Cache-Control": "no-store",
      },
    },
  );
}
