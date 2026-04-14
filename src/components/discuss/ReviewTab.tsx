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
} from "react-native";
import {
  ContextSegment,
  QuizType,
  RootState,
  SegmentWord,
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
  stripPunctuation,
  isInterestingVocab,
} from "../../helpers/helpers";
import WordHints from "../common/WordHints";
import { evaluateVocabAnswer } from "../../requests";
import QuestionBubble from "./QuestionBubble";
import ContextClipsSection from "./ContextClipsSection";
import UserAnswerBubble from "./UserAnswerBubble";
import { EvaluatingBubble, VocabEvaluationBubble } from "./EvaluationBubble";
import AnswerInput from "./AnswerInput";
import AnswerActions from "./AnswerActions";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";

interface ReviewTabProps {
  onPlayClip: (start: number, end: number) => void;
  isKeyboardVisible: boolean;
  setShowVideo: (show: boolean) => void;
}

const ReviewTab: React.FC<ReviewTabProps> = ({
  onPlayClip,
  isKeyboardVisible,
  setShowVideo,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const sentences = currentVideo?.sentences ?? [];
  const focusVocab = currentVideo?.focusVocab;
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();

  const [selectedQuizType, setSelectedQuizType] = useState<QuizType>("Vocab");

  const isVocabMode = selectedQuizType === "Vocab";
  const isPhraseMode = selectedQuizType === "Phrases";

  const [contextSegments, setContextSegments] = useState<ContextSegment[]>([]);
  const [userAnswer, setUserAnswer] = useState("");
  const [vocabEvaluation, setVocabEvaluation] =
    useState<VocabEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [questionIndex, setQuestionIndex] = useState<number>(0);

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

  const vocabLoading =
    !allVocabulary || !Object.keys(allVocabulary).length || !sentences?.length;

  // Reset all state on quiz type change
  useEffect(() => {
    setUserAnswer("");
    setVocabEvaluation(null);
    setAnswered(false);
    setUserMessages([]);
    setQuestionIndex(0);
  }, [selectedQuizType]);

  // Reset on question change
  useEffect(() => {
    setUserAnswer("");
    setVocabEvaluation(null);
    setAnswered(false);
    setContextSegments([]);
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
  }, [sentences, shadowResultIndices]);

  const activeVocabItems =
    selectedQuizType === "Vocab" ? vocabItems : phraseItems;

  const currentVocabItem =
    questionIndex !== undefined && activeVocabItems.length > 0
      ? activeVocabItems[questionIndex]
      : null;

  const currentSentenceWords = useMemo(() => {
    if (!currentVocabItem) return [];
    const sentence = sentences.find((_, i) => i === currentVocabItem.id);
    return sentence?.words ?? [];
  }, [currentVocabItem, sentences]);

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
    }

    return {
      word: currentVocabItem.word,
      translation: currentVocabItem.translation,
      question,
      contextSegments: currentVocabItem.contextSegments,
    };
  }, [currentVocabItem, selectedQuizType, isVocabMode, isPhraseMode]);

  const totalItems = activeVocabItems.length;

  useEffect(() => {
    if (currentVocabItem) {
      setUserAnswer("");
      setVocabEvaluation(null);
      setAnswered(false);
      setContextSegments(currentVocabItem.contextSegments);
    }
  }, [questionIndex, currentVocabItem]);

  const handlePlayClip = useCallback(
    (segment: ContextSegment) => {
      setShowVideo(true);
      onPlayClip(segment.start, segment.end);
    },
    [onPlayClip],
  );

  const handleResetAnswer = () => {
    setUserAnswer("");
    setVocabEvaluation(null);
    setAnswered(false);
    Keyboard.dismiss();
  };

  const handleNext = () => {
    handleResetAnswer();
    setQuestionIndex((prev) => prev + 1);
  };

  const handlePrev = () => {
    setQuestionIndex((prev) => prev - 1);
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

  if (!currentVideo) {
    return (
      <View style={styles.noVideoContainer}>
        <SelectVideoPrompt
          title="No Video Selected"
          subtitle="Select a video first to start reviewing"
        />
      </View>
    );
  }

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
        videoId={currentVideo.videoId}
        hasSearch={false}
      >
        <ReviewTypeSelector
          selectedQuizType={selectedQuizType}
          onSelectQuizType={setSelectedQuizType}
        />
        {isVocabMode && currentVocabItem?.word && (
          <View style={styles.vocabBadge}>
            <Text style={styles.vocabBadgeText}>
              {normalizeWord(currentVocabItem.word)}
            </Text>
          </View>
        )}
      </NavSwitcher>

      {displayQuestion ? (
        <View style={styles.questionAboveBar}>
          <View style={styles.questionRow}>
            <View style={styles.questionBubbleWrap}>
              <QuestionBubble question={displayQuestion} />
            </View>
          </View>
        </View>
      ) : null}

      <ScrollView
        ref={scrollViewRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      >
        <ContextClipsSection
          loading={false}
          segments={contextSegments}
          onPlayClip={handlePlayClip}
          isVocabMode={isVocabMode}
        />
        <WordHints
          hintWords={hintWords}
          handlePlayWordSnippet={() => {}}
          isPlayingWordSnippet={false}
          showWordHints={false}
          showSlowPlay={false}
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
          onNext={handleNext}
          isLastQuestion={questionIndex >= totalItems - 1}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  noVideoContainer: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: 8,
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
});

export default ReviewTab;
