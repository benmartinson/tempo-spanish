import { BACKEND_BASE_URL } from "./streaming_helpers";

type GlobalCache = typeof globalThis & {
  __tempoClerkSupabaseGetToken?: (opts?: {
    template?: string;
  }) => Promise<string | null>;
};

/**
 * Fetch wrapper that injects the Clerk JWT into backend API requests.
 */
export async function backendFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const g = globalThis as GlobalCache;
  const getToken = g.__tempoClerkSupabaseGetToken;
  const token = getToken ? await getToken({ template: "backend" }) : null;

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Don't set Content-Type for FormData — let the runtime set the multipart boundary
  if (!(init?.body instanceof FormData)) {
    headers.set(
      "Content-Type",
      headers.get("Content-Type") ?? "application/json",
    );
  }

  return fetch(`${BACKEND_BASE_URL}${path}`, {
    ...init,
    headers,
  });
}
