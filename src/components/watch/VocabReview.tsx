import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SegmentWord } from "../../types";
import { capitalize, stripPunctuation } from "../../helpers";

interface VocabReviewProps {
  userSelectedVocab: string[];
  userIgnoredVocab: string[];
  setUserIgnoredVocab: (userIgnoredVocab: string[]) => void;
  allWords: SegmentWord[];
  onConfirm: () => void;
  onGoBack: () => void;
}

const VocabReview: React.FC<VocabReviewProps> = ({
  userSelectedVocab,
  userIgnoredVocab,
  setUserIgnoredVocab,
  allWords,
  onConfirm,
  onGoBack,
}) => {
  const getTranslation = (word: string): string => {
    const normalizedWord = stripPunctuation(word.toLowerCase());
    const found = allWords.find(
      (w) => stripPunctuation(w.word.toLowerCase()) === normalizedWord
    );
    return capitalize(stripPunctuation(found?.translation)) || "—";
  };

  const handleUndo = (word: string) => {
    setUserIgnoredVocab(userIgnoredVocab.filter((w) => w !== word));
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        {/* Selected Vocab Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Review the vocab you're choosing to focus on
          </Text>
          {userSelectedVocab.length === 0 ? (
            <Text style={styles.emptyText}>No vocab selected</Text>
          ) : (
            <View style={styles.vocabList}>
              {userSelectedVocab.map((word, index) => (
                <View key={`selected-${word}-${index}`} style={styles.wordContainer}>
                  <Text style={styles.wordText}>
                    {word} <Text style={styles.arrow}>→</Text>{" "}
                    <Text style={styles.translationText}>{getTranslation(word)}</Text>
                  </Text>
                  <TouchableOpacity
                      style={styles.undoButton}
                      onPress={() => handleUndo(word)}
                    >
                      <Text style={styles.undoButtonText}>Remove</Text>
                    </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Ignored Vocab Section */}
        {userIgnoredVocab.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Removed / Ignored Vocab (These will not be included in the vocab lists going forward!)</Text>
              <View style={styles.vocabList}>
                {userIgnoredVocab.map((word, index) => (
                  <View key={`ignored-${word}-${index}`} style={styles.wordContainer}>
                    <Text style={styles.wordText}>
                      {word} <Text style={styles.arrow}>→</Text>{" "}
                      <Text style={styles.translationText}>{getTranslation(word)}</Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.undoButton}
                      onPress={() => handleUndo(word)}
                    >
                      <MaterialIcons name="undo" size={18} color="#5a5680" />
                      <Text style={styles.undoButtonText}>Undo</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
          </View>
        )}
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.confirmButtonContainer}>
        <TouchableOpacity style={styles.goBackButton} onPress={onGoBack}>
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
          <Text style={styles.confirmButtonText}>Confirm and Start Watching</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    margin: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  vocabList: {
    gap: 8,
  },
  wordContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fafafa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  wordText: {
    fontSize: 16,
    color: "#333",
  },
  arrow: {
    color: "#888",
  },
  translationText: {
    color: "#5a5680",
    fontStyle: "italic",
  },
  emptyText: {
    fontSize: 14,
    color: "#888",
    fontStyle: "italic",
    paddingVertical: 8,
  },
  undoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#f0eef5",
    borderRadius: 6,
  },
  undoButtonText: {
    fontSize: 14,
    color: "#5a5680",
    fontWeight: "500",
  },
  confirmButtonContainer: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  confirmButton: {
    backgroundColor: "#5a5680",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  goBackButton: {
    backgroundColor: "5#a5680",
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#5a5680",
    alignItems: "center",
  },
  goBackButtonText: {
    color: "#5a5680",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default VocabReview;
