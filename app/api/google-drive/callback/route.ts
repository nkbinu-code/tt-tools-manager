import {
  exchangeAuthorizationCode,
} from "@/lib/googleDriveBackup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cookieValue(
  request: Request,
  name: string,
): string {
  const header = request.headers.get("cookie") || "";

  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");

    if (key === name) {
      return decodeURIComponent(value.join("="));
    }
  }

  return "";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const expectedState = cookieValue(
    request,
    "tt_google_state",
  );
  const oauthError =
    url.searchParams.get("error") || "";

  if (oauthError) {
    return Response.redirect(
      `${origin}/backup-recovery?drive=${encodeURIComponent(
        oauthError,
      )}`,
    );
  }

  if (
    !code ||
    !state ||
    !expectedState ||
    state !== expectedState
  ) {
    return Response.redirect(
      `${origin}/backup-recovery?drive=invalid-state`,
    );
  }

  try {
    await exchangeAuthorizationCode({
      code,
      origin,
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location:
          `${origin}/backup-recovery?drive=connected`,
        "Set-Cookie":
          "tt_google_state=; HttpOnly; SameSite=Lax; Path=/api/google-drive/callback; Max-Age=0",
      },
    });
  } catch (error) {
    return Response.redirect(
      `${origin}/backup-recovery?drive=${encodeURIComponent(
        error instanceof Error
          ? error.message
          : "connection-failed",
      )}`,
    );
  }
}
