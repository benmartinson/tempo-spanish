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
  const isVocabMode =
    selectedQuizType === "Vocab" || selectedQuizType === "Uncommon";
  const isPhraseMode = selectedQuizType === "Phrases";

  useEffect(() => {
    setUserAnswer("");
    setVocabEvaluation(null);
    setAnswered(false);
    setUserMessages([]);
    const items =
      selectedQuizType === "Uncommon"
        ? uncommonVocabItems
        : selectedQuizType === "Phrases"
          ? phraseItems
          : vocabItems;
    if (items.length > 0) {
      const newIndex = Math.floor(Math.random() * items.length);
      setVocabQuestionIndex(newIndex);
    }
  }, [selectedQuizType]);

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
    selectedQuizType === "Uncommon"
      ? uncommonVocabItems
      : selectedQuizType === "Phrases"
        ? phraseItems
        : vocabItems;

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
