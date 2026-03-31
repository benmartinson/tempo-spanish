import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  LayoutChangeEvent,
  Pressable,
  Modal,
} from "react-native";
import { RootState, SegmentWord } from "../../types";
import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import TooltipModal from "../common/TooltipModal";
import { useSelector } from "react-redux";
import { vocabFormatWord } from "../../helpers/helpers";

interface FullSegmentTranscriptBubbleProps {
  words?: SegmentWord[];
  translationWords?: string[];
  time: number;
  mode?: "video" | "shadow"; // default 'video'
  currentTargetIndex?: number; // for shadow mode - the word user is attempting
  showFullText?: boolean;
  playerIsPlaying?: boolean;
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
  showFullText = false,
  playerIsPlaying = false,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [wordPositions, setWordPositions] = useState<{ [key: number]: number }>(
    {},
  );
  const [isActive, setIsActive] = useState(false);
  const prevWordsRef = useRef<SegmentWord[]>([]);
  const [tooltipWord, setTooltipWord] = useState<SegmentWord | null>(null);
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);

  const handleLongPress = useCallback(
    (word: SegmentWord) => {
      const cleanWordText = word.word.replace(
        /[.,\/#!$%\^&\*;:{}=\-_`~()]/g,
        "",
      );
      const vocabulary = word.word
        ? allVocabulary[vocabFormatWord(word.word)]
        : null;

      if (vocabulary) {
        setTooltipWord({
          ...word,
          word: cleanWordText,
        });
      }
    },
    [allVocabulary],
  );

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
    return 0;
  }, [words, time, mode, currentTargetIndex]);

  // Activate when we first hit a valid word (video mode) or immediately (shadow mode)
  useEffect(() => {
    if (currentWordIndex >= 0 && !isActive) {
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

  const wordEndsWithSpecialCase = (word: string) => {
    return (
      word.endsWith(",.") ||
      word.endsWith(".,") ||
      word.endsWith("?,") ||
      word.endsWith("!,")
    );
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
        style={showFullText ? styles.fullTextScrollView : styles.scrollView}
        contentContainerStyle={[
          styles.wordsRow,
          !showFullText && styles.wordsRowPadding,
          styles.tooltipContent,
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        {!words.length && <Text style={styles.word}></Text>}
        {words.map((word, index) => {
          // Determine word style based on mode
          const getWordStyle = () => {
            if (mode === "shadow") {
              return index <= currentTargetIndex
                ? styles.currentWord
                : styles.normalWord;
            }
            // Video mode: highlight chunk of 5 words around current position
            if (!playerIsPlaying) return styles.normalWord;
            const chunkStart = Math.floor(currentWordIndex / 5) * 5;
            const chunkEnd = chunkStart + 4;
            return index >= chunkStart && index <= chunkEnd
              ? styles.activeWord
              : styles.normalWord;
          };

          return (
            <Pressable
              key={`${word.start}-${index}`}
              onLayout={(e) => handleWordLayout(index, e)}
              onLongPress={() => handleLongPress(word)}
              delayLongPress={300}
            >
              <Text style={[styles.word, getWordStyle()]}>
                {word.word.startsWith(" ") ? "" : " "}
                {wordEndsWithSpecialCase(word.word)
                  ? word.word.slice(0, -1)
                  : word.word}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* <TooltipModal
        isVisible={tooltipWord !== null}
        onRequestClose={hideTooltip}
      >
        <Text style={styles.tooltipWord}>{tooltipWord?.word}</Text>
        <Text style={styles.tooltipTranslation}>
          {tooltipWord?.word
            ? wordsInContext.find(
                (w) =>
                  stripPunctuation(w.word.toLowerCase()).trim() ===
                  stripPunctuation(tooltipWord.word.toLowerCase()).trim(),
              )?.translation ||
              allVocabulary[
                stripPunctuation(tooltipWord.word.toLowerCase()).trim()
              ]?.translation ||
              ""
            : ""}
        </Text>
      </TooltipModal> */}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
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
    justifyContent: "center",
    gap: 2,
    flexWrap: "wrap",
  },
  fullTextScrollView: {
    height: "auto",
    overflow: "visible",
  },
  wordsRowPadding: {
    paddingBottom: LINE_HEIGHT * 2, // Extra space at bottom for scrolling
  },
  word: {
    fontSize: 18,
    marginHorizontal: -2,
    paddingHorizontal: 0,
    fontWeight: "600",
    textAlign: "center",
    fontFamily: "Helvetica",
    lineHeight: LINE_HEIGHT,
  },
  currentWord: {
    color: "black",
  },
  activeWord: {
    color: "#4CAF50",
  },
  normalWord: {
    color: "black", // White for other words
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
  tooltipContent: {
    alignItems: "center",
  },
});

export default FullSegmentTranscriptBubble;
