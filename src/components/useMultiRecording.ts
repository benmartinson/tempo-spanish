import { useState, useRef, useCallback, useEffect } from "react";
import { useAudioRecorder } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import {
  getRecordingConfig,
  setAudioModeForRecording,
  concatenateWavFiles,
} from "../helpers/streaming_helpers";

const MAX_RECORDING_MS = 30000;

export interface UseMultiRecordingReturn {
  recordings: Record<number, string>;
  recordingIndex: number | null;
  recordingCount: number;
  allRecorded: boolean;
  startRecording: (index: number) => Promise<void>;
  stopRecording: () => Promise<void>;
  addRecording: (uri: string) => Promise<void>;
  concatenateRecordings: () => Promise<string>;
  resetRecordings: () => void;
}

/**
 * Hook for managing multiple indexed recordings that can be concatenated.
 * @param expectedCount - If provided, `allRecorded` is true when this many slots are filled.
 *                        If omitted, `allRecorded` is true when at least one recording exists.
 */
export const useMultiRecording = (
  expectedCount?: number,
): UseMultiRecordingReturn => {
  const [recordings, setRecordings] = useState<Record<number, string>>({});
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);

  const recorder = useAudioRecorder(getRecordingConfig());
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIndexRef = useRef<number | null>(null);
  const recordingsRef = useRef(recordings);
  recordingsRef.current = recordings;

  const clearAutoStopTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(async () => {
    clearAutoStopTimeout();
    const idx = recordingIndexRef.current;

    if (recorderRef.current && idx !== null) {
      try {
        await recorderRef.current.stop();
        const audioUri = recorderRef.current.uri;

        if (audioUri) {
          // Delete old recording if re-recording the same index
          const oldUri = recordingsRef.current[idx];
          if (oldUri) {
            try {
              await FileSystem.deleteAsync(oldUri, { idempotent: true });
            } catch {}
          }

          // Copy to a stable location so the recorder can reuse its internal file
          const stableUri = `${FileSystem.cacheDirectory}recording_${idx}_${Date.now()}.wav`;
          await FileSystem.copyAsync({ from: audioUri, to: stableUri });

          setRecordings((prev) => ({
            ...prev,
            [idx]: stableUri,
          }));
        }
      } catch (err) {
        console.error("Error stopping recording:", err);
      }
    }

    await setAudioModeForRecording(false);
    setRecordingIndex(null);
    recordingIndexRef.current = null;
  }, [clearAutoStopTimeout]);

  const startRecording = useCallback(
    async (index: number) => {
      // Stop any in-progress recording first
      if (recordingIndexRef.current !== null) {
        await stopRecording();
      }

      try {
        await setAudioModeForRecording(true);
        await recorderRef.current.prepareToRecordAsync(getRecordingConfig());
        recorderRef.current.record();

        setRecordingIndex(index);
        recordingIndexRef.current = index;

        // Auto-stop after 30 seconds
        timeoutRef.current = setTimeout(() => {
          stopRecording();
        }, MAX_RECORDING_MS);
      } catch (err) {
        console.error("Failed to start recording:", err);
        await setAudioModeForRecording(false);
      }
    },
    [stopRecording],
  );

  const concatenateRecordings = useCallback(async (): Promise<string> => {
    const maxIndex = Math.max(
      ...Object.keys(recordingsRef.current).map(Number),
    );
    const orderedUris: string[] = [];
    for (let i = 0; i <= maxIndex; i++) {
      const uri = recordingsRef.current[i];
      if (!uri) throw new Error(`Missing recording for index ${i}`);
      orderedUris.push(uri);
    }
    return concatenateWavFiles(orderedUris);
  }, []);

  const addRecording = useCallback(async (uri: string) => {
    const nextIndex =
      Math.max(-1, ...Object.keys(recordingsRef.current).map(Number)) + 1;
    const stableUri = `${FileSystem.cacheDirectory}recording_${nextIndex}_${Date.now()}.wav`;
    await FileSystem.copyAsync({ from: uri, to: stableUri });
    setRecordings((prev) => ({ ...prev, [nextIndex]: stableUri }));
  }, []);

  const resetRecordings = useCallback(() => {
    clearAutoStopTimeout();
    for (const uri of Object.values(recordingsRef.current)) {
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
    setRecordings({});
    setRecordingIndex(null);
    recordingIndexRef.current = null;
  }, [clearAutoStopTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAutoStopTimeout();
      for (const uri of Object.values(recordingsRef.current)) {
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
    };
  }, []);

  const recordingCount = Object.keys(recordings).length;
  const allRecorded =
    expectedCount != null
      ? expectedCount > 0 && recordingCount >= expectedCount
      : recordingCount > 0;

  return {
    recordings,
    recordingIndex,
    recordingCount,
    allRecorded,
    startRecording,
    stopRecording,
    addRecording,
    concatenateRecordings,
    resetRecordings,
  };
};
