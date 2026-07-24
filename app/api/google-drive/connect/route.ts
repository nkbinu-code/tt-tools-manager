import { randomBytes } from "node:crypto";
import {
  googleAuthorizationUrl,
} from "@/lib/googleDriveBackup";
import {
  recoveryAuthorizationError,
} from "@/lib/recoveryAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError =
    recoveryAuthorizationError(request);
  const origin = new URL(request.url).origin;

  if (authError) {
    return Response.redirect(
      `${origin}/backup-recovery?drive=unlock`,
    );
  }

  try {
    const state = randomBytes(24).toString("base64url");
    const secure =
      process.env.NODE_ENV === "production"
        ? "; Secure"
        : "";
    const redirect = googleAuthorizationUrl({
      origin,
      state,
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirect,
        "Set-Cookie": [
          `tt_google_state=${encodeURIComponent(state)}`,
          "HttpOnly",
          "SameSite=Lax",
          "Path=/api/google-drive/callback",
          "Max-Age=600",
          secure.replace(/^; /, ""),
        ]
          .filter(Boolean)
          .join("; "),
      },
    });
  } catch (error) {
    return Response.redirect(
      `${origin}/backup-recovery?drive=${encodeURIComponent(
        error instanceof Error
          ? error.message
          : "configuration-error",
      )}`,
    );
  }
}
