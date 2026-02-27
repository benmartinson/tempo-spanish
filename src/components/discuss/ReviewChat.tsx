import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import {
  VideoQuestion,
  ContextSegment,
  QuizType,
  Sentence,
  RootState,
  VocabQuestion,
  Evaluation,
  VocabEvaluation,
} from "../../types";
import NavSwitcher from "../common/NavSwitcher";
import ReviewTypeSelector from "./ReviewTypeSelector";
import { useSelector } from "react-redux";
import {
  normalizeWord,
  getRandomUniqueIndex,
  buildVocabItemsWithContext,
  getUncommonVocabFromSentences,
  getFocusVocabWords,
} from "../../helpers";
import {
  fetchReviewContext,
  evaluateVocabAnswer,
  evaluateReviewAnswer,
} from "../../requests";
import QuestionBubble from "./QuestionBubble";
import ContextClipsSection from "./ContextClipsSection";
import UserAnswerBubble from "./UserAnswerBubble";
import {
  EvaluatingBubble,
  VocabEvaluationBubble,
  ComprehensionEvaluationBubble,
} from "./EvaluationBubble";
import AnswerInput from "./AnswerInput";
import AnswerActions from "./AnswerActions";
import {
  LoadingState,
  VocabEmptyState,
  QuestionsEmptyState,
} from "./ReviewEmptyStates";

interface ReviewChatProps {
  questions: VideoQuestion[];
  currentQuestionIndex: number;
  questionsLoading: boolean;
  videoId: string;
  onNextQuestion: () => void;
  onPrevQuestion: () => void;
  onPlayClip: (start: ContextSegment) => void;
  isKeyboardVisible: boolean;
  selectedQuizType: QuizType;
  onSelectQuizType: (type: QuizType) => void;
}

