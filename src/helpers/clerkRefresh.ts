/**
 * A tiny event emitter used to force the Clerk provider to remount.
 *
 * Some Clerk error states (signed_out, session_exists) leave the SDK with an
 * invalid client cached in memory that signOut() + clearing SecureStore can't
 * reach. The only reliable recovery is to remount ClerkProvider so it
 * re-initializes from a freshly-cleared cache.
 *
 * App.tsx subscribes to refresh events and bumps a `key` on ClerkProvider when
 * one fires. Code that detects an unrecoverable Clerk error calls
 * `triggerClerkRefresh()`.
 */

type Handler = () => void;

let handler: Handler | null = null;

export const setClerkRefreshHandler = (h: Handler | null) => {
  handler = h;
};

export const triggerClerkRefresh = () => {
  handler?.();
};
