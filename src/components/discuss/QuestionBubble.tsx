import React from "react";
import { StyleSheet, View, Text } from "react-native";

interface QuestionBubbleProps {
  question: string;
  label?: string;
}

const QuestionBubble: React.FC<QuestionBubbleProps> = ({ question, label }) => {
  return (
    <View style={styles.questionBubble}>
      <Text style={styles.questionLabel}>{label ?? "Question"}</Text>
      <Text style={styles.questionText}>{question}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
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
});

export default QuestionBubble;
