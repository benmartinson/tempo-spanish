import { useState, useRef, useEffect, useCallback } from "react";
import { Audio } from "expo-av";
import {
  TranscriptWord,
  connectToBackend,
  startAudioStreaming,
  getRecordingConfig,
  requestMicrophonePermission,
  setAudioModeForRecording,
} from "./streaming_helpers";

export interface UseRecordingOptions {
  onTranscript: (
    transcript: string,
    isFinal: boolean,
    words?: TranscriptWord[],
  ) => void;
  onError?: (message: string) => void;
}

export interface UseRecordingReturn {
  isRecording: boolean;
  isConnecting: boolean;
  hasPermission: boolean | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export const useRecording = (
  options: UseRecordingOptions,
): UseRecordingReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Store callbacks in refs to avoid stale closures
  const onTranscriptRef = useRef(options.onTranscript);
  const onErrorRef = useRef(options.onError);

  // Update refs when callbacks change
  useEffect(() => {
    onTranscriptRef.current = options.onTranscript;
    onErrorRef.current = options.onError;
  }, [options.onTranscript, options.onError]);

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
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (err) {
        // Recording may already be stopped
      }
      recordingRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!hasPermission) {
      onErrorRef.current?.("Microphone permission not granted");
      return;
    }

    setIsConnecting(true);

    try {
      // Connect to backend server first
      wsRef.current = await connectToBackend({
        onTranscript: (transcript, isFinal, words) => {
          onTranscriptRef.current(transcript, isFinal, words);
        },
        onError: (message) => onErrorRef.current?.(message),
      });

      // Configure audio mode
      await setAudioModeForRecording(true);

      // Create recording with PCM format
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(getRecordingConfig());

      recordingRef.current = recording;
      await recording.startAsync();
      setIsRecording(true);
      setIsConnecting(false);

      // Start streaming audio chunks to backend server
      streamIntervalRef.current = startAudioStreaming(
        () => recordingRef.current,
        () => wsRef.current,
      );
    } catch (err) {
      console.error("Failed to start recording:", err);
      onErrorRef.current?.("Failed to start recording. Please try again.");
      setIsConnecting(false);
      cleanup();
    }
  }, [hasPermission, cleanup]);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);

    // Stop the streaming interval first
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }

    // Stop recording
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (err) {
        console.error("Error stopping recording:", err);
      }
      recordingRef.current = null;
    }

    // Close WebSocket connection after a short delay to receive final transcripts
    setTimeout(() => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }, 1500);

    // Reset audio mode
    await setAudioModeForRecording(false);
  }, []);

  return {
    isRecording,
    isConnecting,
    hasPermission,
    startRecording,
    stopRecording,
    cleanup,
  };
};
