import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/**
 * Browser database requests go through our authenticated Next.js proxy.
 * The service-role key stays on the server and is never exposed here.
 */
async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const originalUrl =
    input instanceof Request ? input.url : String(input);

  if (
    typeof window !== "undefined" &&
    originalUrl.startsWith(`${supabaseUrl}/rest/v1/`)
  ) {
    const proxiedUrl =
      window.location.origin +
      "/api/supabase/rest/v1/" +
      originalUrl.slice(`${supabaseUrl}/rest/v1/`.length);

    if (input instanceof Request) {
      return fetch(new Request(proxiedUrl, input), {
        ...init,
        credentials: "same-origin",
      });
    }

    return fetch(proxiedUrl, {
      ...init,
      credentials: "same-origin",
    });
  }

  return fetch(input, init);
}

export const supabase = createClient(
  supabaseUrl,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: {
      fetch: authenticatedFetch,
    },
  },
);
