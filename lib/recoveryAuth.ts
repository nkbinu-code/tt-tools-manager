import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export const RECOVERY_SESSION_COOKIE =
  "tt_backup_session";

const SESSION_SECONDS = 90 * 24 * 60 * 60;

function requiredPassword(): string {
  const value = process.env.BACKUP_ADMIN_PASSWORD || "";

  if (!value) {
    throw new Error(
      "BACKUP_ADMIN_PASSWORD is not configured.",
    );
  }

  return value;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function signingSecret(): string {
  return (
    process.env.BACKUP_SESSION_SECRET ||
    requiredPassword()
  );
}

function signature(payload: string): string {
  return createHmac("sha256", signingSecret())
    .update(payload, "utf8")
    .digest("base64url");
}

function cookieValue(request: Request): string {
  const cookieHeader = request.headers.get("cookie") || "";

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");

    if (name === RECOVERY_SESSION_COOKIE) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return "";
}

export function validateRecoveryPassword(
  supplied: string,
): string | null {
  try {
    const expected = requiredPassword();

    return safeEqual(supplied, expected)
      ? null
      : "Incorrect Backup Administrator password.";
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Backup password is not configured.";
  }
}

export function createRecoverySessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    }),
    "utf8",
  ).toString("base64url");

  return `${payload}.${signature(payload)}`;
}

export function validateRecoverySessionToken(
  token: string,
): boolean {
  try {
    const [payload, suppliedSignature] = token.split(".");

    if (!payload || !suppliedSignature) return false;
    if (!safeEqual(signature(payload), suppliedSignature)) {
      return false;
    }

    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp?: number };

    return Number(decoded.exp || 0) > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function recoveryAuthorizationError(
  request: Request,
): string | null {
  const suppliedPassword =
    request.headers.get("x-backup-password") || "";

  if (suppliedPassword) {
    return validateRecoveryPassword(suppliedPassword);
  }

  const token = cookieValue(request);

  if (token && validateRecoverySessionToken(token)) {
    return null;
  }

  try {
    requiredPassword();

    return "Backup Administrator access is required.";
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Backup password is not configured.";
  }
}

export function recoverySessionCookie(
  token: string,
): string {
  const secure =
    process.env.NODE_ENV === "production"
      ? "; Secure"
      : "";

  return [
    `${RECOVERY_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${SESSION_SECONDS}`,
    secure.replace(/^; /, ""),
  ]
    .filter(Boolean)
    .join("; ");
}
