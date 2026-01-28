import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SegmentWord } from "../../types";
import { useMemo, useState } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

interface TranscriptBubbleProps {
  words: SegmentWord[];
  time: number;
}

const TranscriptBubble: React.FC<TranscriptBubbleProps> = ({ words, time }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const currentWordIndex = useMemo(() => {
    // Find the current word: where start <= time and next word's start > time
    // If no next word, it's the current word if start <= time
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const nextWord = words[i + 1];
      const previousWord = i > 0 ? words[i - 1] : null;

      if (word.start <= time && (!previousWord || previousWord.end <= time)) {
        // If there's no next word, or next word hasn't started yet
        if (!nextWord || nextWord.start > time) {
          return i;
        }
      }
    }
    // If time is before first word, return -1 (no current word yet)
    return -1;
  }, [words, time]);

  const previousWord =
    currentWordIndex > 0 ? words[currentWordIndex - 1] : null;
  const currentWord = currentWordIndex >= 0 ? words[currentWordIndex] : null;
  const nextWord =
    currentWordIndex >= 0 && currentWordIndex < words.length - 1
      ? words[currentWordIndex + 1]
      : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Transcript</Text>
        <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)}>
          <MaterialIcons
            name={isExpanded ? "expand-less" : "expand-more"}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>
      </View>
      {isExpanded && (
        <View style={styles.wordsRow}>
          <Text style={styles.sideWord}>
            {previousWord ? previousWord.word : ""}
          </Text>
          <Text style={styles.currentWord}>
            {currentWord ? currentWord.word : ""}
          </Text>
          <Text style={styles.sideWord}>{nextWord ? nextWord.word : ""}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: "#2d2a40",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  wordsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingTop: 16,
  },
  sideWord: {
    fontSize: 16,
    color: "#888",
    minWidth: 80,
    textAlign: "center",
    fontFamily: "Helvetica",
  },
  currentWord: {
    fontSize: 28,
    fontWeight: "600",
    color: "#4ade80",
    minWidth: 100,
    textAlign: "center",
    fontFamily: "Helvetica",
  },
});

export default TranscriptBubble;
