import React from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

interface AnswerActionsProps {
  onRetry: () => void;
  onNext: () => void;
  isLastQuestion: boolean;
}

const AnswerActions: React.FC<AnswerActionsProps> = ({
  onRetry,
  onNext,
  isLastQuestion,
}) => {
  return (
    <View style={styles.nextPrompt}>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Retry</Text>
        <MaterialIcons name="refresh" size={18} color="black" opacity={0.5} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.nextQuestionButton}
        onPress={onNext}
        disabled={isLastQuestion}
      >
        <Text style={styles.nextQuestionButtonText}>
          {isLastQuestion ? "All Questions Complete" : "Next Question"}
        </Text>
        {!isLastQuestion && (
          <MaterialIcons name="arrow-forward" size={18} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  nextPrompt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    marginBottom: 12,
    borderTopColor: "#eee",
    backgroundColor: "#fafafa",
  },
  nextQuestionButton: {
    backgroundColor: "#4a69bd",
    justifyContent: "center",
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
  },
  nextQuestionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  retryButton: {
    justifyContent: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "black",
    opacity: 0.5,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default AnswerActions;
