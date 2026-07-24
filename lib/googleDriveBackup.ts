import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import {
  buildCurrentRecoverySnapshot,
  recordBackupAudit,
} from "@/lib/recoveryData";
import { RECOVERY_FILE_NAME } from "@/lib/recoveryWorkbook";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const GOOGLE_SCOPE =
  "https://www.googleapis.com/auth/drive.file";
const TOKEN_SETTING_KEY =
  "google_drive_refresh_token";
const FILE_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name] || "";

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function encryptionKey(): Buffer {
  return createHash("sha256")
    .update(requiredEnv("GOOGLE_TOKEN_ENCRYPTION_KEY"))
    .digest();
}

function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    encryptionKey(),
    iv,
  );
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptSecret(value: string): string {
  const [version, ivText, tagText, encryptedText] =
    value.split(".");

  if (
    version !== "v1" ||
    !ivText ||
    !tagText ||
    !encryptedText
  ) {
    throw new Error(
      "The saved Google Drive token is not valid.",
    );
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivText, "base64url"),
  );

  decipher.setAuthTag(
    Buffer.from(tagText, "base64url"),
  );

  return Buffer.concat([
    decipher.update(
      Buffer.from(encryptedText, "base64url"),
    ),
    decipher.final(),
  ]).toString("utf8");
}

async function saveRefreshToken(
  refreshToken: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const encryptedValue = encryptSecret(refreshToken);

  const { error } = await supabase
    .from("tt_secure_settings")
    .upsert(
      {
        setting_key: TOKEN_SETTING_KEY,
        encrypted_value: encryptedValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "setting_key" },
    );

  if (error) {
    throw new Error(
      `Could not save Google Drive connection: ${error.message}`,
    );
  }
}

async function readRefreshToken(): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tt_secure_settings")
    .select("encrypted_value")
    .eq("setting_key", TOKEN_SETTING_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not read Google Drive connection: ${error.message}`,
    );
  }

  if (!data?.encrypted_value) {
    throw new Error(
      "Google Drive is not connected yet.",
    );
  }

  return decryptSecret(String(data.encrypted_value));
}

function clientId(): string {
  return requiredEnv("GOOGLE_DRIVE_CLIENT_ID");
}

function clientSecret(): string {
  return requiredEnv("GOOGLE_DRIVE_CLIENT_SECRET");
}

export function googleRedirectUri(origin: string): string {
  return (
    process.env.GOOGLE_DRIVE_REDIRECT_URI ||
    `${origin}/api/google-drive/callback`
  );
}

export function googleAuthorizationUrl(input: {
  origin: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: googleRedirectUri(input.origin),
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: input.state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  origin: string;
}): Promise<void> {
  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId(),
        client_secret: clientSecret(),
        code: input.code,
        redirect_uri: googleRedirectUri(input.origin),
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    },
  );

  const payload =
    (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !payload.refresh_token) {
    throw new Error(
      payload.error_description ||
        payload.error ||
        "Google did not return a refresh token. Reconnect and approve access again.",
    );
  }

  await saveRefreshToken(payload.refresh_token);
}

async function accessToken(): Promise<string> {
  const refreshToken = await readRefreshToken();

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId(),
        client_secret: clientSecret(),
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    },
  );

  const payload =
    (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description ||
        payload.error ||
        "Google Drive access token could not be refreshed.",
    );
  }

  return payload.access_token;
}

function escapeDriveQuery(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

async function findRecoveryFile(
  token: string,
): Promise<DriveFile | null> {
  const q = [
    `name = '${escapeDriveQuery(RECOVERY_FILE_NAME)}'`,
    "trashed = false",
  ].join(" and ");

  const params = new URLSearchParams({
    q,
    spaces: "drive",
    pageSize: "10",
    orderBy: "modifiedTime desc",
    fields:
      "files(id,name,modifiedTime,webViewLink)",
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as {
    files?: DriveFile[];
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        "Google Drive file search failed.",
    );
  }

  return payload.files?.[0] || null;
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;
}

async function createDriveFile(
  token: string,
  workbook: Uint8Array,
): Promise<DriveFile> {
  const boundary = `tt_tools_${randomBytes(12).toString(
    "hex",
  )}`;
  const metadata = JSON.stringify({
    name: RECOVERY_FILE_NAME,
    mimeType: FILE_MIME,
  });

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        metadata +
        "\r\n" +
        `--${boundary}\r\n` +
        `Content-Type: ${FILE_MIME}\r\n\r\n`,
      "utf8",
    ),
    Buffer.from(workbook),
    Buffer.from(`\r\n--${boundary}--`, "utf8"),
  ]);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: toArrayBuffer(new Uint8Array(body)),
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as DriveFile & {
    error?: { message?: string };
  };

  if (!response.ok || !payload.id) {
    throw new Error(
      payload.error?.message ||
        "Google Drive file creation failed.",
    );
  }

  return payload;
}

async function updateDriveFile(
  token: string,
  fileId: string,
  workbook: Uint8Array,
): Promise<DriveFile> {
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
      fileId,
    )}?uploadType=media&fields=id,name,modifiedTime,webViewLink`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": FILE_MIME,
      },
      body: toArrayBuffer(workbook),
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as DriveFile & {
    error?: { message?: string };
  };

  if (!response.ok || !payload.id) {
    throw new Error(
      payload.error?.message ||
        "Google Drive file update failed.",
    );
  }

  return payload;
}

