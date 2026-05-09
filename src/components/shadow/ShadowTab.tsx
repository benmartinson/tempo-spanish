import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Linking,
  AppState,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import Feather from "@expo/vector-icons/Feather";
import Foundation from "@expo/vector-icons/Foundation";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useAuth } from "@clerk/clerk-expo";
import * as FileSystem from "expo-file-system/legacy";
import {
  AutoReviewDetails,
  AutoShadowDetails,
  RootState,
  SegmentWord,
  VoiceCommand,
} from "../../types";
import SelectVideoPrompt from "./SelectVideoPrompt";
import { useRecording } from "../../hooks/useRecording";
import { useRealtimeTranscription } from "../../hooks/useRealtimeTranscription";
import {
  chargeRealtimeTranscription,
  sendAudioForTranscription,
  stopAudio,
  playDing,
  playDingStop,
  playDingWarning,
} from "../../helpers/streaming_helpers";
import { AccuracyResult, CachedResponse } from "../../types";
import SettingsModal from "./SettingsModal";
import CountdownTimer from "./CountdownTimer";
import {
  capitalize,
  computeSubSegments,
  hasUnnaturalSpeechTiming,
  isWebScreenWidth,
} from "../../helpers/helpers";
import ShadowResults from "./ShadowResults";
import TooltipModal from "../common/TooltipModal";
import NavSwitcher from "../common/NavSwitcher";
import { useNavigation } from "@react-navigation/native";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import WalkthroughModal from "../common/WalkthroughModal";
import {
  persistUserSettings,
  incrementFocusVocabReviewCount,
  saveFocusVocabTranslation,
} from "../../requests";
import { VocabCacheEntry } from "../../types";
import TranslationReviewModal from "./TranslationReviewModal";
import {
  setUserSettings,
  setUserCredits,
  refreshVideoPlayer,
} from "../../store/actions/dataActions";
import PlayerControls from "./PlayerControls";
import VoiceCommands from "./VoiceCommands";
import { useCachedAudio } from "../../hooks/useCachedAudio";
import { useVoiceCommand } from "../../hooks/useVoiceCommand";
import {
  setCurrentSentence,
  updateFocusVocabTranslation,
  incrementFocusVocabReview,
} from "../../store/actions/dataActions";
import { calculateAccuracy } from "../../helpers/calculate_accuracy";
import RecordingControls from "../common/RecordingControls";
import NoCreditsModal from "../common/NoCreditsModal";
import SignInPromptModal from "../common/SignInPromptModal";
import MemorizeContent from "./MemorizeContent";
import ShadowSettingsButtons from "./ShadowSettingsButtons";
import ShadowTabMobile from "./ShadowTabMobile";
import ShadowTabWeb from "./ShadowTabWeb";
import { useDraggableWebPanelWidth } from "../common/DraggableWebPanel";

const USE_OPENAI_REALTIME_TRANSCRIPTION = false;

interface ShadowTabProps {
  time: number;
  playKey?: number;
  playerSpeed?: number;
  handleNextSentence: () => void;
  handlePreviousSentence: (n?: number) => void;
  playSentence: () => void;
  setPlayerSpeed: (speed: number) => void;
  pausePlayer: () => void;
  resumePlayer: () => void;
  playWordSnippet: (word: SegmentWord) => void;
  isPlayingWordSnippet: boolean;
  hintWords: SegmentWord[];
  onPlayClip?: (time: number) => void;
  playClipSnippet?: (start: number, end: number) => void;
  playerIsPlaying: boolean;
  isLoadingInsights: boolean;
  orderedCharacters: string[];
  sentenceTranslation: { index: number; text: string | null } | null;
  autoShadowDetails?: AutoShadowDetails | null;
  onAutoShadowHandled?: () => void;
  mutePlayer: () => void;
  unMutePlayer: () => void;
  shadowMode: "shadow" | "stream" | "voice";
  setShadowMode: (mode: "shadow" | "stream" | "voice") => void;
  setAutoplay: (autoplay: boolean) => void;
  isPlayerFullscreen?: boolean;
  onRequestSentenceTranslation?: () => void | Promise<void>;
}

const WebCountdownTimerContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const webPanelWidth = useDraggableWebPanelWidth();
  const shouldFillNarrowPanel = webPanelWidth !== null && webPanelWidth < 450;
  const shouldUseCompactWidePanel =
    webPanelWidth !== null && webPanelWidth >= 1000;

  return (
    <View
      style={[
        styles.countdownTimer,
        styles.webCountdownTimer,
        shouldFillNarrowPanel && styles.webCountdownTimerNarrow,
        shouldUseCompactWidePanel && styles.webCountdownTimerWideCompact,
      ]}
    >
      {children}
    </View>
  );
};

