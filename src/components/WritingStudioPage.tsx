import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAuth } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { supabase as rawSupabase } from "../../lib/supabase";
import { useSupabaseWithClerk } from "../../utils/supabase";
import {
  TranscriptPhraseMatch,
  WritingSuggestion,
  fetchWritingSuggestions,
  searchTranscriptPhrase,
} from "../requests";
import {
  computeBaseMaskedIndices,
  isWebScreenWidth,
  removeSpecialPunctuation,
} from "../helpers/helpers";
import { LanguageCode, RootState, SegmentWord, Sentence } from "../types";
import YouTubePlayer, { YouTubePlayerHandle } from "./common/YouTubePlayer";
import PlayerControls from "./shadow/PlayerControls";
import FullSegmentTranscriptBubble from "./common/FullSegmentTranscriptBubble";
import DifficultySlider from "./common/DifficultySlider";

type StudioMode = "write" | "memorize";

const DEFAULT_DRAFT =
  "Cuando pienso en mi futuro, quiero hablar con mas confianza y contar historias que suenen naturales.";

const splitDraftIntoSentences = (text: string): string[] =>
  text
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];

const getActiveSentence = (text: string, cursor: number): string => {
  const safeCursor = Math.max(0, Math.min(cursor, text.length));
  const before = text.slice(0, safeCursor);
  const after = text.slice(safeCursor);
  const start = Math.max(
    before.lastIndexOf("."),
    before.lastIndexOf("!"),
    before.lastIndexOf("?"),
  );
  const nextStops = [after.indexOf("."), after.indexOf("!"), after.indexOf("?")]
    .filter((index) => index >= 0)
    .map((index) => safeCursor + index + 1);
  const end = nextStops.length ? Math.min(...nextStops) : text.length;
  return text.slice(start + 1, end).trim();
};

const getSelectedPhrase = (
  draft: string,
  selection: { start: number; end: number },
): string => {
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  return draft.slice(start, end).trim().replace(/\s+/g, " ");
};

const makeClipSentence = (match: TranscriptPhraseMatch): Sentence => ({
  index: match.segmentId,
  start: match.start,
  end: match.end,
  text: match.clipText,
  words: [],
});

