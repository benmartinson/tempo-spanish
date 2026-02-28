import "react-native-url-polyfill/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const SUPABASE_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export type ClerkGetToken = (opts?: {
  template?: string;
}) => Promise<string | null>;

type GlobalCache = typeof globalThis & {
  __tempoSupabase?: SupabaseClient;
  __tempoClerkSupabaseGetToken?: ClerkGetToken;
};

const g = globalThis as GlobalCache;

function createFetchWithClerkToken(): typeof fetch {
  return async (input, init) => {
    const getToken = g.__tempoClerkSupabaseGetToken;
    const token = getToken ? await getToken({ template: "supabase" }) : null;

    const baseHeaders =
      init?.headers ??
      (typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : undefined);

    const headers = new Headers(baseHeaders);
    if (token) headers.set("Authorization", `Bearer ${token}`);

    return fetch(input as any, { ...(init ?? {}), headers });
  };
}

if (!g.__tempoSupabase) {
  g.__tempoSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      fetch: createFetchWithClerkToken(),
    },
    // We don't use Supabase Auth sessions (Clerk owns auth).
    auth: {
      storage: null,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export const supabase: SupabaseClient = g.__tempoSupabase;

export function setClerkSupabaseTokenGetter(getToken?: ClerkGetToken) {
  g.__tempoClerkSupabaseGetToken = getToken;
}
