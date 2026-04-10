import { useState, useCallback, useRef, useEffect } from "react";

let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: any = (_event: string, _handler: any) => {};
let setAudioModeAsync: any = null;

try {
  const mod = require("expo-speech-recognition");
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch {}

try {
  const audioMod = require("expo-audio");
  setAudioModeAsync = audioMod.setAudioModeAsync;
} catch {}

interface UseVoiceCommandOptions {
  onRepeat?: () => void;
  onRecord?: () => void;
  onSlow?: () => void;
  onTranslation?: () => void;
  onArtificial?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onHint?: () => void;
  onHear?: (spokenWord: string) => void;
  onFirstPhrase?: () => void;
  onSecondPhrase?: () => void;
  onThirdPhrase?: () => void;
  onWatchMode?: () => void;
  onReviewMode?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onShadowMode?: () => void;
  onSubmit?: () => void;
  onAddTo?: () => void;
  onResults?: () => void;
  onReviewPrevious?: () => void;
  onTwoBack?: () => void;
  onThreeBack?: () => void;
  onFiveBack?: () => void;
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
  onHear,
  onFirstPhrase,
  onSecondPhrase,
  onThirdPhrase,
  onWatchMode,
  onReviewMode,
  onPlay,
  onPause,
  onShadowMode,
  onSubmit,
  onAddTo,
  onResults,
  onReviewPrevious,
  onTwoBack,
  onThreeBack,
  onFiveBack,
}: UseVoiceCommandOptions) => {
  const [isListening, setIsListening] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const isListeningRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptBufferRef = useRef("");
  const shouldRetryRef = useRef(false);
  const lastCommandTimeRef = useRef<number>(0);
  const onRepeatRef = useRef(onRepeat);
  const onRecordRef = useRef(onRecord);
  const onSlowRef = useRef(onSlow);
  const onTranslationRef = useRef(onTranslation);
  const onArtificialRef = useRef(onArtificial);
  const onNextRef = useRef(onNext);
  const onPreviousRef = useRef(onPrevious);
  const onHintRef = useRef(onHint);
  const onHearRef = useRef(onHear);
  const onFirstPhraseRef = useRef(onFirstPhrase);
  const onSecondPhraseRef = useRef(onSecondPhrase);
  const onThirdPhraseRef = useRef(onThirdPhrase);
  const onWatchModeRef = useRef(onWatchMode);
  const onReviewModeRef = useRef(onReviewMode);
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onShadowModeRef = useRef(onShadowMode);
  const onSubmitRef = useRef(onSubmit);
  const onAddToRef = useRef(onAddTo);
  const onResultsRef = useRef(onResults);
  const onReviewPreviousRef = useRef(onReviewPrevious);
  const onTwoBackRef = useRef(onTwoBack);
  const onThreeBackRef = useRef(onThreeBack);
  const onFiveBackRef = useRef(onFiveBack);

  useEffect(() => {
    onRepeatRef.current = onRepeat;
    onRecordRef.current = onRecord;
    onSlowRef.current = onSlow;
    onTranslationRef.current = onTranslation;
    onArtificialRef.current = onArtificial;
    onNextRef.current = onNext;
    onPreviousRef.current = onPrevious;
    onHintRef.current = onHint;
    onHearRef.current = onHear;
    onFirstPhraseRef.current = onFirstPhrase;
    onSecondPhraseRef.current = onSecondPhrase;
    onThirdPhraseRef.current = onThirdPhrase;
    onWatchModeRef.current = onWatchMode;
    onReviewModeRef.current = onReviewMode;
    onPlayRef.current = onPlay;
    onPauseRef.current = onPause;
    onShadowModeRef.current = onShadowMode;
    onSubmitRef.current = onSubmit;
    onAddToRef.current = onAddTo;
    onResultsRef.current = onResults;
    onReviewPreviousRef.current = onReviewPrevious;
    onTwoBackRef.current = onTwoBack;
    onThreeBackRef.current = onThreeBack;
    onFiveBackRef.current = onFiveBack;
  }, [
    onRepeat,
    onRecord,
    onSlow,
    onTranslation,
    onArtificial,
    onNext,
    onPrevious,
    onHint,
    onHear,
    onFirstPhrase,
    onSecondPhrase,
    onThirdPhrase,
    onWatchMode,
    onReviewMode,
    onPlay,
    onPause,
    onShadowMode,
    onSubmit,
    onAddTo,
    onResults,
    onReviewPrevious,
  ]);

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
        ExpoSpeechRecognitionModule?.stop();
      } catch {}
      setIsListening(false);
      setTimedOut(true);
    }, 60000);
  }, []);

  const resetAudioSession = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule?.setCategoryIOS({
        category: "playback",
        categoryOptions: ["defaultToSpeaker"],
        mode: "default",
      });
    } catch {}
  }, []);

  const cleanup = useCallback(async () => {
    isListeningRef.current = false;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      ExpoSpeechRecognitionModule?.stop();
    } catch {}

    resetAudioSession();
    setIsListening(false);
  }, [resetAudioSession]);

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
  useSpeechRecognitionEvent("result", (event: any) => {
    if (!isListeningRef.current) return;

    const transcript = event.results[0]?.transcript;
    if (!transcript) return;

    // Track that the user spoke during this session
    lastCommandTimeRef.current = Date.now();

    // Reset inactivity timeout on each result
    resetInactivityTimeout();

    // Interim results contain the full text so far, so set (not append)
    transcriptBufferRef.current = transcript.toLowerCase();
    const text = transcriptBufferRef.current;

    if (text.includes("shadow")) {
      transcriptBufferRef.current = "";
      onShadowModeRef.current?.();
    } else if (text.includes("watch")) {
      transcriptBufferRef.current = "";
      onWatchModeRef.current?.();
    } else if (text.includes("review")) {
      transcriptBufferRef.current = "";
      onReviewPreviousRef.current?.();
    } else if (text.includes("first")) {
      transcriptBufferRef.current = "";
      onFirstPhraseRef.current?.();
    } else if (text.includes("second")) {
      transcriptBufferRef.current = "";
      onSecondPhraseRef.current?.();
    } else if (text.includes("third")) {
      transcriptBufferRef.current = "";
      onThirdPhraseRef.current?.();
    } else if (text.includes("hear")) {
      const hearMatch = text.match(/hear\s+(\S+)/);
      if (hearMatch) {
        transcriptBufferRef.current = "";
        onHearRef.current?.(hearMatch[1]);
      }
    } else if (text.includes("record")) {
      transcriptBufferRef.current = "";
      onRecordRef.current?.();
    } else if (text.includes("translat")) {
      transcriptBufferRef.current = "";
      onTranslationRef.current?.();
    } else if (text.includes("slow")) {
      transcriptBufferRef.current = "";
      onSlowRef.current?.();
    } else if (text.includes("repeat")) {
      transcriptBufferRef.current = "";
      onRepeatRef.current?.();
    } else if (text.includes("next")) {
      transcriptBufferRef.current = "";
      onNextRef.current?.();
    } else if (text.includes("five back") || text.includes("5 back")) {
      transcriptBufferRef.current = "";
      onFiveBackRef.current?.();
    } else if (text.includes("three back") || text.includes("3 back")) {
      transcriptBufferRef.current = "";
      onThreeBackRef.current?.();
    } else if (text.includes("two back") || text.includes("2 back")) {
      transcriptBufferRef.current = "";
      onTwoBackRef.current?.();
    } else if (text.includes("previous") || text.includes("back")) {
      transcriptBufferRef.current = "";
      onPreviousRef.current?.();
    } else if (text.includes("hint")) {
      transcriptBufferRef.current = "";
      onHintRef.current?.();
    } else if (text.includes("add")) {
      transcriptBufferRef.current = "";
      onAddToRef.current?.();
    } else if (text.includes("submit")) {
      transcriptBufferRef.current = "";
      onSubmitRef.current?.();
    } else if (text.includes("result")) {
      transcriptBufferRef.current = "";
      onResultsRef.current?.();
    } else if (text.includes("pause")) {
      transcriptBufferRef.current = "";
      onPauseRef.current?.();
    } else if (text.includes("play")) {
      transcriptBufferRef.current = "";
      onPlayRef.current?.();
    }
  });

  // Handle speech recognition errors
  useSpeechRecognitionEvent("error", (event: any) => {
    if (!isListeningRef.current) return;
    if (event.error === "no-speech" || event.error === "speech-timeout") {
      // Let the end handler decide whether to restart based on recent activity
      return;
    } else if (event.error === "not-allowed") {
      cleanup();
    } else if (shouldRetryRef.current) {
      // Retry once — covers fresh permission grant where recognizer isn't ready yet
      shouldRetryRef.current = false;
      isListeningRef.current = false;
      setTimeout(() => {
        startListening();
      }, 500);
    } else {
      cleanupWithError();
    }
  });

  // Handle recognition ending — restart if user was active in the last session
  useSpeechRecognitionEvent("end", () => {
    if (!isListeningRef.current) return;

    // If user spoke a command in the last 2 minutes, restart automatically.
    // Otherwise, time out.
    const timeSinceLastCommand = Date.now() - lastCommandTimeRef.current;
    if (lastCommandTimeRef.current === 0 || timeSinceLastCommand > 120000) {
      isListeningRef.current = false;
      setIsListening(false);
      setTimedOut(true);
      return;
    }

    setTimeout(() => {
      if (isListeningRef.current) {
        ExpoSpeechRecognitionModule?.start({
          lang: "en-US",
          interimResults: true,
          continuous: true,
          requiresOnDeviceRecognition: true,
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
            "did I hear",
            "first phrase",
            "second phrase",
            "third phrase",
            "shadow mode",
            "watch mode",
            "review mode",
            "review previous",
            "play",
            "pause",
            "submit",
            "add to",
            "results",
          ],
        });
      }
    }, 100);
  });

  const startListening = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) {
      // Dev mode: fake the listening state so VoiceCommands UI renders
      if (__DEV__) {
        isListeningRef.current = true;
        transcriptBufferRef.current = "";
        setHasError(false);
        setTimedOut(false);
        setIsListening(true);
      }
      return;
    }
    if (isListeningRef.current) return;
    isListeningRef.current = true;
    transcriptBufferRef.current = "";
    setHasError(false);
    setTimedOut(false);

    const { granted, canAskAgain } =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();

    // If we were stopped while awaiting permissions (e.g. by the stop-on-tab-change
    // effect), bail out instead of starting recognition with a stale audio session.
    if (!isListeningRef.current) return;

    if (!granted) {
      isListeningRef.current = false;
      if (!canAskAgain) {
        setPermissionDenied(true);
      }
      return;
    }

    // Ensure audio session allows recording — playAudio sets allowsRecording: false
    // which prevents the speech recognizer from accessing the mic.
    try {
      await setAudioModeAsync?.({ allowsRecording: true });
    } catch {}

    shouldRetryRef.current = true;

    try {
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: true,
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
          "shadow mode",
          "watch mode",
          "review mode",
          "review previous",
          "play",
          "pause",
          "submit",
          "add to",
        ],
      });

      setIsListening(true);

      // 60-second inactivity timeout
      timeoutRef.current = setTimeout(async () => {
        await cleanup();
        setTimedOut(true);
      }, 60000);
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
      ExpoSpeechRecognitionModule?.abort();
    } catch {}

    resetAudioSession();
    setIsListening(false);
  }, [resetAudioSession]);

  return {
    isListening,
    hasError,
    timedOut,
    permissionDenied,
    startListening,
    stopListening,
    closeConnection,
  };
};
