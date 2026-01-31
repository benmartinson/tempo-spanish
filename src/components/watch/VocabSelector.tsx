import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SegmentWord } from "../../types";

interface VocabSelectorProps {
  vocab: string[];
}

const VocabSelector: React.FC<VocabSelectorProps> = ({ vocab }) => {
  const [selectedVocab, setSelectedVocab] = useState<SegmentWord[]>([]);

  return (
    <View style={styles.container}>
      <View style={styles.infoHeader}>
        <Text>Below is a list of words used in the video. </Text>
        <Text>1. Click the checkmark to select the word to focus on that are unknown or need reinforcement.</Text>
        <Text>2. Click the trash icon if you already know the word and wont need to review it in the future.</Text>
        <Text>2. Ten words is recommended. Click "Next" to continue.</Text>
      </View>
      <ScrollView style={styles.vocabList}>
        {vocab.map((word, index) => (
          <View key={`${word}-${index}`} style={styles.wordContainer}>
            <Text style={styles.wordText}>{word}</Text>
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.deleteButton}>
                <MaterialIcons name="delete-outline" size={24} color="black" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.checkButton}>
                <MaterialIcons name="check" size={24} color="black" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.submitButton}><Text style={styles.submitButtonText}>Next</Text></TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  infoHeader: {
    margin: 16,
    marginBottom: 0,
  },
  vocabList: {
    flex: 1,
    margin: 16,
  },
  wordContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  deleteButton: {
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 8,
  },
  checkButton: {
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 8,
  },
  submitButton: {
    backgroundColor: "#5a5680",
    alignSelf: "flex-end",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    margin: 16,
    width: 100,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  wordText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default VocabSelector;