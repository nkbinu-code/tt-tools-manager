import {
  recoveryAuthorizationError,
} from "@/lib/recoveryAuth";
import {
  uploadCurrentRecoveryToDrive,
} from "@/lib/googleDriveBackup";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARCHIVE_PHRASE = "ARCHIVE SETTLED DATA";

export async function POST(request: Request) {
  const authError =
    recoveryAuthorizationError(request);

  if (authError) {
    return Response.json(
      { error: authError },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as {
      cutoff?: string;
      confirmation?: string;
    };

    if (
      String(body.confirmation || "").trim() !==
      ARCHIVE_PHRASE
    ) {
      return Response.json(
        {
          error:
            `Type ${ARCHIVE_PHRASE} exactly to archive.`,
        },
        { status: 400 },
      );
    }

    if (!body.cutoff) {
      return Response.json(
        { error: "Archive cutoff date is required." },
        { status: 400 },
      );
    }

    await uploadCurrentRecoveryToDrive(
      "pre_archive_safety",
    );

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc(
      "tt_archive_execute",
      {
        cutoff_date: body.cutoff,
        confirmation_phrase: ARCHIVE_PHRASE,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    const afterBackup =
      await uploadCurrentRecoveryToDrive(
        "post_archive_snapshot",
      );

    return Response.json({
      success: true,
      result: data,
      driveFile: afterBackup.file,
      message:
        "Archive completed and Google Drive recovery file updated.",
    });
  } catch (error) {
    console.error("Archive failed:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Archive failed.",
      },
      { status: 500 },
    );
  }
}
