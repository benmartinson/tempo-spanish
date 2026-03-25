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
  onSlow: () => void;
  onTranslation: () => void;
  onArtificial: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onHint: () => void;
}

const VOICE_COMMAND_WS_URL = BACKEND_WS_URL?.replace(
  "/ws/transcribe",
  "/ws/voice-command",
);

export const useVoiceCommand = ({
  onRepeat,
  onRecord,
  onSlow,
  onTranslation,
  onArtificial,
  onNext,
  onPrevious,
  onHint,
}: UseVoiceCommandOptions) => {
  const [isListening, setIsListening] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const isListeningRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<ReturnType<typeof useAudioRecorder> | null>(null);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptBufferRef = useRef("");
  const onRepeatRef = useRef(onRepeat);
  const onRecordRef = useRef(onRecord);
  const onSlowRef = useRef(onSlow);
  const onTranslationRef = useRef(onTranslation);
  const onArtificialRef = useRef(onArtificial);
  const onNextRef = useRef(onNext);
  const onPreviousRef = useRef(onPrevious);
  const onHintRef = useRef(onHint);

  useEffect(() => {
    onRepeatRef.current = onRepeat;
    onRecordRef.current = onRecord;
    onSlowRef.current = onSlow;
    onTranslationRef.current = onTranslation;
    onArtificialRef.current = onArtificial;
    onNextRef.current = onNext;
    onPreviousRef.current = onPrevious;
    onHintRef.current = onHint;
  }, [onRepeat, onRecord, onSlow, onTranslation, onArtificial, onNext, onPrevious, onHint]);

  const recorder = useAudioRecorder(getRecordingConfig());

  const cleanup = useCallback(async () => {
    isListeningRef.current = false;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

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

  const cleanupWithError = useCallback(async () => {
    await cleanup();
    setHasError(true);
  }, [cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const startListening = useCallback(async () => {
    if (isListeningRef.current || !VOICE_COMMAND_WS_URL) return;
    isListeningRef.current = true;
    transcriptBufferRef.current = "";
    setHasError(false);
    setTimedOut(false);

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
            timeoutRef.current = setTimeout(async () => {
              await cleanup();
              setTimedOut(true);
            }, 30000);
          } else if (data.type === "error") {
            cleanupWithError();
          } else if (data.type === "transcript" && data.transcript) {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(async () => {
              await cleanup();
              setTimedOut(true);
            }, 30000);
            transcriptBufferRef.current += data.transcript.toLowerCase();
            const text = transcriptBufferRef.current;
            if (text.includes("record")) {
              transcriptBufferRef.current = "";
              onRecordRef.current();
            } else if (text.includes("translat")) {
              transcriptBufferRef.current = "";
              onTranslationRef.current();
              // } else if (text.includes("artificial")) {
              //   transcriptBufferRef.current = "";
              //   onArtificialRef.current();
            } else if (text.includes("slow")) {
              transcriptBufferRef.current = "";
              onSlowRef.current();
            } else if (text.includes("repeat")) {
              transcriptBufferRef.current = "";
              onRepeatRef.current();
            } else if (text.includes("next")) {
              transcriptBufferRef.current = "";
              onNextRef.current();
            } else if (text.includes("previous") || text.includes("back")) {
              transcriptBufferRef.current = "";
              onPreviousRef.current();
            } else if (text.includes("hint")) {
              transcriptBufferRef.current = "";
              onHintRef.current();
            }
          }
        } catch {
          cleanupWithError();
        }
      };

      ws.onerror = () => {
        cleanupWithError();
      };

      ws.onclose = () => {
        cleanup();
      };
    } catch {
      cleanupWithError();
    }
  }, [recorder, cleanup, cleanupWithError]);

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

  return {
    isListening,
    hasError,
    timedOut,
    startListening,
    stopListening,
    closeConnection,
  };
};