const ShadowTab: React.FC<ShadowTabProps> = ({
  time,
  playKey,
  playerSpeed,
  handleNextSentence: parentHandleNextSentence,
  handlePreviousSentence: parentHandlePreviousSentence,
  playSentence,
  playWordSnippet,
  setPlayerSpeed,
  pausePlayer,
  resumePlayer,
  onPlayClip,
  playClipSnippet,
  playerIsPlaying,
  isLoadingInsights,
  orderedCharacters,
  sentenceTranslation,
  autoShadowDetails,
  onAutoShadowHandled,
  mutePlayer,
  unMutePlayer,
  shadowMode,
  setShadowMode,
  setAutoplay,
  isPlayerFullscreen = false,
  onRequestSentenceTranslation,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const isWebScreen = isWebScreenWidth(windowWidth);
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const isVoiceMode = shadowMode === "voice";

  // Track when a clip was just started so voice mode doesn't connect prematurely
  const clipJustStartedRef = useRef(false);
  const [awaitingFirstPlayback, setAwaitingFirstPlayback] = useState(true);
  const playerIsPlayingRef = useRef(playerIsPlaying);
  const disableAutoplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentSentenceIndex = currentVideo ? currentVideo.currentSentence : 0;
  const currentSentenceObject = currentVideo
    ? { ...currentVideo.sentences[currentSentenceIndex] }
    : null;

  const supabase = useSupabaseWithClerk();
  const { userId, isSignedIn } = useAuth();
  const recordingExtensionRef = useRef<NodeJS.Timeout | null>(null);
  // Speed control state (internal settings)
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const targetLanguage = userSettings.targetLanguage ?? "es";
  const userCredits = useSelector((state: RootState) => state.userCredits);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(
    userSettings.playbackSpeed,
  );
  const [recordSpeed, setRecordSpeed] = useState<number>(
    userSettings.playbackSpeedDuringRecording,
  );
  const [muteVideoWhenRecording, setMuteVideoWhenRecording] =
    useState<boolean>(true);

  // Local difficulty state — survives tab switches, resets on segment change
  const [localDifficulty, setLocalDifficulty] = useState<number>(
    userSettings.defaultMemorizeDifficulty,
  );
  const [vocabCache, setVocabCache] = useState<VocabCacheEntry[]>([]);
  const handleVocabCacheUpdate = useCallback((entry: VocabCacheEntry) => {
    setVocabCache((prev) => [...prev, entry]);
  }, []);
  useEffect(() => {
    setLocalDifficulty(userSettings.defaultMemorizeDifficulty);
    setVocabCache([]);
    setError(null);
    setAutoplay(true);
  }, [currentSentenceIndex]);

  // Recording and transcription state
  const [error, setError] = useState<string | null>(null);
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);

  // Restore autoplay when returning from SignInScreen
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (!showSignInModal && !isWebScreen) {
        console.log({ isWebScreen });
        setAutoplay(true);
        dispatch(refreshVideoPlayer());
      }
    });
    return unsubscribe;
  }, [navigation, showSignInModal, setAutoplay, dispatch]);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [accuracyResult, setAccuracyResult] = useState<AccuracyResult | null>(
    null,
  );
  const [previousResults, setPreviousResults] = useState<
    (AccuracyResult & { recordingId: string }) | null
  >(null);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState<boolean>(false);
  const [isRecordingMode, setIsRecordingMode] = useState<boolean>(false);
  const [streamBannerDismissed, setStreamBannerDismissed] =
    useState<boolean>(false);

  // Re-show the banner each time the user enters stream mode.
  useEffect(() => {
    if (shadowMode === "stream") setStreamBannerDismissed(false);
  }, [shadowMode]);
  const [sentenceEnded, setSentenceEnded] = useState<boolean>(false);
  const [showNoVocabFoundTooltip, setShowNoVocabFoundTooltip] =
    useState<boolean>(false);
  const isTransitioningRef = useRef<boolean>(false);
  const [nextSentenceCountdown, setNextSentenceCountdown] = useState<number>(0);
  const [hasPlayedSentence, setHasPlayedSentence] = useState<boolean>(false);
  const [isPlayingRecording, setIsPlayingRecording] = useState<boolean>(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [showShadowInstructions, setShowShadowInstructions] =
    useState<boolean>(false);
  const [showStreamRecordingTooltip, setShowStreamRecordingTooltip] =
    useState(false);

  // Review modal state
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewType, setReviewType] = useState<"vocab" | "translation" | null>(
    null,
  );
  const [reviewVocabWord, setReviewVocabWord] = useState<string | null>(null);
  const [reviewVocabSentenceText, setReviewVocabSentenceText] = useState<
    string | null
  >(null);
  const [reviewTranslationSentence, setReviewTranslationSentence] = useState<{
    text: string;
    translation: string;
    words: SegmentWord[];
    properNouns: string[];
    start: number;
    end: number;
  } | null>(null);
  const reviewVocabWordRef = useRef<string | null>(null);
  const [reviewTranslationSentenceIndex, setReviewTranslationSentenceIndex] =
    useState<number | null>(null);
  const sentenceHistoryRef = useRef<
    Record<
      number,
      {
        start: number;
        end: number;
        text: string;
        translation: string;
        words: SegmentWord[];
        properNouns: string[];
      }
    >
  >({});
  const latestShadowedSentenceRef = useRef<number>(-1);

  // Fetch latest shadowed sentence for this video
  useEffect(() => {
    if (!supabase || !userId || !currentVideo?.recordId) return;
    supabase
      .from("user_shadow_result")
      .select("sentence")
      .eq("user_id", userId)
      .eq("video_id", parseInt(currentVideo.recordId))
      .order("sentence", { ascending: false })
      .limit(1)
      .then(({ data, error }: { data: any; error: any }) => {
        if (!error && data?.[0]) {
          latestShadowedSentenceRef.current = data[0].sentence;
        }
      });
  }, [supabase, userId, currentVideo?.recordId]);

  // Fetch focus vocab review data when video view changes
  // Reset review state when video changes
  useEffect(() => {
    setReviewCount(0);
    setReviewType(null);
    reviewVocabWordRef.current = null;
    sentenceHistoryRef.current = {};
    latestShadowedSentenceRef.current = -1;
  }, [currentVideo?.videoId]);

  // Close review modals when app returns from background
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && reviewType !== null) {
        setReviewType(null);
        setReviewVocabWord(null);
        setReviewVocabSentenceText(null);
        setReviewTranslationSentence(null);
        reviewVocabWordRef.current = null;
      }
    });
    return () => subscription.remove();
  }, [reviewType]);

  const [isSpeakingResponse, setIsSpeakingResponse] = useState(false);
  const [activeCommand, setActiveCommandState] = useState<VoiceCommand>(null);
  const setActiveCommand = useCallback((command: VoiceCommand) => {
    setActiveCommandState(command);
  }, []);

  // Text input state
  const [userAnswer, setUserAnswer] = useState<string>("");
  useEffect(() => {
    if (playerIsPlaying) {
      setActiveCommand(null);
    }
  }, [playerIsPlaying]);

  useEffect(() => {
    if (
      currentSentenceObject?.words?.length &&
      hasUnnaturalSpeechTiming(currentSentenceObject.words)
    ) {
      setError(
        "This segment has been flagged for having unnaturally long pauses in speech. Possibly due to the transcript data being incorrectly processed.",
      );
    }
  }, [currentSentenceObject]);

  const subSegments = useMemo(
    () => computeSubSegments(currentSentenceObject?.words ?? []),
    [currentSentenceObject?.words],
  );

  const calculateAccuracyFromWords = useCallback(
    (spokenWords: string[]) => {
      const targetWords = currentSentenceObject?.words.map((w) => {
        return w.word;
      });

      const accuracy = calculateAccuracy(
        spokenWords,
        targetWords,
        orderedCharacters,
      );

      return {
        ...accuracy,
        targetSentence: capitalize(currentSentenceObject?.text),
      };
    },
    [currentSentenceObject?.words, orderedCharacters],
  );

  const saveShadowResult = useCallback(
    async (spokenWords: string[]) => {
      if (!supabase || !userId || !currentVideo) return;

      try {
        await supabase.from("user_shadow_result").upsert(
          {
            user_id: userId,
            video_id: parseInt(currentVideo.recordId),
            sentence: currentSentenceIndex,
            spoken_words: spokenWords.join(" "),
          },
          { onConflict: "user_id,video_id,sentence" },
        );
      } catch (err) {
        console.error("Failed to save shadow result:", err);
      }
    },
    [supabase, userId, currentVideo, currentSentenceIndex],
  );

  const fetchShadowResult = useCallback(async () => {
    if (!supabase || !userId || !currentVideo) return null;

    try {
      const { data, error } = await supabase
        .from("user_shadow_result")
        .select("spoken_words, recording_id")
        .eq("user_id", userId)
        .eq("video_id", parseInt(currentVideo.recordId))
        .eq("sentence", currentSentenceIndex)
        .single();
      if (error || !data) return null;
      return { spokenWords: data.spoken_words, recordingId: data.recording_id };
    } catch (err) {
      console.error("Failed to fetch shadow result:", err);
      return null;
    }
  }, [supabase, userId, currentVideo, currentSentenceIndex]);

  const loadExistingShadowResult = async () => {
    console.log("loadExisting");
    try {
      const result = await fetchShadowResult();
      if (result) {
        const spokenWords = result.spokenWords.split(/\s+/).filter(Boolean);
        const accuracy = calculateAccuracyFromWords(spokenWords);
        if (!isWebScreen && !isVoiceMode) {
          setAccuracyResult(accuracy);
        } else {
          setAccuracyResult(null);
        }

        setPreviousResults({ ...accuracy, recordingId: null });
      } else {
        setPreviousResults(null);
        setAccuracyResult(null);
      }
    } catch (err) {
      console.error("Error loading existing shadow result:", err);
    }
  };

  useEffect(() => {
    if (isLoadingInsights) return;
    loadExistingShadowResult();
  }, [currentSentenceIndex, isLoadingInsights]);

  // Cache sentence data for translation review whenever we have both a result and translation
  useEffect(() => {
    if (
      sentenceTranslation?.index === currentSentenceIndex &&
      sentenceTranslation.text &&
      currentSentenceObject &&
      (accuracyResult || previousResults)
    ) {
      sentenceHistoryRef.current[currentSentenceIndex] = {
        text: currentSentenceObject.text,
        translation: sentenceTranslation.text,
        words: currentSentenceObject.words,
        properNouns: orderedCharacters,
        start: currentSentenceObject.start,
        end: currentSentenceObject.end,
      };
    }
  }, [
    sentenceTranslation,
    currentSentenceIndex,
    accuracyResult,
    previousResults,
    orderedCharacters,
  ]);

  useEffect(() => {
    Keyboard.dismiss();
    if (hasPlayedSentence) {
      setHasPlayedSentence(false);
    }
    stopAudio();
    setAudioUri(null);
    setIsPlayingRecording(false);

    return () => {
      if (recordingExtensionRef.current) {
        clearTimeout(recordingExtensionRef.current);
      }
    };
  }, [currentSentenceIndex]);

  // Recording is kept locally only — no remote upload

  const playResultsReviewRef = useRef<
    (accuracy: AccuracyResult) => Promise<void>
  >(async () => {});
  const stopListeningRef = useRef<() => Promise<void>>(async () => {});
  const startListeningRef = useRef<() => void>(() => {});
  const liveTranscriptionResultRef = useRef<string | null>(null);
  const {
    transcript: liveTranscript,
    isSupported: isRealtimeTranscriptionSupported,
    startRealtimeTranscription,
    stopRealtimeTranscription,
    resetRealtimeTranscript,
  } = useRealtimeTranscription();

  const submitRecording = useCallback(
    async (uri: string) => {
      if (!currentVideo) return;
      setError(null);
      setIsProcessing(true);

      let safeUri = uri;
      if (Platform.OS !== "web") {
        // Copy recording to a stable path so it survives temp file cleanup.
        const stableUri = `${FileSystem.cacheDirectory}shadow_recording_${currentSentenceIndex}_${Date.now()}.wav`;
        try {
          await FileSystem.copyAsync({ from: uri, to: stableUri });
          safeUri = (await FileSystem.getInfoAsync(stableUri)).exists
            ? stableUri
            : uri;
        } catch {
          console.warn("Could not copy recording, using original URI");
        }
      }

      try {
        const liveTranscriptText = USE_OPENAI_REALTIME_TRANSCRIPTION
          ? liveTranscriptionResultRef.current?.trim() || ""
          : "";
        const transcriptionResult = liveTranscriptText
          ? {
              transcript: liveTranscriptText,
              confidence: 1,
              words: liveTranscriptText
                .split(/\s+/)
                .filter(Boolean)
                .map((word) => ({ word, confidence: 1 })),
            }
          : await sendAudioForTranscription(safeUri, targetLanguage);

        if (USE_OPENAI_REALTIME_TRANSCRIPTION && liveTranscriptText) {
          await chargeRealtimeTranscription();
        }

        const spokenWords = transcriptionResult.transcript
          .split(/\s+/)
          .filter(Boolean);
        const accuracy = calculateAccuracyFromWords(spokenWords);

        if (!isVoiceMode) {
          setAccuracyResult(accuracy);
        } else {
          setPreviousResults({
            ...accuracy,
            recordingId: null,
          });
          await playCachedResponse(accuracy);
        }
        // Track latest shadowed sentence and save to history for translation review
        latestShadowedSentenceRef.current = currentSentenceIndex;

        setAudioUri(safeUri);
        saveShadowResult(spokenWords);

        // Backend deducted 1 credit — update local count
        dispatch(setUserCredits(userCredits - 1));
      } catch (err) {
        console.error("Transcription error:", err);
        setError("Failed to process audio");
      } finally {
        liveTranscriptionResultRef.current = null;
        resetRealtimeTranscript();
        setIsProcessing(false);
      }
    },
    [
      calculateAccuracyFromWords,
      saveShadowResult,
      userId,
      currentVideo,
      currentSentenceIndex,
      isVoiceMode,
      resetRealtimeTranscript,
      targetLanguage,
    ],
  );

  const handleRecordingComplete = useCallback(
    async (audioUri: string) => {
      submitRecording(audioUri);
    },
    [submitRecording],
  );

  const handleResetAnswer = useCallback(() => {
    setUserAnswer("");
    Keyboard.dismiss();
  }, []);

  const {
    isRecording,
    hasPermission,
    passedSilenceThreshold,
    startRecording,
    stopRecording,
  } = useRecording({
    onRecordingComplete: handleRecordingComplete,
    onError: (message) => setError(message),
  });

  const {
    isListening,
    hasError: voiceCommandError,
    timedOut: voiceCommandTimedOut,
    permissionDenied: voicePermissionDenied,
    startListening,
    stopListening,
    closeConnection,
  } = useVoiceCommand({
    onRepeat: async () => {
      setActiveCommand("repeat");
      handlePlaySnippetAgain();
    },
    onRecord: async () => {
      setActiveCommand("record");
      voiceInitiatedRecordRef.current = true;
      await closeConnection();
      handleEnterRecordingMode();
    },
    onSlow: async () => {
      setActiveCommand("slow");
      await closeConnection();
      handlePlaySnippetSlow();
    },
    onNext: async () => {
      setActiveCommand("next");
      await closeConnection();
      handleNextRef.current();
    },
    onPrevious: async () => {
      setActiveCommand("previous");
      await closeConnection();
      handlePreviousRef.current();
    },
    onFirstPhrase: async () => {
      if (subSegments.length >= 1) {
        setActiveCommand("first_phrase");
        await closeConnection();
        handlePlayPhrase(subSegments[0].start, subSegments[0].end, 0);
      }
    },
    onSecondPhrase: async () => {
      if (subSegments.length >= 2) {
        setActiveCommand("second_phrase");
        await closeConnection();
        handlePlayPhrase(subSegments[1].start, subSegments[1].end, 1);
      }
    },
    onThirdPhrase: async () => {
      if (subSegments.length >= 3) {
        setActiveCommand("third_phrase");
        await closeConnection();
        handlePlayPhrase(subSegments[2].start, subSegments[2].end, 2);
      }
    },
    onTwoBack: async () => {
      setActiveCommand("two_back");
      await closeConnection();
      handlePreviousRef.current(2);
    },
    onThreeBack: async () => {
      setActiveCommand("three_back");
      await closeConnection();
      handlePreviousRef.current(3);
    },
    onFiveBack: async () => {
      setActiveCommand("five_back");
      await closeConnection();
      handlePreviousRef.current(5);
    },
    // onResults: async () => {
    //   if (!previousResults) return;
    //   setActiveCommand("results");
    //   await stopListening();
    //   await playResultsReview(previousResults);
    //   startListeningRef.current();
    // },
    // onReviewPrevious: async () => {
    //   setActiveCommand("review_previous");
    //   await closeConnection();
    //   handleReviewPreviousSegment();
    // },
  });

  startListeningRef.current = startListening;
  stopListeningRef.current = stopListening;

  const { playCachedResponse } = useCachedAudio(
    supabase,
    setIsSpeakingResponse,
    startListeningRef,
  );

  const commandHandlersRef = useRef<Record<string, (() => void) | undefined>>(
    {},
  );
  commandHandlersRef.current = {
    repeat: () => {
      setActiveCommand("repeat");
      handlePlaySnippetAgain();
    },
    record: () => {
      setActiveCommand("record");
      handleEnterRecordingMode();
    },
    slow: () => {
      setActiveCommand("slow");
      handlePlaySnippetSlow();
    },
    next: () => {
      setActiveCommand("next");
      handleNextRef.current();
    },
    previous: () => {
      setActiveCommand("previous");
      handlePreviousRef.current();
    },
    two_back: () => {
      setActiveCommand("two_back");
      handlePreviousRef.current(2);
    },
    three_back: () => {
      setActiveCommand("three_back");
      handlePreviousRef.current(3);
    },
    five_back: () => {
      setActiveCommand("five_back");
      handlePreviousRef.current(5);
    },
  };

  const handleCommandPress = useCallback((command: VoiceCommand) => {
    if (!command) return;
    commandHandlersRef.current[command]?.();
  }, []);

  useEffect(() => {
    playerIsPlayingRef.current = playerIsPlaying;
    if (playerIsPlaying) {
      clipJustStartedRef.current = false;
      const t = setTimeout(() => setAwaitingFirstPlayback(false), 600);
      return () => clearTimeout(t);
    }
  }, [playerIsPlaying]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active" && !playerIsPlayingRef.current) {
        setAwaitingFirstPlayback(true);
      }
    });
    return () => sub.remove();
  }, []);

  // Start listening when voice mode is active and nothing is playing
  useEffect(() => {
    if (
      isVoiceMode &&
      !awaitingFirstPlayback &&
      !playerIsPlaying &&
      !clipJustStartedRef.current &&
      !isSpeakingResponse &&
      !isRecordingMode &&
      !isRecording &&
      !isProcessing &&
      !accuracyResult
    ) {
      setTimeout(() => {
        if (!playerIsPlayingRef.current) {
          startListening();
        }
      }, 3000);
    } else {
      if (isListening) {
        stopListening();
      }
    }
  }, [
    isVoiceMode,
    awaitingFirstPlayback,
    playerIsPlaying,
    isSpeakingResponse,
    isRecordingMode,
    isRecording,
    isProcessing,
    accuracyResult,
  ]);

  // Stop listening when switching to stream mode
  useEffect(() => {
    if (isListening && shadowMode === "stream") {
      stopListening();
    }
  }, [shadowMode]);

  const justRecordedRef = useRef(false);
  const voiceInitiatedRecordRef = useRef(false);

  useEffect(() => {
    return () => {
      isTransitioningRef.current = false;
      clearRecordingTimer();
      if (disableAutoplayTimerRef.current) {
        clearTimeout(disableAutoplayTimerRef.current);
        disableAutoplayTimerRef.current = null;
      }
      setIsRecordingMode(false);
      setSentenceEnded(false);
      setIsProcessing(false);
      setAccuracyResult(null);
      setError(null);
      setShowNoVocabFoundTooltip(false);
      setIsSettingsVisible(false);
    };
  }, []);

  // Play warning sound 2 seconds before recording auto-stops (voice mode)
  const playedEndWarningRef = useRef(false);
  useEffect(() => {
    if (
      isRecording &&
      isVoiceMode &&
      !playedEndWarningRef.current &&
      currentSentenceObject?.end &&
      time >= currentSentenceObject.end - 2.5 &&
      !sentenceEnded
    ) {
      playedEndWarningRef.current = true;
      playDingWarning();
    }
  }, [
    time,
    isRecording,
    isVoiceMode,
    currentSentenceObject?.end,
    sentenceEnded,
  ]);

  // Reset warning flag when sentence changes
  useEffect(() => {
    playedEndWarningRef.current = false;
  }, [currentSentenceIndex]);

  // Auto-stop a voice-initiated recording after 5s of silence
  useEffect(() => {
    if (
      passedSilenceThreshold &&
      isVoiceMode &&
      voiceInitiatedRecordRef.current
    ) {
      handleSubmitRecording();
    }
  }, [passedSilenceThreshold]);

  useEffect(() => {
    if (
      !isTransitioningRef.current &&
      time >= currentSentenceObject?.end - 0.5 &&
      !sentenceEnded
    ) {
      if (isRecording) {
        setSentenceEnded(true);
        setHasPlayedSentence(true);
      }
    }
  }, [time, currentSentenceObject?.end, isRecording, sentenceEnded]);

  useEffect(() => {
    if (currentSentenceObject?.end && time >= currentSentenceObject.end) {
      setSentenceEnded(true);
    }
  }, [time, currentSentenceObject?.end]);

  const setJustRecorded = () => {
    setTimeout(() => {
      justRecordedRef.current = false;
    }, 1000);
  };

  const doAdvanceToNextSentence = () => {
    setPreviousResults(null);
    setAccuracyResult(null);
    setUserAnswer("");
    setPlayerSpeed(playbackSpeed);

    setIsRecordingMode(false);
    handleResetState();
    setJustRecorded();
    parentHandleNextSentence();
  };

  const markSentenceReviewed = async (sentenceIndex: number) => {
    if (!supabase || !userId || !currentVideo) return;
    try {
      await supabase
        .from("user_shadow_result")
        .update({ was_reviewed: true })
        .eq("user_id", userId)
        .eq("video_id", parseInt(currentVideo.recordId))
        .eq("sentence", sentenceIndex);
    } catch (err) {
      console.error("Failed to mark sentence as reviewed:", err);
    }
  };

  const proceedAfterReview = () => {
    if (
      reviewType === "vocab" &&
      reviewVocabWordRef.current &&
      supabase &&
      currentVideo?.videoViewId
    ) {
      incrementFocusVocabReviewCount({
        supabase,
        videoViewId: currentVideo.videoViewId,
        word: reviewVocabWordRef.current,
      });
      dispatch(incrementFocusVocabReview(reviewVocabWordRef.current));
    }
    setReviewType(null);
    setReviewVocabWord(null);
    setReviewVocabSentenceText(null);
    setReviewTranslationSentence(null);
    reviewVocabWordRef.current = null;
    doAdvanceToNextSentence();
  };

  const tryStartReview = async (): Promise<boolean> => {
    if (!isSignedIn) return false;
    if (!userSettings.showReviewMode) return false;

    // Only show review if the user just recorded this segment (not skipping around)
    if (currentSentenceIndex !== latestShadowedSentenceRef.current) {
      return false;
    }

    const newCount = reviewCount + 1;
    setReviewCount(newCount);

    // Only trigger based on review frequency setting
    const reviewSentenceIndex =
      currentSentenceIndex - userSettings.reviewFrequency;
    const historySentence = sentenceHistoryRef.current[reviewSentenceIndex];
    if (newCount % userSettings.reviewFrequency !== 0 || !historySentence)
      return false;

    // Skip if already reviewed
    if (supabase && userId && currentVideo) {
      const { data } = await supabase
        .from("user_shadow_result")
        .select("was_reviewed")
        .eq("user_id", userId)
        .eq("video_id", parseInt(currentVideo.recordId))
        .eq("sentence", reviewSentenceIndex)
        .single();
      if (data?.was_reviewed) return false;
    }

    markSentenceReviewed(reviewSentenceIndex);
    setReviewTranslationSentence(historySentence);
    setReviewType("translation");
    pausePlayer();
    return true;
  };

  const handleShadowNextSentence = async () => {
    if (!(await tryStartReview())) {
      doAdvanceToNextSentence();
    }
  };

  const handleNextRef = useRef(handleShadowNextSentence);
  const handlePreviousRef = useRef<(n?: number) => void>(() => {});
  useEffect(() => {
    handleNextRef.current = handleShadowNextSentence;
    handlePreviousRef.current = handleShadowPreviousSentence;
  });

  const handleResetState = () => {
    setError(null);
    setAccuracyResult(null);
    setSentenceEnded(false);
    setIsProcessing(false);
    clearRecordingTimer();
  };

  const clearRecordingTimer = () => {
    if (recordingExtensionRef.current) {
      clearTimeout(recordingExtensionRef.current);
      recordingExtensionRef.current = null;
    }
  };

  const handleEnterRecordingMode = async () => {
    if (!isSignedIn) {
      pausePlayer();
      setAutoplay(false);
      setShowSignInModal(true);
      return;
    }
    if (userCredits <= 0) {
      setShowNoCreditsModal(true);
      return;
    }
    await stopListening();
    pausePlayer();
    mutePlayer();

    if (recordSpeed > 0 && !isVoiceMode) {
      setPlayerSpeed(recordSpeed);
    }
    setIsRecordingMode(true);
    handleResetState();
    isTransitioningRef.current = true;
    justRecordedRef.current = true;
  };

  const handleActualStartRecording = async () => {
    if (isVoiceMode) playDing();
    liveTranscriptionResultRef.current = null;
    resetRealtimeTranscript();
    await startRecording();
    if (recordSpeed > 0 && !isVoiceMode) {
      playSentence();
    }
    if (USE_OPENAI_REALTIME_TRANSCRIPTION && isRealtimeTranscriptionSupported) {
      void startRealtimeTranscription(targetLanguage);
    }
    setTimeout(() => {
      isTransitioningRef.current = false;
    }, 1000);
  };

  const handleSubmitRecording = async () => {
    if (isVoiceMode) playDingStop();
    pausePlayer();
    unMutePlayer();
    setPlayerSpeed(1);
    if (USE_OPENAI_REALTIME_TRANSCRIPTION && isRealtimeTranscriptionSupported) {
      liveTranscriptionResultRef.current = await stopRealtimeTranscription();
    }
    await stopRecording(false);
    setIsRecordingMode(false);
  };

  const handleTrashRecording = async (trashed: boolean = false) => {
    voiceInitiatedRecordRef.current = false;
    pausePlayer();
    unMutePlayer();
    setPlayerSpeed(1);
    liveTranscriptionResultRef.current = null;
    if (USE_OPENAI_REALTIME_TRANSCRIPTION && isRealtimeTranscriptionSupported) {
      await stopRealtimeTranscription();
      resetRealtimeTranscript();
    }
    await stopRecording(trashed);
    setIsRecordingMode(false);
  };

  const handleShadowPreviousSentence = (n = 1) => {
    setPreviousResults(null);
    setIsRecordingMode(false);
    setJustRecorded();
    setPlayerSpeed(playbackSpeed);

    handleResetState();
    parentHandlePreviousSentence(n);
  };

  const handlePlaySnippetAgain = async (
    word?: SegmentWord,
    isSlow?: boolean,
  ) => {
    await stopListening();
    if (isSlow) {
      setPlayerSpeed(0.7);
    } else {
      setPlayerSpeed(playbackSpeed);
    }

    setJustRecorded();
    setIsRecordingMode(false);
    handleResetState();
    if (word) {
      playWordSnippet(word);
    } else {
      playSentence();
    }
  };

  const handlePlaySnippetSlow = async () => {
    await stopListening();
    setJustRecorded();
    setPlayerSpeed(0.75);
    setIsRecordingMode(false);
    handleResetState();

    playSentence();
  };

  const handlePlayPause = async () => {
    await stopListening();
    if (playerIsPlaying) {
      pausePlayer();
    } else {
      resumePlayer();
    }
  };

  useEffect(() => {
    if (!isWebScreen || typeof document === "undefined") return;

    const handleSpacebarPlayPause = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        tagName === "button" ||
        tagName === "a" ||
        !!target?.closest?.('[role="button"], [role="textbox"]') ||
        target?.isContentEditable
      ) {
        return;
      }

      event.preventDefault();
      handlePlayPause();
    };

    document.addEventListener("keydown", handleSpacebarPlayPause);
    return () => {
      document.removeEventListener("keydown", handleSpacebarPlayPause);
    };
  }, [handlePlayPause, isWebScreen]);

  const stopRecordingPlayback = useCallback(async () => {
    await stopAudio();
    setIsPlayingRecording(false);
  }, []);

  const handleRetry = () => {
    stopRecordingPlayback();
    const prevResult = accuracyResult;
    if (prevResult) {
      setPreviousResults({
        ...prevResult,
        recordingId: null,
      });
    }
    setAccuracyResult(null);
    setUserAnswer("");
  };

  const handlePreviousResults = () => {
    setAccuracyResult(previousResults);
  };

  const getSegmentDuration = (start, end, recordSpeed: number) => {
    return (end - start) / recordSpeed;
  };

  const handlePlayPhrase = (start, end, _phraseIndex?: number) => {
    setPlayerSpeed(playbackSpeed);
    playClipSnippet(start, end);
  };

  if (!currentVideo) {
    return <SelectVideoPrompt />;
  }

  const isMissingPermission = error?.toLowerCase().includes("permission");
  const currentSentenceTranslationText =
    sentenceTranslation?.index === currentSentenceIndex
      ? sentenceTranslation.text
      : null;
  const renderPlayerControlsElement = (compact = false) =>
    isRecordingMode ? null : (
      <PlayerControls
        onReplay={() => handlePlaySnippetAgain()}
        onReplaySlow={handlePlaySnippetSlow}
        onPlayPause={handlePlayPause}
        isPlaying={playerIsPlaying}
        playDisabled={
          sentenceEnded &&
          time >= (currentSentenceObject?.words?.at(-1)?.start ?? 0)
        }
        segmentText={currentSentenceObject?.text}
        videoId={parseInt(currentVideo.recordId)}
        sentenceIndex={currentSentenceIndex}
        onBeforeAction={stopListening}
        containerStyle={isWebScreen ? styles.webPlayerControls : undefined}
        compact={compact}
      />
    );
  const playerControlsElement = renderPlayerControlsElement();
  const webCompactPlayerControlsElement = isWebScreen
    ? renderPlayerControlsElement(true)
    : undefined;
  const settingsButtonsElement = (
    <ShadowSettingsButtons
      mode={shadowMode}
      onModeChange={setShadowMode}
      onHelpSelect={() => setShowWalkthrough(true)}
      speed={recordSpeed}
      onSpeedChange={(s) => {
        setRecordSpeed(s);
        const updated = {
          ...userSettings,
          playbackSpeedDuringRecording: s,
        };
        dispatch(setUserSettings(updated));
        persistUserSettings({
          supabase,
          userId,
          settings: updated,
        });
      }}
      onSettingsPress={() => setIsSettingsVisible(true)}
      showPreviousResults={
        !isWebScreen && !!previousResults && !isRecordingMode
      }
      onPreviousResultsPress={handlePreviousResults}
      previousResultsDisabled={isPlayingRecording}
    />
  );
  const handleRecordingTrashPress = () => {
    handleTrashRecording(true);
    handleResetAnswer();
  };
  const handleRecordingMicPress = () => {
    if (shadowMode === "stream") {
      setShowStreamRecordingTooltip(true);
      return;
    }
    if (isRecordingMode) {
      handleSubmitRecording();
    } else {
      handleEnterRecordingMode();
    }
  };
  const renderWebRecordingControlsElement = (compact = false) =>
    !accuracyResult && !isProcessing ? (
      <View
        style={[
          styles.webRecordingControlsRow,
          compact && styles.webRecordingControlsRowCompact,
        ]}
      >
        {!!previousResults && !isRecordingMode && (
          <TouchableOpacity
            style={[
              styles.webPreviousResultsButton,
              compact && styles.webPreviousResultsButtonCompact,
            ]}
            onPress={handlePreviousResults}
            disabled={isPlayingRecording}
          >
            <Foundation
              name="clipboard-notes"
              size={compact ? 21 : 30}
              color={isPlayingRecording ? "#9aa4ba" : "#4a69bd"}
            />
          </TouchableOpacity>
        )}
        <RecordingControls
          isRecording={isRecordingMode}
          onTrash={handleRecordingTrashPress}
          onMic={handleRecordingMicPress}
          disabled={!hasPermission || isProcessing}
          showContainer={false}
          compact={compact}
        />
      </View>
    ) : null;
  const webRecordingControlsElement = renderWebRecordingControlsElement();
  const webCompactRecordingControlsElement = isWebScreen
    ? renderWebRecordingControlsElement(true)
    : undefined;
  const sentenceNavElement = (
    <NavSwitcher
      onPrev={() => handleShadowPreviousSentence()}
      onNext={handleShadowNextSentence}
      currentIndex={currentSentenceIndex}
      totalItems={currentVideo.sentences.length}
      sentences={currentVideo.sentences}
      onPlayClip={onPlayClip}
      videoId={currentVideo.videoId}
      recordId={currentVideo.recordId}
      style={isWebScreen ? styles.webPanelSentenceNavSwitcher : undefined}
      showSearchIcon={!isWebScreen}
      compact={isWebScreen}
      navigationDisabled={isRecordingMode}
    >
      <Text style={styles.segmentNavText}>
        Segment {currentSentenceIndex + 1} of {currentVideo.sentences.length}
      </Text>
    </NavSwitcher>
  );
  const errorBannerElement = error ? (
    <View style={styles.errorContainer}>
      <View style={styles.errorContent}>
        <Text style={styles.errorText}>{error}</Text>
        {isMissingPermission && (
          <TouchableOpacity
            style={styles.grantPermissionButton}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.grantPermissionText}>Grant Permission</Text>
          </TouchableOpacity>
        )}
      </View>
      {!isMissingPermission && (
        <TouchableOpacity onPress={() => setError(null)}>
          <MaterialIcons name="close" size={20} color="black" />
        </TouchableOpacity>
      )}
    </View>
  ) : null;
  const mobileControlsElement =
    !isRecordingMode && !accuracyResult && !isProcessing ? (
      <View style={styles.recordButtonContainer}>
        {playerControlsElement}
        {settingsButtonsElement}
      </View>
    ) : null;
  const countdownTimerElement = isRecordingMode ? (
    isWebScreen ? (
      <WebCountdownTimerContainer>
        <CountdownTimer
          onStartRecording={handleActualStartRecording}
          onStopRecording={handleSubmitRecording}
          bufferDuration={3}
          onTrash={undefined}
          maxRecordingDuration={getSegmentDuration(
            currentSentenceObject.start,
            currentSentenceObject.end,
            recordSpeed,
          )}
        />
      </WebCountdownTimerContainer>
    ) : (
      <View style={styles.countdownTimer}>
        <CountdownTimer
          onStartRecording={handleActualStartRecording}
          onStopRecording={handleSubmitRecording}
          bufferDuration={3}
          onTrash={() => {
            handleTrashRecording(true);
            handleResetAnswer();
          }}
          maxRecordingDuration={getSegmentDuration(
            currentSentenceObject.start,
            currentSentenceObject.end,
            recordSpeed,
          )}
        />
      </View>
    )
  ) : null;
  const statusContentElement = isProcessing ? (
    <View style={styles.processingContainer}>
      <ActivityIndicator size="large" color="#4ade80" />
      <Text style={styles.processingText}>Analyzing...</Text>
    </View>
  ) : (
    accuracyResult && (
      <>
        <ShadowResults
          accuracyResult={accuracyResult}
          handleNextSentence={handleShadowNextSentence}
          handleRetry={handleRetry}
          properNouns={orderedCharacters}
          variant={isWebScreen ? "webPanel" : "default"}
          audioUri={audioUri}
          playerIsPlaying={playerIsPlaying}
          pausePlayer={pausePlayer}
          playSentence={playSentence}
          onPlaybackStateChange={setIsPlayingRecording}
          onPlaybackError={setError}
        />
        {nextSentenceCountdown > 0 && (
          <View style={styles.nextSentenceCountdownRefContainer}>
            <Text style={styles.nextSentenceCountdownRefText}>
              {nextSentenceCountdown}
            </Text>
          </View>
        )}
      </>
    )
  );
  const memorizeContentElement = (
    <MemorizeContent
      time={time}
      playKey={playKey}
      playerSpeed={playerSpeed}
      currentSentence={currentSentenceObject!}
      playerIsPlaying={playerIsPlaying}
      isRecording={isRecording}
      localDifficulty={localDifficulty}
      onLocalDifficultyChange={setLocalDifficulty}
      playWordSnippet={handlePlaySnippetAgain}
      vocabCache={vocabCache}
      onVocabCacheUpdate={handleVocabCacheUpdate}
      layout={isWebScreen ? "webPlayer" : "default"}
      webPlayerControls={isWebScreen ? playerControlsElement : undefined}
      webRecordingControls={
        isWebScreen ? webRecordingControlsElement : undefined
      }
      webWidePlayerControls={webCompactPlayerControlsElement}
      webWideRecordingControls={webCompactRecordingControlsElement}
      webSentenceNav={isWebScreen ? sentenceNavElement : undefined}
      webCountdownTimer={isWebScreen ? countdownTimerElement : undefined}
      webStatusContent={isWebScreen ? statusContentElement : undefined}
      webLiveTranscript={
        USE_OPENAI_REALTIME_TRANSCRIPTION && isWebScreen && isRecordingMode
          ? liveTranscript
          : ""
      }
      translationText={currentSentenceTranslationText}
      isLoadingTranslation={isLoadingInsights}
      onRequestTranslation={onRequestSentenceTranslation}
    />
  );
  const streamBannerElement =
    shadowMode === "stream" && !streamBannerDismissed ? (
      <View
        style={[styles.streamBanner, isWebScreen && styles.streamBannerWeb]}
      >
        <Text style={styles.streamBannerText}>
          You are in Stream mode, the video will not stop at the end of
          segments, switch back to{" "}
          <Text
            style={styles.streamBannerLink}
            onPress={() => setShadowMode("shadow")}
          >
            Shadow
          </Text>{" "}
          mode to stop video.
        </Text>
        <TouchableOpacity
          onPress={() => setStreamBannerDismissed(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.streamBannerClose}
        >
          <Feather name="x" size={16} color="#7a5d00" />
        </TouchableOpacity>
      </View>
    ) : null;
  const voiceContentElement = (
    <ScrollView
      style={styles.transcriptContainer}
      keyboardShouldPersistTaps="handled"
    >
      <VoiceCommands
        isListening={isListening}
        isClipPlaying={playerIsPlaying || isSpeakingResponse}
        isRecording={isRecordingMode}
        activeCommand={activeCommand}
        hasError={voiceCommandError}
        timedOut={voiceCommandTimedOut}
        permissionDenied={voicePermissionDenied}
        onActivate={startListening}
        onCommandPress={handleCommandPress}
        commands={[
          {
            command: "record" as const,
            label: "Record",
            description: "Start recording",
          },
          {
            command: "repeat" as const,
            label: "Repeat",
            description: "Replay the clip",
          },
          {
            command: "slow" as const,
            label: "Slowdown",
            description: "Replay the clip in slow mode",
          },
          {
            command: "next" as const,
            label: "Next",
            description: "Go to next segment",
          },
          {
            command: "previous" as const,
            label: "Previous",
            description: "Go to previous segment",
          },
          ...["First Phrase", "Second Phrase", "Third Phrase"]
            .slice(0, subSegments.length)
            .map((label, i) => ({
              command: (
                ["first_phrase", "second_phrase", "third_phrase"] as const
              )[i],
              label,
              description: `Replay phrase ${i + 1}`,
            })),
        ]}
      />
    </ScrollView>
  );
  const contentTabsElement =
    isVoiceMode && !accuracyResult && !isProcessing
      ? voiceContentElement
      : isWebScreen
        ? memorizeContentElement
        : accuracyResult || isProcessing
          ? null
          : memorizeContentElement;
  const recordingControlsElement =
    !accuracyResult && !isProcessing ? (
      <RecordingControls
        isRecording={isRecordingMode}
        onTrash={handleRecordingTrashPress}
        onMic={handleRecordingMicPress}
        disabled={!hasPermission || isProcessing}
      />
    ) : null;
  const overlaysElement = (
    <>
      {isSettingsVisible && (
        <SettingsModal
          visible={isSettingsVisible}
          onClose={() => setIsSettingsVisible(false)}
          recordSpeed={recordSpeed}
          setRecordSpeed={setRecordSpeed}
          initMute={muteVideoWhenRecording}
          setMuteWhenRecording={setMuteVideoWhenRecording}
          onSave={(settings) => {
            persistUserSettings({
              supabase,
              userId,
              settings,
            });
          }}
        />
      )}
      {showNoVocabFoundTooltip && (
        <TooltipModal
          isVisible={showNoVocabFoundTooltip}
          onRequestClose={() => setShowNoVocabFoundTooltip(false)}
        >
          <Text style={styles.noVocabFoundTooltipText}>
            Vocab is in this segment or a previous segment
          </Text>
        </TooltipModal>
      )}
      {showStreamRecordingTooltip && (
        <TooltipModal
          isVisible={showStreamRecordingTooltip}
          onRequestClose={() => setShowStreamRecordingTooltip(false)}
        >
          <Text style={styles.shadowInstructionsText}>
            Recording is disabled while in stream mode, switch back to shadow
            mode to activate
          </Text>
        </TooltipModal>
      )}
      {showShadowInstructions && (
        <TooltipModal
          isVisible={showShadowInstructions}
          onRequestClose={() => setShowShadowInstructions(false)}
        >
          <Text style={styles.shadowInstructionsText}>
            Listen to the sentence until memorized and then press the microphone
            button to record your pronunciation of it...
          </Text>
        </TooltipModal>
      )}
      <TranslationReviewModal
        segmentDuration={
          reviewTranslationSentence
            ? getSegmentDuration(
                reviewTranslationSentence.start,
                reviewTranslationSentence.end,
                recordSpeed,
              )
            : 60
        }
        visible={reviewType === "translation"}
        englishTranslation={reviewTranslationSentence?.translation ?? ""}
        targetText={reviewTranslationSentence?.text ?? ""}
        targetWords={reviewTranslationSentence?.words ?? []}
        properNouns={reviewTranslationSentence?.properNouns ?? []}
        onComplete={proceedAfterReview}
        onClose={proceedAfterReview}
      />
      <NoCreditsModal
        visible={showNoCreditsModal}
        onClose={() => setShowNoCreditsModal(false)}
      />
      <SignInPromptModal
        visible={showSignInModal}
        onClose={() => {
          setShowSignInModal(false);
          setAutoplay(true);
          dispatch(refreshVideoPlayer());
        }}
        onSignIn={() => {
          setShowSignInModal(false);
        }}
      />
      <WalkthroughModal
        visible={showWalkthrough}
        onComplete={() => setShowWalkthrough(false)}
        closeable
      />
    </>
  );
  const layoutProps = {
    styles,
    errorBanner: errorBannerElement,
    mobileControls: mobileControlsElement,
    countdownTimer: isWebScreen ? null : countdownTimerElement,
    statusContent: statusContentElement,
    streamBanner: streamBannerElement,
    contentTabs: contentTabsElement,
    recordingControls: recordingControlsElement,
    sentenceNav: sentenceNavElement,
    memorizeContent: memorizeContentElement,
    playerControls: playerControlsElement,
    settingsButtons: settingsButtonsElement,
    overlays: overlaysElement,
    isRecordingMode,
    showPracticeContent: !accuracyResult && !isProcessing,
    isPlayerFullscreen,
  };

  return isWebScreen ? (
    <ShadowTabWeb {...layoutProps} />
  ) : (
    <ShadowTabMobile {...layoutProps} />
  );
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  transcriptContainer: {
    flex: 1,
  },
  webPracticeLayout: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  webPracticeSide: {
    flex: 1,
    minWidth: 0,
  },
  webMemorizeColumn: {
    flex: 2,
    minWidth: 0,
  },
  webControlsColumn: {
    flex: 1,
    minWidth: 260,
    alignItems: "center",
    gap: 12,
  },
  webSettingsButtonsOverlay: {
    position: "fixed" as any,
    top: 12,
    right: 82,
    zIndex: 200,
    alignItems: "center",
  },
  webFullscreenShadowRoot: {
    backgroundColor: "transparent",
  },
  webPlayerControls: {
    alignSelf: "auto",
    flexWrap: "nowrap",
  },
  webRecordingControlsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 24,
    maxWidth: "100%",
  },
  webRecordingControlsRowCompact: {
    gap: 10,
  },
  webPreviousResultsButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(74,105,189,0.18)",
  },
  webPreviousResultsButtonCompact: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  webPanelSentenceNavSwitcher: {
    width: "100%",
    minHeight: 40,
    backgroundColor: "#f7f9ff",
    borderBottomWidth: 0,
    paddingTop: 5,
    paddingBottom: 5,
  },
  webStatusOverlay: {
    position: "fixed" as any,
    top: 52,
    left: 0,
    right: 0,
    height: 480,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 40,
  },
  webStatusOverlayContent: {
    width: "min(100%, 850px)" as any,
    height: "100%",
    backgroundColor: "white",
    justifyContent: "center",
    overflow: "hidden",
  },
  countdownTimer: {
    marginHorizontal: 16,
    marginVertical: 10,
  },
  webCountdownTimer: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    marginHorizontal: 0,
  },
  webCountdownTimerNarrow: {
    maxWidth: "100%",
  },
  webCountdownTimerWideCompact: {
    width: "auto",
    marginVertical: 0,
  },
  instructionContainer: {
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    marginTop: 20,
    paddingHorizontal: 24,
  },
  shadowInstructionsText: {
    color: "white",
    textAlign: "center",
    fontSize: 14,
  },
  streamDisabledContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  streamDisabledText: {
    color: "#888",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  instructionText: {
    color: "#666",
    textAlign: "center",
    fontSize: 14,
  },
  recordSpeedBubble: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fafafa",
  },
  recordSpeedBubbleText: {
    fontSize: 16,
    fontWeight: "500",
    opacity: 0.5,
    color: "black",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: "#ff4757",
    borderRadius: 8,
  },
  errorContent: {
    flex: 1,
  },
  errorText: {
    color: "#fff",
    textAlign: "center",
  },
  grantPermissionButton: {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "center",
  },
  grantPermissionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  segmentNavText: {
    opacity: 0.6,
  },
  cefrBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cefrBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  noVocabFoundTooltipText: {
    color: "#fff",
    textAlign: "center",
  },
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#3d3a52",
    borderRadius: 24,
    gap: 8,
  },
  rightArrowContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    gap: 16,
  },
  recordButtonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "600",
  },
  processingContainer: {
    alignItems: "center",
    marginTop: 24,
    gap: 12,
    minHeight: 200,
    justifyContent: "center",
  },
  processingText: {
    color: "#666",
    fontSize: 14,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  recordButtonContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sentenceNavContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 40,
    marginTop: 16,
  },
  prevSentenceButton: {
    flexDirection: "row",
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "black",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderRadius: 24,
    gap: 8,
    alignSelf: "center",
  },
  nextSentenceButton: {
    flexDirection: "row",
    backgroundColor: "#4ade80",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: "#4ade80",
    borderRadius: 24,
    gap: 8,
    alignSelf: "center",
  },
  navButtonDisabled: {
    opacity: 0.5,
    borderColor: "#ccc",
  },
  navButtonTextDisabled: {
    color: "#ccc",
  },
  sentenceIndicator: {
    color: "#666",
    fontSize: 14,
    fontWeight: "600",
  },
  nextSentenceCountdownRefContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  nextSentenceCountdownRefText: {
    fontSize: 24,
    fontWeight: "600",
  },
  // Input Area styles
  textInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: "#222",
    borderWidth: 1,
    borderColor: "#ddd",
    maxHeight: 100,
  },
  previousResultsButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: 4,
  },
  previousResultsText: {
    color: "#4a69bd",
    fontSize: 14,
    fontWeight: "500",
  },
  translationOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  translationModal: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    width: 280,
    alignItems: "center",
  },
  translationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },
  translationText: {
    fontSize: 15,
    color: "#333",
    textAlign: "center",
    lineHeight: 22,
  },
  streamBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF3C7",
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 10,
  },
  streamBannerWeb: {
    marginTop: 16,
    maxWidth: 830,
    alignSelf: "center",
  },
  streamBannerText: {
    flex: 1,
    fontSize: 14,
    color: "#7a5d00",
    lineHeight: 20,
  },
  streamBannerLink: {
    fontWeight: "700",
    textDecorationLine: "underline",
    color: "#7a5d00",
  },
  streamBannerClose: {
    paddingTop: 2,
  },
});

export default ShadowTab;
