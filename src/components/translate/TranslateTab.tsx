import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Foundation from "@expo/vector-icons/Foundation";
import {
  AccuracyResult,
  AutoReviewDetails,
  ContextSegment,
  RootState,
  SegmentWord,
  VoiceCommand,
} from "../../types";
import NavSwitcher from "../common/NavSwitcher";
import { useSelector, useDispatch } from "react-redux";
import { setCurrentSentence as setCurrentSentenceAction } from "../../store/actions/dataActions";
import {
  normalizeWord,
  computeSubSegments,
  stripPunctuation,
  isInterestingVocab,
  removeSpecialPunctuation,
  addEllipsis,
} from "../../helpers/helpers";
import Phrases from "../shadow/Phrases";
import WordHints from "../common/WordHints";
import { loadSentenceInsights } from "../../requests";
import QuestionBubble from "../discuss/QuestionBubble";
import ContextClipsSection from "../discuss/ContextClipsSection";
import ContentTabBar from "../common/ContentTabBar";
import ShadowResults from "../shadow/ShadowResults";
import VoiceCommands from "../shadow/VoiceCommands";
import { useRecording } from "../useRecording";
import { useVoiceCommand } from "../useVoiceCommand";
import {
  sendAudioForTranscription,
  playAiSpeech,
  playAudio,
} from "../../helpers/streaming_helpers";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useCachedAudio } from "../shadow/useCachedAudio";
import { calculateAccuracy } from "../../helpers/calculate_accuracy";
import AnswerInput from "../discuss/AnswerInput";

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish",
  en: "English",
  pt: "Portuguese",
};

interface TranslateTabProps {
  onPlayClip: (start: ContextSegment) => void;
  onPlayClipStart: (start: number) => void;
  isKeyboardVisible: boolean;
  playerIsPlaying: boolean;
  setShowVideo: (show: boolean) => void;
  playSentence: () => void;
}

