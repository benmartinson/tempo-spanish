import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SegmentWord } from "../../types";
import { capitalize } from "../../helpers";
import Entypo from "@expo/vector-icons/Entypo";

interface FeaturedVocabProps {
  word: SegmentWord;
  onMarkKnown: (word: SegmentWord) => void;
}

const FeaturedVocab: React.FC<FeaturedVocabProps> = ({ word, onMarkKnown }) => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.textContainer}>
          <Text style={styles.word}>{capitalize(word.word)}</Text>
          <Text style={styles.translation}>{capitalize(word.translation)}</Text>
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={() => onMarkKnown(word)}
        >
          <Text style={styles.buttonText}>Mark This Word as Already Known</Text>
          <Entypo name="pencil" size={16} color="#5a5680" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    width: "100%",
    marginTop: 16,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    alignItems: "center",
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  word: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  translation: {
    fontSize: 18,
    color: "#666",
    fontStyle: "italic",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#f0f0f5",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    width: "100%",
  },
  buttonText: {
    color: "#5a5680",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default FeaturedVocab;
