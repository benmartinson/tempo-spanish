import { setClerkSupabaseTokenGetter, supabase, type ClerkGetToken } from "./supabase";

export function withClerkAuth(getToken: ClerkGetToken) {
  // Ensure ALL Supabase HTTP requests always use a fresh Clerk JWT.
  // This avoids creating new Supabase clients (and extra GoTrueClient instances).
  setClerkSupabaseTokenGetter(getToken);

  // Realtime expects a concrete token string (not a callback).
  // We set an initial token here; callers can refresh periodically if needed.
  void (async () => {
    const token = await getToken({ template: "supabase" });
    supabase.realtime.setAuth(token ?? "");
  })();

  return supabase;
}

export function clearClerkAuth() {
  setClerkSupabaseTokenGetter(undefined);
  supabase.realtime.setAuth("");
}