const TranslateTab: React.FC<TranslateTabProps> = ({
  onPlayClip,
  onPlayClipStart,
  isKeyboardVisible,
  playerIsPlaying,
  setShowVideo,
  playSentence,
}) => {
  const dispatch = useDispatch();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const sentences = currentVideo?.sentences ?? [];
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const supabase = useSupabaseWithClerk();

  const [error, setError] = useState<string | null>(null);
  const [clipRevealed, setClipRevealed] = useState(false);
  const [contextSegments, setContextSegments] = useState<ContextSegment[]>([]);
  const [userAnswer, setUserAnswer] = useState("");
  const [answered, setAnswered] = useState(false);
  const [questionIndex, setQuestionIndex] = useState<number>(
    currentVideo?.currentSentence ?? 0,
  );

  const scrollViewRef = useRef<ScrollView>(null);
  const [contentTab, setContentTab] = useState<"insights" | "voice">(
    "insights",
  );
  const contentTabRef = useRef(contentTab);
  contentTabRef.current = contentTab;

  // Translate state
  const [translationText, setTranslationText] = useState<string | null>(null);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [properNouns, setProperNouns] = useState<string[]>([]);
  const [accuracyResult, setAccuracyResult] = useState<AccuracyResult | null>(
    null,
  );
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isSpeakingTranslation, setIsSpeakingTranslation] = useState(false);
  const [previousResults, setPreviousResults] = useState<AccuracyResult | null>(
    null,
  );

  const { getOrCreatePhraseRecording } = useCachedAudio(
    supabase,
    setIsSpeakingTranslation,
  );

  // Sequential sentence ordering for translate
  const phraseItems = useMemo(() => {
    if (!sentences?.length) return [];
    return sentences.map((sentence, index) => ({
      id: index,
      word: sentence.text,
      translation: "",
      contextSegments: [
        {
          segment_id: index,
          start: sentence.start,
          end: sentence.end,
          text: sentence.text,
          score: 1,
        },
      ],
    }));
  }, [sentences]);

  const currentVocabItem =
    questionIndex !== undefined && phraseItems.length > 0
      ? phraseItems[questionIndex]
      : null;

  // Fetch translation
  useEffect(() => {
    if (!currentVocabItem || !supabase || !currentVideo) {
      setTranslationText(null);
      return;
    }

    let cancelled = false;
    setTranslationLoading(true);
    setTranslationText(null);

    loadSentenceInsights({
      supabase,
      sentenceText: currentVocabItem.word,
      videoRecordId: currentVideo.recordId,
      sentenceIndex: questionIndex,
      translationLanguage: userSettings.translationLanguage,
    })
      .then(async (result) => {
        if (!cancelled) {
          setTranslationText(result.translation);
          setProperNouns(result.properNouns);
          setTranslationLoading(false);
          if (result.translation && contentTabRef.current === "voice") {
            setIsSpeakingTranslation(true);
            const recording = await getOrCreatePhraseRecording(
              result.translation,
            );
            if (recording && !cancelled) {
              await playAudio(recording);
            }
            if (!cancelled) setIsSpeakingTranslation(false);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setTranslationLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentVocabItem, questionIndex, supabase]);

  const currentSentenceWords = useMemo(() => {
    if (!currentVocabItem) return [];
    const sentence = sentences.find((_, i) => i === currentVocabItem.id);
    return sentence?.words ?? [];
  }, [currentVocabItem, sentences]);

  const currentSubSegments = useMemo(() => {
    return currentSentenceWords.length > 0
      ? computeSubSegments(currentSentenceWords)
      : [];
  }, [currentSentenceWords]);

  const hintWords = useMemo(() => {
    if (currentSentenceWords.length === 0 || !allVocabulary) return [];
    const uniqueWords = [
      ...new Map(currentSentenceWords.map((sw) => [sw.word, sw])).values(),
    ];
    return uniqueWords
      .map((sw) => {
        const normalized = stripPunctuation(sw.word.toLowerCase()).trim();
        const vocab = allVocabulary[normalized];
        const cleanedWord = stripPunctuation(sw.word).trim();
        return vocab ? { sw: { ...sw, word: cleanedWord }, vocab } : null;
      })
      .filter(
        (item): item is { sw: SegmentWord; vocab: any } =>
          item?.vocab?.word && isInterestingVocab(item.vocab),
      )
      .sort((a, b) => b.vocab.percentile - a.vocab.percentile)
      .sort((a, b) => {
        const aMatch =
          normalizeWord(a.vocab.translation) === normalizeWord(a.vocab.word);
        const bMatch =
          normalizeWord(b.vocab.translation) === normalizeWord(b.vocab.word);
        if (aMatch === bMatch) return 0;
        return aMatch ? 1 : -1;
      })
      .map((item) => item.sw);
  }, [currentSentenceWords, allVocabulary]);

  const totalItems = phraseItems.length;

  // Hide video initially
  useEffect(() => {
    setShowVideo(false);
    return () => setShowVideo(true);
  }, []);

  // Reset on question change
  useEffect(() => {
    if (currentVocabItem) {
      setUserAnswer("");
      setAnswered(false);
      setAccuracyResult(null);
      setClipRevealed(false);
      setShowVideo(false);
      setContextSegments(currentVocabItem.contextSegments);
    }
  }, [questionIndex, currentVocabItem]);

  // Voice recording
  const handleRecordingComplete = useCallback(
    async (audioUri: string) => {
      if (!currentVocabItem) return;

      setIsProcessingAudio(true);
      setAnswered(true);

      try {
        const transcriptionResult = await sendAudioForTranscription(
          audioUri,
          userSettings.targetLanguage,
        );
        const spokenWords = transcriptionResult.transcript
          .split(/\s+/)
          .filter(Boolean);
        const targetWords = currentVocabItem.word.split(/\s+/).filter(Boolean);
        const accuracy = calculateAccuracy(
          spokenWords,
          targetWords,
          properNouns,
        );
        if (contentTab !== "voice") {
          setAccuracyResult({ ...accuracy });
        }
        setPreviousResults(accuracy);
      } catch (err) {
        console.error("Transcription error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to process audio",
        );
        setAnswered(false);
      } finally {
        setIsProcessingAudio(false);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    },
    [currentVocabItem, userSettings.targetLanguage, properNouns],
  );

  const { isRecording, startRecording, stopRecording } = useRecording({
    onRecordingComplete: handleRecordingComplete,
  });

  const handleResetAnswer = () => {
    if (isRecording) {
      stopRecording(true);
    }
    if (accuracyResult) setPreviousResults(accuracyResult);
    setUserAnswer("");
    setAnswered(false);
    setAccuracyResult(null);
    Keyboard.dismiss();
  };

  const handleNext = () => {
    handleResetAnswer();
    setPreviousResults(null);
    setQuestionIndex((prev) => {
      const next = prev + 1;
      dispatch(setCurrentSentenceAction(next));
      return next;
    });
  };

  const handlePrev = () => {
    setQuestionIndex((prev) => {
      const next = prev - 1;
      dispatch(setCurrentSentenceAction(next));
      return next;
    });
  };

  // Voice commands
  const [activeCommand, setActiveCommand] = useState<VoiceCommand>(null);
  const voiceHintIndexRef = useRef(0);

  const playTranslation = useCallback(async () => {
    if (!translationText || isSpeakingTranslation) return;
    setIsSpeakingTranslation(true);
    try {
      const recording = await getOrCreatePhraseRecording(translationText);
      if (recording) {
        await playAudio(recording);
      }
    } finally {
      setIsSpeakingTranslation(false);
    }
  }, [translationText, isSpeakingTranslation, getOrCreatePhraseRecording]);

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
      await playTranslation();
      startListening();
    },
    onPlay: async () => {
      setActiveCommand("play");
      if (contextSegments.length > 0) {
        await stopListening();
        onPlayClip(contextSegments[0]);
      }
    },
    onNext: async () => {
      setActiveCommand("next");
      handleNext();
    },
    onRecord: async () => {
      setActiveCommand("record");
      await closeConnection();
      startRecording();
    },
    onHint: async () => {
      setActiveCommand("hint");
      if (hintWords.length > 0) {
        const word = hintWords[voiceHintIndexRef.current];
        await stopListening();
        await playAiSpeech({ segmentText: word.word });
        voiceHintIndexRef.current =
          (voiceHintIndexRef.current + 1) % hintWords.length;
        startListening();
      }
    },
  });

  const commandHandlersRef = useRef<Record<string, () => void>>({});
  commandHandlersRef.current = {
    repeat: async () => {
      setActiveCommand("repeat");
      await stopListening();
      await playTranslation();
      startListening();
    },
    play: async () => {
      setActiveCommand("play");
      if (contextSegments.length > 0) {
        await stopListening();
        onPlayClip(contextSegments[0]);
      }
    },
    next: () => {
      setActiveCommand("next");
      handleNext();
    },
    record: async () => {
      setActiveCommand("record");
      await closeConnection();
      startRecording();
    },
    hint: async () => {
      setActiveCommand("hint");
      if (hintWords.length > 0) {
        const word = hintWords[voiceHintIndexRef.current];
        await stopListening();
        await playAiSpeech({ segmentText: word.word });
        voiceHintIndexRef.current =
          (voiceHintIndexRef.current + 1) % hintWords.length;
        startListening();
      }
    },
  };

  const handleCommandPress = useCallback((command: VoiceCommand) => {
    if (!command) return;
    commandHandlersRef.current[command]?.();
  }, []);

  // Start listening when on voice tab and nothing is playing
  useEffect(() => {
    if (
      contentTab === "voice" &&
      !playerIsPlaying &&
      !isSpeakingTranslation &&
      !translationLoading &&
      !isRecording &&
      !isProcessingAudio &&
      !accuracyResult
    ) {
      startListening();
    }
  }, [
    contentTab,
    playerIsPlaying,
    isSpeakingTranslation,
    translationLoading,
    isRecording,
    isProcessingAudio,
    accuracyResult,
  ]);

  // Stop listening when question or tab changes
  useEffect(() => {
    stopListening();
  }, [questionIndex, contentTab]);

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim() || !currentVocabItem) return;
    Keyboard.dismiss();

    setAnswered(true);
    const spokenWords = userAnswer.trim().split(/\s+/).filter(Boolean);
    const targetWords = currentVocabItem.word.split(/\s+/).filter(Boolean);
    const accuracy = calculateAccuracy(spokenWords, targetWords, properNouns);
    setAccuracyResult({
      ...accuracy,
      targetSentence: currentVocabItem.word,
    });
    setUserAnswer("");
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleRetry = () => {
    if (accuracyResult) setPreviousResults(accuracyResult);
    setUserAnswer("");
    setAnswered(false);
    setAccuracyResult(null);
  };

  const handlePreviousResults = () => {
    setAccuracyResult(previousResults);
  };

  const displayQuestion = translationText;

  if (!currentVideo) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={
        Platform.OS === "ios" ? (isKeyboardVisible ? 92 : 120) : 0
      }
    >
      {error && (
        <View style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <TouchableOpacity onPress={() => setError(null)}>
            <MaterialIcons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <NavSwitcher
        onPrev={handlePrev}
        onNext={handleNext}
        currentIndex={questionIndex}
        totalItems={totalItems}
        sentences={sentences}
        onPlayClip={onPlayClipStart}
        videoId={currentVideo.videoId}
        recordId={currentVideo.recordId}
      >
        <Text style={styles.segmentNavText}>
          Segment {questionIndex + 1} of {totalItems}
        </Text>
      </NavSwitcher>

      {isProcessingAudio ? (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#4ade80" />
          <Text style={styles.processingText}>Analyzing...</Text>
        </View>
      ) : accuracyResult ? (
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
        >
          <ShadowResults
            accuracyResult={accuracyResult}
            handleNextSentence={handleNext}
            handleRetry={handleRetry}
            properNouns={properNouns}
          />
          {!clipRevealed && (
            <TouchableOpacity
              style={styles.playClipButton}
              onPress={() => {
                setClipRevealed(true);
                setShowVideo(true);
                playSentence();
              }}
            >
              <MaterialIcons name="play-circle-outline" size={20} color="#fff" />
              <Text style={styles.playClipButtonText}>Play Clip</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : translationLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#4a69bd" />
          <Text style={styles.loadingText}>Loading translation...</Text>
        </View>
      ) : (
        <>
          {displayQuestion ? (
            <View style={styles.questionAboveBar}>
              <QuestionBubble
                question={addEllipsis(
                  removeSpecialPunctuation(displayQuestion),
                )}
                label={`Translate into ${LANGUAGE_NAMES[userSettings.targetLanguage] || userSettings.targetLanguage}`}
              />
              {/* <View style={styles.questionActions}>
                <TouchableOpacity
                  style={styles.aiVoiceButton}
                  onPress={playTranslation}
                  disabled={isSpeakingTranslation}
                >
                  {isSpeakingTranslation ? (
                    <ActivityIndicator size="small" color="#7C3AED" />
                  ) : (
                    <MaterialIcons
                      name="record-voice-over"
                      size={22}
                      color="#7C3AED"
                    />
                  )}
                </TouchableOpacity>
                {previousResults && (
                  <TouchableOpacity
                    style={styles.previousResultsButton}
                    onPress={handlePreviousResults}
                  >
                    <Foundation
                      name="clipboard-notes"
                      size={24}
                      color="#4a69bd"
                    />
                  </TouchableOpacity>
                )}
              </View> */}
            </View>
          ) : null}
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatArea}
            contentContainerStyle={styles.chatContent}
            keyboardShouldPersistTaps="handled"
          >
            {clipRevealed && (
              <ContextClipsSection
                loading={false}
                segments={contextSegments}
                onPlayClip={onPlayClip}
                isVocabMode={false}
              />
            )}
            {currentVocabItem && (
              <Phrases
                subSegments={currentSubSegments}
                sentenceText={currentVocabItem.word}
                showPhrases={false}
                isRecordingMode={true}
              />
            )}
            {hintWords.length > 0 && (
              <WordHints
                hintWords={hintWords}
                handlePlayWordSnippet={() => {}}
                isPlayingWordSnippet={false}
                showWordHints={false}
                showSlowPlay={false}
              />
            )}
          </ScrollView>
          {/* <ContentTabBar
            tabs={[
              { key: "insights", label: "Insights" },
              { key: "voice", label: "Voice Commands" },
            ]}
            selectedTab={contentTab}
            onSelectTab={(key) => setContentTab(key as "insights" | "voice")}
          >
            <VoiceCommands
              isListening={isListening}
              isClipPlaying={isSpeakingTranslation || playerIsPlaying}
              activeCommand={activeCommand}
              hasError={voiceCommandError}
              timedOut={voiceCommandTimedOut}
              permissionDenied={voicePermissionDenied}
              onActivate={startListening}
              onCommandPress={handleCommandPress}
              commands={[
                {
                  command: "repeat",
                  label: "Repeat",
                  description: "Hear the translation again",
                },
                {
                  command: "play",
                  label: "Play Clip",
                  description: "Play the context clip",
                },
                {
                  command: "record",
                  label: "Record",
                  description: "Start recording",
                },
                {
                  command: "hint",
                  label: "Word Hint",
                  description: "Hear a hint word",
                },
                {
                  command: "next",
                  label: "Next",
                  description: "Go to next question",
                },
              ]}
            />
          </ContentTabBar> */}
        </>
      )}

      {!answered && (
        <AnswerInput
          value={userAnswer}
          onChangeText={setUserAnswer}
          onSubmit={handleSubmitAnswer}
          onClear={handleResetAnswer}
          isKeyboardVisible={isKeyboardVisible}
          showRecordButton={true}
          isRecording={isRecording}
          onRecordStart={() => startRecording()}
          onRecordStop={() => stopRecording()}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
  },
  processingContainer: {
    alignItems: "center" as const,
    marginTop: 24,
    gap: 12,
    flex: 1,
  },
  processingText: {
    color: "#666",
    fontSize: 14,
  },
  segmentNavText: {
    opacity: 0.6,
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    paddingBottom: 20,
  },
  questionAboveBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  questionBubbleWrap: {
    flex: 1,
    marginBottom: 12,
  },
  aiVoiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f0ff",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginTop: 4,
  },
  questionActions: {
    alignItems: "center" as const,
    gap: 6,
  },
  playClipButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: "#4a69bd",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    marginTop: 16,
  },
  playClipButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
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
  previousResultsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eef2ff",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
});

export default TranslateTab;
