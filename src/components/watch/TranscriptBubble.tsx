import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { RootState, SegmentWord } from "../../types";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { stripPunctuation, vocabFormatWord } from "../../helpers";

interface TranscriptBubbleProps {
  words: SegmentWord[];
  time: number;
}

const TranscriptBubble: React.FC<TranscriptBubbleProps> = ({ words, time }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const displayedMaxIndex = useRef(-1);
  const previousWords = useRef<SegmentWord[]>([]);
  const previousTime = useRef<number>(0);
  const [tooltipWord, setTooltipWord] = useState<SegmentWord | null>(null);
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);

  const handleLongPress = useCallback((word: SegmentWord) => {
    const vocabulary = allVocabulary[vocabFormatWord(word.word)];
    if (vocabulary) {
      // Strip punctuation for display in tooltip
      const cleanWord = {
        ...word,
        word: word.word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ""),
        translation: vocabulary.translation.replace(
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
      {isExpanded && (
        <View style={styles.wordsRow}>
          {!visibleWords.length && <Text style={styles.visibleWord}></Text>}
          {visibleWords.map((word, index) => {
            if (index > 5) {
              return null;
            }
            return (
              <Pressable
                key={`${word.start}-${index}`}
                onLongPress={() => handleLongPress(word)}
                delayLongPress={300}
              >
                <Text style={styles.visibleWord}>{word.word}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

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
              {allVocabulary[vocabFormatWord(tooltipWord?.word)].translation}
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

export default TranscriptBubble;