const ReviewChat: React.FC<ReviewChatProps> = ({
  questions,
  currentQuestionIndex,
  questionsLoading,
  videoId,
  onNextQuestion,
  onPrevQuestion,
  onPlayClip,
  isKeyboardVisible,
  selectedQuizType,
  onSelectQuizType,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const sentences = [...currentVideo?.sentences];
  const focusVocab = currentVideo?.focusVocab;
  const [contextSegments, setContextSegments] = useState<ContextSegment[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [vocabEvaluation, setVocabEvaluation] =
    useState<VocabEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [vocabQuestionIndex, setVocabQuestionIndex] = useState<number>(0);
  const [userMessages, setUserMessages] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const isVocabMode =
    selectedQuizType === "Vocab" || selectedQuizType === "Uncommon";

  useEffect(() => {
    setUserAnswer("");
    setEvaluation(null);
    setVocabEvaluation(null);
    setAnswered(false);
    setUserMessages([]);
    const items =
      selectedQuizType === "Uncommon" ? uncommonVocabItems : vocabItems;
    if (isVocabMode && items.length > 0) {
      const newIndex = Math.floor(Math.random() * items.length);
      setVocabQuestionIndex(newIndex);
    }
  }, [selectedQuizType]);

  const currentQuestion =
    questions.length > 0 ? questions[currentQuestionIndex] : null;

  const vocabItems = useMemo(() => {
    if (
      !allVocabulary ||
      !Object.keys(allVocabulary).length ||
      !focusVocab ||
      focusVocab.length === 0
    )
      return [];

    const vocabWords = getFocusVocabWords(focusVocab, allVocabulary);
    return buildVocabItemsWithContext(vocabWords, sentences || []);
  }, [focusVocab, sentences, allVocabulary]);

  const uncommonVocabItems = useMemo(() => {
    if (
      !allVocabulary ||
      !Object.keys(allVocabulary).length ||
      !sentences?.length
    )
      return [];

    const uncommonVocab = getUncommonVocabFromSentences(
      sentences,
      allVocabulary,
    );
    return buildVocabItemsWithContext(uncommonVocab, sentences);
  }, [allVocabulary, sentences]);
  console.log(
    "uncommonVocabItems",
    uncommonVocabItems.map((item) => item.word),
  );

  const activeVocabItems =
    selectedQuizType === "Uncommon" ? uncommonVocabItems : vocabItems;

  const currentVocabItem =
    vocabQuestionIndex !== undefined && activeVocabItems.length > 0
      ? activeVocabItems[vocabQuestionIndex]
      : null;

  const currentVocabQuestion: VocabQuestion | null = useMemo(() => {
    if (!currentVocabItem) return null;

    const question = isVocabMode
      ? `What does "${currentVocabItem.word}" mean?`
      : "";

    return {
      word: currentVocabItem.word,
      translation: currentVocabItem.translation,
      id: currentVocabItem.id,
      question,
      contextSegments: currentVocabItem.contextSegments,
    };
  }, [currentVocabItem, selectedQuizType]);

  const vocabQuestions = activeVocabItems;
  const totalItems = isVocabMode ? vocabQuestions.length : questions.length;

  useEffect(() => {
    setUserAnswer("");
    setEvaluation(null);
    setVocabEvaluation(null);
    setAnswered(false);
    setContextSegments([]);
  }, [selectedQuizType]);

  useEffect(() => {
    if (isVocabMode) {
      if (currentVocabItem) {
        setContextSegments(currentVocabItem.contextSegments);
      }
      return;
    }

    if (!currentQuestion) {
      setContextSegments([]);
      return;
    }

    setUserAnswer("");
    setEvaluation(null);
    setVocabEvaluation(null);
    setAnswered(false);
    setContextSegments([]);

    const loadContext = async () => {
      setContextLoading(true);
      try {
        const segments = await fetchReviewContext({
          searchQuery:
            currentQuestion.question + "... " + currentQuestion.answer,
          videoId,
        });
        setContextSegments(segments);
      } catch (err) {
        console.error("Error fetching review context:", err);
      } finally {
        setContextLoading(false);
      }
    };

    loadContext();
  }, [currentQuestion?.id, videoId, isVocabMode, currentVocabItem]);

  useEffect(() => {
    if (isVocabMode && currentVocabItem) {
      setUserAnswer("");
      setEvaluation(null);
      setVocabEvaluation(null);
      setAnswered(false);
      setContextSegments(currentVocabItem.contextSegments);
    }
  }, [vocabQuestionIndex, isVocabMode, currentVocabItem]);

  const handleResetAnswer = () => {
    setUserAnswer("");
    setEvaluation(null);
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

    if (isVocabMode && !currentVocabQuestion) return;
    if (!isVocabMode && !currentQuestion) return;

    Keyboard.dismiss();
    setEvaluating(true);
    setAnswered(true);

    try {
      if (isVocabMode && currentVocabQuestion) {
        const translations = contextSegments.map((s) => {
          const fullTranslation = sentences.find(
            (sentence) => sentence.start === s.start && sentence.end === s.end,
          )?.full_translation;
          return {
            text: `${s.text} - translation: ${fullTranslation}`,
          };
        });

        const result = await evaluateVocabAnswer({
          question: currentVocabQuestion.question,
          userAnswer: userAnswer.trim(),
          contextSegments: translations,
          vocabWord: currentVocabQuestion.word,
        });

        if (result) {
          setVocabEvaluation(result);
        }
      } else if (currentQuestion) {
        const result = await evaluateReviewAnswer({
          question: currentQuestion.question,
          idealAnswer: currentQuestion.answer,
          userAnswer: userAnswer.trim(),
          contextSegments: contextSegments.map((s) => ({ text: s.text })),
        });

        if (result) {
          setEvaluation(result);
        }
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
    setEvaluation(null);
    setVocabEvaluation(null);
    setAnswered(false);
    setUserMessages([]);
  };

  if (questionsLoading && !isVocabMode) {
    return <LoadingState />;
  }

  if (isVocabMode && vocabQuestions.length === 0) {
    return (
      <VocabEmptyState
        selectedQuizType={selectedQuizType}
        hasFocusVocab={focusVocab.length > 0}
      />
    );
  }

  if (!isVocabMode && questions.length === 0) {
    return <QuestionsEmptyState />;
  }

  const displayQuestion = isVocabMode
    ? currentVocabQuestion?.question
    : currentQuestion?.question;

  const displayIdealAnswer = isVocabMode
    ? currentVocabQuestion?.translation
    : currentQuestion?.answer;

  const handleNext = isVocabMode ? handleVocabNext : onNextQuestion;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={
        Platform.OS === "ios" ? (isKeyboardVisible ? 128 : 180) : 0
      }
    >
      <NavSwitcher
        onPrev={isVocabMode ? handleVocabPrev : onPrevQuestion}
        onNext={handleNext}
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
        {!isVocabMode && currentQuestion?.cefr_level && (
          <View style={styles.cefrBadge}>
            <Text style={styles.cefrBadgeText}>
              {currentQuestion.cefr_level}
            </Text>
          </View>
        )}
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
        {displayQuestion && <QuestionBubble question={displayQuestion} />}

        <ContextClipsSection
          loading={contextLoading}
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

        {evaluation && (
          <ComprehensionEvaluationBubble
            evaluation={evaluation}
            idealAnswer={displayIdealAnswer || ""}
          />
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
          onNext={handleNext}
          isLastQuestion={isLastQuestion}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cefrBadge: {
    backgroundColor: "#4a69bd",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  cefrBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
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
