import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import AntDesign from "@expo/vector-icons/AntDesign";
import { Answer } from "../types";

interface MultipleChoiceProps {
  answers: Answer[];
  onCorrectAnswer: () => void;
  currentlyPlayingIndex?: number | null;
  onPressAudio?: (index: number) => void;
}

export const MultipleChoice: React.FC<MultipleChoiceProps> = ({
  answers,
  onCorrectAnswer,
  currentlyPlayingIndex,
  onPressAudio,
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [answerFeedback, setAnswerFeedback] = useState<string>("");
  const correctAnswer = answers.find(
    (answer) => answer.correct === true,
  )?.answer;

  useEffect(() => {
    setSelectedAnswer("");
    setAnswerFeedback("");
  }, [answers]);

  const handleMultipleChoiceAnswer = (answer: string) => {
    setSelectedAnswer(answer);
    if (answer === correctAnswer) {
      setAnswerFeedback("Correct!");
      setTimeout(() => {
        onCorrectAnswer();
      }, 1000);
    } else {
      setAnswerFeedback("Not Quite!");
    }
  };

  return (
    <View style={styles.multipleChoiceContainer}>
      {answers.map((answer, index) => (
        <View key={index} style={styles.answerRow}>
          <TouchableOpacity
            style={[
              styles.multipleChoiceButton,
              currentlyPlayingIndex === index && styles.playingButton,
              selectedAnswer === answer.answer &&
                selectedAnswer === correctAnswer &&
                styles.correctButton,
              selectedAnswer === answer.answer &&
                selectedAnswer !== correctAnswer &&
                styles.incorrectButton,
            ]}
            onPress={() => handleMultipleChoiceAnswer(answer.answer)}
          >
            <Text
              style={[
                styles.multipleChoiceButtonText,
                currentlyPlayingIndex === index && styles.playingButtonText,
                selectedAnswer === answer.answer && styles.selectedButtonText,
              ]}
            >
              {answer.answer}
            </Text>
          </TouchableOpacity>
          {onPressAudio && (
            <TouchableOpacity
              style={styles.audioButton}
              onPress={() => onPressAudio(index)}
            >
              <AntDesign name="sound" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
      ))}
      {answerFeedback !== "" && (
        <Text
          style={[
            styles.feedbackText,
            answerFeedback === "Correct!"
              ? styles.correctFeedback
              : styles.incorrectFeedback,
          ]}
        >
          {answerFeedback}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  multipleChoiceContainer: {
    marginTop: 16,
    marginHorizontal: 16,
    gap: 12,
  },
  answerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  multipleChoiceButton: {
    flex: 1,
    backgroundColor: "#333",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#555",
  },
  playingButton: {
    backgroundColor: "#1a237e",
    borderColor: "#3f51b5",
    borderWidth: 2,
  },
  correctButton: {
    backgroundColor: "#2e7d32",
    borderColor: "#4caf50",
  },
  incorrectButton: {
    backgroundColor: "#c62828",
    borderColor: "#f44336",
  },
  multipleChoiceButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  playingButtonText: {
    color: "#90caf9",
    fontWeight: "bold",
  },
  selectedButtonText: {
    fontWeight: "bold",
  },
  feedbackText: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  correctFeedback: {
    color: "#4caf50",
    backgroundColor: "rgba(76, 175, 80, 0.1)",
  },
  incorrectFeedback: {
    color: "#f44336",
    backgroundColor: "rgba(244, 67, 54, 0.1)",
  },
  audioButton: {
    backgroundColor: "#333",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#555",
  },
  audioButtonText: {
    fontSize: 18,
  },
});
