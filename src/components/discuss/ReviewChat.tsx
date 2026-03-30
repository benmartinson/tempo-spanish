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
import {
  AccuracyResult,
  AutoReviewDetails,
  ContextSegment,
  QuizType,
  RootState,
  SegmentWord,
  VoiceCommand,
  VocabQuestion,
  VocabEvaluation,
} from "../../types";
import NavSwitcher from "../common/NavSwitcher";
import ReviewTypeSelector from "./ReviewTypeSelector";
import { useSelector, useDispatch } from "react-redux";
import { setCurrentSentence as setCurrentSentenceAction } from "../../store/actions/dataActions";
import {
  normalizeWord,
  buildVocabItemsWithContext,
  getUncommonVocabFromSentences,
  getFocusVocabWords,
  computeSubSegments,
  stripPunctuation,
  isInterestingVocab,
  removeSpecialPunctuation,
} from "../../helpers";
import Phrases from "../shadow/Phrases";
import WordHints from "../common/WordHints";
import { evaluateVocabAnswer, loadSentenceInsights } from "../../requests";
import QuestionBubble from "./QuestionBubble";
import ContextClipsSection from "./ContextClipsSection";
import UserAnswerBubble from "./UserAnswerBubble";
import { EvaluatingBubble, VocabEvaluationBubble } from "./EvaluationBubble";
import AnswerInput from "./AnswerInput";
import AnswerActions from "./AnswerActions";
import ContentTabBar from "../common/ContentTabBar";
import ShadowResults from "../shadow/ShadowResults";
import VoiceCommands from "../shadow/VoiceCommands";
import { useRecording } from "../useRecording";
import { useVoiceCommand } from "../useVoiceCommand";
import {
  sendAudioForTranscription,
  calculateAccuracy,
  playAiSpeech,
  playAudio,
} from "../streaming_helpers";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useCachedAudio } from "../shadow/useCachedAudio";
import { useAuth } from "@clerk/clerk-expo";

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish",
  en: "English",
  pt: "Portuguese",
};

interface ReviewChatProps {
  videoId: string;
  onPlayClip: (start: ContextSegment) => void;
  isKeyboardVisible: boolean;
  selectedQuizType: QuizType;
  onSelectQuizType: (type: QuizType) => void;
  autoReviewDetails?: AutoReviewDetails | null;
  onBackToShadow?: (isVoiceMode) => void;
  playerIsPlaying: boolean;
}

