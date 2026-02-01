import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SegmentWord } from "../../types";

interface VocabSelectorProps {
  vocab: string[];
  userSelectedVocab: string[];
  setUserSelectedVocab: (userSelectedVocab: string[]) => void;
  userIgnoredVocab: string[];
  setUserIgnoredVocab: (userIgnoredVocab: string[]) => void;
  onNext: () => void;
}

const VocabSelector: React.FC<VocabSelectorProps> = ({ vocab, userSelectedVocab, setUserSelectedVocab, userIgnoredVocab, setUserIgnoredVocab, onNext }) => {

  return (
    <View style={styles.container}>
      <View style={styles.infoHeader}>
        <Text>Below is a list of words used in the video. </Text>
        <Text>1. Click the checkmark to select the word to focus on that are unknown or need reinforcement.</Text>
        <Text>2. Click the trash icon if you already know the word and wont need to review it in the future.</Text>
        <Text>2. 5-10 words per video is recommended.</Text>
      </View>
      <ScrollView style={styles.vocabList}>
        {vocab.map((word, index) => (
          <View key={`${word}-${index}`} style={styles.wordContainer}>
            <Text style={styles.wordText}>{word}</Text>
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.deleteButton} onPress={() => setUserIgnoredVocab([...userIgnoredVocab, word])}>
                <MaterialIcons name="delete-outline" size={24} color="black" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.checkButton} onPress={() => setUserSelectedVocab([...userSelectedVocab, word])}>
                <MaterialIcons name="check" size={24} color="black" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

     <View style={styles.nextButtonContainer}>
        <View style={styles.vocabCountContainer}>
          {userSelectedVocab.length > 0 && <Text>Selected Vocab: {userSelectedVocab.length} choosen</Text>}
          {userIgnoredVocab.length > 0 && <Text>Removed Vocab: {userIgnoredVocab.length} removed</Text>}
        </View>
        <TouchableOpacity style={styles.submitButton} onPress={onNext}><Text style={styles.submitButtonText}>Next</Text></TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  nextButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    margin: 16,
  },
  vocabCountContainer: {
    flexDirection: "column",
    gap: 3,
    alignItems: "flex-start",
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
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    alignSelf: "flex-end",
    margin: 8,
    width: 100,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  wordText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default VocabSelector;