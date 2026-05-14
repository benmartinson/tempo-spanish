import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { supabase as rawSupabase } from "../../../lib/supabase";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import {
  TranscriptPhraseMatch,
  UserComposition,
  WritingSuggestion,
  createUserComposition,
  fetchVideoContext,
  fetchUserCompositions,
  fetchWritingSuggestions,
  persistVideoSelection,
  searchTranscriptPhrase,
  updateUserComposition,
} from "../../requests";
import {
  addUserVideoView,
  setCurrentVideo,
} from "../../store/actions/dataActions";
import {
  computeBaseMaskedIndices,
  isWebScreenWidth,
  removeSpecialPunctuation,
} from "../../helpers/helpers";
import { LanguageCode, RootState, SegmentWord } from "../../types";
import { YouTubePlayerHandle } from "../common/YouTubePlayer";
import { CompositionTemplate } from "./ChooseComposition";
import ClipMatcher from "./ClipMatcher";
import Composer, { StudioMode } from "./Composer";

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

const makeCompositionTitle = (text: string): string => {
  const words = text.trim().split(/\s+/).filter(Boolean).slice(0, 7);
  if (!words.length) return "Untitled composition";
  return words.join(" ");
};

const WritingStudioPage: React.FC = () => {
  const { width } = useWindowDimensions();
  const isWide = isWebScreenWidth(width);
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const { isSignedIn, userId } = useAuth();
  const clerkSupabase = useSupabaseWithClerk();
  const publicSupabase = clerkSupabase ?? rawSupabase;
  const allVideos = useSelector((state: RootState) => state.allVideos);
  const allChannels = useSelector((state: RootState) => state.allChannels);
  const targetLanguage = useSelector(
    (state: RootState) => state.userSettings.targetLanguage,
  );

  const [mode, setMode] = useState<StudioMode>("write");
  const [draft, setDraft] = useState("");
  const [compositionTitle, setCompositionTitle] = useState("");
  const [hasChosenComposition, setHasChosenComposition] = useState(false);
  const [currentComposition, setCurrentComposition] =
    useState<UserComposition | null>(null);
  const [savedCompositions, setSavedCompositions] = useState<UserComposition[]>(
    [],
  );
  const [isLoadingSavedCompositions, setIsLoadingSavedCompositions] =
    useState(false);
  const [savedCompositionError, setSavedCompositionError] = useState<
    string | null
  >(null);
  const [isSavingComposition, setIsSavingComposition] = useState(false);
  const [saveCompositionError, setSaveCompositionError] = useState<
    string | null
  >(null);
  const [saveCompositionMessage, setSaveCompositionMessage] = useState<
    string | null
  >(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [relayedHighlightedPhrase, setRelayedHighlightedPhrase] = useState("");
  const [suggestions, setSuggestions] = useState<WritingSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [matches, setMatches] = useState<TranscriptPhraseMatch[]>([]);
  const [selectedMatch, setSelectedMatch] =
    useState<TranscriptPhraseMatch | null>(null);
  const [selectedMatchPhrase, setSelectedMatchPhrase] = useState("");
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

  useEffect(() => {
    if (!isSignedIn || !userId) {
      setSavedCompositions([]);
      setSavedCompositionError(null);
      setIsLoadingSavedCompositions(false);
      return;
    }

    if (!clerkSupabase) {
      setIsLoadingSavedCompositions(true);
      return;
    }

    let cancelled = false;
    setIsLoadingSavedCompositions(true);
    setSavedCompositionError(null);

    fetchUserCompositions({ supabase: clerkSupabase, userId })
      .then((compositions) => {
        if (!cancelled) setSavedCompositions(compositions);
      })
      .catch(() => {
        if (!cancelled) {
          setSavedCompositions([]);
          setSavedCompositionError("None found.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSavedCompositions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clerkSupabase, isSignedIn, userId]);

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
    if (!saveCompositionMessage) return;
    const timer = setTimeout(() => {
      setSaveCompositionMessage(null);
    }, 1000);

    return () => clearTimeout(timer);
  }, [saveCompositionMessage]);

  useEffect(() => {
    if (
      !hasChosenComposition ||
      !targetLanguage ||
      !isSignedIn ||
      activeSentence.length < 4
    ) {
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
  }, [activeSentence, draft, hasChosenComposition, isSignedIn, targetLanguage]);

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
      const requestedPhrase = activeSearchPhrase;

      const runSearch = async () => {
        let quickMatch: TranscriptPhraseMatch | null = null;

        try {
          const quickMatches = await searchTranscriptPhrase({
            supabase: publicSupabase,
            phrase: requestedPhrase,
            videos: allVideos,
            limit: 1,
          });
          if (cancelled) return;

          quickMatch = quickMatches[0] ?? null;
          if (quickMatch) {
            setMatches([quickMatch]);
            setSelectedMatch(quickMatch);
            setSelectedMatchPhrase(requestedPhrase);
            setPlayerTime(quickMatch.start);
            setPlayerRefreshKey((key) => key + 1);
            queueMatchPlayback(quickMatch);
          }
        } catch {
          if (!cancelled) {
            setMatches([]);
            setSelectedMatch(null);
            setSelectedMatchPhrase("");
            setPhraseError("Transcript search is unavailable right now.");
          }
          return;
        }

        try {
          const fullMatches = await searchTranscriptPhrase({
            supabase: publicSupabase,
            phrase: requestedPhrase,
            videos: allVideos,
          });
          if (cancelled) return;

          setMatches(fullMatches);
          const bestMatch = fullMatches[0] ?? quickMatch;
          if (!bestMatch) {
            setSelectedMatch(null);
            setSelectedMatchPhrase("");
            setPhraseError("No transcript match found.");
            return;
          }

          if (!quickMatch) {
            setSelectedMatch(bestMatch);
            setSelectedMatchPhrase(requestedPhrase);
            setPlayerTime(bestMatch.start);
            setPlayerRefreshKey((key) => key + 1);
            queueMatchPlayback(bestMatch);
          }
        } catch {
          if (!cancelled) {
            setPhraseError("Transcript search is unavailable right now.");
          }
        } finally {
          if (!cancelled) setIsSearchingPhrase(false);
        }
      };

      runSearch();
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeSearchPhrase, allVideos, publicSupabase, queueMatchPlayback]);

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

  const clearCompositionWorkspace = useCallback(() => {
    clipPlaybackTimeoutsRef.current.forEach(clearTimeout);
    clipPlaybackTimeoutsRef.current = [];
    setMode("write");
    setSelection({ start: 0, end: 0 });
    setRelayedHighlightedPhrase("");
    setMatches([]);
    setSelectedMatch(null);
    setSelectedMatchPhrase("");
    setIsSearchingPhrase(false);
    setPhraseError(null);
    setPlayerTime(0);
    setPlayerIsPlaying(false);
    setRevealedMemorizeIndices(new Set());
  }, []);

  const beginComposition = useCallback(
    (text: string, composition: UserComposition | null = null) => {
      clearCompositionWorkspace();
      setDraft(text);
      setCompositionTitle(composition?.title ?? "");
      setCurrentComposition(composition);
      setHasChosenComposition(true);
      setSaveCompositionError(null);
      setSaveCompositionMessage(null);
    },
    [clearCompositionWorkspace],
  );

  const handleDraftChange = useCallback((nextDraft: string) => {
    setDraft(nextDraft);
    setSaveCompositionError(null);
    setSaveCompositionMessage(null);
  }, []);

  const handleTitleChange = useCallback((nextTitle: string) => {
    setCompositionTitle(nextTitle);
    setSaveCompositionError(null);
    setSaveCompositionMessage(null);
  }, []);

  const handleBlankCanvas = useCallback(() => {
    beginComposition("");
  }, [beginComposition]);

  const handleChooseTemplate = useCallback(
    (template: CompositionTemplate) => {
      beginComposition(template.text);
    },
    [beginComposition],
  );

  const handleChooseSavedComposition = useCallback(
    (composition: UserComposition) => {
      beginComposition(composition.text, composition);
    },
    [beginComposition],
  );

  const handleNewComposition = useCallback(() => {
    clearCompositionWorkspace();
    setDraft("");
    setCompositionTitle("");
    setCurrentComposition(null);
    setHasChosenComposition(false);
    setSaveCompositionError(null);
    setSaveCompositionMessage(null);
  }, [clearCompositionWorkspace]);

  const mergeSavedComposition = useCallback((composition: UserComposition) => {
    setSavedCompositions((prev) => [
      composition,
      ...prev.filter((item) => item.id !== composition.id),
    ]);
  }, []);

  const saveComposition = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;

    if (!isSignedIn || !userId) {
      setSaveCompositionError("Sign in to save compositions.");
      setSaveCompositionMessage(null);
      return;
    }

    if (!clerkSupabase) {
      setSaveCompositionError("Saving is still getting ready.");
      setSaveCompositionMessage(null);
      return;
    }

    setIsSavingComposition(true);
    setSaveCompositionError(null);
    setSaveCompositionMessage(null);

    try {
      const title = compositionTitle.trim() || makeCompositionTitle(text);
      const savedComposition = currentComposition
        ? await updateUserComposition({
            supabase: clerkSupabase,
            userId,
            compositionId: currentComposition.id,
            title,
            text: draft,
          })
        : await createUserComposition({
            supabase: clerkSupabase,
            userId,
            title,
            text: draft,
          });

      setCurrentComposition(savedComposition);
      mergeSavedComposition(savedComposition);
      setSaveCompositionMessage("Saved!");
    } catch {
      setSaveCompositionError("Could not save this composition.");
    } finally {
      setIsSavingComposition(false);
    }
  }, [
    currentComposition,
    draft,
    compositionTitle,
    clerkSupabase,
    isSignedIn,
    mergeSavedComposition,
    userId,
  ]);

  const openSelectedVideo = useCallback(async () => {
    if (!selectedMatch) return;

    try {
      const { videoContext, videoView } = await fetchVideoContext({
        supabase: publicSupabase,
        videoId: selectedMatch.videoId,
        recordId: selectedMatch.videoRecordId,
        clip: selectedMatch.anchorTime,
        userId,
      });

      if (userId && videoView) {
        dispatch(addUserVideoView(videoView));
      }
      dispatch(setCurrentVideo(videoContext));
      await persistVideoSelection({
        supabase: clerkSupabase,
        userId,
        recordId: selectedMatch.videoRecordId,
        currentSentence: videoContext.currentSentence,
      });
    } catch (error) {
      console.error("Error preloading selected clip video:", error);
    }

    navigation.navigate({
      name: "MainApp",
      params: {
        videoId: selectedMatch.videoId,
      },
      merge: false,
    });
  }, [
    clerkSupabase,
    dispatch,
    navigation,
    publicSupabase,
    selectedMatch,
    userId,
  ]);

  const handleRelayHighlightedWords = useCallback((words: SegmentWord[]) => {
    const phrase = removeSpecialPunctuation(
      words
        .map((word) => word.word)
        .join(" ")
        .replace(/\s+/g, " "),
    ).trim();
    setRelayedHighlightedPhrase(phrase);
  }, []);

  return (
    <View style={styles.page}>
      <View style={[styles.writeLayout, !isWide && styles.writeLayoutNarrow]}>
        <ClipMatcher
          matches={matches}
          selectedMatch={selectedMatch}
          selectedMatchIndex={selectedMatchIndex}
          previousMatch={previousMatch}
          nextMatch={nextMatch}
          selectedMatchPhrase={selectedMatchPhrase}
          isSearchingPhrase={isSearchingPhrase}
          phraseError={phraseError}
          playerRef={playerRef}
          playerRefreshKey={playerRefreshKey}
          playerTime={playerTime}
          playerIsPlaying={playerIsPlaying}
          channelTitleById={channelTitleById}
          onSetPlayerTime={setPlayerTime}
          onSetPlayerIsPlaying={setPlayerIsPlaying}
          onPlayMatch={playMatch}
          onReplaySelectedMatch={replaySelectedMatch}
          onToggleMatchPlayback={toggleMatchPlayback}
          onOpenSelectedVideo={openSelectedVideo}
        />
        <Composer
          mode={mode}
          draft={draft}
          title={compositionTitle}
          hasChosenComposition={hasChosenComposition}
          selectionSearchPhrase={activeSearchPhrase}
          savedCompositions={savedCompositions}
          isLoadingSavedCompositions={isLoadingSavedCompositions}
          savedCompositionError={savedCompositionError}
          isSignedIn={isSignedIn}
          memorizeWords={memorizeWords}
          memorizeMaskedIndices={memorizeMaskedIndices}
          memorizeDifficulty={memorizeDifficulty}
          isSavingComposition={isSavingComposition}
          saveCompositionError={saveCompositionError}
          saveCompositionMessage={saveCompositionMessage}
          onModeChange={setMode}
          onTitleChange={handleTitleChange}
          onDraftChange={handleDraftChange}
          onSelectionChange={setSelection}
          onBlankCanvas={handleBlankCanvas}
          onChooseTemplate={handleChooseTemplate}
          onChooseSavedComposition={handleChooseSavedComposition}
          onNewComposition={handleNewComposition}
          onSaveComposition={saveComposition}
          onMemorizeDifficultyChange={setMemorizeDifficultyAndReset}
          onRevealMemorizeWord={revealMemorizeWord}
          onRelayHighlightedWords={handleRelayHighlightedWords}
        />
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
});

export default WritingStudioPage;
