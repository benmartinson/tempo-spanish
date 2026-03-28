import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import {
  AccuracyResult,
  ContextSegment,
  QuizType,
  RootState,
  VocabQuestion,
  VocabEvaluation,
} from "../../types";
import NavSwitcher from "../common/NavSwitcher";
import ReviewTypeSelector from "./ReviewTypeSelector";
import { useSelector } from "react-redux";
import {
  normalizeWord,
  buildVocabItemsWithContext,
  getUncommonVocabFromSentences,
  getFocusVocabWords,
} from "../../helpers";
import { evaluateVocabAnswer, loadSentenceInsights } from "../../requests";
import QuestionBubble from "./QuestionBubble";
import ContextClipsSection from "./ContextClipsSection";
import UserAnswerBubble from "./UserAnswerBubble";
import { EvaluatingBubble, VocabEvaluationBubble } from "./EvaluationBubble";
import AnswerInput from "./AnswerInput";
import AnswerActions from "./AnswerActions";
import ShadowResults from "../shadow/ShadowResults";
import { useRecording } from "../useRecording";
import {
  sendAudioForTranscription,
  calculateAccuracy,
  playAiSpeech,
} from "../streaming_helpers";
import { useSupabaseWithClerk } from "../../../utils/supabase";
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
}

const ReviewChat: React.FC<ReviewChatProps> = ({
  videoId,
  onPlayClip,
  isKeyboardVisible,
  selectedQuizType,
  onSelectQuizType,
}) => {
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
  const [vocabQuestionIndex, setVocabQuestionIndex] = useState<number>(0);
  const [userMessages, setUserMessages] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

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
  const [answeredWithVoice, setAnsweredWithVoice] = useState(false);

  const vocabLoading =
    !allVocabulary || !Object.keys(allVocabulary).length || !sentences?.length;

  // Reset all state on quiz type change
  useEffect(() => {
    setUserAnswer("");
    setVocabEvaluation(null);
    setAnswered(false);
    setUserMessages([]);
    setVocabQuestionIndex(0);
    setAccuracyResult(null);
    setAnsweredWithVoice(false);
    setTranslationText(null);
  }, [selectedQuizType]);

  // Reset on question change
  useEffect(() => {
    setUserAnswer("");
    setVocabEvaluation(null);
    setAnswered(false);
    setContextSegments([]);
    setAccuracyResult(null);
    setAnsweredWithVoice(false);
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

    const shadowSet = new Set(shadowResultIndices);
    const all = sentences.map((s, i) => ({ sentence: s, index: i }));

    const prioritized = all.filter((item) => shadowSet.has(item.index));
    const rest = all.filter((item) => !shadowSet.has(item.index));

    // Shuffle each group, then show shadow results first
    const shuffle = <T,>(arr: T[]): T[] => {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

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
  }, [sentences, shadowResultIndices]);

  const activeVocabItems =
    selectedQuizType === "Vocab" ? vocabItems : phraseItems;

  const currentVocabItem =
    vocabQuestionIndex !== undefined && activeVocabItems.length > 0
      ? activeVocabItems[vocabQuestionIndex]
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

    loadSentenceInsights({
      supabase,
      sentenceText: currentVocabItem.word,
      videoRecordId: currentVideo.recordId,
      sentenceIndex: currentVocabItem.id,
      translationLanguage: userSettings.translationLanguage,
    })
      .then((result) => {
        if (!cancelled) {
          setTranslationText(result.translation);
          setProperNouns(result.properNouns);
          setTranslationLoading(false);
          if (result.translation) {
            playAiSpeech({ segmentText: result.translation });
          }
        }
      })
      .catch(() => {
        if (!cancelled) setTranslationLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isTranslateMode, currentVocabItem, vocabQuestionIndex, supabase]);

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
      setAnsweredWithVoice(false);
      setContextSegments(currentVocabItem.contextSegments);
    }
  }, [vocabQuestionIndex, currentVocabItem]);

  // Voice recording
  const handleRecordingComplete = useCallback(
    async (audioUri: string) => {
      if (!currentVocabItem) return;

      setIsProcessingAudio(true);
      setAnswered(true);
      setAnsweredWithVoice(true);

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

  const {
    isRecording,
    startRecording,
    stopRecording,
  } = useRecording({
    onRecordingComplete: handleRecordingComplete,
  });

  const handleResetAnswer = () => {
    setUserAnswer("");
    setVocabEvaluation(null);
    setAnswered(false);
    setAccuracyResult(null);
    setAnsweredWithVoice(false);
    Keyboard.dismiss();
  };

  const handleVocabNext = () => {
    handleResetAnswer();
    setVocabQuestionIndex((prev) => prev + 1);
  };

  const handleVocabPrev = () => {
    setVocabQuestionIndex((prev) => prev - 1);
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) return;
    if (!currentVocabQuestion) return;

    Keyboard.dismiss();

    // Translate mode: compare typed text against target sentence directly
    if (isTranslateMode && currentVocabItem) {
      setAnswered(true);
      setAnsweredWithVoice(true); // reuse the ShadowResults display path
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
    setAnsweredWithVoice(false);
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
        onPrev={handleVocabPrev}
        onNext={handleVocabNext}
        currentIndex={vocabQuestionIndex}
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
      </NavSwitcher>

      <ScrollView
        ref={scrollViewRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      >
        {answeredWithVoice && isProcessingAudio ? (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#4ade80" />
            <Text style={styles.processingText}>Analyzing...</Text>
          </View>
        ) : answeredWithVoice && accuracyResult ? (
          <ShadowResults
            accuracyResult={accuracyResult}
            handleNextSentence={handleVocabNext}
            handleRetry={handleRetry}
            properNouns={properNouns}
          />
        ) : (
          <>
            {isTranslateMode && translationLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#4a69bd" />
                <Text style={styles.loadingText}>Loading translation...</Text>
              </View>
            ) : (
              <>
                {displayQuestion && (
                  <QuestionBubble
                    question={displayQuestion}
                    label={
                      isTranslateMode
                        ? `Translate into ${LANGUAGE_NAMES[userSettings.targetLanguage] || userSettings.targetLanguage}`
                        : undefined
                    }
                  />
                )}
                <ContextClipsSection
                  loading={false}
                  segments={contextSegments}
                  onPlayClip={onPlayClip}
                  isVocabMode={isVocabMode}
                />
              </>
            )}

            {answered && userMessages.length > 0 && (
              <UserAnswerBubble answer={userMessages[userMessages.length - 1]} />
            )}

            <EvaluatingBubble isEvaluating={evaluating} />

            {vocabEvaluation && (
              <VocabEvaluationBubble evaluation={vocabEvaluation} />
            )}
          </>
        )}
      </ScrollView>

      {answeredWithVoice ? null : !answered ? (
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
        <AnswerActions
          onRetry={handleRetry}
          onNext={handleVocabNext}
          isLastQuestion={vocabQuestionIndex >= totalItems - 1}
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
    padding: 16,
    paddingBottom: 20,
  },
});

export default ReviewChat;
