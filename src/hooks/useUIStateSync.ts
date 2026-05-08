import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../types";
import { useSupabaseWithClerk } from "../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";
import { saveLastSentenceWatched } from "../requests";

/**
 * Hook that syncs currentSentence changes to the user_ui_state table.
 * Uses debouncing to avoid excessive database writes during video playback.
 */
export const useUIStateSync = () => {
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const currentSentence = currentVideo?.currentSentence;
  const videoViewId = currentVideo?.videoViewId;

  // Use refs to track previous values and debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedUiRef = useRef<
    { videoViewId: number | undefined; sentence: number | undefined } | undefined
  >(undefined);
  const lastSavedVideoViewRef = useRef<
    { videoViewId: number | undefined; sentence: number | undefined } | undefined
  >(undefined);

  useEffect(() => {
    // Don't sync if no supabase, no user, or no video selected
    if (!supabase || !userId || currentVideo === null) {
      return;
    }

    if (
      videoViewId &&
      (lastSavedVideoViewRef.current?.videoViewId !== videoViewId ||
        lastSavedVideoViewRef.current?.sentence !== currentSentence)
    ) {
      lastSavedVideoViewRef.current = { videoViewId, sentence: currentSentence };
      saveLastSentenceWatched({
        supabase,
        videoViewId,
        currentSentence: currentSentence ?? 0,
      });
    }

    // Don't sync if sentence hasn't actually changed
    if (
      lastSyncedUiRef.current?.videoViewId === videoViewId &&
      lastSyncedUiRef.current?.sentence === currentSentence
    ) {
      return;
    }

    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce the sync to avoid excessive writes
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const { error } = await supabase.from("user_ui_state").upsert(
          {
            user_id: userId,
            current_sentence: currentSentence,
            updated_at: new Date(),
          },
          { onConflict: "user_id" },
        );

        if (error) {
          console.error("Error persisting current_sentence:", error);
        } else {
          lastSyncedUiRef.current = { videoViewId, sentence: currentSentence };
        }
      } catch (err) {
        console.error("Error in useUIStateSync:", err);
      }
    }, 2000); // 10 seconds debounce

    // Cleanup on unmount or when dependencies change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [supabase, userId, currentSentence, currentVideo, videoViewId]);
};
