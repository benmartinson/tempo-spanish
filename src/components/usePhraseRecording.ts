import { useState, useRef, useCallback, useEffect } from "react";
import { useAudioRecorder } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import {
  getRecordingConfig,
  setAudioModeForRecording,
  concatenateWavFiles,
} from "./streaming_helpers";

const MAX_PHRASE_RECORDING_MS = 30000;

export interface UsePhraseRecordingReturn {
  phraseRecordings: Record<number, string>;
  recordingPhraseIndex: number | null;
  allPhrasesRecorded: boolean;
  startPhraseRecording: (index: number) => Promise<void>;
  stopPhraseRecording: () => Promise<void>;
  submitPhraseRecordings: () => Promise<string>;
  resetPhraseRecordings: () => void;
}

export const usePhraseRecording = (
  phraseCount: number,
): UsePhraseRecordingReturn => {
  const [phraseRecordings, setPhraseRecordings] = useState<
    Record<number, string>
  >({});
  const [recordingPhraseIndex, setRecordingPhraseIndex] = useState<
    number | null
  >(null);

  const recorder = useAudioRecorder(getRecordingConfig());
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingPhraseIndexRef = useRef<number | null>(null);
  const phraseRecordingsRef = useRef(phraseRecordings);
  phraseRecordingsRef.current = phraseRecordings;

  const clearAutoStopTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stopPhraseRecording = useCallback(async () => {
    clearAutoStopTimeout();
    const phraseIdx = recordingPhraseIndexRef.current;

    if (recorderRef.current && phraseIdx !== null) {
      try {
        await recorderRef.current.stop();
        const audioUri = recorderRef.current.uri;

        if (audioUri) {
          // Delete old recording if re-recording
          const oldUri = phraseRecordingsRef.current[phraseIdx];
          if (oldUri) {
            try {
              await FileSystem.deleteAsync(oldUri, { idempotent: true });
            } catch {}
          }

          // Copy to a stable location so the recorder can reuse its internal file
          const stableUri = `${FileSystem.cacheDirectory}phrase_${phraseIdx}_${Date.now()}.wav`;
          await FileSystem.copyAsync({ from: audioUri, to: stableUri });

          setPhraseRecordings((prev) => ({
            ...prev,
            [phraseIdx]: stableUri,
          }));
        }
      } catch (err) {
        console.error("Error stopping phrase recording:", err);
      }
    }

    await setAudioModeForRecording(false);
    setRecordingPhraseIndex(null);
    recordingPhraseIndexRef.current = null;
  }, [clearAutoStopTimeout]);

  const startPhraseRecording = useCallback(
    async (index: number) => {
      // Stop any in-progress recording first
      if (recordingPhraseIndexRef.current !== null) {
        await stopPhraseRecording();
      }

      try {
        await setAudioModeForRecording(true);
        await recorderRef.current.prepareToRecordAsync(getRecordingConfig());
        recorderRef.current.record();

        setRecordingPhraseIndex(index);
        recordingPhraseIndexRef.current = index;

        // Auto-stop after 30 seconds
        timeoutRef.current = setTimeout(() => {
          stopPhraseRecording();
        }, MAX_PHRASE_RECORDING_MS);
      } catch (err) {
        console.error("Failed to start phrase recording:", err);
        await setAudioModeForRecording(false);
      }
    },
    [stopPhraseRecording],
  );

  const submitPhraseRecordings = useCallback(async (): Promise<string> => {
    const orderedUris: string[] = [];
    for (let i = 0; i < phraseCount; i++) {
      const uri = phraseRecordingsRef.current[i];
      if (!uri) throw new Error(`Missing recording for phrase ${i}`);
      orderedUris.push(uri);
    }
    return concatenateWavFiles(orderedUris);
  }, [phraseCount]);

  const resetPhraseRecordings = useCallback(() => {
    clearAutoStopTimeout();
    // Delete all temp files
    for (const uri of Object.values(phraseRecordingsRef.current)) {
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
    setPhraseRecordings({});
    setRecordingPhraseIndex(null);
    recordingPhraseIndexRef.current = null;
  }, [clearAutoStopTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAutoStopTimeout();
      for (const uri of Object.values(phraseRecordingsRef.current)) {
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
    };
  }, []);

  const allPhrasesRecorded =
    phraseCount > 0 && Object.keys(phraseRecordings).length === phraseCount;

  return {
    phraseRecordings,
    recordingPhraseIndex,
    allPhrasesRecorded,
    startPhraseRecording,
    stopPhraseRecording,
    submitPhraseRecordings,
    resetPhraseRecordings,
  };
};
