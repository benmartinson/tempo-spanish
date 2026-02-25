import React from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import {
  Evaluation,
  VocabEvaluation,
} from "../../types";
import {
  SCORE_COLORS,
  SCORE_BG_COLORS,
  SCORE_LABELS,
  VOCAB_SCORE_COLORS,
  VOCAB_SCORE_BG_COLORS,
  VOCAB_SCORE_LABELS,
} from "../../helpers";

interface EvaluatingBubbleProps {
  isEvaluating: boolean;
}

export const EvaluatingBubble: React.FC<EvaluatingBubbleProps> = ({
  isEvaluating,
}) => {
  if (!isEvaluating) return null;

  return (
    <View style={styles.evaluatingBubble}>
      <ActivityIndicator size="small" color="#4a69bd" />
      <Text style={styles.evaluatingText}>Evaluating...</Text>
    </View>
  );
};

interface VocabEvaluationBubbleProps {
  evaluation: VocabEvaluation;
}

export const VocabEvaluationBubble: React.FC<VocabEvaluationBubbleProps> = ({
  evaluation,
}) => {
  return (
    <View
      style={[
        styles.evaluationBubble,
        { backgroundColor: VOCAB_SCORE_BG_COLORS[evaluation.score] },
      ]}
    >
      <View style={styles.scoreRow}>
        <View
          style={[
            styles.scoreDot,
            { backgroundColor: VOCAB_SCORE_COLORS[evaluation.score] },
          ]}
        />
        <Text
          style={[
            styles.scoreLabel,
            { color: VOCAB_SCORE_COLORS[evaluation.score] },
          ]}
        >
          {VOCAB_SCORE_LABELS[evaluation.score]}
        </Text>
      </View>
      <View style={styles.acceptedAnswersSection}>
        <Text style={styles.acceptedAnswersLabel}>Accepted Answers:</Text>
        {evaluation.acceptedAnswers.map((answer, index) => (
          <Text key={index} style={styles.acceptedAnswerText}>
            • {answer}
          </Text>
        ))}
      </View>
    </View>
  );
};

interface ComprehensionEvaluationBubbleProps {
  evaluation: Evaluation;
  idealAnswer: string;
}

export const ComprehensionEvaluationBubble: React.FC<
  ComprehensionEvaluationBubbleProps
> = ({ evaluation, idealAnswer }) => {
  return (
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
          style={[styles.scoreLabel, { color: SCORE_COLORS[evaluation.score] }]}
        >
          {SCORE_LABELS[evaluation.score]}
        </Text>
      </View>
      <Text style={styles.feedbackText}>{evaluation.feedback}</Text>
      <View style={styles.idealAnswerSection}>
        <Text style={styles.idealAnswerLabel}>Ideal Answer:</Text>
        <Text style={styles.idealAnswerText}>{idealAnswer}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
  acceptedAnswersSection: {
    marginTop: 4,
  },
  acceptedAnswersLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  acceptedAnswerText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#444",
  },
});
