import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { clearClerkAuth, withClerkAuth } from "../lib/clerkAuth";
import { supabase } from "../lib/supabase";

/**
 * Returns the shared Supabase client, wired to Clerk auth.
 *
 * Important: we do NOT create per-user Supabase clients. Creating multiple
 * clients triggers Supabase's "Multiple GoTrueClient instances" warning.
 */
export function useSupabaseWithClerk() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      clearClerkAuth();
      return;
    }

    withClerkAuth(getToken);

    let cancelled = false;
    const refreshRealtimeAuth = async () => {
      const token = await getToken({ template: "supabase" });
      if (!cancelled) supabase.realtime.setAuth(token ?? "");
    };

    // Set immediately, then refresh periodically to keep the JWT fresh.
    void refreshRealtimeAuth();
    const interval = setInterval(refreshRealtimeAuth, 50 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [getToken, isLoaded, isSignedIn]);

  return isLoaded && isSignedIn ? supabase : null;
}
