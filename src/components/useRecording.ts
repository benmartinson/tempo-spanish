import { useState, useRef, useEffect, useCallback } from "react";
import { useAudioRecorder, type AudioRecorder } from "expo-audio";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import {
  getRecordingConfig,
  requestMicrophonePermission,
  setAudioModeForRecording,
} from "./streaming_helpers";

export interface UseRecordingOptions {
  onRecordingComplete: (audioUri: string) => void;
  onError?: (message: string) => void;
}

export interface UseRecordingReturn {
  isRecording: boolean;
  hasPermission: boolean | null;
  startRecording: () => Promise<void>;
  stopRecording: (userTrashed?: boolean) => Promise<string | null>;
  cleanup: () => Promise<void>;
}

export const useRecording = (
  options: UseRecordingOptions,
): UseRecordingReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const recorder = useAudioRecorder(getRecordingConfig());

  const recordingRef = useRef<AudioRecorder | null>(null);

  // Store callbacks in refs to avoid stale closures
  const onRecordingCompleteRef = useRef(options.onRecordingComplete);
  const onErrorRef = useRef(options.onError);

  // Update refs when callbacks change
  useEffect(() => {
    onRecordingCompleteRef.current = options.onRecordingComplete;
    onErrorRef.current = options.onError;
  }, [options.onRecordingComplete, options.onError]);

  // Request microphone permission on mount
  useEffect(() => {
    const requestPermission = async () => {
      try {
        const granted = await requestMicrophonePermission();
        setHasPermission(granted);
        if (!granted) {
          onErrorRef.current?.(
            "Microphone permission is required for speech recognition",
          );
        }
      } catch (err) {
        onErrorRef.current?.("Failed to request microphone permission");
        console.error("Permission error:", err);
      }
    };

    requestPermission();

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stop();
      } catch (err) {
        // Recording may already be stopped
      }
      recordingRef.current = null;
      deactivateKeepAwake("recording");
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!hasPermission) {
      onErrorRef.current?.("Microphone permission not granted");
      return;
    }

    try {
      // Configure audio mode for recording
      await setAudioModeForRecording(true);

      // Create recording with PCM format
      await recorder.prepareToRecordAsync(getRecordingConfig());

      recordingRef.current = recorder;
      recorder.record();
      setIsRecording(true);
      activateKeepAwakeAsync("recording");
    } catch (err) {
      console.error("Failed to start recording:", err);
      onErrorRef.current?.("Failed to start recording. Please try again.");
      cleanup();
    }
  }, [hasPermission, cleanup]);

  const stopRecording = useCallback(
    async (userTrashed: boolean = false): Promise<string | null> => {
      setIsRecording(false);
      deactivateKeepAwake("recording");

      let audioUri: string | null = null;
      // Stop recording and get the URI

      if (recordingRef.current) {
        try {
          await recordingRef.current.stop();
          audioUri = recordingRef.current.uri;
        } catch (err) {
          console.error("Error stopping recording:", err);
          onErrorRef.current?.("Error stopping recording");
        }
        recordingRef.current = null;
      }

      // Reset audio mode — this deactivates/reactivates the iOS audio
      // session to fully clear the PlayAndRecord pipeline.
      await setAudioModeForRecording(false);

      // Notify completion with the audio URI
      if (audioUri && !userTrashed) {
        onRecordingCompleteRef.current(audioUri);
        return audioUri;
      }
      return null;
    },
    [],
  );

  return {
    isRecording,
    hasPermission,
    startRecording,
    stopRecording,
    cleanup,
  };
};
