import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { QuizType } from "../../types";

interface VocabEmptyStateProps {
  selectedQuizType: QuizType;
  hasFocusVocab: boolean;
}

export const VocabEmptyState: React.FC<VocabEmptyStateProps> = ({
  selectedQuizType,
  hasFocusVocab,
}) => {
  let message = "";
  if (selectedQuizType === "Uncommon") {
    message = "You've reviewed all the vocabulary for this video.";
  } else if (selectedQuizType === "Vocab") {
    message = hasFocusVocab
      ? "You've reviewed all the selected vocabulary for this video."
      : "No vocabulary has been 'Selected for Review' for this video yet.";
  }

  return (
    <View style={styles.centeredContainer}>
      <MaterialIcons name="translate" size={48} color="#ccc" />
      <Text style={styles.emptyText}>{message}</Text>
      <TouchableOpacity style={styles.restartVocabButton} onPress={() => {}}>
        <Text style={styles.restartVocabButtonText}>Restart</Text>
        <MaterialIcons name="restart-alt" size={18} color="white" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#888",
    textAlign: "center",
  },
  restartVocabButton: {
    backgroundColor: "#4a69bd",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
  },
  restartVocabButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
