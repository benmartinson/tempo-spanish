import { useState, useCallback, useRef, useEffect } from "react";
import { useAudioRecorder } from "expo-audio";
import {
  getRecordingConfig,
  requestMicrophonePermission,
  setAudioModeForRecording,
  startAudioStreaming,
  BACKEND_WS_URL,
} from "./streaming_helpers";

interface UseVoiceCommandOptions {
  onRepeat: () => void;
  onRecord: () => void;
}

const VOICE_COMMAND_WS_URL = BACKEND_WS_URL?.replace(
  "/ws/transcribe",
  "/ws/voice-command",
);

export const useVoiceCommand = ({ onRepeat, onRecord }: UseVoiceCommandOptions) => {
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<ReturnType<typeof useAudioRecorder> | null>(null);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const onRepeatRef = useRef(onRepeat);
  const onRecordRef = useRef(onRecord);

  useEffect(() => {
    onRepeatRef.current = onRepeat;
    onRecordRef.current = onRecord;
  }, [onRepeat]);

  const recorder = useAudioRecorder(getRecordingConfig());

  const cleanup = useCallback(async () => {
    isListeningRef.current = false;

    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "stop" }));
        }
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    if (recorderRef.current) {
      try {
        await recorderRef.current.stop();
      } catch {}
      recorderRef.current = null;
    }

    await setAudioModeForRecording(false);
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const startListening = useCallback(async () => {
    if (isListeningRef.current || !VOICE_COMMAND_WS_URL) return;
    isListeningRef.current = true;

    const granted = await requestMicrophonePermission();
    if (!granted) {
      isListeningRef.current = false;
      return;
    }

    try {
      await setAudioModeForRecording(true);
      await recorder.prepareToRecordAsync(getRecordingConfig());
      recorderRef.current = recorder;

      const ws = new WebSocket(VOICE_COMMAND_WS_URL);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "connected") {
            recorder.record();
            streamIntervalRef.current = startAudioStreaming(
              () => recorderRef.current ?? null,
              () => wsRef.current,
            );
            setIsListening(true);
          } else if (data.type === "transcript" && data.transcript) {
            const text = data.transcript.toLowerCase();
            if (text.includes("record")) {
              onRecordRef.current();
            } else if (text.includes("repeat")) {
              onRepeatRef.current();
            }
          }
        } catch {}
      };

      ws.onerror = () => {
        cleanup();
      };

      ws.onclose = () => {
        cleanup();
      };
    } catch {
      cleanup();
    }
  }, [recorder, cleanup]);

  const stopListening = useCallback(async () => {
    await cleanup();
  }, [cleanup]);

  const closeConnection = useCallback(async () => {
    isListeningRef.current = false;

    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    if (recorderRef.current) {
      try {
        await recorderRef.current.stop();
      } catch {}
      recorderRef.current = null;
    }

    setIsListening(false);
  }, []);

  return { isListening, startListening, stopListening, closeConnection };
};
