import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  LayoutChangeEvent,
  Pressable,
  Modal,
} from "react-native";
import { SegmentWord } from "../../types";
import { useMemo, useRef, useEffect, useState, useCallback } from "react";

interface FullSegmentTranscriptBubbleProps {
  words?: SegmentWord[];
  translationWords?: string[];
  time: number;
  mode?: "video" | "shadow"; // default 'video'
  currentTargetIndex?: number; // for shadow mode - the word user is attempting
}

const LINE_HEIGHT = 28;
const VISIBLE_LINES = 3;
const VISIBLE_HEIGHT = LINE_HEIGHT * VISIBLE_LINES;

const FullSegmentTranscriptBubble: React.FC<
  FullSegmentTranscriptBubbleProps
> = ({
  words,
  translationWords,
  time,
  mode = "video",
  currentTargetIndex = 0,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [wordPositions, setWordPositions] = useState<{ [key: number]: number }>(
    {},
  );
  const [isActive, setIsActive] = useState(false);
  const prevWordsRef = useRef<SegmentWord[]>([]);
  const [tooltipWord, setTooltipWord] = useState<SegmentWord | null>(null);

  const handleLongPress = useCallback((word: SegmentWord) => {
    if (word.translation) {
      // Strip punctuation for display in tooltip
      const cleanWord = {
        ...word,
        word: word.word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ""),
        translation: word.translation.replace(
          /[.,\/#!$%\^&\*;:{}=\-_`~()]/g,
          "",
        ),
      };
      setTooltipWord(cleanWord);
    }
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltipWord(null);
  }, []);

  // Reset when words array changes
  useEffect(() => {
    if (words !== prevWordsRef.current && words.length > 0) {
      setIsActive(false);
      setWordPositions({});
      prevWordsRef.current = words;
    }
  }, [words]);

  // Find the current word index based on time (video mode) or currentTargetIndex (shadow mode)
  const currentWordIndex = useMemo(() => {
    if (mode === "shadow") {
      return currentTargetIndex;
    }
    // Video mode: find word based on playback time
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
  }, [words, time, mode, currentTargetIndex]);

  // Activate when we first hit a valid word (video mode) or immediately (shadow mode)
  useEffect(() => {
    if (mode === "shadow") {
      setIsActive(true);
    } else if (currentWordIndex >= 0 && !isActive) {
      setIsActive(true);
    }
  }, [currentWordIndex, isActive, mode]);

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

  const handleWordLayout = (index: number, event: LayoutChangeEvent) => {
    const { y } = event.nativeEvent.layout;
    setWordPositions((prev) => {
      if (prev[index] === y) return prev;
      return { ...prev, [index]: y };
    });
  };

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
        {words.map((word, index) => {
          // Determine word style based on mode
          const getWordStyle = () => {
            if (mode === "shadow") {
              // Shadow mode: words at or before currentTargetIndex are highlighted
              return index <= currentTargetIndex
                ? styles.currentWord
                : styles.normalWord;
            }
            // Video mode: only current word is highlighted
            return index === currentWordIndex
              ? styles.currentWord
              : styles.normalWord;
          };

          return (
            <Pressable
              key={`${word.start}-${index}`}
              onLayout={(e) => handleWordLayout(index, e)}
              onLongPress={() => handleLongPress(word)}
              delayLongPress={300}
            >
              <Text style={[styles.word, getWordStyle()]}>{word.word}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal
        visible={tooltipWord !== null}
        transparent
        animationType="fade"
        onRequestClose={hideTooltip}
      >
        <Pressable style={styles.tooltipOverlay} onPress={hideTooltip}>
          <View style={styles.tooltipContainer}>
            <Text style={styles.tooltipWord}>{tooltipWord?.word}</Text>
            <Text style={styles.tooltipTranslation}>
              {tooltipWord?.translation}
            </Text>
          </View>
        </Pressable>
      </Modal>
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
    color: "#ffffff", // White for other words
    opacity: 0.7, // Slightly dimmed
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

export default FullSegmentTranscriptBubble;
