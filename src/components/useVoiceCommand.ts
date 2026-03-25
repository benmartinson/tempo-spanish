import { useState, useCallback, useRef, useEffect } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

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

  const resetInactivityTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(async () => {
      isListeningRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {}
      setIsListening(false);
      setTimedOut(true);
    }, 30000);
  }, []);

  const cleanup = useCallback(async () => {
    isListeningRef.current = false;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}

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

  // Handle speech recognition results
  useSpeechRecognitionEvent("result", (event) => {
    if (!isListeningRef.current) return;

    const transcript = event.results[0]?.transcript;
    if (!transcript) return;

    // Reset inactivity timeout on each result
    resetInactivityTimeout();

    // Interim results contain the full text so far, so set (not append)
    transcriptBufferRef.current = transcript.toLowerCase();
    const text = transcriptBufferRef.current;

    if (text.includes("record")) {
      transcriptBufferRef.current = "";
      onRecordRef.current();
    } else if (text.includes("translat")) {
      transcriptBufferRef.current = "";
      onTranslationRef.current();
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
  });

  // Handle speech recognition errors
  useSpeechRecognitionEvent("error", (event) => {
    if (!isListeningRef.current) return;
    if (event.error === "no-speech" || event.error === "speech-timeout") {
      cleanup();
      setTimedOut(true);
    } else {
      cleanupWithError();
    }
  });

  // Handle recognition ending (auto-restart if still supposed to be listening)
  useSpeechRecognitionEvent("end", () => {
    if (isListeningRef.current) {
      // Recognition ended unexpectedly (e.g., non-continuous mode on older Android)
      // Restart after a brief delay
      setTimeout(() => {
        if (isListeningRef.current) {
          ExpoSpeechRecognitionModule.start({
            lang: "en-US",
            interimResults: true,
            continuous: true,
            contextualStrings: [
              "record",
              "translate",
              "translation",
              "slow",
              "repeat",
              "next",
              "previous",
              "back",
              "hint",
            ],
          });
        }
      }, 100);
    }
  });

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;
    isListeningRef.current = true;
    transcriptBufferRef.current = "";
    setHasError(false);
    setTimedOut(false);

    const { granted } =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      isListeningRef.current = false;
      return;
    }

    try {
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        continuous: true,
        contextualStrings: [
          "record",
          "translate",
          "translation",
          "slow",
          "repeat",
          "next",
          "previous",
          "back",
          "hint",
        ],
      });

      setIsListening(true);

      // 30-second inactivity timeout
      timeoutRef.current = setTimeout(async () => {
        await cleanup();
        setTimedOut(true);
      }, 30000);
    } catch {
      cleanupWithError();
    }
  }, [cleanup, cleanupWithError]);

  const stopListening = useCallback(async () => {
    await cleanup();
  }, [cleanup]);

  const closeConnection = useCallback(async () => {
    isListeningRef.current = false;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {}

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
