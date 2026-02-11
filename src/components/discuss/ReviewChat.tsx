import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import {
  VideoQuestion,
  ContextSegment,
  QuizType,
  SegmentWord,
  Segment,
  RootState,
  VocabQuestion,
  EvaluationScore,
  Evaluation,
} from "../../types";
import { BACKEND_BASE_URL } from "../streaming_helpers";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import NavSwitcher from "../common/NavSwitcher";
import ReviewTypeSelector from "./ReviewTypeSelector";
import { useSelector } from "react-redux";

interface ReviewChatProps {
  questions: VideoQuestion[];
  currentQuestionIndex: number;
  questionsLoading: boolean;
  videoId: string;
  onNextQuestion: () => void;
  onPrevQuestion: () => void;
  onPlayClip: (segment: ContextSegment) => void;
  isKeyboardVisible: boolean;
  selectedQuizType: QuizType;
  onSelectQuizType: (type: QuizType) => void;
  focusVocab: SegmentWord[];
  segments: Segment[];
}

const formatTimestamp = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const SCORE_COLORS: Record<EvaluationScore, string> = {
  correct: "#2d8a4e",
  partial: "#b8860b",
  incorrect: "#c0392b",
};

const SCORE_BG_COLORS: Record<EvaluationScore, string> = {
  correct: "#e8f5e9",
  partial: "#fff8e1",
  incorrect: "#ffebee",
};