const ReviewChat: React.FC<ReviewChatProps> = ({
  videoId,
  onPlayClip,
  isKeyboardVisible,
  selectedQuizType,
  onSelectQuizType,
  autoReviewDetails,
  onBackToShadow,
  playerIsPlaying,
}) => {
  const dispatch = useDispatch();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const sentences = currentVideo?.sentences ?? [];
  const focusVocab = currentVideo?.focusVocab;
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();

  const isVocabMode = selectedQuizType === "Vocab";
  const isPhraseMode = selectedQuizType === "Phrases";
  const isTranslateMode = selectedQuizType === "Translate";

  const [contextSegments, setContextSegments] = useState<ContextSegment[]>([]);
  const [userAnswer, setUserAnswer] = useState("");
  const [vocabEvaluation, setVocabEvaluation] =
    useState<VocabEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [questionIndex, setQuestionIndex] = useState<number>(
    autoReviewDetails?.reviewSegmentId ?? currentVideo?.currentSentence ?? 0,
  );
  useEffect(() => {
    if (autoReviewDetails) {
      dispatch(setCurrentSentenceAction(autoReviewDetails.reviewSegmentId));
      setQuestionIndex(autoReviewDetails.reviewSegmentId);
    }
  }, [autoReviewDetails]);

  const [userMessages, setUserMessages] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const [contentTab, setContentTab] = useState<"insights" | "voice">(
    autoReviewDetails?.isVoiceMode ? "voice" : "insights",
  );
  const contentTabRef = useRef(contentTab);
  contentTabRef.current = contentTab;

  // Shadow result sentence indices for prioritization
  const [shadowResultIndices, setShadowResultIndices] = useState<number[]>([]);

  useEffect(() => {
    if (!supabase || !userId || !currentVideo) return;

    supabase
      .from("user_shadow_result")
      .select("sentence")
      .eq("user_id", userId)
      .eq("video_id", parseInt(currentVideo.recordId))
      .then(({ data, error }: { data: any; error: any }) => {
        if (!error && data) {
          setShadowResultIndices(data.map((r: any) => r.sentence));
        }
      });
  }, [supabase, userId, currentVideo?.recordId]);

  // Translate mode state
  const [translationText, setTranslationText] = useState<string | null>(null);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [properNouns, setProperNouns] = useState<string[]>([]);
  const [accuracyResult, setAccuracyResult] = useState<AccuracyResult | null>(
    null,
  );
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isSpeakingTranslation, setIsSpeakingTranslation] = useState(false);

  const { getOrCreatePhraseRecording } = useCachedAudio(
    supabase,
    setIsSpeakingTranslation,
  );

  const vocabLoading =
    !allVocabulary || !Object.keys(allVocabulary).length || !sentences?.length;

  // Reset all state on quiz type change
  useEffect(() => {
    setUserAnswer("");
    setVocabEvaluation(null);
    setAnswered(false);
    setUserMessages([]);
    setQuestionIndex(
      selectedQuizType === "Translate"
        ? (autoReviewDetails?.reviewSegmentId ??
            currentVideo?.currentSentence ??
            0)
        : 0,
    );
    setAccuracyResult(null);
    setTranslationText(null);
  }, [selectedQuizType]);

  // Reset on question change
  useEffect(() => {
    setUserAnswer("");
    setVocabEvaluation(null);
    setAnswered(false);
    setContextSegments([]);
    setAccuracyResult(null);
  }, [selectedQuizType]);

  const vocabItems = useMemo(() => {
    if (
      !allVocabulary ||
      !Object.keys(allVocabulary).length ||
      !sentences?.length
    )
      return [];

    const shuffle = <T,>(arr: T[]): T[] => {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const focusWords = focusVocab?.length
      ? getFocusVocabWords(focusVocab, allVocabulary)
      : [];
    const uncommonWords = getUncommonVocabFromSentences(
      sentences,
      allVocabulary,
    );

    const focusSet = new Set(focusWords.map((w) => w.word));
    const uniqueUncommon = uncommonWords.filter((w) => !focusSet.has(w.word));

    const combined = [...shuffle(focusWords), ...shuffle(uniqueUncommon)];

    return buildVocabItemsWithContext(combined, sentences);
  }, [focusVocab, sentences, allVocabulary]);

  const phraseItems = useMemo(() => {
    if (!sentences?.length) return [];

    if (isTranslateMode) {
      // Translate mode: sequential order, no shuffle
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
    }

    // Phrases mode: shuffle with shadow results prioritized
    const shadowSet = new Set(shadowResultIndices);
    const all = sentences.map((s, i) => ({ sentence: s, index: i }));

    const shuffle = <T,>(arr: T[]): T[] => {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const prioritized = all.filter((item) => shadowSet.has(item.index));
    const rest = all.filter((item) => !shadowSet.has(item.index));
    const ordered = [...shuffle(prioritized), ...shuffle(rest)];

    return ordered.map(({ sentence, index }) => ({
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
  }, [sentences, shadowResultIndices, isTranslateMode]);

  const activeVocabItems =
    selectedQuizType === "Vocab" ? vocabItems : phraseItems;

  const currentVocabItem =
    questionIndex !== undefined && activeVocabItems.length > 0
      ? activeVocabItems[questionIndex]
      : null;

  // Fetch translation for Translate mode
  useEffect(() => {
    if (!isTranslateMode || !currentVocabItem || !supabase || !currentVideo) {
      setTranslationText(null);
      return;
    }

    let cancelled = false;
    setTranslationLoading(true);
    setTranslationText(null);

    console.log({ questionIndex });
    loadSentenceInsights({
      supabase,
      sentenceText: currentVocabItem.word,
      videoRecordId: currentVideo.recordId,
      sentenceIndex: isTranslateMode ? questionIndex : currentVocabItem.id,
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
  }, [isTranslateMode, currentVocabItem, questionIndex, supabase]);

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

  const currentVocabQuestion: VocabQuestion | null = useMemo(() => {
    if (!currentVocabItem) return null;

    let wordOrPhrase = currentVocabItem.word;
    if (isPhraseMode && wordOrPhrase.endsWith(",.")) {
      wordOrPhrase = wordOrPhrase.slice(0, -1);
    }

    let question = "";
    if (isVocabMode) {
      question = `What does "${currentVocabItem.word}" mean?`;
    } else if (isPhraseMode) {
      question = `What does this phrase mean?\n\n"${wordOrPhrase}"`;
    } else if (isTranslateMode) {
      question = translationText ? `"${translationText}"` : "";
    }

    return {
      word: currentVocabItem.word,
      translation: currentVocabItem.translation,
      question,
      contextSegments: currentVocabItem.contextSegments,
    };
  }, [
    currentVocabItem,
    selectedQuizType,
    isVocabMode,
    isPhraseMode,
    isTranslateMode,
    translationText,
  ]);

  const totalItems = activeVocabItems.length;

  useEffect(() => {
    if (currentVocabItem) {
      setUserAnswer("");
      setVocabEvaluation(null);
      setAnswered(false);
      setAccuracyResult(null);
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
        setAccuracyResult({
          ...accuracy,
          targetSentence: currentVocabItem.word,
        });
      } catch (err) {
        console.error("Transcription error:", err);
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
    setUserAnswer("");
    setVocabEvaluation(null);
    setAnswered(false);
    setAccuracyResult(null);
    Keyboard.dismiss();
  };

  const handleNext = () => {
    handleResetAnswer();
    setQuestionIndex((prev) => {
      const next = prev + 1;
      if (isTranslateMode) dispatch(setCurrentSentenceAction(next));
      return next;
    });
  };

  const handlePrev = () => {
    setQuestionIndex((prev) => {
      const next = prev - 1;
      if (isTranslateMode) dispatch(setCurrentSentenceAction(next));
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
      if (contextSegments.length > 0) {
        await stopListening();
        onPlayClip(contextSegments[0]);
      }
    },
    onNext: async () => {
      setActiveCommand("next");
      if (autoReviewDetails && onBackToShadow) {
        await closeConnection();
        onBackToShadow(contentTab === "voice");
      } else {
        handleNext();
      }
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
    onTranslation: async () => {
      setActiveCommand("translation");
      await stopListening();
      await playTranslation();
      startListening();
    },
  });

  const commandHandlersRef = useRef<Record<string, () => void>>({});
  commandHandlersRef.current = {
    repeat: async () => {
      setActiveCommand("repeat");
      if (contextSegments.length > 0) {
        await stopListening();
        onPlayClip(contextSegments[0]);
      }
    },
    next: () => {
      setActiveCommand("next");
      if (autoReviewDetails && onBackToShadow) {
        onBackToShadow(contentTab === "voice");
      } else {
        handleNext();
      }
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
    translation: async () => {
      setActiveCommand("translation");
      await stopListening();
      await playTranslation();
      startListening();
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
      isTranslateMode &&
      !playerIsPlaying &&
      !isSpeakingTranslation &&
      !isRecording &&
      !isProcessingAudio &&
      !accuracyResult
    ) {
      startListening();
    }
  }, [
    contentTab,
    isTranslateMode,
    playerIsPlaying,
    isSpeakingTranslation,
    isRecording,
    isProcessingAudio,
    accuracyResult,
  ]);

  // Stop listening when question or tab changes
  useEffect(() => {
    stopListening();
  }, [questionIndex, contentTab]);

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) return;
    if (!currentVocabQuestion) return;

    Keyboard.dismiss();

    // Translate mode: compare typed text against target sentence directly
    if (isTranslateMode && currentVocabItem) {
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
      return;
    }

    setEvaluating(true);
    setAnswered(true);

    try {
      const translations = contextSegments.map((s) => {
        return {
          text: `${s.text}`,
        };
      });

      const result = await evaluateVocabAnswer({
        question: currentVocabQuestion.question,
        userAnswer: userAnswer.trim(),
        contextSegments: translations,
        vocabWord: currentVocabQuestion.word,
        quizType: isPhraseMode ? "phrase" : "vocab",
      });

      if (result) {
        setVocabEvaluation(result);
      }
    } catch (err) {
      console.error("Error evaluating answer:", err);
    } finally {
      setEvaluating(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      const userMessage = userAnswer.trim();
      setUserMessages((prev) => [...prev, userMessage]);
      setUserAnswer("");
    }
  };

  const handleRetry = () => {
    setUserAnswer("");
    setVocabEvaluation(null);
    setAnswered(false);
    setUserMessages([]);
    setAccuracyResult(null);
  };

  if (vocabLoading && isVocabMode) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a69bd" />
      </View>
    );
  }

  const displayQuestion = currentVocabQuestion?.question;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={
        Platform.OS === "ios" ? (isKeyboardVisible ? 92 : 120) : 0
      }
    >
      <NavSwitcher
        onPrev={handlePrev}
        onNext={handleNext}
        currentIndex={questionIndex}
        totalItems={totalItems}
        sentences={sentences}
        videoId={videoId}
        hasSearch={false}
      >
        <ReviewTypeSelector
          selectedQuizType={selectedQuizType}
          onSelectQuizType={onSelectQuizType}
        />
        {isVocabMode && currentVocabItem?.word && (
          <View style={styles.vocabBadge}>
            <Text style={styles.vocabBadgeText}>
              {normalizeWord(currentVocabItem.word)}
            </Text>
          </View>
        )}
        {isTranslateMode && currentVideo && (
          <View style={styles.vocabBadge}>
            <Text style={styles.vocabBadgeText}>
              {currentVideo.currentSentence + 1}
            </Text>
          </View>
        )}
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
            onBackToShadow={
              autoReviewDetails
                ? () => onBackToShadow(contentTab === "voice")
                : undefined
            }
          />
        </ScrollView>
      ) : isTranslateMode && translationLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#4a69bd" />
          <Text style={styles.loadingText}>Loading translation...</Text>
        </View>
      ) : (
        <>
          {displayQuestion ? (
            <View style={styles.questionAboveBar}>
              <View style={styles.questionRow}>
                <View style={styles.questionBubbleWrap}>
                  <QuestionBubble
                    question={removeSpecialPunctuation(displayQuestion)}
                    label={
                      isTranslateMode
                        ? `Translate into ${LANGUAGE_NAMES[userSettings.targetLanguage] || userSettings.targetLanguage}`
                        : undefined
                    }
                  />
                </View>
                {isTranslateMode && translationText && (
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
                )}
              </View>
            </View>
          ) : null}
          <ContentTabBar
            tabs={[
              { key: "insights", label: "Insights" },
              { key: "voice", label: "Voice Commands" },
            ]}
            selectedTab={contentTab}
            onSelectTab={(key) => setContentTab(key as "insights" | "voice")}
            hidden={!isTranslateMode}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.chatArea}
              contentContainerStyle={styles.chatContent}
              keyboardShouldPersistTaps="handled"
            >
              {contentTab === "insights" || !isTranslateMode ? (
                <>
                  <ContextClipsSection
                    loading={false}
                    segments={contextSegments}
                    onPlayClip={onPlayClip}
                    isVocabMode={isVocabMode}
                  />
                  {currentVocabItem && isTranslateMode && (
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

                  {answered && userMessages.length > 0 && (
                    <UserAnswerBubble
                      answer={userMessages[userMessages.length - 1]}
                    />
                  )}

                  <EvaluatingBubble isEvaluating={evaluating} />

                  {vocabEvaluation && (
                    <VocabEvaluationBubble evaluation={vocabEvaluation} />
                  )}
                </>
              ) : (
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
                      command: "translation",
                      label: "Play Translation",
                      description: "Hear the translation",
                    },
                    {
                      command: "repeat",
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
                      description: autoReviewDetails
                        ? "Go back to shadowing"
                        : "Go to next question",
                    },
                  ]}
                />
              )}
            </ScrollView>
          </ContentTabBar>
        </>
      )}

      {!answered ? (
        <AnswerInput
          value={userAnswer}
          onChangeText={setUserAnswer}
          onSubmit={handleSubmitAnswer}
          onClear={handleResetAnswer}
          isKeyboardVisible={isKeyboardVisible}
          showRecordButton={isTranslateMode}
          isRecording={isRecording}
          onRecordStart={startRecording}
          onRecordStop={() => stopRecording()}
        />
      ) : (
        !isTranslateMode && (
          <AnswerActions
            onRetry={handleRetry}
            onNext={handleNext}
            isLastQuestion={questionIndex >= totalItems - 1}
          />
        )
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
  vocabBadge: {
    backgroundColor: "#2d8a4e",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  vocabBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
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
});

export default ReviewChat;