export async function getGoogleDriveStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  file: DriveFile | null;
  message: string;
}> {
  const configured = Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
      process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
  );

  if (!configured) {
    return {
      configured: false,
      connected: false,
      file: null,
      message:
        "Google Drive environment settings are incomplete.",
    };
  }

  try {
    const token = await accessToken();
    const file = await findRecoveryFile(token);

    return {
      configured: true,
      connected: true,
      file,
      message: file
        ? "Google Drive is connected and the recovery file exists."
        : "Google Drive is connected. The first upload has not run yet.",
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      file: null,
      message:
        error instanceof Error
          ? error.message
          : "Google Drive is not connected.",
    };
  }
}

export async function uploadCurrentRecoveryToDrive(
  backupType = "manual_drive",
): Promise<{
  file: DriveFile;
  totalRows: number;
  createdAt: string;
}> {
  const snapshot = await buildCurrentRecoverySnapshot();
  const token = await accessToken();
  const existing = await findRecoveryFile(token);
  const file = existing
    ? await updateDriveFile(
        token,
        existing.id,
        snapshot.workbook,
      )
    : await createDriveFile(token, snapshot.workbook);

  await recordBackupAudit({
    backupType,
    status: "drive_uploaded",
    fileName: snapshot.fileName,
    driveFileId: file.id,
    rowCount: snapshot.totalRows,
    details: {
      modifiedTime: file.modifiedTime || null,
      webViewLink: file.webViewLink || null,
      snapshotCreatedAt: snapshot.createdAt,
    },
  });

  return {
    file,
    totalRows: snapshot.totalRows,
    createdAt: snapshot.createdAt,
  };
}

export async function uploadWorkbookToDrive(input: {
  workbook: Uint8Array;
  totalRows: number;
  createdAt: string;
  backupType: string;
}): Promise<DriveFile> {
  const token = await accessToken();
  const existing = await findRecoveryFile(token);
  const file = existing
    ? await updateDriveFile(
        token,
        existing.id,
        input.workbook,
      )
    : await createDriveFile(token, input.workbook);

  await recordBackupAudit({
    backupType: input.backupType,
    status: "drive_uploaded",
    fileName: RECOVERY_FILE_NAME,
    driveFileId: file.id,
    rowCount: input.totalRows,
    details: {
      modifiedTime: file.modifiedTime || null,
      webViewLink: file.webViewLink || null,
      snapshotCreatedAt: input.createdAt,
    },
  });

  return file;
}
