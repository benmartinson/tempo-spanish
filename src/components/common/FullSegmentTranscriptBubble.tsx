import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  LayoutChangeEvent,
  Pressable,
} from "react-native";
import { RootState, SegmentWord, VocabCacheEntry } from "../../types";
import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import WordModal from "./WordModal";
import SignInPromptModal from "./SignInPromptModal";
import { useSelector, useDispatch } from "react-redux";
import {
  addUserSelectedVocab,
  updateFocusVocabTranslation,
} from "../../store/actions/dataActions";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";
import { vocabFormatWord, getDisplayWord } from "../../helpers/helpers";
import { saveFocusVocabTranslation } from "../../requests";
import { useInterpolatedTime } from "../../hooks/useInterpolatedTime";
import { useStableChunkIdx } from "../../hooks/useStableChunkIdx";
import { CHAR_WIDTHS, DEFAULT_CHAR_WIDTH, TEST_CHAR } from "../../constants";

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
  disableGuessModal?: boolean;
  playWordSnippet?: (word: SegmentWord, isSlow?: boolean) => void;
  revealCounts?: Record<number, number>;
  vocabCache?: VocabCacheEntry[];
  onVocabCacheUpdate?: (entry: VocabCacheEntry) => void;
  attachedTop?: boolean;
  squareEdges?: boolean;
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
  disableGuessModal = false,
  playWordSnippet,
  revealCounts,
  vocabCache,
  onVocabCacheUpdate,
  attachedTop = false,
  squareEdges = false,
}) => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId, isSignedIn } = useAuth();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);

  const [guessWord, setGuessWord] = useState<string | null>(null);
  const [showSignInModal, setShowSignInModal] = useState(false);

  const handleSelectForReview = useCallback(
    async (word: SegmentWord) => {
      if (!currentVideo) return;
      if (!isSignedIn) {
        setShowSignInModal(true);
        return;
      }
      const wordKey = vocabFormatWord(word.word);
      dispatch(addUserSelectedVocab([wordKey]));
      if (supabase && userId && currentVideo.videoViewId) {
        const { data } = await supabase
          .from("video_view_focus_vocab")
          .select("word")
          .eq("video_view_id", currentVideo.videoViewId)
          .eq("word", wordKey)
          .single();

        if (!data) {
          await supabase.from("video_view_focus_vocab").insert({
            video_view_id: currentVideo.videoViewId,
            word: wordKey,
          });
        }
      }
      setGuessWord(word.word);
    },
    [currentVideo, supabase, userId, dispatch],
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

  // const localTime = useInterpolatedTime(
  //   time,
  //   playerIsPlaying,
  //   playKey,
  //   playerSpeed,
  //   words?.[0]?.start,
  // );
  const localTime = time;

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

  // Compute raw word index from current playback time
  const rawWordIdx = useMemo(() => {
    if (mode === "shadow") return currentTargetIndex;
    if (!words?.length) return -1;
    for (let i = 0; i < words.length; i++) {
      if (localTime >= words[i].start && localTime <= words[i].end) return i;
      if (
        localTime > words[i].end &&
        (i === words.length - 1 || localTime < words[i + 1].start)
      ) {
        return i;
      }
    }
    return 0;
  }, [words, localTime, mode, currentTargetIndex]);

  const segmentStartTime = words?.[0]?.start ?? 0;
  const { activeChunkStart, activeChunkEnd, displayWordIdx } =
    useStableChunkIdx({
      wordCount: words?.length ?? 0,
      rawWordIdx,
      isReplay: localTime <= segmentStartTime + 0.5,
      resetKey: segmentIdentity,
    });

  const currentWordIndex = displayWordIdx;

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

  // Show blank when not active (before first word or after words change)
  if (!isActive) {
    return (
      <View
        style={[
          styles.bubble,
          attachedTop && styles.attachedTopBubble,
          squareEdges && styles.squareEdgesBubble,
        ]}
      >
        <View style={styles.scrollView} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bubble,
        attachedTop && styles.attachedTopBubble,
        squareEdges && styles.squareEdgesBubble,
      ]}
    >
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
            if (
              activeChunkStart >= 0 &&
              index >= activeChunkStart &&
              index <= activeChunkEnd
            ) {
              return styles.activeWord;
            }
            return styles.normalWord;
          };

          const isBlurred = blurredIndices?.has(index);
          const wordStyle = getWordStyle();
          const isActive = wordStyle === styles.activeWord;
          const displayWord = getDisplayWord(words, index);

          return (
            <Pressable
              key={`${word.start}-${index}`}
              onLayout={(e) => handleWordLayout(index, e)}
              onPress={() => {
                if (isBlurred && onWordPress) {
                  onWordPress(index);
                } else if (!isBlurred && !disableGuessModal) {
                  handleSelectForReview(word);
                }
              }}
              onLongPress={onWordPress ? () => onWordPress(index) : undefined}
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
                    revealCounts?.[index] != null && {
                      left:
                        1 +
                        (CHAR_WIDTHS[TEST_CHAR ?? word.word.trim()[0]] ??
                          DEFAULT_CHAR_WIDTH),
                    },
                  ]}
                />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      <WordModal
        visible={!!guessWord}
        onClose={() => setGuessWord(null)}
        word={guessWord ?? ""}
        sentenceText={currentSentenceText}
        onPlaySnippet={
          playWordSnippet && guessWord
            ? () => playWordSnippet(words.find((w) => w.word === guessWord)!)
            : undefined
        }
        onPlaySnippetSlow={
          playWordSnippet && guessWord
            ? () =>
                playWordSnippet(words.find((w) => w.word === guessWord)!, true)
            : undefined
        }
        vocabCache={vocabCache}
        onVocabCacheUpdate={onVocabCacheUpdate}
        onTranslationFetched={(translation) => {
          if (guessWord) {
            const wordKey = vocabFormatWord(guessWord);
            dispatch(updateFocusVocabTranslation(wordKey, translation));
            if (supabase && currentVideo?.videoViewId) {
              saveFocusVocabTranslation({
                supabase,
                videoViewId: currentVideo.videoViewId,
                word: wordKey,
                translation,
              });
            }
          }
        }}
      />
      <SignInPromptModal
        visible={showSignInModal}
        onClose={() => setShowSignInModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    marginHorizontal: 16,
    marginTop: 0,
    backgroundColor: "#f0f4ff",
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 16,
  },
  attachedTopBubble: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  squareEdgesBubble: {
    borderRadius: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
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
