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
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import Feather from "@expo/vector-icons/Feather";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useAuth } from "@clerk/clerk-expo";
import * as FileSystem from "expo-file-system/legacy";
import {
  AutoReviewDetails,
  AutoShadowDetails,
  ContentTab,
  RootState,
  SegmentWord,
  VoiceCommand,
} from "../../types";
import SelectVideoPrompt from "./SelectVideoPrompt";
import { useRecording } from "../../hooks/useRecording";
import {
  sendAudioForTranscription,
  playLocalAudio,
  stopAudio,
  playDing,
  playDingStop,
  playDingWarning,
} from "../../helpers/streaming_helpers";
import { AccuracyResult, CachedResponse } from "../../types";
import SettingsModal from "./SettingsModal";
import SpeedDial from "./SpeedDial";
import CountdownTimer from "./CountdownTimer";
import { capitalize, hasUnnaturalSpeechTiming } from "../../helpers/helpers";
import ShadowResults from "./ShadowResults";
import TooltipModal from "../common/TooltipModal";
import NavSwitcher from "../common/NavSwitcher";
import ContentTabBar from "../common/ContentTabBar";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import Foundation from "@expo/vector-icons/Foundation";
import {
  persistUserSettings,
  persistCurrentShadowTab,
  incrementFocusVocabReviewCount,
  saveFocusVocabTranslation,
  deductUserCredit,
} from "../../requests";
import GuessWordModal from "../common/GuessWordModal";
import TranslationReviewModal from "./TranslationReviewModal";
import {
  setCurrentShadowTab,
  setUserSettings,
  setUserCredits,
} from "../../store/actions/dataActions";
import Insights from "./Insights";
import PlayerControls from "./PlayerControls";
import VoiceCommands from "./VoiceCommands";
import { useCachedAudio } from "../../hooks/useCachedAudio";
import { useVoiceCommand } from "../../hooks/useVoiceCommand";
import { computeSubSegments } from "../../helpers/helpers";
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
import TranslateContent from "./TranslateContent";
import ModeSwitcher from "./ModeSwitcher";

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
  sentenceTranslation: string | null;
  autoShadowDetails?: AutoShadowDetails | null;
  onAutoShadowHandled?: () => void;
  mutePlayer: () => void;
  unMutePlayer: () => void;
  shadowMode: "shadow" | "stream";
  setShadowMode: (mode: "shadow" | "stream") => void;
}

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
  isPlayingWordSnippet,
  hintWords,
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
}) => {
  const dispatch = useDispatch();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const selectedTab = useSelector((state: RootState) => state.currentShadowTab);

  // Track when a clip was just started so voice mode doesn't connect prematurely
  const clipJustStartedRef = useRef(false);

  // Jump to a specific segment when returning from review
  useEffect(() => {
    if (autoShadowDetails && currentVideo?.sentences && onPlayClip) {
      const sentence =
        currentVideo.sentences[autoShadowDetails.backToSegmentId];
      if (sentence) {
        clipJustStartedRef.current = true;
        onPlayClip(sentence.start);
        setCurrentSentence(sentence.index);
      }
      if (autoShadowDetails.isVoiceMode) {
        setSelectedTab("voice");
      }
      onAutoShadowHandled?.();
    }
  }, [autoShadowDetails]);

  const currentSentenceIndex = currentVideo ? currentVideo.currentSentence : 0;
  const currentSentenceObject = currentVideo
    ? { ...currentVideo.sentences[currentSentenceIndex] }
    : null;

  const supabase = useSupabaseWithClerk();
  const { userId, isSignedIn } = useAuth();
  const recordingExtensionRef = useRef<NodeJS.Timeout | null>(null);
  // Speed control state (internal settings)
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const userCredits = useSelector((state: RootState) => state.userCredits);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(
    userSettings.playbackSpeed,
  );
  const [recordSpeed, setRecordSpeed] = useState<number>(
    userSettings.playbackSpeedDuringRecording,
  );
  const [muteVideoWhenRecording, setMuteVideoWhenRecording] =
    useState<boolean>(true);

  // Insight visibility state (lifted so SettingsModal can update them)
  const [showWordsHints, setShowWordsHints] = useState<boolean>(
    userSettings.showWordsHints,
  );
  const [showCharacters, setShowCharacters] = useState<boolean>(
    userSettings.showCharacters,
  );
  const [showPhrases, setShowPhrases] = useState<boolean>(
    userSettings.showPhrases,
  );

  // Local difficulty state — survives tab switches, resets on segment change
  const [localDifficulty, setLocalDifficulty] = useState<number>(
    userSettings.defaultMemorizeDifficulty,
  );
  useEffect(() => {
    setLocalDifficulty(userSettings.defaultMemorizeDifficulty);
    setError(null);
  }, [currentSentenceIndex]);

  // Recording and transcription state
  const [error, setError] = useState<string | null>(null);
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [accuracyResult, setAccuracyResult] = useState<AccuracyResult | null>(
    null,
  );
  const [previousResults, setPreviousResults] = useState<
    (AccuracyResult & { recordingId: string }) | null
  >(null);
  const [isSettingsVisible, setIsSettingsVisible] = useState<boolean>(false);
  const [isRecordingMode, setIsRecordingMode] = useState<boolean>(false);
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
  const [showTranslation, setShowTranslation] = useState<boolean>(false);
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
  } | null>(null);
  const reviewVocabIdRef = useRef<number | null>(null);
  const sentenceHistoryRef = useRef<
    Record<number, { text: string; translation: string; words: SegmentWord[] }>
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
    reviewVocabIdRef.current = null;
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
        reviewVocabIdRef.current = null;
      }
    });
    return () => subscription.remove();
  }, [reviewType]);

  const setSelectedTab = useCallback(
    (tab: ContentTab) => {
      dispatch(setCurrentShadowTab(tab));
      persistCurrentShadowTab({
        supabase,
        userId: userId ?? null,
        currentShadowTab: tab,
      });
    },
    [dispatch, supabase, userId],
  );
  const [isSpeakingResponse, setIsSpeakingResponse] = useState(false);
  const [activeCommand, setActiveCommandState] = useState<VoiceCommand>(null);
  const setActiveCommand = useCallback((command: VoiceCommand) => {
    setActiveCommandState(command);
  }, []);

  // Text input state
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [isReplayingPhrase, setIsReplayingPhrase] = useState(false);
  const [replayingPhraseIndex, setReplayingPhraseIndex] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (playerIsPlaying) {
      setActiveCommand(null);
    } else {
      setIsReplayingPhrase(false);
      setReplayingPhraseIndex(null);
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
        if (selectedTab !== "voice") {
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
      sentenceTranslation &&
      currentSentenceObject &&
      (accuracyResult || previousResults)
    ) {
      sentenceHistoryRef.current[currentSentenceIndex] = {
        text: currentSentenceObject.text,
        translation: sentenceTranslation,
        words: currentSentenceObject.words,
      };
    }
  }, [
    sentenceTranslation,
    currentSentenceIndex,
    accuracyResult,
    previousResults,
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

  const submitRecording = useCallback(
    async (uri: string) => {
      if (!currentVideo) return;

      setIsProcessing(true);
      setError(null);

      // Copy recording to a stable path so it survives temp file cleanup
      const stableUri = `${FileSystem.cacheDirectory}shadow_recording_${currentSentenceIndex}_${Date.now()}.wav`;
      try {
        await FileSystem.copyAsync({ from: uri, to: stableUri });
      } catch {
        console.warn("Could not copy recording, using original URI");
      }
      const safeUri = (await FileSystem.getInfoAsync(stableUri)).exists
        ? stableUri
        : uri;

      try {
        const transcriptionResult = await sendAudioForTranscription(
          safeUri,
          userSettings.targetLanguage,
        );
        const spokenWords = transcriptionResult.transcript
          .split(/\s+/)
          .filter(Boolean);
        const accuracy = calculateAccuracyFromWords(spokenWords);

        if (selectedTab !== "voice") {
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
        if (currentSentenceObject && sentenceTranslation) {
          sentenceHistoryRef.current[currentSentenceIndex] = {
            text: currentSentenceObject.text,
            translation: sentenceTranslation,
            words: currentSentenceObject.words,
          };
        }
        setAudioUri(safeUri);
        saveShadowResult(spokenWords);

        // Deduct 1 credit after successful recording submission
        const newCredits = await deductUserCredit({ supabase, userId });
        if (newCredits !== null) {
          dispatch(setUserCredits(newCredits));
        }
      } catch (err) {
        console.error("Transcription error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to process audio",
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [
      calculateAccuracyFromWords,
      saveShadowResult,
      userId,
      currentVideo,
      currentSentenceIndex,
      selectedTab,
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

  // Clear the clip-just-started flag once the player actually starts playing
  useEffect(() => {
    if (playerIsPlaying) {
      clipJustStartedRef.current = false;
    }
  }, [playerIsPlaying]);

  // Start listening when on voice tab and nothing is playing
  useEffect(() => {
    if (
      selectedTab === "voice" &&
      !playerIsPlaying &&
      !clipJustStartedRef.current &&
      !isSpeakingResponse &&
      !isRecordingMode &&
      !isRecording &&
      !isProcessing &&
      !accuracyResult
    ) {
      startListening();
    } else {
      if (isListening) {
        stopListening();
      }
    }
  }, [
    selectedTab,
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
      selectedTab === "voice" &&
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
    selectedTab,
    currentSentenceObject?.end,
    sentenceEnded,
  ]);

  // Reset warning flag when sentence changes
  useEffect(() => {
    playedEndWarningRef.current = false;
  }, [currentSentenceIndex]);

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

  const proceedAfterReview = () => {
    if (
      reviewType === "vocab" &&
      reviewVocabIdRef.current &&
      supabase &&
      currentVideo?.videoViewId
    ) {
      incrementFocusVocabReviewCount({
        supabase,
        videoViewId: currentVideo.videoViewId,
        vocabularyId: reviewVocabIdRef.current,
      });
      dispatch(incrementFocusVocabReview(reviewVocabIdRef.current));
    }
    setReviewType(null);
    setReviewVocabWord(null);
    setReviewVocabSentenceText(null);
    setReviewTranslationSentence(null);
    reviewVocabIdRef.current = null;
    doAdvanceToNextSentence();
  };

  const tryStartReview = (): boolean => {
    if (!isSignedIn) return false;
    if (userSettings.disableReviewMode) return false;

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

    setReviewTranslationSentence({
      text: historySentence.text,
      translation: historySentence.translation,
      words: historySentence.words,
    });
    setReviewType("translation");
    pausePlayer();
    return true;
  };

  const handleShadowNextSentence = () => {
    if (!tryStartReview()) {
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

    if (recordSpeed > 0) {
      setPlayerSpeed(recordSpeed);
    }
    setIsRecordingMode(true);
    handleResetState();
    isTransitioningRef.current = true;
    justRecordedRef.current = true;
  };

  const handleActualStartRecording = async () => {
    if (selectedTab === "voice") playDing();
    await startRecording();
    if (recordSpeed > 0) {
      playSentence();
    }
    setTimeout(() => {
      isTransitioningRef.current = false;
    }, 1000);
  };

  const handleSubmitRecording = async () => {
    if (selectedTab === "voice") playDingStop();
    pausePlayer();
    unMutePlayer();
    setPlayerSpeed(1);
    await stopRecording(false);
    setIsRecordingMode(false);
  };

  const handleTrashRecording = async (trashed: boolean = false) => {
    voiceInitiatedRecordRef.current = false;
    pausePlayer();
    unMutePlayer();
    setPlayerSpeed(1);
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

  const stopRecordingPlayback = useCallback(async () => {
    await stopAudio();
    setIsPlayingRecording(false);
  }, []);

  const handlePlayUserRecording = useCallback(async () => {
    if (!audioUri) return;

    if (playerIsPlaying) {
      pausePlayer();
    }

    if (isPlayingRecording) {
      await stopRecordingPlayback();
      return;
    }

    const wasPlaying = playerIsPlaying;
    if (wasPlaying) pausePlayer();

    setIsPlayingRecording(true);
    try {
      await playLocalAudio(audioUri);
    } catch (err) {
      console.error("Failed to play recording:", err);
      setError(err instanceof Error ? err.message : "Failed to play recording");
    } finally {
      setIsPlayingRecording(false);
      if (wasPlaying) playSentence();
    }
  }, [
    audioUri,
    isPlayingRecording,
    playerIsPlaying,
    pausePlayer,
    playSentence,
    stopRecordingPlayback,
  ]);

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

  const getBufferDuration = (recordSpeed: number) => {
    if (recordSpeed <= 0.35) return 2;
    if (recordSpeed <= 0.6) return 3;
    if (recordSpeed <= 0.75) return 4;
    return 5;
  };

  const handlePlayPhrase = (start, end, phraseIndex?: number) => {
    setIsReplayingPhrase(true);
    setReplayingPhraseIndex(phraseIndex ?? null);
    setPlayerSpeed(playbackSpeed);
    playClipSnippet(start, end);
  };

  if (!currentVideo) {
    return <SelectVideoPrompt />;
  }

  return (
    <>
      <View style={styles.container}>
        {error && (
          <View style={styles.errorContainer}>
            <View style={styles.errorContent}>
              <Text style={styles.errorText}>{error}</Text>
              {error.toLowerCase().includes("permission") && (
                <TouchableOpacity
                  style={styles.grantPermissionButton}
                  onPress={() => Linking.openSettings()}
                >
                  <Text style={styles.grantPermissionText}>
                    Grant Permission
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => setError(null)}>
              <MaterialIcons name="close" size={20} color="black" />
            </TouchableOpacity>
          </View>
        )}

        {/* Sentence Navigation */}
        <NavSwitcher
          onPrev={() => handleShadowPreviousSentence()}
          onNext={handleShadowNextSentence}
          currentIndex={currentSentenceIndex}
          totalItems={currentVideo.sentences.length}
          sentences={currentVideo.sentences}
          onPlayClip={onPlayClip}
          videoId={currentVideo.videoId}
          recordId={currentVideo.recordId}
        >
          <Text style={styles.segmentNavText}>
            Segment {currentSentenceIndex + 1} of{" "}
            {currentVideo.sentences.length + 1}
          </Text>
        </NavSwitcher>
        {!isRecordingMode && !accuracyResult && !isProcessing && (
          <View style={styles.recordButtonContainer}>
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
            />
            <View style={styles.settingsButtonContainer}>
              {previousResults && (
                <TouchableOpacity
                  style={styles.previousResultsButtonInner}
                  onPress={handlePreviousResults}
                  disabled={isPlayingRecording}
                >
                  <Foundation
                    name="clipboard-notes"
                    size={32}
                    color="#4a69bd"
                  />
                </TouchableOpacity>
              )}
              <ModeSwitcher mode={shadowMode} onModeChange={setShadowMode} />
              <SpeedDial
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
              />
              <TouchableOpacity onPress={() => setIsSettingsVisible(true)}>
                <Feather name="settings" size={30} color="#222222" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        {isRecordingMode && (
          <View style={styles.countdownTimer}>
            <CountdownTimer
              onStartRecording={handleActualStartRecording}
              onStopRecording={handleSubmitRecording}
              sentenceEnded={sentenceEnded}
              bufferDuration={getBufferDuration(recordSpeed)}
              onTrash={() => {
                handleTrashRecording(true);
                handleResetAnswer();
              }}
            />
          </View>
        )}
        <View style={styles.transcriptContainer}>
          {/* Recording button or processing indicator */}
          {isProcessing ? (
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
          )}
          {/* Play user recording button - shown when a local recording exists */}
          {!isRecordingMode && !isProcessing && accuracyResult && audioUri && (
            <View style={styles.playRecordingContainer}>
              <TouchableOpacity
                style={styles.playRecordingButton}
                onPress={handlePlayUserRecording}
              >
                <MaterialIcons
                  name={isPlayingRecording ? "stop" : "play-arrow"}
                  size={20}
                  color="#4a69bd"
                />
                <Text style={styles.playRecordingButtonText}>
                  {isPlayingRecording ? "Stop" : "Play Recording"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {!accuracyResult && !isProcessing && (
            <ContentTabBar
              tabs={[
                { key: "memorize", label: "Transcript" },
                { key: "insights", label: "Insights" },
                { key: "translate", label: "Translated" },
                { key: "voice", label: "Voice" },
              ]}
              selectedTab={selectedTab}
              onSelectTab={(key) => setSelectedTab(key as ContentTab)}
              hidden={false}
            >
              {selectedTab === "memorize" ? (
                <MemorizeContent
                  time={time}
                  playKey={playKey}
                  playerSpeed={playerSpeed}
                  currentSentence={currentSentenceObject!}
                  playerIsPlaying={playerIsPlaying}
                  disableGuessModal={isRecording}
                  localDifficulty={localDifficulty}
                  onLocalDifficultyChange={setLocalDifficulty}
                />
              ) : selectedTab === "translate" ? (
                <TranslateContent
                  translationText={sentenceTranslation}
                  sentenceText={currentSentenceObject?.text}
                  isLoading={isLoadingInsights}
                  time={time}
                  playerIsPlaying={playerIsPlaying}
                  segmentStart={currentSentenceObject?.start}
                  segmentEnd={currentSentenceObject?.end}
                  playKey={playKey}
                  isRecording={isRecording}
                  playerSpeed={playerSpeed}
                />
              ) : (
                <ScrollView
                  style={styles.transcriptContainer}
                  keyboardShouldPersistTaps="handled"
                >
                  {selectedTab === "insights" ? (
                    <Insights
                      isLoading={isLoadingInsights}
                      characters={orderedCharacters}
                      sentenceText={currentSentenceObject?.text ?? ""}
                      subSegments={subSegments}
                      hintWords={hintWords}
                      handlePlayWordSnippet={handlePlaySnippetAgain}
                      isPlayingWordSnippet={isPlayingWordSnippet}
                      showWordsHints={showWordsHints}
                      showCharacters={showCharacters}
                      showPhrases={showPhrases}
                      onReplaySentence={() => handlePlaySnippetAgain()}
                      onPlayClip={handlePlayPhrase}
                      playerIsPlaying={playerIsPlaying && !isReplayingPhrase}
                      replayingPhraseIndex={replayingPhraseIndex}
                      playbackTime={time}
                      isRecordingMode={isRecordingMode}
                    />
                  ) : (
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
                      commands={
                        shadowMode === "stream"
                          ? [
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
                              {
                                command: "two_back" as const,
                                label: "Two Back",
                                description: "Go back 2 segments",
                              },
                              {
                                command: "three_back" as const,
                                label: "Three Back",
                                description: "Go back 3 segments",
                              },
                              {
                                command: "five_back" as const,
                                label: "Five Back",
                                description: "Go back 5 segments",
                              },
                            ]
                          : [
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
                              ...[
                                "First Phrase",
                                "Second Phrase",
                                "Third Phrase",
                              ]
                                .slice(0, subSegments.length)
                                .map((label, i) => ({
                                  command: (
                                    [
                                      "first_phrase",
                                      "second_phrase",
                                      "third_phrase",
                                    ] as const
                                  )[i],
                                  label,
                                  description: `Replay phrase ${i + 1}`,
                                })),
                            ]
                      }
                    />
                  )}
                </ScrollView>
              )}
            </ContentTabBar>
          )}
        </View>

        {/* Input Area - always visible when not in recording mode or showing results */}
        {!accuracyResult && !isProcessing && (
          <RecordingControls
            isRecording={isRecordingMode}
            onTrash={() => {
              handleTrashRecording(true);
              handleResetAnswer();
            }}
            onMic={() => {
              if (shadowMode === "stream") {
                setShowStreamRecordingTooltip(true);
                return;
              }
              if (isRecordingMode) {
                handleSubmitRecording();
              } else {
                handleEnterRecordingMode();
              }
            }}
            disabled={!hasPermission || isProcessing}
          />
        )}
      </View>
      {isSettingsVisible && (
        <SettingsModal
          visible={isSettingsVisible}
          onClose={() => setIsSettingsVisible(false)}
          recordSpeed={recordSpeed}
          setRecordSpeed={setRecordSpeed}
          initMute={muteVideoWhenRecording}
          setMuteWhenRecording={setMuteVideoWhenRecording}
          onSave={(settings) => {
            setShowWordsHints(settings.showWordsHints);
            setShowCharacters(settings.showCharacters);
            setShowPhrases(settings.showPhrases);
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
        visible={reviewType === "translation"}
        englishTranslation={reviewTranslationSentence?.translation ?? ""}
        targetText={reviewTranslationSentence?.text ?? ""}
        targetWords={reviewTranslationSentence?.words ?? []}
        targetLanguage={userSettings.targetLanguage}
        onComplete={proceedAfterReview}
        onClose={proceedAfterReview}
      />

      {/* No Credits Modal */}
      <NoCreditsModal
        visible={showNoCreditsModal}
        onClose={() => setShowNoCreditsModal(false)}
      />

      {/* Sign In Prompt Modal */}
      <SignInPromptModal
        visible={showSignInModal}
        onClose={() => setShowSignInModal(false)}
      />
    </>
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
  countdownTimer: {
    marginVertical: 11,
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
  settingsButtonContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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
  playRecordingContainer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  previousResultsButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: 4,
  },
  previousResultsButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    paddingVertical: 12,
    borderRadius: 24,
  },
  previousResultsText: {
    color: "#4a69bd",
    fontSize: 14,
    fontWeight: "500",
  },
  playRecordingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#e8f0fe",
    borderWidth: 1,
    borderColor: "#4a69bd",
    gap: 8,
  },
  playRecordingButtonText: {
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
});

export default ShadowTab;
