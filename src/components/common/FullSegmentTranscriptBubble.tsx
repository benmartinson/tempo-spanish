import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  LayoutChangeEvent,
  Pressable,
  Platform,
} from "react-native";
import { RootState, SegmentWord, VocabCacheEntry } from "../../types";
import {
  ReactNode,
  Fragment,
  useMemo,
  useRef,
  useEffect,
  useState,
  useCallback,
} from "react";
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
  reviewPresentation?: "modal" | "inline";
  onInlineReviewWord?: (word: SegmentWord) => void;
  footerContent?: ReactNode;
  relayHighlightedWords?: (words: SegmentWord[]) => void;
  relayResetKey?: number | string;
  showWordTimestamps?: boolean;
}

const LINE_HEIGHT = 28;
const VISIBLE_LINES = 3;
const VISIBLE_HEIGHT = LINE_HEIGHT * VISIBLE_LINES;
const normalizeRelayToken = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();

const formatWordTimestamp = (time: number): string => {
  const safeTime = Math.max(0, Number.isFinite(time) ? time : 0);
  const minutes = Math.floor(safeTime / 60);
  const seconds = Math.floor(safeTime % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const hasParagraphBreakBefore = (word: SegmentWord): boolean =>
  Boolean(word.paragraphBreakBefore);

const selectionTokenMatchesWord = (
  token: string,
  wordToken: string,
  index: number,
  lastIndex: number,
): boolean => {
  if (!token || !wordToken) return false;
  if (index === 0 || index === lastIndex) return wordToken.includes(token);
  return wordToken === token;
};

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
  reviewPresentation = "modal",
  onInlineReviewWord,
  footerContent,
  relayHighlightedWords,
  relayResetKey = 0,
  showWordTimestamps = false,
}) => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId, isSignedIn } = useAuth();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);

  const [guessWord, setGuessWord] = useState<string | null>(null);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [relayRange, setRelayRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const relayDidHighlightRef = useRef(false);

  const handleSelectForReview = useCallback(
    async (word: SegmentWord) => {
      if (!currentVideo) {
        setGuessWord(word.word);
        return;
      }
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
      if (reviewPresentation === "inline") {
        onInlineReviewWord?.(word);
      } else {
        setGuessWord(word.word);
      }
    },
    [
      currentVideo,
      supabase,
      userId,
      dispatch,
      reviewPresentation,
      onInlineReviewWord,
      isSignedIn,
    ],
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

  // Build a stable identity for the displayed segment so edit-tab text changes
  // refresh the memorize view while masking/revealing words does not.
  const segmentIdentity = useMemo(() => {
    if (!words?.length) return "";
    const textIdentity = words.map((word) => word.word).join("|");
    return `${words.length}-${words[0]?.start}-${words[words.length - 1]?.end}-${textIdentity}`;
  }, [words]);

  // Reset only when the displayed segment changes.
  useEffect(() => {
    setIsActive(false);
    setWordPositions({});
    setRelayRange(null);
    relayDidHighlightRef.current = false;
  }, [segmentIdentity]);

  useEffect(() => {
    setRelayRange(null);
    relayDidHighlightRef.current = false;
  }, [relayResetKey]);

  const relayWordRange = useCallback(
    (startIndex: number, endIndex: number) => {
      if (!relayHighlightedWords || !words?.length) return;

      const start = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);

      setRelayRange({ start, end });
      relayHighlightedWords(words.slice(start, end + 1));
    },
    [relayHighlightedWords, words],
  );

  const relayBrowserSelection = useCallback(
    (selectionText: string) => {
      if (!relayHighlightedWords || !words?.length) return;

      const selectedTokens = selectionText
        .split(/\s+/)
        .filter((token) => !/^\d+:\d{2}$/.test(token.trim()))
        .map(normalizeRelayToken)
        .filter(Boolean);
      if (!selectedTokens.length) return;

      const wordTokens = words.map((word) => normalizeRelayToken(word.word));
      for (
        let start = 0;
        start <= wordTokens.length - selectedTokens.length;
        start++
      ) {
        const matches = selectedTokens.every((token, offset) =>
          selectionTokenMatchesWord(
            token,
            wordTokens[start + offset],
            offset,
            selectedTokens.length - 1,
          ),
        );
        if (!matches) continue;

        relayDidHighlightRef.current = true;
        relayWordRange(start, start + selectedTokens.length - 1);
        if (typeof window !== "undefined") {
          window.getSelection?.()?.removeAllRanges();
        }
        return;
      }
    },
    [relayHighlightedWords, relayWordRange, words],
  );

  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      !relayHighlightedWords ||
      typeof document === "undefined" ||
      typeof window === "undefined"
    ) {
      return;
    }

    const handleSelectionComplete = () => {
      window.setTimeout(() => {
        const selectionText = window.getSelection?.()?.toString() ?? "";
        if (selectionText.trim()) {
          relayBrowserSelection(selectionText);
        }
      }, 0);
    };

    document.addEventListener("mouseup", handleSelectionComplete);
    document.addEventListener("touchend", handleSelectionComplete);
    document.addEventListener("keyup", handleSelectionComplete);
    return () => {
      document.removeEventListener("mouseup", handleSelectionComplete);
      document.removeEventListener("touchend", handleSelectionComplete);
      document.removeEventListener("keyup", handleSelectionComplete);
    };
  }, [relayBrowserSelection, relayHighlightedWords]);

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
        footerContent && styles.bubbleWithFooter,
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
          const isRelayHighlighted =
            relayRange !== null &&
            index >= relayRange.start &&
            index <= relayRange.end;

          return (
            <Fragment key={`${word.start}-${index}`}>
              {hasParagraphBreakBefore(word) && (
                <View style={styles.paragraphBreak} />
              )}
              <Pressable
                onLayout={(e) => handleWordLayout(index, e)}
                onPress={() => {
                  const hasBrowserSelection =
                    Platform.OS === "web" &&
                    typeof window !== "undefined" &&
                    !!window.getSelection?.()?.toString().trim();
                  if (relayDidHighlightRef.current || hasBrowserSelection) {
                    relayDidHighlightRef.current = false;
                    return;
                  }
                  if (isBlurred && onWordPress) {
                    onWordPress(index);
                  } else if (!isBlurred && relayHighlightedWords) {
                    relayWordRange(index, index);
                  } else if (!isBlurred && !disableGuessModal) {
                    handleSelectForReview(word);
                  }
                }}
                onLongPress={onWordPress ? () => onWordPress(index) : undefined}
                delayLongPress={300}
                style={isBlurred ? styles.maskedWordWrapper : undefined}
              >
                <Text
                  style={[
                    styles.word,
                    wordStyle,
                    isRelayHighlighted && styles.relayHighlightedWord,
                  ]}
                >
                  {word.word.startsWith(" ") ? "" : " "}
                  {displayWord}
                </Text>
                {showWordTimestamps && (
                  <Text selectable={false} style={styles.wordTimestamp}>
                    {formatWordTimestamp(word.start)}
                  </Text>
                )}
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
            </Fragment>
          );
        })}
      </ScrollView>
      {footerContent && <View style={styles.footer}>{footerContent}</View>}
      {reviewPresentation === "modal" && (
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
                  playWordSnippet(
                    words.find((w) => w.word === guessWord)!,
                    true,
                  )
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
      )}
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
  bubbleWithFooter: {
    paddingBottom: 6,
  },
  squareEdgesBubble: {
    marginHorizontal: 0,
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
    paddingHorizontal: 2,
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
  relayHighlightedWord: {
    color: "#26705d",
  },
  normalWord: {
    color: "#222",
  },
  maskedWordWrapper: {
    position: "relative",
  },
  paragraphBreak: {
    width: "100%",
    height: 12,
  },
  wordTimestamp: {
    color: "#7c8497",
    fontSize: 9,
    lineHeight: 10,
    fontWeight: "800",
    textAlign: "center",
    marginTop: -3,
    userSelect: "none" as any,
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
  footer: {
    marginTop: 6,
    minHeight: 28,
    paddingTop: 6,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(74, 105, 189, 0.16)",
    justifyContent: "center",
  },
});

export default FullSegmentTranscriptBubble;
