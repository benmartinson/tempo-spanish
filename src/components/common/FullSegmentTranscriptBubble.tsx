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
import GuessWordModal from "../common/GuessWordModal";
import { useSelector, useDispatch } from "react-redux";
import { addUserSelectedVocab } from "../../store/actions/dataActions";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";
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
  playKey?: number;
  playerSpeed?: number;
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
  playKey,
  playerSpeed = 1,
}) => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);

  const [guessWord, setGuessWord] = useState<string | null>(null);

  const handleSelectForReview = useCallback(
    async (word: SegmentWord) => {
      if (!currentVideo) return;
      const vocabEntry = allVocabulary[vocabFormatWord(word.word)];
      if (!vocabEntry) return;
      const vocabId = vocabEntry.id;
      dispatch(addUserSelectedVocab([vocabId]));
      if (supabase && userId && currentVideo.videoViewId) {
        await supabase
          .from("video_view_focus_vocab")
          .upsert(
            { video_view_id: currentVideo.videoViewId, vocabulary_id: vocabId },
            { onConflict: "video_view_id,vocabulary_id" },
          );
      }
      setGuessWord(word.word);
    },
    [currentVideo, allVocabulary, supabase, userId, dispatch],
  );

  const currentSentenceText = useMemo(
    () => words?.map((w) => w.word).join(" ") ?? "",
    [words],
  );

  const scrollViewRef = useRef<ScrollView>(null);
  const [wordPositions, setWordPositions] = useState<{ [key: number]: number }>(
    {},
  );
  const [isActive, setIsActive] = useState(false);
  const [tooltipWord, setTooltipWord] = useState<SegmentWord | null>(null);

  // Fill the initial time gap when playback starts.
  // The player provides an initial time, then ~1.5s of silence before
  // updates resume at ~150ms. We interpolate during that gap.
  const [localTime, setLocalTime] = useState(time);
  const localTimeRef = useRef(time);
  const timeUpdateCountRef = useRef(0);
  const interpolatingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPlayerIsPlayingRef = useRef(playerIsPlaying);

  const startInterpolation = (startTime: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    timeUpdateCountRef.current = 0;
    interpolatingRef.current = true;
    let counter = 0;
    const speed = playerSpeed || 1;
    const intervalMs = 150 / speed;
    intervalRef.current = setInterval(() => {
      counter++;
      const t = startTime + counter * 0.15;
      localTimeRef.current = t;
      setLocalTime(t);
    }, intervalMs);
  };

  // Detect replay via playKey change
  const prevPlayKeyRef = useRef(playKey);
  useEffect(() => {
    if (playKey !== undefined && playKey !== prevPlayKeyRef.current) {
      prevPlayKeyRef.current = playKey;
      setLocalTime(time);
      localTimeRef.current = time;
      if (playerIsPlaying) {
        startInterpolation(time);
      }
    }
  }, [playKey]);

  // Track incoming time prop updates
  useEffect(() => {
    // Detect replay: time jumped backward while still playing
    if (playerIsPlaying && time < localTimeRef.current) {
      setLocalTime(time);
      localTimeRef.current = time;
      startInterpolation(time);
      return;
    }

    if (interpolatingRef.current) {
      timeUpdateCountRef.current += 1;
      // Second real update means the player is feeding us reliably — stop interpolating
      if (timeUpdateCountRef.current >= 2) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        interpolatingRef.current = false;
      }
    }
    localTimeRef.current = time;
    setLocalTime(time);
  }, [time]);

  // Start/stop interpolation when playerIsPlaying changes
  useEffect(() => {
    const wasPlaying = prevPlayerIsPlayingRef.current;
    prevPlayerIsPlayingRef.current = playerIsPlaying;

    if (playerIsPlaying && !wasPlaying) {
      // Player just started — begin interpolating
      startInterpolation(time);
    } else if (!playerIsPlaying && wasPlaying) {
      // Player stopped
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      interpolatingRef.current = false;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [playerIsPlaying]);

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
    // Video mode: find word based on playback time (using localTime to cover the initial gap)
    for (let i = 0; i < words.length; i++) {
      if (localTime >= words[i].start && localTime <= words[i].end) {
        return i;
      }
      if (
        localTime > words[i].end &&
        (i === words.length - 1 || localTime < words[i + 1].start)
      ) {
        return i;
      }
    }
    return 0;
  }, [words, localTime, mode, currentTargetIndex]);

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

  // Precompute highlight chunks: 5 words each, but if 6 remain split into 4+2
  const chunks = useMemo(() => {
    if (!words?.length) return [];
    const result: [number, number][] = [];
    let i = 0;
    while (i < words.length) {
      const remaining = words.length - i;
      const size = remaining === 6 ? 4 : Math.min(5, remaining);
      result.push([i, i + size - 1]);
      i += size;
    }
    return result;
  }, [words]);

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
            // Video mode: highlight the chunk containing the current word
            if (!playerIsPlaying) return styles.normalWord;
            const chunk = chunks.find(
              ([start, end]) =>
                currentWordIndex >= start && currentWordIndex <= end,
            );
            if (chunk && index >= chunk[0] && index <= chunk[1]) {
              return styles.activeWord;
            }
            return styles.normalWord;
          };

          const isBlurred = blurredIndices?.has(index);
          const wordStyle = getWordStyle();
          const isActive = wordStyle === styles.activeWord;
          let displayWord = wordEndsWithSpecialCase(word.word)
            ? word.word.slice(0, -1)
            : word.word;
          if (index === 0 && displayWord[0] && displayWord[0] !== displayWord[0].toUpperCase()) {
            displayWord = "..." + displayWord;
          }
          if (index === words.length - 1 && displayWord.endsWith(",")) {
            displayWord = displayWord.slice(0, -1) + "...";
          }

          return (
            <Pressable
              key={`${word.start}-${index}`}
              onLayout={(e) => handleWordLayout(index, e)}
              onPress={() => {
                if (isBlurred && onWordPress) {
                  onWordPress(index);
                } else if (!isBlurred) {
                  handleSelectForReview(word);
                }
              }}
              onLongPress={() =>
                onWordPress ? onWordPress(index) : handleLongPress(word)
              }
              delayLongPress={300}
              style={isBlurred ? styles.maskedWordWrapper : undefined}
            >
              <Text style={[styles.word, wordStyle]}>
                {word.word.startsWith(" ") ? "" : " "}
                {displayWord}
              </Text>
              {isBlurred && (
                <View
                  style={[
                    styles.maskedWordOverlay,
                    isActive && { backgroundColor: "#b9e6bf" },
                  ]}
                />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      <GuessWordModal
        visible={!!guessWord}
        onClose={() => setGuessWord(null)}
        word={guessWord ?? ""}
        sentenceText={currentSentenceText}
      />
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
