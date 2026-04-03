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
  onWordPress?: (index: number) => void;
  blurredIndices?: Set<number>;
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
  onWordPress,
  blurredIndices,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [wordPositions, setWordPositions] = useState<{ [key: number]: number }>(
    {},
  );
  const [isActive, setIsActive] = useState(false);
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

  // Build a stable identity for the segment (based on timing, not text content)
  // so masking/revealing words doesn't trigger a full reset
  const segmentIdentity = useMemo(() => {
    if (!words?.length) return "";
    return `${words.length}-${words[0]?.start}-${words[words.length - 1]?.end}`;
  }, [words]);

  // Reset only when the actual segment changes, not when word text changes
  useEffect(() => {
    setIsActive(false);
    setWordPositions({});
  }, [segmentIdentity]);

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
      <View style={styles.bubble}>
        <View style={styles.scrollView} />
      </View>
    );
  }

  return (
    <View style={styles.bubble}>
      <ScrollView
        ref={scrollViewRef}
        style={showFullText ? styles.fullTextScrollView : styles.scrollView}
        contentContainerStyle={[
          styles.wordsRow,
          !showFullText && styles.wordsRowPadding,
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

          const isBlurred = blurredIndices?.has(index);
          const displayWord = wordEndsWithSpecialCase(word.word)
            ? word.word.slice(0, -1)
            : word.word;

          return (
            <Pressable
              key={`${word.start}-${index}`}
              onLayout={(e) => handleWordLayout(index, e)}
              onPress={() => (onWordPress ? onWordPress(index) : undefined)}
              onLongPress={() =>
                onWordPress ? onWordPress(index) : handleLongPress(word)
              }
              delayLongPress={300}
              style={isBlurred ? styles.maskedWordWrapper : undefined}
            >
              <Text style={[styles.word, getWordStyle()]}>
                {word.word.startsWith(" ") ? "" : " "}
                {displayWord}
              </Text>
              {isBlurred && (
                <View style={styles.maskedWordOverlay}>
                  {/* <Text style={styles.maskedWordXText}>
                    {"x".repeat(displayWord.replace(/[\s\p{P}]/gu, "").length)}
                  </Text> */}
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#f0f4ff",
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 16,
  },
  scrollView: {
    height: VISIBLE_HEIGHT, // Exactly 3 lines
    overflow: "hidden",
  },
  wordsRow: {
    flexDirection: "row",
    justifyContent: "center",
    columnGap: 5,
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
    fontSize: 17,
    marginHorizontal: -2,
    paddingHorizontal: 0,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: LINE_HEIGHT,
  },
  currentWord: {
    color: "#222",
  },
  activeWord: {
    color: "#4CAF50",
  },
  normalWord: {
    color: "#222",
  },
  maskedWordWrapper: {
    position: "relative",
  },
  maskedWordOverlay: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 1,
    right: -4,
    backgroundColor: "#c0c6d6",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  maskedWordXText: {
    fontSize: 13,
    lineHeight: 13,
    color: "#8a90a0",
    letterSpacing: 1,
    fontWeight: "600",
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
