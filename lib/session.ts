const SESSION_COOKIE = "tt_logged_in";
const SESSION_DAYS = 7;

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function signingKey() {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "APP_SESSION_SECRET must be configured with at least 32 characters.",
    );
  }

  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signature(payload: string) {
  const key = await signingKey();
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return base64Url(new Uint8Array(signed));
}

export async function createSessionToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const payload = `v1.${expiresAt}`;
  return `${payload}.${await signature(payload)}`;
}

export async function verifySessionToken(token?: string | null) {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;

  const expiresAt = Number(parts[1]);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() / 1000) {
    return false;
  }

  const payload = `${parts[0]}.${parts[1]}`;
  const expected = await signature(payload);

  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(parts[2]);
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

export { SESSION_COOKIE, SESSION_DAYS };
