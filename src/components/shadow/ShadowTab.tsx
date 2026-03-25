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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TextInput,
  LayoutAnimation,
  Linking,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useSelector, useDispatch } from "react-redux";
import Feather from "@expo/vector-icons/Feather";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AntDesign from "@expo/vector-icons/AntDesign";

import { useAuth } from "@clerk/clerk-expo";
import { RootState, SegmentWord, VoiceCommand } from "../../types";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import FullSegmentTranscriptBubble from "../watch/FullSegmentTranscriptBubble";
import { useRecording } from "../useRecording";
import {
  sendAudioForTranscription,
  calculateAccuracy,
  uploadAudioToStorage,
  playAudioFromStorage,
  trimSilenceFromAudio,
  playAudio,
  playAudioSequence,
  generateTTS,
  playAiSpeech,
  playDing,
  playDingStop,
} from "../streaming_helpers";
import { AccuracyResult, CachedResponse } from "../../types";
import SettingsModal from "./SettingsModal";
import CountdownTimer from "./CountdownTimer";
import {
  capitalize,
  findSentenceWithVocab,
  getResponseForPercentage,
  isInterestingVocab,
  normalizeWord,
  splitIntoSentences,
  stripPunctuation,
} from "../../helpers";
import ShadowResults from "./ShadowResults";
import VocabList from "../watch/VocabList";
import TooltipModal from "../common/TooltipModal";
import NavSwitcher from "../common/NavSwitcher";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import FeaturedVocab from "../watch/FeaturedVocab";
import Foundation from "@expo/vector-icons/Foundation";
import FocusSentenceRequest from "./FocusSentenceRequest";
import { persistUserSettings } from "../../requests";
import {
  setCachedResponses,
  setCurrentTab,
} from "../../store/actions/dataActions";
import Insights from "./Insights";
import PlayerControls from "./PlayerControls";
import VoiceCommands from "./VoiceCommands";
import { usePhraseRecording } from "../usePhraseRecording";
import { useVoiceCommand } from "../useVoiceCommand";
import { computeSubSegments } from "../../helpers";

interface ShadowTabProps {
  time: number;
  handleNextSentence: () => void;
  handlePreviousSentence: () => void;
  isActive?: boolean;
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
}

