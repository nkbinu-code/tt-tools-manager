import {
  recoveryAuthorizationError,
} from "@/lib/recoveryAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function defaultCutoff(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().slice(0, 10);
}

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
    const body = (await request.json().catch(() => ({}))) as {
      cutoff?: string;
    };
    const cutoff = body.cutoff || defaultCutoff();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc(
      "tt_archive_preview",
      { cutoff_date: cutoff },
    );

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({
      success: true,
      preview: data,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Archive preview failed.",
      },
      { status: 500 },
    );
  }
}
