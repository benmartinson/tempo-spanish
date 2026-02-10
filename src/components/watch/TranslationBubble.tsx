import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  LayoutChangeEvent,
} from "react-native";
import { SegmentWord } from "../../types";
import { useMemo, useRef, useEffect, useState, useCallback } from "react";

interface TranslationBubbleProps {
  words: SegmentWord[];
  translation: string[];
  time: number;
}

const LINE_HEIGHT = 28;
const VISIBLE_LINES = 3;
const VISIBLE_HEIGHT = LINE_HEIGHT * VISIBLE_LINES;

const TranslationBubble: React.FC<TranslationBubbleProps> = ({
  words,
  translation,
  time,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [wordPositions, setWordPositions] = useState<{ [key: number]: number }>(
    {},
  );
  const [isActive, setIsActive] = useState(false);
  const prevWordsRef = useRef<SegmentWord[]>([]);

  // Reset when words array changes
  useEffect(() => {
    if (words !== prevWordsRef.current && words.length > 0) {
      setIsActive(false);
      setWordPositions({});
      prevWordsRef.current = words;
    }
  }, [words]);

  const handleWordLayout = (index: number, event: LayoutChangeEvent) => {
    const { y } = event.nativeEvent.layout;
    setWordPositions((prev) => {
      if (prev[index] === y) return prev;
      return { ...prev, [index]: y };
    });
  };

  // Find the current word index based on time
  const currentWordIndex = useMemo(() => {
    for (let i = 0; i < words.length; i++) {
      if (time >= words[i].start && time <= words[i].end) {
        return i;
      }
      // If we're past the end time of a word but before the start of the next,
      // consider it the current word if it's the last word
      if (
        time > words[i].end &&
        (i === words.length - 1 || time < words[i + 1].start)
      ) {
        return i;
      }
    }
    return -1;
  }, [words, time]);

  // Activate when we first hit a valid word
  useEffect(() => {
    if (currentWordIndex >= 0 && !isActive) {
      setIsActive(true);
    }
  }, [currentWordIndex, isActive]);

  // Auto-scroll to current word
  useEffect(() => {
    if (
      currentWordIndex >= 0 &&
      wordPositions[currentWordIndex] !== undefined
    ) {
      const wordY = wordPositions[currentWordIndex];
      // Scroll so the current word is in the middle of the visible area
      const scrollY = Math.max(0, wordY - LINE_HEIGHT);
      scrollViewRef.current?.scrollTo({
        y: scrollY,
        animated: true,
      });
    }
  }, [currentWordIndex, wordPositions]);

  // Show blank when not active (before first word or after words change)
  if (!isActive) {
    return (
      <View style={styles.card}>
        <View style={styles.scrollView} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.wordsRow}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        {!words.length && <Text style={styles.word}></Text>}
        {translation.map((translationWord, index) => (
          <View key={index} onLayout={(e) => handleWordLayout(index, e)}>
            <Text style={[styles.word, styles.normalWord]}>
              {translationWord}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  scrollView: {
    height: VISIBLE_HEIGHT, // Exactly 3 lines
    overflow: "hidden",
  },
  wordsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 4,
    flexWrap: "wrap",
    paddingBottom: LINE_HEIGHT * 2, // Extra space at bottom for scrolling
  },
  word: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    fontFamily: "Helvetica",
    lineHeight: LINE_HEIGHT,
  },
  currentWord: {
    color: "#4ade80", // Green highlight for current word
  },
  normalWord: {
    color: "#000000", // White for other words
  },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  tooltipContainer: {
    backgroundColor: "#3d3a50",
    borderRadius: 12,
    padding: 16,
    minWidth: 120,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  tooltipWord: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4ade80",
    marginBottom: 8,
  },
  tooltipTranslation: {
    fontSize: 16,
    color: "#ffffff",
    textAlign: "center",
  },
});

export default TranslationBubble;