const WritingStudioPage: React.FC = () => {
  const { width } = useWindowDimensions();
  const isWide = isWebScreenWidth(width);
  const navigation = useNavigation<any>();
  const { isSignedIn } = useAuth();
  const clerkSupabase = useSupabaseWithClerk();
  const publicSupabase = clerkSupabase ?? rawSupabase;
  const allVideos = useSelector((state: RootState) => state.allVideos);
  const allChannels = useSelector((state: RootState) => state.allChannels);
  const targetLanguage = useSelector(
    (state: RootState) => state.userSettings.targetLanguage,
  );

  const [mode, setMode] = useState<StudioMode>("write");
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [relayedHighlightedPhrase, setRelayedHighlightedPhrase] = useState("");
  const [suggestions, setSuggestions] = useState<WritingSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [matches, setMatches] = useState<TranscriptPhraseMatch[]>([]);
  const [selectedMatch, setSelectedMatch] =
    useState<TranscriptPhraseMatch | null>(null);
  const [isSearchingPhrase, setIsSearchingPhrase] = useState(false);
  const [phraseError, setPhraseError] = useState<string | null>(null);
  const [playerTime, setPlayerTime] = useState(0);
  const [playerIsPlaying, setPlayerIsPlaying] = useState(false);
  const [playerRefreshKey, setPlayerRefreshKey] = useState(1);
  const [memorizeDifficulty, setMemorizeDifficulty] = useState(0);
  const [revealedMemorizeIndices, setRevealedMemorizeIndices] = useState<
    Set<number>
  >(new Set());
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const clipPlaybackTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const showSuggestions = false;
  const channelTitleById = useMemo(
    () =>
      new Map(
        allChannels.map((channel) => [channel.channel_id, channel.title]),
      ),
    [allChannels],
  );
  const selectedMatchIndex = selectedMatch
    ? matches.findIndex(
        (match) =>
          match.videoRecordId === selectedMatch.videoRecordId &&
          match.segmentId === selectedMatch.segmentId,
      )
    : -1;
  const previousMatch =
    selectedMatchIndex > 0 ? matches[selectedMatchIndex - 1] : null;
  const nextMatch =
    selectedMatchIndex >= 0 && selectedMatchIndex < matches.length - 1
      ? matches[selectedMatchIndex + 1]
      : null;

  const queueMatchPlayback = useCallback(
    (match: TranscriptPhraseMatch, delays = [500, 1000]) => {
      clipPlaybackTimeoutsRef.current.forEach(clearTimeout);
      clipPlaybackTimeoutsRef.current = delays.map((delay) =>
        setTimeout(() => {
          playerRef.current?.setClip(match.start, match.end);
          playerRef.current?.setSpeed(1);
          playerRef.current?.seekAndPlay(match.start);
        }, delay),
      );
    },
    [],
  );

  useEffect(() => {
    return () => {
      clipPlaybackTimeoutsRef.current.forEach(clearTimeout);
      clipPlaybackTimeoutsRef.current = [];
    };
  }, []);

  const selectedPhrase = useMemo(
    () => getSelectedPhrase(draft, selection),
    [draft, selection],
  );
  const activeSearchPhrase = selectedPhrase || relayedHighlightedPhrase;
  const activeSentence = useMemo(
    () => getActiveSentence(draft, selection.end),
    [draft, selection.end],
  );
  const memorizeWords = useMemo<SegmentWord[]>(() => {
    const tokens = draft.trim().split(/\s+/).filter(Boolean);
    return tokens.map((word, index) => ({
      word,
      start: index * 0.35,
      end: index * 0.35 + 0.3,
      frequency: index,
    }));
  }, [draft]);
  const memorizeMaskedIndices = useMemo(() => {
    const masked = computeBaseMaskedIndices(memorizeWords, memorizeDifficulty);
    revealedMemorizeIndices.forEach((index) => masked.delete(index));
    return masked;
  }, [memorizeDifficulty, memorizeWords, revealedMemorizeIndices]);
  const setMemorizeDifficultyAndReset = useCallback((difficulty: number) => {
    setMemorizeDifficulty(difficulty);
    setRevealedMemorizeIndices(new Set());
  }, []);
  const revealMemorizeWord = useCallback((index: number) => {
    setRevealedMemorizeIndices((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  useEffect(
    () => setRevealedMemorizeIndices(new Set()),
    [memorizeDifficulty, memorizeWords],
  );
  useEffect(() => {
    if (!targetLanguage || !isSignedIn || activeSentence.length < 4) {
      setSuggestions([]);
      setSuggestionError(
        !isSignedIn && activeSentence.length >= 4
          ? "Sign in to use AI suggestions."
          : null,
      );
      setIsLoadingSuggestions(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setIsLoadingSuggestions(true);
      setSuggestionError(null);
      fetchWritingSuggestions({
        draftText: draft,
        activeSentence,
        targetLanguage: targetLanguage as LanguageCode,
      })
        .then((nextSuggestions) => {
          if (!cancelled) setSuggestions(nextSuggestions);
        })
        .catch(() => {
          if (!cancelled) {
            setSuggestions([]);
            setSuggestionError("Suggestions are unavailable right now.");
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoadingSuggestions(false);
        });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeSentence, draft, isSignedIn, targetLanguage]);

  useEffect(() => {
    if (!activeSearchPhrase) {
      setPhraseError(null);
      setIsSearchingPhrase(false);
      return;
    }

    const selectedSentences = splitDraftIntoSentences(activeSearchPhrase);
    if (selectedSentences.length > 1 || activeSearchPhrase.length > 180) {
      setIsSearchingPhrase(false);
      setPhraseError("Select no more than one sentence.");
      return;
    }

    if (activeSearchPhrase.length < 3) {
      setIsSearchingPhrase(false);
      setPhraseError(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setIsSearchingPhrase(true);
      setPhraseError(null);
      searchTranscriptPhrase({
        supabase: publicSupabase,
        phrase: activeSearchPhrase,
        videos: allVideos,
      })
        .then((nextMatches) => {
          if (cancelled) return;
          setMatches(nextMatches);
          const bestMatch = nextMatches[0] ?? null;
          setSelectedMatch(bestMatch);
          setPlayerTime(bestMatch?.start ?? 0);
          if (bestMatch) {
            setPlayerRefreshKey((key) => key + 1);
            queueMatchPlayback(bestMatch);
          }
          if (!bestMatch) setPhraseError("No transcript match found.");
        })
        .catch(() => {
          if (!cancelled) {
            setMatches([]);
            setSelectedMatch(null);
            setPhraseError("Transcript search is unavailable right now.");
          }
        })
        .finally(() => {
          if (!cancelled) setIsSearchingPhrase(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeSearchPhrase, allVideos, publicSupabase, queueMatchPlayback]);

  const insertSuggestion = useCallback(
    (suggestion: WritingSuggestion) => {
      const start = Math.min(selection.start, selection.end);
      const end = Math.max(selection.start, selection.end);
      const before = draft.slice(0, start);
      const after = draft.slice(end);
      const needsSpace =
        before.length > 0 &&
        !/\s$/.test(before) &&
        suggestion.insertText.length > 0 &&
        !/^[.,!?;:]/.test(suggestion.insertText);
      const insertText = `${needsSpace ? " " : ""}${suggestion.insertText}`;
      const nextDraft = `${before}${insertText}${after}`;
      const nextCursor = before.length + insertText.length;
      setDraft(nextDraft);
      setSelection({ start: nextCursor, end: nextCursor });
    },
    [draft, selection],
  );

  const playMatch = useCallback(
    (match: TranscriptPhraseMatch) => {
      setSelectedMatch(match);
      setPlayerTime(match.start);
      setPlayerRefreshKey((key) => key + 1);
      queueMatchPlayback(match, [250, 700]);
    },
    [queueMatchPlayback],
  );

  const replaySelectedMatch = useCallback(
    (speed = 1) => {
      if (!selectedMatch) return;
      playerRef.current?.setSpeed(speed);
      playerRef.current?.setClip(selectedMatch.start, selectedMatch.end);
      playerRef.current?.seekAndPlay(selectedMatch.start);
    },
    [selectedMatch],
  );

  const toggleMatchPlayback = useCallback(() => {
    playerRef.current?.togglePlayback();
  }, []);

  const openSelectedVideo = useCallback(() => {
    if (!selectedMatch) return;
    navigation.navigate({
      name: "MainApp",
      params: {
        videoId: selectedMatch.videoId,
        clip: selectedMatch.anchorTime,
      },
      merge: false,
    });
  }, [navigation, selectedMatch]);

  const handleRelayHighlightedWords = useCallback((words: SegmentWord[]) => {
    const phrase = removeSpecialPunctuation(
      words
        .map((word) => word.word)
        .join(" ")
        .replace(/\s+/g, " "),
    ).trim();
    setRelayedHighlightedPhrase(phrase);
  }, []);

  const renderSegmentTranscript = useCallback(() => {
    if (!selectedMatch) return null;

    const words = selectedMatch.segmentWords.length
      ? selectedMatch.segmentWords
      : selectedMatch.segmentText.split(/\s+/).filter(Boolean);

    return words.map((word, index) => {
      const isHighlighted =
        selectedMatch.highlightStartIndex !== null &&
        selectedMatch.highlightEndIndex !== null &&
        index >= selectedMatch.highlightStartIndex &&
        index <= selectedMatch.highlightEndIndex;

      return (
        <Text
          key={`${word}-${index}`}
          style={isHighlighted && styles.segmentTranscriptWordActive}
        >
          {word}
          {index < words.length - 1 ? " " : ""}
        </Text>
      );
    });
  }, [selectedMatch]);

  return (
    <View style={styles.page}>
      <View style={[styles.writeLayout, !isWide && styles.writeLayoutNarrow]}>
        <View style={styles.clipColumn}>
          {showSuggestions && (
            <View style={styles.suggestionsPane}>
              <View style={styles.paneHeader}>
                <Text style={styles.paneTitle}>Suggestions</Text>
                {isLoadingSuggestions && (
                  <ActivityIndicator size="small" color="#5a5680" />
                )}
              </View>
              {suggestionError ? (
                <Text style={styles.emptyText}>{suggestionError}</Text>
              ) : suggestions.length ? (
                <View style={styles.suggestionList}>
                  {suggestions.map((suggestion, index) => (
                    <Pressable
                      key={`${suggestion.insertText}-${index}`}
                      style={styles.suggestionItem}
                      onPress={() => insertSuggestion(suggestion)}
                    >
                      <Text style={styles.suggestionText}>
                        {suggestion.label || suggestion.insertText}
                      </Text>
                      <Ionicons name="add" size={17} color="#3d3a52" />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>
                  Keep typing to generate continuation ideas.
                </Text>
              )}
            </View>
          )}

          <View style={styles.videoPane}>
            <View
              style={[
                styles.paneHeader,
                styles.videoPaneHeader,
                { marginTop: 12 },
              ]}
            >
              <Text style={styles.paneTitle}>Clip Match</Text>
              {isSearchingPhrase && (
                <ActivityIndicator size="small" color="#5a5680" />
              )}
            </View>
            {selectedMatch ? (
              <>
                <View style={styles.playerShell}>
                  <YouTubePlayer
                    ref={playerRef}
                    videoId={selectedMatch.videoId}
                    clip={makeClipSentence(selectedMatch)}
                    autoplay
                    refreshKey={playerRefreshKey}
                    setTime={setPlayerTime}
                    startTime={playerTime}
                    videoText={activeSearchPhrase}
                    onPlayingStateChange={setPlayerIsPlaying}
                    webCropMode="narrow"
                  />
                </View>
                <View style={styles.matchTitleRow}>
                  <View style={styles.matchTitleTextGroup}>
                    <Text style={styles.matchTitle} numberOfLines={1}>
                      {selectedMatch.title}
                    </Text>
                    <Text style={styles.matchChannel} numberOfLines={1}>
                      {channelTitleById.get(selectedMatch.channelId) ??
                        "Tempo clip"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.openVideoButton}
                    onPress={openSelectedVideo}
                    activeOpacity={0.76}
                  >
                    <Ionicons name="open-outline" size={18} color="#26705d" />
                  </TouchableOpacity>
                </View>
                <View style={styles.clipActionRow}>
                  <PlayerControls
                    onReplay={() => replaySelectedMatch(1)}
                    onReplaySlow={() => replaySelectedMatch(0.75)}
                    onPlayPause={toggleMatchPlayback}
                    isPlaying={playerIsPlaying}
                    playDisabled={!selectedMatch}
                    compact
                    containerStyle={styles.clipPlayerControls}
                  />
                  <View style={styles.clipNavHeader}>
                    <TouchableOpacity
                      style={[
                        styles.clipNavArrow,
                        !previousMatch && styles.clipNavArrowDisabled,
                      ]}
                      onPress={() => previousMatch && playMatch(previousMatch)}
                      disabled={!previousMatch}
                    >
                      <Ionicons name="arrow-back" size={18} color="#3d3a52" />
                    </TouchableOpacity>
                    <Text style={styles.clipNavCount}>
                      Clip {selectedMatchIndex + 1} of {matches.length}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.clipNavArrow,
                        !nextMatch && styles.clipNavArrowDisabled,
                      ]}
                      onPress={() => nextMatch && playMatch(nextMatch)}
                      disabled={!nextMatch}
                    >
                      <Ionicons
                        name="arrow-forward"
                        size={18}
                        color="#3d3a52"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.segmentTranscript}>
                  {renderSegmentTranscript()}
                </Text>
              </>
            ) : (
              <View style={styles.emptyVideoState}>
                <Ionicons name="film-outline" size={24} color="#5a5680" />
                <Text style={styles.emptyText}>
                  {phraseError ||
                    "Matched video clips will appear after you highlight text."}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.editorPane}>
          <View style={styles.paneHeader}>
            <Text style={styles.paneTitle}>Composer</Text>
            <View style={styles.modeSwitch}>
              <Pressable
                style={[
                  styles.modeButton,
                  mode === "write" && styles.modeButtonActive,
                ]}
                onPress={() => setMode("write")}
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={mode === "write" ? "#ffffff" : "#3d3a52"}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === "write" && styles.modeButtonTextActive,
                  ]}
                >
                  Write
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modeButton,
                  mode === "memorize" && styles.modeButtonActive,
                ]}
                onPress={() => setMode("memorize")}
              >
                <MaterialIcons
                  name="psychology"
                  size={17}
                  color={mode === "memorize" ? "#ffffff" : "#3d3a52"}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === "memorize" && styles.modeButtonTextActive,
                  ]}
                >
                  Memorize
                </Text>
              </Pressable>
            </View>
          </View>

          {mode === "write" ? (
            <>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSelectionChange={(event: any) => {
                  const nextSelection = event.nativeEvent.selection;
                  if (nextSelection) setSelection(nextSelection);
                }}
                multiline
                placeholder="Write a short passage..."
                placeholderTextColor="#8a91a3"
                style={styles.editor}
                textAlignVertical="top"
              />
            </>
          ) : (
            <View style={styles.composerMemorizeContent}>
              <DifficultySlider
                difficulty={memorizeDifficulty}
                onDifficultyChange={setMemorizeDifficultyAndReset}
                variant="compact"
                style={styles.composerDifficultySlider}
              />
              <ScrollView
                style={styles.memorizeBubbleScroll}
                contentContainerStyle={styles.memorizeBubbleScrollContent}
                showsVerticalScrollIndicator
              >
                <FullSegmentTranscriptBubble
                  words={memorizeWords}
                  blurredIndices={memorizeMaskedIndices}
                  time={0}
                  playerIsPlaying={false}
                  showFullText
                  disableGuessModal={false}
                  onWordPress={revealMemorizeWord}
                  relayHighlightedWords={handleRelayHighlightedWords}
                />
              </ScrollView>
            </View>
          )}
          <View style={styles.selectionBar}>
            <Ionicons name="scan-outline" size={16} color="#5a5680" />
            <Text style={styles.selectionText} numberOfLines={1}>
              {activeSearchPhrase ||
                "Highlight a phrase to find a matching clip"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  modeSwitch: {
    flexDirection: "row",
    alignItems: "center",
    padding: 3,
    borderRadius: 10,
    backgroundColor: "#e8edf7",
  },
  modeButton: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: "#3d3a52",
  },
  modeButtonText: {
    color: "#3d3a52",
    fontSize: 13,
    fontWeight: "800",
  },
  modeButtonTextActive: {
    color: "#ffffff",
  },
  writeLayout: {
    flex: 1,
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    flexDirection: "row",
    gap: 16,
  },
  writeLayoutNarrow: {
    flexDirection: "column",
  },
  editorPane: {
    flex: 1,
    minHeight: 460,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.14)",
    overflow: "hidden",
  },
  clipColumn: {
    flex: 1.2,
    gap: 16,
  },
  suggestionsPane: {
    minHeight: 178,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.14)",
    padding: 14,
  },
  videoPane: {
    flex: 1,
    minHeight: 460,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.14)",
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  paneHeader: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  videoPaneHeader: {
    marginHorizontal: -14,
  },
  paneTitle: {
    color: "#2f3140",
    fontSize: 16,
    fontWeight: "900",
  },
  editor: {
    flex: 1,
    minHeight: 380,
    paddingHorizontal: 18,
    paddingVertical: 14,
    color: "#222638",
    fontSize: 20,
    lineHeight: 32,
    outlineStyle: "none" as any,
  },
  composerMemorizeContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  selectionBar: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(74, 105, 189, 0.12)",
    backgroundColor: "#f7f9ff",
  },
  selectionText: {
    flex: 1,
    color: "#5a5680",
    fontSize: 13,
    fontWeight: "700",
  },
  suggestionList: {
    gap: 8,
  },
  suggestionItem: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "#f7f9ff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.16)",
  },
  suggestionText: {
    flex: 1,
    color: "#2f3140",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyText: {
    color: "#697187",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  playerShell: {
    height: 320,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  clipPlayerControls: {
    alignSelf: "flex-start",
  },
  matchTitleRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  matchTitleTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  matchTitle: {
    color: "#2f3140",
    fontSize: 14,
    fontWeight: "900",
  },
  matchChannel: {
    marginTop: 2,
    color: "#697187",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  openVideoButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf4f2",
    borderWidth: 1,
    borderColor: "rgba(38, 112, 93, 0.18)",
  },
  clipActionRow: {
    minHeight: 42,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  segmentTranscript: {
    marginTop: 12,
    color: "#697187",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    minHeight: 86,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#f7f9ff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.12)",
  },
  segmentTranscriptWordActive: {
    color: "#26705d",
    fontWeight: "900",
  },
  clipNavHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  clipNavArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.22)",
  },
  clipNavArrowDisabled: {
    opacity: 0.32,
  },
  clipNavCount: {
    minWidth: 88,
    color: "#3d3a52",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  clipNavigation: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  clipNavSlot: {
    flex: 1,
    minWidth: 0,
  },
  clipNavCard: {
    minHeight: 148,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f7f9ff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.14)",
  },
  clipNavThumbnail: {
    width: 116,
    height: "100%",
    borderRadius: 6,
    backgroundColor: "#d8dee9",
  },
  clipNavTextGroup: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  clipNavLabel: {
    color: "#26705d",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  clipNavTitle: {
    marginTop: 8,
    color: "#2f3140",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },
  clipNavChannel: {
    marginTop: 8,
    color: "#697187",
    fontSize: 11,
    fontWeight: "700",
  },
  emptyVideoState: {
    flex: 1,
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  composerDifficultySlider: {
    alignSelf: "stretch",
    marginTop: 12,
  },
  memorizeBubbleScroll: {
    flex: 1,
    marginTop: 12,
    minHeight: 0,
  },
  memorizeBubbleScrollContent: {
    paddingBottom: 8,
  },
});

export default WritingStudioPage;
