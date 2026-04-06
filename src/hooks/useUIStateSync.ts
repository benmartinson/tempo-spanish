import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../types";
import { useSupabaseWithClerk } from "../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";

/**
 * Hook that syncs currentSentence changes to the user_ui_state table.
 * Uses debouncing to avoid excessive database writes during video playback.
 */
export const useUIStateSync = () => {
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const currentSentence = currentVideo?.currentSentence;

  // Use refs to track previous values and debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedSentenceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Don't sync if no supabase, no user, or no video selected
    if (!supabase || !userId || currentVideo === null) {
      return;
    }

    // Don't sync if sentence hasn't actually changed
    if (currentSentence === lastSyncedSentenceRef.current) {
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
          lastSyncedSentenceRef.current = currentSentence;
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
  }, [supabase, userId, currentSentence, currentVideo]);
};