const SCORE_LABELS: Record<EvaluationScore, string> = {
  correct: "Correct",
  partial: "Partially Correct",
  incorrect: "Incorrect",
};

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
  focusVocab,
  segments,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const [contextSegments, setContextSegments] = useState<ContextSegment[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [vocabQuestionIndex, setVocabQuestionIndex] = useState<number>();
  const [generatedQuestion, setGeneratedQuestion] = useState<string | null>(
    null,
  );
  const [questionLoading, setQuestionLoading] = useState(false);
  const [userMessages, setUserMessages] = useState<string[]>([]);
  const [previousVocabIndexes, setPreviousVocabIndexes] = useState<number[]>(
    [],
  );
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (focusVocab.length > 0) {
      setRandomVocabQuestionIndex();
    }
  }, [focusVocab]);

  const currentQuestion =
    questions.length > 0 ? questions[currentQuestionIndex] : null;

  // Generate vocab data from focusVocab (without question text for "Vocab in Context")
  const vocabItems = useMemo(() => {
    if (!focusVocab || focusVocab.length === 0) return [];

    return focusVocab.map((vocab) => {
      // Find segments that contain this vocab word
      let matchingSegment: ContextSegment = null;
      currentVideo?.segments.forEach((segment, segIndex) => {
        const segmentText = segment.text.toLowerCase();
        // console.log("segmentText", segmentText);
        // console.log("vocab.word", vocab.word);
        if (segmentText.includes(vocab.word.toLowerCase())) {
          matchingSegment = {
            segment_id: segIndex,
            start: segment.start,
            end: segment.end,
            text: segment.text,
            score: 1,
          };
        }
      });

      return {
        word: vocab.word,
        translation: vocab.translation,
        contextSegments: [matchingSegment],
      };
    });
  }, [focusVocab, currentVideo?.segments]);

  const currentVocabItem =
    vocabQuestionIndex && vocabItems.length > 0
      ? vocabItems[vocabQuestionIndex]
      : null;

  // Build the current vocab question object
  const currentVocabQuestion: VocabQuestion | null = useMemo(() => {
    if (!currentVocabItem) return null;

    let question: string;
    if (selectedQuizType === "Vocab") {
      question = `What does "${currentVocabItem.word}" mean? Try to use it in a sentence.`;
    } else if (selectedQuizType === "Vocab in Context" && generatedQuestion) {
      question = generatedQuestion;
    } else {
      // Fallback while loading or if generation fails
      question = "";
    }

    return {
      word: currentVocabItem.word,
      translation: currentVocabItem.translation,
      question,
      contextSegments: currentVocabItem.contextSegments,
    };
  }, [currentVocabItem, selectedQuizType, generatedQuestion]);

  // Total vocab questions count
  const vocabQuestions = vocabItems;

  // Determine which question set to use based on quiz type
  const isVocabMode =
    selectedQuizType === "Vocab" || selectedQuizType === "Vocab in Context";
  const totalItems = isVocabMode ? vocabQuestions.length : questions.length;
  const currentIndex = isVocabMode ? vocabQuestionIndex : currentQuestionIndex;

  // Reset state when quiz type changes
  // useEffect(() => {
  //   setUserAnswer("");
  //   setEvaluation(null);
  //   setAnswered(false);
  //   setContextSegments([]);
  //   setRandomVocabQuestionIndex();
  //   setGeneratedQuestion(null);
  // }, [selectedQuizType]);

  const setRandomVocabQuestionIndex = () => {
    let newIndex = Math.floor(Math.random() * vocabQuestions.length);
    let count = 0;
    while (previousVocabIndexes.includes(newIndex) && count < 100) {
      newIndex = Math.floor(Math.random() * vocabQuestions.length);
      count++;
    }
    setVocabQuestionIndex(newIndex);
    setPreviousVocabIndexes((prev) => [...prev, newIndex]);
  };

  // Fetch generated question for "Vocab in Context" mode
  useEffect(() => {
    if (selectedQuizType !== "Vocab in Context" || !currentVocabItem) {
      setGeneratedQuestion(null);
      return;
    }

    // Get the top context segment text for the question generation
    const topContextSegment = currentVocabItem.contextSegments[0];
    if (!topContextSegment) {
      setGeneratedQuestion(null);
      return;
    }

    const fetchGeneratedQuestion = async () => {
      setQuestionLoading(true);
      console.log({ topContextSegment });
      try {
        const response = await fetch(
          `${BACKEND_BASE_URL}/generate-vocab-context-question`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              vocab_word: currentVocabItem.word,
              translation: currentVocabItem.translation,
              context_text: topContextSegment.text,
            }),
          },
        );

        if (!response.ok) {
          console.error("Error generating question:", response.status);
          return;
        }

        const data = await response.json();
        if (data.question) {
          setGeneratedQuestion(data.question);
        }
      } catch (err) {
        console.error("Error generating vocab context question:", err);
      } finally {
        setQuestionLoading(false);
      }
    };

    fetchGeneratedQuestion();
  }, [selectedQuizType, vocabQuestionIndex, currentVocabItem]);

  // Fetch context segments when comprehension question changes
  useEffect(() => {
    if (isVocabMode) {
      // For vocab modes, use pre-computed context segments
      if (currentVocabItem) {
        setContextSegments(currentVocabItem.contextSegments);
      }
      return;
    }

    if (!currentQuestion) {
      setContextSegments([]);
      return;
    }

    // Reset state for new question
    setUserAnswer("");
    setEvaluation(null);
    setAnswered(false);
    setContextSegments([]);

    const fetchContext = async () => {
      setContextLoading(true);
      try {
        const response = await fetch(`${BACKEND_BASE_URL}/review-context`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: currentQuestion.question,
            answer: currentQuestion.answer,
            video_id: videoId,
          }),
        });

        if (!response.ok) {
          console.error("Error fetching context:", response.status);
          return;
        }

        const data = await response.json();
        if (data.segments) {
          setContextSegments(data.segments);
        }
      } catch (err) {
        console.error("Error fetching review context:", err);
      } finally {
        setContextLoading(false);
      }
    };

    fetchContext();
  }, [currentQuestion?.id, videoId, isVocabMode, currentVocabItem]);

  // Reset state when vocab question changes
  useEffect(() => {
    if (isVocabMode && currentVocabItem) {
      setUserAnswer("");
      setEvaluation(null);
      setAnswered(false);
      setContextSegments(currentVocabItem.contextSegments);
      setGeneratedQuestion(null); // Reset generated question for new vocab item
    }
  }, [vocabQuestionIndex, isVocabMode, currentVocabItem]);

  const handleResetAnswer = () => {
    setUserAnswer("");
    setEvaluation(null);
    setAnswered(false);
    // close keyboard
    Keyboard.dismiss();
  };

  // Navigation handlers for vocab mode
  const handleVocabNext = () => {
    setRandomVocabQuestionIndex();
  };

  const handleVocabPrev = () => {
    setVocabQuestionIndex(
      previousVocabIndexes[previousVocabIndexes.length - 1],
    );
    setPreviousVocabIndexes((prev) => prev.slice(0, -1));
  };

  // Submit answer for evaluation
  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) return;

    // Check we have a valid question based on mode
    if (isVocabMode && !currentVocabQuestion) return;
    if (!isVocabMode && !currentQuestion) return;

    Keyboard.dismiss();
    setEvaluating(true);
    setAnswered(true);

    try {
      let requestBody;

      if (isVocabMode && currentVocabQuestion) {
        // Vocab quiz evaluation
        const additionalContext =
          "The user may be trying to use this word in a sentence to demonstrate understanding. Evaluate both their definition and usage.";

        requestBody = {
          question: currentVocabQuestion.question,
          ideal_answer: currentVocabQuestion.translation,
          user_answer: userAnswer.trim(),
          context_segments: contextSegments.map((s) => ({ text: s.text })),
          additional_context:
            selectedQuizType === "Vocab" ? additionalContext : null,
          vocab_word:
            selectedQuizType === "Vocab" ? currentVocabQuestion.word : null,
        };
      } else if (currentQuestion) {
        // Comprehension quiz evaluation
        requestBody = {
          question: currentQuestion.question,
          ideal_answer: currentQuestion.answer,
          user_answer: userAnswer.trim(),
          context_segments: contextSegments.map((s) => ({ text: s.text })),
        };
      }

      const response = await fetch(
        `${BACKEND_BASE_URL}/evaluate-review-answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        console.error("Error evaluating answer:", response.status);
        return;
      }

      const data = await response.json();
      if (data.feedback && data.score) {
        setEvaluation({ feedback: data.feedback, score: data.score });
      }
    } catch (err) {
      console.error("Error evaluating answer:", err);
    } finally {
      setEvaluating(false);
      // Scroll to bottom to show evaluation
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      const userMessage = userAnswer.trim();
      setUserMessages((prev) => [...prev, userMessage]);
      setUserAnswer("");
    }
  };

  if (questionsLoading && !isVocabMode) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#4a69bd" />
        <Text style={styles.loadingText}>Loading questions...</Text>
      </View>
    );
  }

  // Show empty state based on quiz type
  if (isVocabMode && vocabQuestions.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <MaterialIcons name="translate" size={48} color="#ccc" />
        <Text style={styles.emptyText}>
          No focus vocabulary available for this video yet.
        </Text>
      </View>
    );
  }

  if (!isVocabMode && questions.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <MaterialIcons name="quiz" size={48} color="#ccc" />
        <Text style={styles.emptyText}>
          No review questions available for this video yet.
        </Text>
      </View>
    );
  }

  // Get the current question text based on mode
  const displayQuestion = isVocabMode
    ? currentVocabQuestion?.question
    : currentQuestion?.question;

  const displayIdealAnswer = isVocabMode
    ? currentVocabQuestion?.translation
    : currentQuestion?.answer;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={
        Platform.OS === "ios" ? (isKeyboardVisible ? 128 : 180) : 0
      }
    >
      {/* Question Navigation Header */}
      <NavSwitcher
        onPrev={isVocabMode ? handleVocabPrev : onPrevQuestion}
        onNext={isVocabMode ? handleVocabNext : onNextQuestion}
        currentIndex={previousVocabIndexes.length}
        totalItems={totalItems}
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
        {selectedQuizType === "Vocab" && currentVocabItem?.word && (
          <View style={styles.vocabBadge}>
            <Text style={styles.vocabBadgeText}>{currentVocabItem.word}</Text>
          </View>
        )}
      </NavSwitcher>

      {/* Chat Area */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Question Bubble */}
        {questionLoading ? (
          <View style={styles.questionBubble}>
            <Text style={styles.questionLabel}>Question</Text>
            <View style={styles.questionLoadingRow}>
              <ActivityIndicator size="small" color="#4a69bd" />
              <Text style={styles.questionLoadingText}>
                Generating question...
              </Text>
            </View>
          </View>
        ) : displayQuestion ? (
          <View style={styles.questionBubble}>
            <Text style={styles.questionLabel}>Question</Text>
            <Text style={styles.questionText}>{displayQuestion}</Text>
          </View>
        ) : null}

        {/* Context Clips Section */}
        <View style={styles.contextSection}>
          {contextLoading ? (
            <View style={styles.contextLoadingRow}>
              <ActivityIndicator size="small" color="#4a69bd" />
              <Text style={styles.contextLoadingText}>
                Loading context clips...
              </Text>
            </View>
          ) : contextSegments.length > 0 ? (
            <>
              <Text style={styles.contextTitle}>Context Clips</Text>
              <View style={styles.timestampRow}>
                {contextSegments.map((segment, index) => (
                  <TouchableOpacity
                    key={`${segment.segment_id}-${index}`}
                    style={styles.timestampButton}
                    onPress={() => onPlayClip(segment)}
                  >
                    <MaterialIcons
                      name="play-circle-outline"
                      size={16}
                      color="#4a69bd"
                    />
                    <Text style={styles.timestampText}>
                      {formatTimestamp(segment.start)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}
        </View>

        {/* User's Answer (shown after submission) */}
        {answered && userMessages.length > 0 && (
          <View style={styles.userBubble}>
            <Text style={styles.userBubbleText}>
              {userMessages[userMessages.length - 1]}
            </Text>
          </View>
        )}

        {/* Evaluation Loading */}
        {evaluating && (
          <View style={styles.evaluatingBubble}>
            <ActivityIndicator size="small" color="#4a69bd" />
            <Text style={styles.evaluatingText}>Evaluating...</Text>
          </View>
        )}

        {/* Evaluation Feedback */}
        {evaluation && (
          <View
            style={[
              styles.evaluationBubble,
              { backgroundColor: SCORE_BG_COLORS[evaluation.score] },
            ]}
          >
            <View style={styles.scoreRow}>
              <View
                style={[
                  styles.scoreDot,
                  { backgroundColor: SCORE_COLORS[evaluation.score] },
                ]}
              />
              <Text
                style={[
                  styles.scoreLabel,
                  { color: SCORE_COLORS[evaluation.score] },
                ]}
              >
                {SCORE_LABELS[evaluation.score]}
              </Text>
            </View>
            <Text style={styles.feedbackText}>{evaluation.feedback}</Text>
            {selectedQuizType !== "Vocab in Context" && (
              <View style={styles.idealAnswerSection}>
                <Text style={styles.idealAnswerLabel}>
                  {selectedQuizType === "Vocab"
                    ? "Translation:"
                    : "Ideal Answer:"}
                </Text>
                <Text style={styles.idealAnswerText}>{displayIdealAnswer}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Input Area */}
      {/* {!answered ? ( */}
      <View
        style={[
          styles.inputArea,
          { paddingBottom: isKeyboardVisible ? 10 : 40 },
        ]}
      >
        <TextInput
          style={styles.textInput}
          placeholder="Type your answer..."
          placeholderTextColor="#999"
          value={userAnswer}
          onChangeText={setUserAnswer}
          autoComplete="off"
          autoCorrect={false}
          autoCapitalize="none"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.trashButton,
            { backgroundColor: isKeyboardVisible ? "white" : "#f0f0f0" },
          ]}
          onPress={handleResetAnswer}
        >
          <FontAwesome
            name="trash-o"
            size={22}
            color={isKeyboardVisible ? "red" : "#aaa"}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sendButton,
            !userAnswer.trim() && styles.sendButtonDisabled,
          ]}
          onPress={handleSubmitAnswer}
          disabled={!userAnswer.trim()}
        >
          <MaterialIcons
            name="send"
            size={22}
            color={userAnswer.trim() ? "#fff" : "#aaa"}
          />
        </TouchableOpacity>
      </View>
      {/* ) : (
        <View style={styles.nextPrompt}>
          <TouchableOpacity
            style={styles.nextQuestionButton}
            onPress={onNextQuestion}
            disabled={currentQuestionIndex === questions.length - 1}
          >
            <Text style={styles.nextQuestionButtonText}>
              {currentQuestionIndex === questions.length - 1
                ? "All Questions Complete"
                : "Next Question"}
            </Text>
            {currentQuestionIndex < questions.length - 1 && (
              <MaterialIcons name="arrow-forward" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )} */}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#888",
    textAlign: "center",
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

  // Chat Area
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 20,
  },

  // Question Bubble
  questionBubble: {
    backgroundColor: "#f0f4ff",
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 16,
    marginBottom: 12,
    alignSelf: "flex-start",
    maxWidth: "90%",
  },
  questionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4a69bd",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  questionText: {
    fontSize: 17,
    lineHeight: 24,
    color: "#222",
  },
  questionLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  questionLoadingText: {
    fontSize: 15,
    color: "#666",
    fontStyle: "italic",
  },

  // Context Clips
  contextSection: {
    marginBottom: 16,
  },
  contextLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  contextLoadingText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  contextTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  timestampRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timestampButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d0d8f0",
  },
  timestampText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4a69bd",
  },

  // User Bubble
  userBubble: {
    backgroundColor: "#4a69bd",
    borderRadius: 16,
    borderBottomRightRadius: 4,
    padding: 14,
    marginBottom: 12,
    alignSelf: "flex-end",
    maxWidth: "80%",
  },
  userBubbleText: {
    fontSize: 16,
    lineHeight: 22,
    color: "#fff",
  },

  // Evaluating
  evaluatingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "#f5f5f5",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  evaluatingText: {
    fontSize: 14,
    color: "#666",
  },

  // Evaluation Feedback
  evaluationBubble: {
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 16,
    marginBottom: 12,
    alignSelf: "flex-start",
    maxWidth: "90%",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  scoreDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  feedbackText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#333",
    marginBottom: 12,
  },
  idealAnswerSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: 10,
  },
  idealAnswerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  idealAnswerText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#444",
    fontStyle: "italic",
  },

  // Input Area
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fafafa",
    gap: 8,
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
  // Next Question Prompt
  nextPrompt: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fafafa",
  },
  nextQuestionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#4a69bd",
    paddingVertical: 14,
    borderRadius: 12,
  },
  nextQuestionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ReviewChat;
