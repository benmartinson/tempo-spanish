import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SegmentWord } from "../../types";
import { useEffect, useMemo, useRef, useState } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

interface TranscriptBubbleProps {
  words: SegmentWord[];
  time: number;
}

const TranscriptBubble: React.FC<TranscriptBubbleProps> = ({ words, time }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const displayedMaxIndex = useRef(-1);
  const previousWords = useRef<SegmentWord[]>([]);
  const previousTime = useRef<number>(0);

  // Reset when words array changes (new video/segment)
  useEffect(() => {
    displayedMaxIndex.current = -1;
  }, [words]);

  const visibleWords = useMemo(() => {
    if (time < previousTime.current || time > previousTime.current + 2) {
      previousWords.current = [];
      displayedMaxIndex.current = -1;
      // find the index of the word that has started the latest
      const latestStartIndex = words.findIndex(
        (word) => word.start > time && word,
      );
      if (latestStartIndex !== -1) {
        displayedMaxIndex.current = latestStartIndex;
      }
    }

    previousTime.current = time;
    const timeSpan = 0.5;
    const startIndex = displayedMaxIndex.current + 1;

    // Nothing left to show
    if (startIndex >= words.length) {
      return previousWords.current;
    }

    // Check if the first unshown word has started
    if (words[startIndex].start > time) {
      return previousWords.current; // First unshown word hasn't started yet
    }

    // Collect words within the timespan
    const result: SegmentWord[] = [];
    for (let i = startIndex; i < words.length; i++) {
      if (words[i].start <= time + timeSpan) {
        result.push(words[i]);
      } else {
        break;
      }
    }

    if (result.length === 0) {
      return previousWords.current;
    }
    // Mark all result words as displayed
    if (result.length > 0) {
      displayedMaxIndex.current = startIndex + result.length - 1;
    }
    previousWords.current = [...result];
    return result.slice(0, 6);
  }, [words, time]);

  return (
    <View style={styles.card}>
      {/* <View style={styles.header}>
        <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)}>
          <MaterialIcons
            name={isExpanded ? "expand-less" : "expand-more"}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>
      </View> */}
      {isExpanded && (
        <View style={styles.wordsRow}>
          {!visibleWords.length && <Text style={styles.visibleWord}></Text>}
          {visibleWords.map((word, index) => (
            <Text key={`${word.start}-${index}`} style={styles.visibleWord}>
              {word.word}
            </Text>
          ))}
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
    gap: 8,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  visibleWord: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4ade80",
    textAlign: "center",
    fontFamily: "Helvetica",
  },
});

export default TranscriptBubble;
