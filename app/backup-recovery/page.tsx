"use client";

import {
  Archive,
  CheckCircle2,
  Cloud,
  CloudUpload,
  DatabaseBackup,
  Download,
  FileSearch,
  HardDriveUpload,
  KeyRound,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";

interface TableInspection {
  table: string;
  sheet: string;
  rows: number;
  expectedRows: number | null;
  valid: boolean;
  errors: string[];
}

interface InspectionResult {
  valid: boolean;
  format: string;
  createdAt: string;
  appName: string;
  totalRows: number;
  tables: TableInspection[];
  errors: string[];
}

interface InspectResponse {
  fileName: string;
  fileSize: number;
  inspection: InspectionResult;
}

interface DriveStatus {
  configured: boolean;
  connected: boolean;
  file: {
    id: string;
    name: string;
    modifiedTime?: string;
    webViewLink?: string;
  } | null;
  message: string;
}

interface ArchivePreview {
  cutoff_date?: string;
  eligible_customer_count?: number;
  rental_rows?: number;
  payment_rows?: number;
  edit_history_rows?: number;
  movement_rows?: number;
  service_rows?: number;
  expense_rows?: number;
  sale_rows?: number;
  cash_rows?: number;
  eligible_customers?: Array<{
    customer_id: number;
    customer_name: string;
    mobile: string;
    old_business: number;
    old_received: number;
    old_round_off: number;
  }>;
}

function sixMonthsAgo(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().slice(0, 10);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / 1024 ** index).toFixed(
    index === 0 ? 0 : 2,
  )} ${units[index]}`;
}

function formatDateTime(value?: string): string {
  if (!value) return "-";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    return payload?.error || "The operation failed.";
  } catch {
    return "The operation failed.";
  }
}

export default function BackupRecoveryPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);
  const [inspection, setInspection] =
    useState<InspectResponse | null>(null);
  const [driveStatus, setDriveStatus] =
    useState<DriveStatus | null>(null);
  const [restorePhrase, setRestorePhrase] = useState("");
  const [archiveCutoff, setArchiveCutoff] =
    useState(sixMonthsAgo());
  const [archivePhrase, setArchivePhrase] = useState("");
  const [archivePreview, setArchivePreview] =
    useState<ArchivePreview | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const validTables = useMemo(
    () =>
      inspection?.inspection.tables.filter(
        (table) => table.valid,
      ).length || 0,
    [inspection],
  );

  const totalArchiveRows = useMemo(() => {
    if (!archivePreview) return 0;

    return [
      "rental_rows",
      "payment_rows",
      "edit_history_rows",
      "movement_rows",
      "service_rows",
      "expense_rows",
      "sale_rows",
      "cash_rows",
    ].reduce(
      (sum, key) =>
        sum +
        Number(
          archivePreview[
            key as keyof ArchivePreview
          ] || 0,
        ),
      0,
    );
  }, [archivePreview]);

  function authHeaders(): HeadersInit {
    return password.trim()
      ? { "x-backup-password": password }
      : {};
  }

  async function unlockDevice(): Promise<boolean> {
    if (!password.trim()) {
      setMessage(
        "Enter the Backup Administrator password.",
      );
      return false;
    }

    try {
      setBusy("unlock");
      const response = await fetch(
        "/api/recovery-session",
        {
          method: "POST",
          headers: authHeaders(),
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setUnlocked(true);
      setMessage(
        "Backup access enabled on this device for 90 days.",
      );
      return true;
    } catch (error) {
      setUnlocked(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not unlock backup access.",
      );
      return false;
    } finally {
      setBusy("");
    }
  }

  async function ensureUnlocked(): Promise<boolean> {
    return unlocked ? true : unlockDevice();
  }

  async function loadDriveStatus() {
    if (!(await ensureUnlocked())) return;

    try {
      setBusy("drive-status");
      const response = await fetch(
        "/api/google-drive/status",
        {
          headers: authHeaders(),
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setDriveStatus(
        (await response.json()) as DriveStatus,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not check Google Drive.",
      );
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search,
    );
    const drive = params.get("drive");

    if (drive === "connected") {
      setMessage(
        "Google Drive connected. Unlock and check status.",
      );
    } else if (drive) {
      setMessage(
        `Google Drive connection: ${decodeURIComponent(
          drive,
        )}`,
      );
    }
  }, []);

  async function downloadBackup() {
    if (!(await ensureUnlocked())) return;

    try {
      setBusy("download");
      const response = await fetch(
        "/api/recovery-backup",
        {
          headers: authHeaders(),
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download =
        "TT-Tools-Latest-Recovery.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setMessage(
        "Complete recovery Excel downloaded.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Download failed.",
      );
    } finally {
      setBusy("");
    }
  }

  function chooseFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setInspection(null);
    setRestorePhrase("");
    setMessage(
      file
        ? `${file.name} selected. Inspect it before restore.`
        : "",
    );
  }

  async function inspectFile() {
    if (!(await ensureUnlocked())) return;

    if (!selectedFile) {
      setMessage("Select the Excel file first.");
      return;
    }

    try {
      setBusy("inspect");
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(
        "/api/recovery-inspect",
        {
          method: "POST",
          headers: authHeaders(),
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const result =
        (await response.json()) as InspectResponse;

      setInspection(result);
      setMessage(
        result.inspection.valid
          ? "The recovery file passed every verification check."
          : "The file contains verification problems.",
      );
    } catch (error) {
      setInspection(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "Inspection failed.",
      );
    } finally {
      setBusy("");
    }
  }

  async function uploadDrive() {
    if (!(await ensureUnlocked())) return;

    try {
      setBusy("drive-upload");
      const response = await fetch(
        "/api/recovery-drive",
        {
          method: "POST",
          headers: authHeaders(),
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setMessage(
        "Google Drive recovery file updated successfully.",
      );
      await loadDriveStatus();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Google Drive upload failed.",
      );
    } finally {
      setBusy("");
    }
  }

  async function restoreData() {
    if (!(await ensureUnlocked())) return;

    if (!selectedFile || !inspection?.inspection.valid) {
      setMessage(
        "Select and successfully inspect the recovery file first.",
      );
      return;
    }

    if (restorePhrase !== "RESTORE ALL DATA") {
      setMessage(
        "Type RESTORE ALL DATA exactly.",
      );
      return;
    }

    if (
      !window.confirm(
        "This will replace the current business database with the uploaded workbook. Continue?",
      )
    ) {
      return;
    }

    try {
      setBusy("restore");
      const formData = new FormData();

      formData.append("file", selectedFile);
      formData.append(
        "confirmation",
        restorePhrase,
      );

      const response = await fetch(
        "/api/recovery-restore",
        {
          method: "POST",
          headers: authHeaders(),
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setMessage(
        "Restore completed. The app will reload.",
      );
      window.setTimeout(
        () => window.location.assign("/"),
        1200,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Restore failed.",
      );
    } finally {
      setBusy("");
    }
  }

  async function previewArchive() {
    if (!(await ensureUnlocked())) return;

    try {
      setBusy("archive-preview");
      const response = await fetch(
        "/api/archive-preview",
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cutoff: archiveCutoff,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const payload = await response.json();
      setArchivePreview(payload.preview || null);
      setMessage(
        "Archive preview completed. No data was changed.",
      );
    } catch (error) {
      setArchivePreview(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "Archive preview failed.",
      );
    } finally {
      setBusy("");
    }
  }

  async function executeArchive() {
    if (!(await ensureUnlocked())) return;

    if (!archivePreview) {
      setMessage("Run Archive Preview first.");
      return;
    }

    if (archivePhrase !== "ARCHIVE SETTLED DATA") {
      setMessage(
        "Type ARCHIVE SETTLED DATA exactly.",
      );
      return;
    }

    if (
      !window.confirm(
        "A Google Drive safety backup will be created first. Eligible old details will then be replaced by compact monthly totals. Continue?",
      )
    ) {
      return;
    }

    try {
      setBusy("archive-execute");
      const response = await fetch(
        "/api/archive-execute",
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cutoff: archiveCutoff,
            confirmation: archivePhrase,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setArchivePreview(null);
      setArchivePhrase("");
      setMessage(
        "Archive completed. Old details were summarized and Google Drive was updated.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Archive failed.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="recovery-page">
      <style>{`
        * { box-sizing: border-box; }
        body {
          margin: 0;
          background:
            radial-gradient(circle at 0% 0%, #dbeafe 0, transparent 32%),
            linear-gradient(180deg, #f8fbff, #f5f7fb);
        }
        .recovery-page {
          min-height: 100vh;
          padding: 22px;
          color: #16233a;
          font-family: "Segoe UI", Arial, sans-serif;
        }
        .shell { width: min(1280px, 100%); margin: 0 auto; }
        .hero, .panel {
          border: 1px solid #d3deed;
          background: rgba(255,255,255,.96);
          box-shadow: 0 16px 38px rgba(29,55,93,.09);
        }
        .hero {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 24px;
          border-radius: 24px;
          background: linear-gradient(120deg,#eef6ff,#fff9e7 55%,#f5efff);
        }
        .hero-title { display:flex; gap:14px; align-items:center; }
        .hero-icon {
          width:60px;height:60px;border-radius:17px;display:grid;place-items:center;
          color:#fff;background:linear-gradient(145deg,#245bc5,#173a77);
        }
        h1 { margin:0; font-size:clamp(30px,4vw,50px); color:#173b74; }
        .hero p { margin:8px 0 0; max-width:800px; color:#56677f; font-weight:700; }
        .safe {
          align-self:center; min-width:210px; padding:14px; border-radius:15px;
          color:#08783f;background:#effcf5;border:1px solid #afe7c8;font-weight:900;
        }
        .unlock {
          display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:16px;
        }
        input, button {
          min-height:48px;border-radius:13px;font-size:15px;font-weight:800;
        }
        input {
          width:100%;padding:10px 13px;border:1px solid #ccd8e7;background:#fff;
        }
        button {
          border:0;padding:10px 16px;cursor:pointer;
        }
        button:disabled { opacity:.58; cursor:wait; }
        .primary { color:#fff;background:linear-gradient(145deg,#245bc5,#153a79); }
        .gold { color:#6b4300;background:linear-gradient(145deg,#fff4c5,#f5db82);border:1px solid #e5c45f; }
        .green { color:#fff;background:linear-gradient(145deg,#10a861,#06723e); }
        .danger { color:#fff;background:linear-gradient(145deg,#e22947,#9f1239); }
        .grid {
          display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px;margin-top:17px;
        }
        .panel { border-radius:20px;padding:20px; }
        .panel-head { display:flex;gap:12px;align-items:flex-start;margin-bottom:15px; }
        .panel-icon {
          width:44px;height:44px;flex:0 0 44px;border-radius:13px;display:grid;place-items:center;
          color:#245bc5;background:#eaf2ff;
        }
        h2 { margin:0;color:#1c355b;font-size:23px; }
        .panel p { margin:5px 0;color:#66758a;font-weight:700;line-height:1.45; }
        .actions { display:flex;flex-wrap:wrap;gap:10px;margin-top:14px; }
        .actions button { display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:1;min-width:190px; }
        .file {
          display:flex;align-items:center;justify-content:center;gap:10px;min-height:82px;
          border:2px dashed #b9c8db;border-radius:15px;background:#f8fbff;cursor:pointer;
          padding:12px;text-align:center;
        }
        .message {
          margin-top:17px;padding:13px 15px;border-radius:14px;color:#214f80;
          background:#edf6ff;border:1px solid #c7dff7;font-weight:850;
        }
        .status {
          display:flex;align-items:center;gap:9px;margin-top:12px;padding:12px;border-radius:13px;
          background:#f8fafc;border:1px solid #dbe3ed;font-weight:850;
        }
        .ok { color:#08783f; }
        .bad { color:#b51633; }
        .cards {
          display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:13px;
        }
        .card { padding:12px;border-radius:13px;background:#f8fbff;border:1px solid #dce5f0; }
        .card small { display:block;color:#718096;font-weight:900;text-transform:uppercase; }
        .card strong { display:block;margin-top:6px;color:#1d3d6c;font-size:20px; }
        .table-wrap { overflow:auto;margin-top:13px;border:1px solid #dbe3ee;border-radius:13px; }
        table { width:100%;min-width:720px;border-collapse:collapse; }
        th { padding:11px;background:#173f78;color:#fff;text-align:left;font-size:13px; }
        td { padding:10px;border-bottom:1px solid #e4e9f0;font-weight:720;font-size:14px; }
        .phrase { margin-top:12px; }
        .warning {
          margin-top:12px;padding:12px;border-radius:13px;color:#8a5a08;
          background:#fff8e3;border:1px solid #eed89b;font-weight:780;
        }
        @media(max-width:850px){
          .recovery-page{padding:12px}
          .hero{flex-direction:column}
          .safe{width:100%}
          .grid{grid-template-columns:1fr}
          .cards{grid-template-columns:repeat(2,minmax(0,1fr))}
          .unlock{grid-template-columns:1fr}
        }
      `}</style>

      <div className="shell">
        <section className="hero">
          <div>
            <div className="hero-title">
              <div className="hero-icon">
                <DatabaseBackup size={32} />
              </div>
              <div>
                <h1>Backup, Restore &amp; Archive</h1>
                <p>
                  One Excel recovery file, automatic Google Drive
                  updating, transactional restore and safe six-month
                  archiving.
                </p>
              </div>
            </div>

            <div className="unlock">
              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Backup Administrator password"
              />
              <button
                className="primary"
                onClick={() => void unlockDevice()}
                disabled={busy === "unlock"}
              >
                <KeyRound size={19} />
                {unlocked ? "Unlocked" : "Unlock This Device"}
              </button>
            </div>
          </div>

          <div className="safe">
            <ShieldCheck size={26} />
            <br />
            Backup required before destructive actions
          </div>
        </section>

        {message && <div className="message">{message}</div>}

        <section className="grid">
          <article className="panel">
            <div className="panel-head">
              <div className="panel-icon"><Download /></div>
              <div>
                <h2>Complete Excel</h2>
                <p>
                  Contains all current data and compact archived totals.
                </p>
              </div>
            </div>

            <div className="actions">
              <button
                className="primary"
                onClick={() => void downloadBackup()}
                disabled={Boolean(busy)}
              >
                <Download size={19} />
                {busy === "download"
                  ? "Preparing..."
                  : "Download Latest Recovery"}
              </button>
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div className="panel-icon"><Cloud /></div>
              <div>
                <h2>Google Drive</h2>
                <p>
                  The same file is updated automatically once per day
                  whenever the app is open and internet is available.
                </p>
              </div>
            </div>

            {driveStatus && (
              <div
                className={`status ${
                  driveStatus.connected ? "ok" : "bad"
                }`}
              >
                {driveStatus.connected ? (
                  <CheckCircle2 size={21} />
                ) : (
                  <XCircle size={21} />
                )}
                <span>
                  {driveStatus.message}
                  {driveStatus.file?.modifiedTime
                    ? ` Last update: ${formatDateTime(
                        driveStatus.file.modifiedTime,
                      )}`
                    : ""}
                </span>
              </div>
            )}

            <div className="actions">
              <button
                className="gold"
                onClick={() => void loadDriveStatus()}
                disabled={Boolean(busy)}
              >
                <RefreshCw size={19} />
                Check Status
              </button>
              <button
                className="primary"
                onClick={async () => {
                  if (await ensureUnlocked()) {
                    window.location.href =
                      "/api/google-drive/connect";
                  }
                }}
                disabled={Boolean(busy)}
              >
                <Cloud size={19} />
                Connect Google Drive
              </button>
              <button
                className="green"
                onClick={() => void uploadDrive()}
                disabled={Boolean(busy)}
              >
                <CloudUpload size={19} />
                Update Drive Now
              </button>
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div className="panel-icon"><FileSearch /></div>
              <div>
                <h2>Upload and Verify</h2>
                <p>
                  Inspection never writes to Supabase.
                </p>
              </div>
            </div>

            <label className="file">
              <Upload size={24} />
              <span>
                {selectedFile
                  ? `${selectedFile.name} — ${formatBytes(
                      selectedFile.size,
                    )}`
                  : "Select TT-Tools-Latest-Recovery.xlsx"}
              </span>
              <input
                type="file"
                accept=".xlsx"
                onChange={chooseFile}
                hidden
              />
            </label>

            <div className="actions">
              <button
                className="gold"
                onClick={() => void inspectFile()}
                disabled={Boolean(busy)}
              >
                <FileSearch size={19} />
                Inspect Recovery File
              </button>
            </div>

            {inspection && (
              <>
                <div
                  className={`status ${
                    inspection.inspection.valid
                      ? "ok"
                      : "bad"
                  }`}
                >
                  {inspection.inspection.valid ? (
                    <CheckCircle2 size={21} />
                  ) : (
                    <XCircle size={21} />
                  )}
                  {inspection.inspection.valid
                    ? "Verified recovery workbook"
                    : inspection.inspection.errors[0]}
                </div>

                <div className="cards">
                  <div className="card">
                    <small>Rows</small>
                    <strong>
                      {inspection.inspection.totalRows.toLocaleString(
                        "en-IN",
                      )}
                    </strong>
                  </div>
                  <div className="card">
                    <small>Tables</small>
                    <strong>
                      {validTables}/
                      {inspection.inspection.tables.length}
                    </strong>
                  </div>
                  <div className="card">
                    <small>Format</small>
                    <strong>
                      {inspection.inspection.format.replace(
                        "TT_TOOLS_RECOVERY_",
                        "",
                      )}
                    </strong>
                  </div>
                  <div className="card">
                    <small>Created</small>
                    <strong style={{ fontSize: 14 }}>
                      {formatDateTime(
                        inspection.inspection.createdAt,
                      )}
                    </strong>
                  </div>
                </div>
              </>
            )}
          </article>

          <article className="panel">
            <div className="panel-head">
              <div className="panel-icon"><RotateCcw /></div>
              <div>
                <h2>Restore Supabase</h2>
                <p>
                  Replaces current business tables in one database
                  transaction. A Drive safety copy is required when
                  the current database is not empty.
                </p>
              </div>
            </div>

            <input
              className="phrase"
              value={restorePhrase}
              onChange={(event) =>
                setRestorePhrase(event.target.value)
              }
              placeholder="Type RESTORE ALL DATA"
            />

            <div className="actions">
              <button
                className="danger"
                onClick={() => void restoreData()}
                disabled={
                  Boolean(busy) ||
                  !inspection?.inspection.valid
                }
              >
                <HardDriveUpload size={19} />
                Restore Uploaded Excel
              </button>
            </div>

            <div className="warning">
              Test this first with a separate empty Supabase project.
            </div>
          </article>
        </section>

        <section className="panel" style={{ marginTop: 17 }}>
          <div className="panel-head">
            <div className="panel-icon"><Archive /></div>
            <div>
              <h2>Six-Month Archive</h2>
              <p>
                Only customers whose old records close to zero at the
                cutoff are eligible. Active, unpaid and carry-over
                rentals remain complete. Old expenses, sales, cash,
                completed service and movements become monthly totals.
              </p>
            </div>
          </div>

          <div className="unlock">
            <input
              type="date"
              value={archiveCutoff}
              onChange={(event) => {
                setArchiveCutoff(event.target.value);
                setArchivePreview(null);
              }}
            />
            <button
              className="gold"
              onClick={() => void previewArchive()}
              disabled={Boolean(busy)}
            >
              <FileSearch size={19} />
              Preview Only
            </button>
          </div>

          {archivePreview && (
            <>
              <div className="cards">
                <div className="card">
                  <small>Eligible Customers</small>
                  <strong>
                    {Number(
                      archivePreview.eligible_customer_count ||
                        0,
                    ).toLocaleString("en-IN")}
                  </strong>
                </div>
                <div className="card">
                  <small>Rental Rows</small>
                  <strong>
                    {Number(
                      archivePreview.rental_rows || 0,
                    ).toLocaleString("en-IN")}
                  </strong>
                </div>
                <div className="card">
                  <small>Payment Rows</small>
                  <strong>
                    {Number(
                      archivePreview.payment_rows || 0,
                    ).toLocaleString("en-IN")}
                  </strong>
                </div>
                <div className="card">
                  <small>Total Detail Rows</small>
                  <strong>
                    {totalArchiveRows.toLocaleString(
                      "en-IN",
                    )}
                  </strong>
                </div>
              </div>

              {!!archivePreview.eligible_customers?.length && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Mobile</th>
                        <th>Old Business</th>
                        <th>Received</th>
                        <th>Round Off</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archivePreview.eligible_customers.map(
                        (customer) => (
                          <tr key={customer.customer_id}>
                            <td>{customer.customer_name}</td>
                            <td>{customer.mobile}</td>
                            <td>{customer.old_business}</td>
                            <td>{customer.old_received}</td>
                            <td>{customer.old_round_off}</td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <input
                className="phrase"
                value={archivePhrase}
                onChange={(event) =>
                  setArchivePhrase(event.target.value)
                }
                placeholder="Type ARCHIVE SETTLED DATA"
              />

              <div className="actions">
                <button
                  className="danger"
                  onClick={() => void executeArchive()}
                  disabled={
                    Boolean(busy) ||
                    Number(
                      archivePreview.eligible_customer_count ||
                        0,
                    ) === 0
                  }
                >
                  <ShieldAlert size={19} />
                  Backup to Drive and Archive
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
