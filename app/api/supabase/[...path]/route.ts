import { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

async function proxyDatabaseRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceKey) {
    return Response.json(
      { error: "Database server connection is not configured." },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  if (path.length < 2 || path[0] !== "rest" || path[1] !== "v1") {
    return Response.json({ error: "Unsupported database path." }, { status: 404 });
  }

  const destination = new URL(`${supabaseUrl}/${path.join("/")}`);
  destination.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  for (const name of [
    "host",
    "connection",
    "content-length",
    "cookie",
    "authorization",
    "apikey",
    "user-agent",
  ]) {
    headers.delete(name);
  }
  headers.set("apikey", serviceKey);
  headers.set("authorization", `Bearer ${serviceKey}`);
  // Supabase secret keys intentionally reject browser-looking requests.
  // The request is authorized here on our server, so identify this hop as
  // the Manager server rather than forwarding the end user's browser UA.
  headers.set("user-agent", "TT-Tools-Manager-Server/1.0");

  const method = request.method.toUpperCase();
  const upstream = await fetch(destination, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : request.body,
    // Required by Node when forwarding a streaming request body.
    ...(method === "GET" || method === "HEAD" ? {} : { duplex: "half" as any }),
  });

  const responseHeaders = new Headers(upstream.headers);
  // fetch() has already decoded the upstream response body. Forwarding the
  // original compression/length headers can make Vercel send a body that the
  // browser cannot decode, which surfaces as `TypeError: Failed to fetch`.
  for (const name of [
    "set-cookie",
    "content-encoding",
    "content-length",
    "transfer-encoding",
    "connection",
  ]) {
    responseHeaders.delete(name);
  }
  responseHeaders.set("cache-control", "private, no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxyDatabaseRequest;
export const POST = proxyDatabaseRequest;
export const PATCH = proxyDatabaseRequest;
export const PUT = proxyDatabaseRequest;
export const DELETE = proxyDatabaseRequest;
