import React, { useState, useEffect, useRef } from "react";
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
import { VideoQuestion, ContextSegment } from "../../types";
import { BACKEND_BASE_URL } from "../streaming_helpers";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";

interface ReviewChatProps {
  questions: VideoQuestion[];
  currentQuestionIndex: number;
  questionsLoading: boolean;
  videoId: string;
  onNextQuestion: () => void;
  onPrevQuestion: () => void;
  onPlayClip: (segment: ContextSegment) => void;
  isKeyboardVisible: boolean;
}

type EvaluationScore = "correct" | "partial" | "incorrect";

interface Evaluation {
  feedback: string;
  score: EvaluationScore;
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
}) => {
  const [contextSegments, setContextSegments] = useState<ContextSegment[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [answered, setAnswered] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const currentQuestion =
    questions.length > 0 ? questions[currentQuestionIndex] : null;

  // Fetch context segments when question changes
  useEffect(() => {
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
  }, [currentQuestion?.id, videoId]);

  const handleResetAnswer = () => {
    setUserAnswer("");
    setEvaluation(null);
    setAnswered(false);
    // close keyboard
    Keyboard.dismiss();
  };

  // Submit answer for evaluation
  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim() || !currentQuestion) return;

    setEvaluating(true);
    setAnswered(true);

    try {
      const response = await fetch(
        `${BACKEND_BASE_URL}/evaluate-review-answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: currentQuestion.question,
            ideal_answer: currentQuestion.answer,
            user_answer: userAnswer.trim(),
            context_segments: contextSegments.map((s) => ({ text: s.text })),
          }),
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
    }
  };

  if (questionsLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#4a69bd" />
        <Text style={styles.loadingText}>Loading questions...</Text>
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <MaterialIcons name="quiz" size={48} color="#ccc" />
        <Text style={styles.emptyText}>
          No review questions available for this video yet.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={
        Platform.OS === "ios" ? (isKeyboardVisible ? 128 : 180) : 0
      }
    >
      {/* Question Navigation Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity
          style={[
            styles.navButton,
            currentQuestionIndex === 0 && styles.navButtonDisabled,
          ]}
          onPress={onPrevQuestion}
          disabled={currentQuestionIndex === 0}
        >
          <MaterialIcons
            name="chevron-left"
            size={24}
            color={currentQuestionIndex === 0 ? "#ccc" : "#333"}
          />
        </TouchableOpacity>

        <View style={styles.navCenter}>
          <Text style={styles.navCounter}>
            {currentQuestionIndex + 1} / {questions.length}
          </Text>
          {currentQuestion?.cefr_level && (
            <View style={styles.cefrBadge}>
              <Text style={styles.cefrBadgeText}>
                {currentQuestion.cefr_level}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.navButton,
            currentQuestionIndex === questions.length - 1 &&
              styles.navButtonDisabled,
          ]}
          onPress={onNextQuestion}
          disabled={currentQuestionIndex === questions.length - 1}
        >
          <MaterialIcons
            name="chevron-right"
            size={24}
            color={
              currentQuestionIndex === questions.length - 1 ? "#ccc" : "#333"
            }
          />
        </TouchableOpacity>
      </View>

      {/* Chat Area */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Question Bubble */}
        {currentQuestion && (
          <View style={styles.questionBubble}>
            <Text style={styles.questionLabel}>Question</Text>
            <Text style={styles.questionText}>{currentQuestion.question}</Text>
          </View>
        )}

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
        {answered && userAnswer.trim() && (
          <View style={styles.userBubble}>
            <Text style={styles.userBubbleText}>{userAnswer.trim()}</Text>
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
            <View style={styles.idealAnswerSection}>
              <Text style={styles.idealAnswerLabel}>Ideal Answer:</Text>
              <Text style={styles.idealAnswerText}>
                {currentQuestion?.answer}
              </Text>
            </View>
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

  // Navigation Header
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fafafa",
  },
  navButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  navButtonDisabled: {
    backgroundColor: "#f8f8f8",
  },
  navCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navCounter: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
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