const ShadowTab: React.FC<ShadowTabProps> = ({
  time,
  handleNextSentence: parentHandleNextSentence,
  handlePreviousSentence: parentHandlePreviousSentence,
  isActive = true,
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
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);

  const currentSentenceIndex = currentVideo ? currentVideo.currentSentence : 0;
  const currentSentenceObject = currentVideo
    ? { ...currentVideo.sentences[currentSentenceIndex] }
    : null;
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const recordingExtensionRef = useRef<NodeJS.Timeout | null>(null);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  // Speed control state (internal settings)
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(
    userSettings.playbackSpeed,
  );
  const [recordSpeed, setRecordSpeed] = useState<number>(0.75);
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

  // Recording and transcription state
  const [error, setError] = useState<string | null>(null);
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
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(
    null,
  );
  const [isPlayingRecording, setIsPlayingRecording] = useState<boolean>(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isTrimmingAudio, setIsTrimmingAudio] = useState<boolean>(false);
  const [showShadowInstructions, setShowShadowInstructions] =
    useState<boolean>(false);
  const [showTranslation, setShowTranslation] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<"insights" | "voice">(
    "insights",
  );
  const [isSpeakingResponse, setIsSpeakingResponse] = useState(false);
  const [activeCommand, setActiveCommand] = useState<VoiceCommand>(null);
  const [voiceHintIndex, setVoiceHintIndex] = useState(0);

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

  // Phrase recording
  const subSegments = useMemo(
    () => computeSubSegments(currentSentenceObject?.words ?? []),
    [currentSentenceObject?.words],
  );
  const {
    phraseRecordings,
    recordingPhraseIndex,
    allPhrasesRecorded,
    startPhraseRecording,
    stopPhraseRecording,
    submitPhraseRecordings,
    resetPhraseRecordings,
  } = usePhraseRecording(subSegments.length);

  const cachedResponses = useSelector(
    (state: RootState) => state.cachedResponses,
  );

  const dispatch = useDispatch();

  const getOrCreateWordRecording = useCallback(
    async (wordRaw: string): Promise<string | null> => {
      const word = stripPunctuation(wordRaw);
      const existing = cachedResponses.find((r) => r.response_text === word);
      if (existing?.recording) return existing.recording;

      try {
        const base64 = await generateTTS(word);
        if (supabase) {
          const { data } = await supabase
            .from("cached_response")
            .insert({ response_text: word, recording: base64 })
            .select()
            .single();
          if (data) {
            dispatch(setCachedResponses([...cachedResponses, data]));
          }
        }
        return base64;
      } catch (err) {
        console.error(`Error generating TTS for "${word}":`, err);
        return null;
      }
    },
    [cachedResponses, supabase, dispatch],
  );

  const playCachedResponse = useCallback(
    async (accuracy: AccuracyResult) => {
      const responseText = getResponseForPercentage(accuracy.percentage);
      const cached = cachedResponses.find(
        (r) => r.response_text === responseText,
      );
      if (!cached?.recording) return;

      const clips: string[] = [cached.recording];

      // Find missed words (red in results)
      const missedWords = accuracy.details
        .filter((d) => !d.matched || d._matchScore === 0)
        .map((d) => d.targetWord.toLowerCase());

      // if (missedWords.length > 0) {
      //   const missedPrefix = cachedResponses.find(
      //     (r) => r.response_text === "You missed the word",
      //   );
      //   if (missedPrefix?.recording) {
      //     clips.push(missedPrefix.recording);
      //   }

      //   const andClip = cachedResponses.find((r) => r.response_text === "and,");

      //   for (let i = 0; i < missedWords.length; i++) {
      //     if (i > 0 && andClip?.recording) {
      //       clips.push(andClip.recording);
      //     }
      //     const wordRecording = await getOrCreateWordRecording(missedWords[i]);
      //     if (wordRecording) {
      //       clips.push(wordRecording);
      //     }
      //   }
      // }

      setIsSpeakingResponse(true);
      await playAudioSequence(clips);
      setIsSpeakingResponse(false);
      startListeningRef.current();
    },
    [cachedResponses, getOrCreateWordRecording],
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
        }
        setPreviousResults({ ...accuracy, recordingId: result.recordingId });
        setCurrentRecordingId(result.recordingId || null);
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

  useEffect(() => {
    Keyboard.dismiss();
    if (hasPlayedSentence) {
      setHasPlayedSentence(false);
    }
    setCurrentRecordingId(null);
    setIsPlayingRecording(false);
    setVoiceHintIndex(0);

    return () => {
      if (recordingExtensionRef.current) {
        clearTimeout(recordingExtensionRef.current);
      }
    };
  }, [currentSentenceIndex]);

  const handleTrimAndSaveRecording = async (audioUri: string) => {
    setIsTrimmingAudio(true);
    const trimmedAudioUri = trimSilenceFromAudio(audioUri);
    const recordingPath = await uploadAudioToStorage(
      trimmedAudioUri,
      userId,
      currentVideo.recordId,
      currentSentenceIndex,
    );
    setCurrentRecordingId(recordingPath);

    await supabase.from("user_shadow_result").upsert(
      {
        user_id: userId,
        video_id: parseInt(currentVideo.recordId),
        sentence: currentSentenceIndex,
        recording_id: recordingPath,
      },
      { onConflict: "user_id,video_id,sentence" },
    );
    setIsTrimmingAudio(false);
  };

  const handleRecordingComplete = useCallback(
    async (audioUri: string) => {
      if (!currentVideo) return;

      setIsProcessing(true);
      setError(null);

      try {
        const transcriptionResult = await sendAudioForTranscription(
          audioUri,
          userSettings.targetLanguage,
        );
        const spokenWords = transcriptionResult.transcript
          .split(/\s+/)
          .filter(Boolean);
        const accuracy = calculateAccuracyFromWords(spokenWords);

        if (selectedTab !== "voice") {
          console.log({ selectedTab });
          setAccuracyResult(accuracy);
        } else {
          setPreviousResults({
            ...accuracy,
            recordingId: null,
          });
        }
        if (selectedTab === "voice") playCachedResponse(accuracy);
        setAudioUri(audioUri);
        saveShadowResult(spokenWords);
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

  // const handleTextSubmit = useCallback(() => {
  //   if (!userAnswer.trim()) return;

  //   Keyboard.dismiss();
  //   setIsProcessing(true);
  //   setError(null);

  //   try {
  //     const typedWords = userAnswer.trim().split(/\s+/).filter(Boolean);
  //     const accuracy = calculateAccuracyFromWords(typedWords);
  //     setAccuracyResult(accuracy);
  //     if (selectedTab === "voice") playCachedResponse(accuracy);
  //     // Save the shadow result to database
  //     saveShadowResult(typedWords);
  //     setUserAnswer("");
  //   } catch (err) {
  //     console.error("Text comparison error:", err);
  //     setError(err instanceof Error ? err.message : "Failed to process text");
  //   } finally {
  //     setIsProcessing(false);
  //   }
  // }, [userAnswer, calculateAccuracyFromWords, saveShadowResult]);

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
      await stopListening();
      handlePlaySnippetAgain();
    },
    onRecord: async () => {
      setActiveCommand("record");
      await closeConnection();
      handleEnterRecordingMode();
    },
    onSlow: async () => {
      setActiveCommand("slow");
      await closeConnection();
      handlePlaySnippetSlow();
    },
    onTranslation: async () => {
      setActiveCommand("translation");
      await stopListening();
      if (sentenceTranslation) {
        const recording = await getOrCreateWordRecording(sentenceTranslation);
        if (recording) {
          setIsSpeakingResponse(true);
          await playAudio(recording);
          setIsSpeakingResponse(false);
        }
        startListeningRef.current();
      }
    },
    // onArtificial: async () => {
    //   setActiveCommand("artificial");
    //   await stopListening();
    //   if (currentSentenceObject?.text && currentVideo) {
    //     setIsSpeakingResponse(true);
    //     await playAiSpeech({
    //       segmentText: currentSentenceObject.text,
    //       videoId: parseInt(currentVideo.recordId),
    //       sentenceIndex: currentSentenceIndex,
    //       supabase,
    //     });
    //     setIsSpeakingResponse(false);
    //     startListeningRef.current();
    //   }
    // },
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
    onHint: async () => {
      setActiveCommand("hint");
      await stopListening();
      if (hintWords.length > 0) {
        const word = hintWords[voiceHintIndex];
        const recording = await getOrCreateWordRecording(word.word);
        if (recording) {
          setIsSpeakingResponse(true);
          await playAudio(recording);
          setIsSpeakingResponse(false);
        }
        setVoiceHintIndex((prev) => (prev + 1) % hintWords.length);
        startListeningRef.current();
      }
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
    onWatchMode: async () => {
      setActiveCommand("watch_mode");
      await closeConnection();
      dispatch(setCurrentTab("watch"));
    },
    onReviewMode: async () => {
      setActiveCommand("review_mode");
      await closeConnection();
      dispatch(setCurrentTab("discuss"));
    },
  });

  const startListeningRef = useRef(startListening);
  startListeningRef.current = startListening;

  // Start listening when on voice tab and nothing is playing
  useEffect(() => {
    if (
      selectedTab === "voice" &&
      !playerIsPlaying &&
      !isSpeakingResponse &&
      !isRecordingMode &&
      !isRecording &&
      !isProcessing &&
      !accuracyResult
    ) {
      startListening();
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

  // Stop listening when sentence or tab changes
  useEffect(() => {
    stopListening();
  }, [currentSentenceIndex, isActive]);

  const justRecordedRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      if (isRecording) {
        stopRecording();
      }
      stopListening();
      setIsRecordingMode(false);
      setSentenceEnded(false);
      clearRecordingTimer();
      setIsSettingsVisible(false);
      setShowNoVocabFoundTooltip(false);
    }
  }, [isActive, isRecording]);

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

  useEffect(() => {
    if (
      !isTransitioningRef.current &&
      time >= currentSentenceObject?.end - 0.5 &&
      !sentenceEnded
    ) {
      if (isRecording) {
        setSentenceEnded(true);
        setHasPlayedSentence(true);
      } else if (isActive && isLooping && !justRecordedRef.current) {
        setTimeout(() => {
          handleEnterRecordingMode();
        }, 1000);
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

  const handleShadowNextSentence = () => {
    setPreviousResults(null);
    setAccuracyResult(null);
    setUserAnswer("");
    setPlayerSpeed(playbackSpeed);

    setIsRecordingMode(false);
    handleResetState();
    setJustRecorded();
    parentHandleNextSentence();
  };

  const handleNextRef = useRef(handleShadowNextSentence);
  const handlePreviousRef = useRef(() => {});
  useEffect(() => {
    handleNextRef.current = handleShadowNextSentence;
    handlePreviousRef.current = handleShadowPreviousSentence;
  });

  useEffect(() => {
    if (isActive && isLooping && accuracyResult) {
      setNextSentenceCountdown(5);
      const interval = setInterval(() => {
        setNextSentenceCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleNextRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setNextSentenceCountdown(0);
    }
  }, [isActive, isLooping, accuracyResult]);

  const handleResetState = () => {
    setError(null);
    setAccuracyResult(null);
    setSentenceEnded(false);
    setIsProcessing(false);
    clearRecordingTimer();
    resetPhraseRecordings();
  };

  const clearRecordingTimer = () => {
    if (recordingExtensionRef.current) {
      clearTimeout(recordingExtensionRef.current);
      recordingExtensionRef.current = null;
    }
  };

  const handleEnterRecordingMode = async () => {
    // setPreviousResults(null);
    await stopListening();
    pausePlayer();

    setPlayerSpeed(recordSpeed);
    setIsRecordingMode(true);
    handleResetState();
    isTransitioningRef.current = true;
    justRecordedRef.current = true;
  };

  const handleActualStartRecording = async () => {
    if (selectedTab === "voice") playDing();
    await startRecording();
    // playSentence();
    setTimeout(() => {
      isTransitioningRef.current = false;
    }, 1000);
  };

  const handleStopRecording = async (trashed: boolean = false) => {
    if (selectedTab === "voice") playDingStop();
    pausePlayer();
    await stopRecording(trashed);
    setIsRecordingMode(false);
  };

  // Auto-stop recording after silence on voice tab
  useEffect(() => {
    if (passedSilenceThreshold && selectedTab === "voice") {
      handleStopRecording();
    }
  }, [passedSilenceThreshold]);

  const handleShadowPreviousSentence = () => {
    setPreviousResults(null);
    setIsRecordingMode(false);
    setJustRecorded();
    setPlayerSpeed(playbackSpeed);

    handleResetState();
    parentHandlePreviousSentence();
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
    setPlayerSpeed(0.8);
    setIsRecordingMode(false);
    handleResetState();

    playSentence();
  };

  const handlePhraseSubmit = useCallback(async () => {
    try {
      pausePlayer();
      const concatenatedUri = await submitPhraseRecordings();
      handleRecordingComplete(concatenatedUri);
      resetPhraseRecordings();
    } catch (err) {
      console.error("Phrase submission error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit phrase recordings",
      );
    }
  }, [submitPhraseRecordings, handleRecordingComplete, pausePlayer]);

  const handlePlayPause = async () => {
    await stopListening();
    if (playerIsPlaying) {
      pausePlayer();
    } else {
      resumePlayer();
    }
  };

  const handlePlayUserRecording = useCallback(async () => {
    if (!currentRecordingId || isPlayingRecording) return;

    setIsPlayingRecording(true);
    try {
      await playAudioFromStorage(currentRecordingId);
    } catch (err) {
      console.error("Failed to play recording:", err);
      setError(err instanceof Error ? err.message : "Failed to play recording");
    } finally {
      // Note: This will be set immediately, but the audio continues playing
      // The playAudioFromStorage function handles cleanup when audio finishes
      setTimeout(() => setIsPlayingRecording(false), 500);
    }
  }, [currentRecordingId, isPlayingRecording]);

  const handleRetry = () => {
    const prevResult = accuracyResult;
    if (prevResult) {
      setPreviousResults({
        ...prevResult,
        recordingId: currentRecordingId || null,
      });
    }
    setAccuracyResult(null);
    setUserAnswer("");
    setCurrentRecordingId(null);
  };

  const handlePreviousResults = () => {
    console.log("handlePreviousResults");
    setAccuracyResult(previousResults);
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
          onPrev={handleShadowPreviousSentence}
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
              {/* <FocusSentenceRequest
                markedId={
                  currentVideo.focusSentences.find(
                    (s) =>
                      s.segment_index === currentSentenceIndex &&
                      s.sentence_index === currentSentenceIndex,
                  )?.id ?? null
                }
                onReplay={() => handlePlaySnippetAgain()}
                sentenceIndex={currentSentenceIndex}
                sentenceText={currentSentenceObject?.text}
                segmentIndex={currentSentenceIndex}
                videoViewId={currentVideo.videoViewId}
                sentenceTranslation={sentenceTranslation}
                isLoadingTranslation={isLoadingInsights}
                playerIsPlaying={playerIsPlaying}
              /> */}
              <TouchableOpacity onPress={() => setShowTranslation(true)}>
                <MaterialIcons name="translate" size={30} color="#222222" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsSettingsVisible(true)}>
                <Feather name="settings" size={30} color="#222222" />
              </TouchableOpacity>
              {/* <TouchableOpacity onPress={() => setShowShadowInstructions(true)}>
                <AntDesign name="info-circle" size={32} color="#222222" />
              </TouchableOpacity> */}
            </View>
          </View>
        )}
        {isRecordingMode && (
          <>
            <CountdownTimer
              onStartRecording={handleActualStartRecording}
              onStopRecording={() => handleStopRecording(false)}
              sentenceEnded={sentenceEnded}
              bufferDuration={0}
            />
          </>
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
          {/* Play user recording button - shown when a recording exists */}
          {!isRecordingMode && !isProcessing && (
            <>
              {accuracyResult && currentRecordingId && (
                <View style={styles.playRecordingContainer}>
                  <TouchableOpacity
                    style={styles.playRecordingButton}
                    onPress={handlePlayUserRecording}
                    disabled={isPlayingRecording}
                  >
                    <MaterialIcons
                      name={isPlayingRecording ? "pause" : "headphones"}
                      size={20}
                      color="#4a69bd"
                    />
                    <Text style={styles.playRecordingButtonText}>
                      {isPlayingRecording ? "Playing..." : "Play Recording"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {accuracyResult && !currentRecordingId && audioUri && (
                <View style={styles.playRecordingContainer}>
                  <TouchableOpacity
                    style={styles.playRecordingButton}
                    onPress={() => handleTrimAndSaveRecording(audioUri)}
                    disabled={isTrimmingAudio}
                  >
                    <Text style={styles.playRecordingButtonText}>
                      {isTrimmingAudio
                        ? "Saving..."
                        : "Save Recording for Playback"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
          {!accuracyResult && !isProcessing && (
            <View style={styles.tabBarContainer}>
              {!isRecordingMode && (
                <View style={styles.tabBar}>
                  <TouchableOpacity
                    style={[
                      styles.tab,
                      selectedTab === "insights" && styles.tabActive,
                    ]}
                    onPress={() => setSelectedTab("insights")}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        selectedTab === "insights" && styles.tabTextActive,
                      ]}
                    >
                      Insights
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.tab,
                      selectedTab === "voice" && styles.tabActive,
                    ]}
                    onPress={() => setSelectedTab("voice")}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        selectedTab === "voice" && styles.tabTextActive,
                      ]}
                    >
                      Voice Commands
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
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
                    phraseRecordings={phraseRecordings}
                    recordingPhraseIndex={recordingPhraseIndex}
                    allPhrasesRecorded={allPhrasesRecorded}
                    onStartPhraseRecording={startPhraseRecording}
                    onStopPhraseRecording={stopPhraseRecording}
                    onSubmitPhrases={handlePhraseSubmit}
                    isRecordingMode={isRecordingMode}
                  />
                ) : (
                  !isRecordingMode && (
                    <VoiceCommands
                      isListening={isListening}
                      isClipPlaying={playerIsPlaying || isSpeakingResponse}
                      activeCommand={activeCommand}
                      hasError={voiceCommandError}
                      timedOut={voiceCommandTimedOut}
                      permissionDenied={voicePermissionDenied}
                      onActivate={startListening}
                      commands={[
                        { command: "record", label: "Record", description: "Start recording" },
                        { command: "repeat", label: "Repeat", description: "Replay the clip" },
                        { command: "slow", label: "Slowdown", description: "Replay the clip in slow mode" },
                        { command: "translation", label: "Translation", description: "Hear the translation" },
                        { command: "hint", label: "Word Hint", description: "Hear the next hint word" },
                        { command: "next", label: "Next", description: "Go to next segment" },
                        { command: "previous", label: "Previous", description: "Go to previous segment" },
                        { command: "watch_mode", label: "Watch Mode", description: "Switch to Watch tab" },
                        { command: "review_mode", label: "Review Mode", description: "Switch to Review tab" },
                        ...["First Phrase", "Second Phrase", "Third Phrase"]
                          .slice(0, subSegments.length)
                          .map((label, i) => ({
                            command: (["first_phrase", "second_phrase", "third_phrase"] as const)[i],
                            label,
                            description: `Replay phrase ${i + 1}`,
                          })),
                      ]}
                    />
                  )
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Input Area - always visible when not in recording mode or showing results */}
        {!accuracyResult && !isProcessing && (
          <View style={styles.inputArea}>
            <TouchableOpacity
              style={[
                styles.trashButton,
                {
                  backgroundColor: isRecordingMode ? "white" : "#f0f0f0",
                },
              ]}
              onPress={() => {
                if (isRecordingMode) {
                  handleStopRecording(true);
                }
                handleResetAnswer();
              }}
            >
              <FontAwesome
                name="trash-o"
                size={22}
                color={isRecordingMode ? "red" : "#aaa"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.micButton}
              onPress={handleEnterRecordingMode}
              disabled={!hasPermission || isProcessing}
            >
              <MaterialIcons name="mic" size={22} color="red" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sendButton,
                !userAnswer.trim() && styles.sendButtonDisabled,
              ]}
              onPress={() => handleStopRecording(false)}
              disabled={!isRecording}
            >
              <MaterialIcons
                name="send"
                size={22}
                color={userAnswer.trim() ? "#fff" : "#aaa"}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
      {isSettingsVisible && (
        <SettingsModal
          visible={isSettingsVisible}
          onClose={() => setIsSettingsVisible(false)}
          playbackSpeed={playbackSpeed}
          recordSpeed={recordSpeed}
          setPlaybackSpeed={setPlaybackSpeed}
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
      <Modal
        visible={showTranslation}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTranslation(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowTranslation(false)}>
          <View style={styles.translationOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.translationModal}>
                <Text style={styles.translationTitle}>Translation</Text>
                {isLoadingInsights ? (
                  <ActivityIndicator size="small" color="#999" />
                ) : (
                  <Text style={styles.translationText}>
                    {sentenceTranslation || "No translation available"}
                  </Text>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fafafa",
    gap: 24,
  },
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
  sendButton: {
    backgroundColor: "#4a69bd",
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#e0e0e0",
  },
  trashButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  micButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
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
  tabBarContainer: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    paddingTop: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "transparent",
  },
  tabActive: {
    backgroundColor: "#fff",
    borderColor: "#e0e0e0",
    borderBottomWidth: 0,
    marginBottom: -1,
    paddingBottom: 9,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
  },
  tabTextActive: {
    color: "#333",
  },
});

export default ShadowTab;
