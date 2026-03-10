import React, { useState, useEffect, useRef, useMemo } from "react";
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
  ContextSegment,
  QuizType,
  RootState,
  VocabQuestion,
  VocabEvaluation,
  FocusSentence,
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
import { evaluateVocabAnswer } from "../../requests";
import QuestionBubble from "./QuestionBubble";
import ContextClipsSection from "./ContextClipsSection";
import UserAnswerBubble from "./UserAnswerBubble";
import { EvaluatingBubble, VocabEvaluationBubble } from "./EvaluationBubble";
import AnswerInput from "./AnswerInput";
import AnswerActions from "./AnswerActions";

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
  const focusSentences = currentVideo?.focusSentences ?? [];
  const [contextSegments, setContextSegments] = useState<ContextSegment[]>([]);
  const [userAnswer, setUserAnswer] = useState("");
  const [vocabEvaluation, setVocabEvaluation] =
    useState<VocabEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [vocabQuestionIndex, setVocabQuestionIndex] = useState<number>(0);
  const [userMessages, setUserMessages] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const isVocabMode = selectedQuizType === "Vocab";
  const isPhraseMode = selectedQuizType === "Phrases";
  const vocabLoading =
    !allVocabulary || !Object.keys(allVocabulary).length || !sentences?.length;

  useEffect(() => {
    setUserAnswer("");
    setVocabEvaluation(null);
    setAnswered(false);
    setUserMessages([]);
    setVocabQuestionIndex(0);
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

    // Deduplicate uncommon words that are already in focus words
    const focusSet = new Set(focusWords.map((w) => w.word));
    const uniqueUncommon = uncommonWords.filter((w) => !focusSet.has(w.word));

    // Shuffle each group, then show focus words first
    const combined = [...shuffle(focusWords), ...shuffle(uniqueUncommon)];

    return buildVocabItemsWithContext(combined, sentences);
  }, [focusVocab, sentences, allVocabulary]);

  const phraseItems = useMemo(() => {
    if (!focusSentences || focusSentences.length === 0 || !sentences?.length)
      return [];

    return focusSentences.map((fs: FocusSentence) => {
      const sentence = sentences[fs.sentence_index];
      const contextSegment: ContextSegment = sentence
        ? {
            segment_id: fs.segment_index,
            start: sentence.start,
            end: sentence.end,
            text: sentence.text,
            score: 1,
          }
        : {
            segment_id: fs.segment_index,
            start: 0,
            end: 0,
            text: fs.text,
            score: 1,
          };

      return {
        id: fs.id,
        word: fs.text,
        translation: fs.translation,
        contextSegments: [contextSegment],
      };
    });
  }, [focusSentences, sentences]);

  const activeVocabItems =
    selectedQuizType === "Phrases" ? phraseItems : vocabItems;

  const currentVocabItem =
    vocabQuestionIndex !== undefined && activeVocabItems.length > 0
      ? activeVocabItems[vocabQuestionIndex]
      : null;

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
    }

    return {
      word: currentVocabItem.word,
      translation: currentVocabItem.translation,
      id: currentVocabItem.id,
      question,
      contextSegments: currentVocabItem.contextSegments,
    };
  }, [currentVocabItem, selectedQuizType, isVocabMode, isPhraseMode]);

  const totalItems = activeVocabItems.length;

  useEffect(() => {
    setUserAnswer("");
    setVocabEvaluation(null);
    setAnswered(false);
    setContextSegments([]);
  }, [selectedQuizType]);

  useEffect(() => {
    if (currentVocabItem) {
      setUserAnswer("");
      setVocabEvaluation(null);
      setAnswered(false);
      setContextSegments(currentVocabItem.contextSegments);
    }
  }, [vocabQuestionIndex, currentVocabItem]);

  const handleResetAnswer = () => {
    setUserAnswer("");
    setVocabEvaluation(null);
    setAnswered(false);
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
  };

  if (vocabLoading) {
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
        Platform.OS === "ios" ? (isKeyboardVisible ? 128 : 180) : 0
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

      {isPhraseMode && !phraseItems.length && (
        <View style={styles.emptyMessageContainer}>
          <Text style={{ fontSize: 16, color: "#555", textAlign: "center" }}>
            No focus phrases found for this video. Switch to 'Shadow' mode to
            select phrases to focus on (using pencil icon).
          </Text>
        </View>
      )}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      >
        {displayQuestion && <QuestionBubble question={displayQuestion} />}

        <ContextClipsSection
          loading={false}
          segments={contextSegments}
          onPlayClip={onPlayClip}
          isVocabMode={isVocabMode}
        />

        {answered && userMessages.length > 0 && (
          <UserAnswerBubble answer={userMessages[userMessages.length - 1]} />
        )}

        <EvaluatingBubble isEvaluating={evaluating} />

        {vocabEvaluation && (
          <VocabEvaluationBubble evaluation={vocabEvaluation} />
        )}
      </ScrollView>

      {!answered ? (
        <AnswerInput
          value={userAnswer}
          onChangeText={setUserAnswer}
          onSubmit={handleSubmitAnswer}
          onClear={handleResetAnswer}
          isKeyboardVisible={isKeyboardVisible}
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
  emptyMessageContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
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
