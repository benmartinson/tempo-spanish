import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type TranscriptPhraseMatch,
  UserComposition,
  WritingSuggestion,
  createUserComposition,
  fetchUserCompositions,
  fetchWritingSuggestions,
  updateUserComposition,
} from "../../requests";
import {
  computeBaseMaskedIndices,
  removeSpecialPunctuation,
} from "../../helpers/helpers";
import type {
  Channel,
  LanguageCode,
  Segment,
  SegmentWord,
  Video,
} from "../../types";
import type { CompositionTemplate } from "./ChooseComposition";
import type { VideoTranscriptSearchResult } from "./VideoTranscriptImport";
import {
  getActiveSentence,
  getSelectedPhrase,
  makeCompositionTitle,
  makeTranscriptRangeText,
} from "./helpers";
import type { StudioMode } from "./Composer";

const makeFallbackSegmentWords = (segment: Segment): SegmentWord[] => {
  const tokens = segment.text.trim().split(/\s+/).filter(Boolean);
  const duration = Math.max(0.2, segment.end - segment.start);
  const wordDuration = duration / Math.max(tokens.length, 1);

  return tokens.map((word, index) => ({
    word,
    start: segment.start + wordDuration * index,
    end: segment.start + wordDuration * (index + 1),
    frequency: index,
  }));
};

const markFirstWordInParagraph = (
  words: SegmentWord[],
  paragraphBreakBefore: boolean,
): SegmentWord[] =>
  words.map((word, index) =>
    index === 0 && paragraphBreakBefore
      ? {
          ...word,
          paragraphBreakBefore: true,
        }
      : word,
  );

const makeSegmentDisplayWords = (segment: Segment): SegmentWord[] =>
  segment.words?.length ? segment.words : makeFallbackSegmentWords(segment);

const makeParagraphSegmentWords = (
  segment: Segment,
  paragraphBreakBefore: boolean,
): SegmentWord[] =>
  markFirstWordInParagraph(
    makeSegmentDisplayWords(segment),
    paragraphBreakBefore,
  );

const makeDraftMemorizeWords = (text: string): SegmentWord[] => {
  const matches = Array.from(text.matchAll(/\S+/g));
  return matches.map((match, index) => {
    const word = match[0];
    const prefix = text.slice(0, match.index ?? 0);
    const previousMatch = index > 0 ? matches[index - 1] : null;
    const previousEnd = previousMatch
      ? (previousMatch.index ?? 0) + previousMatch[0].length
      : 0;
    const separator = text.slice(previousEnd, match.index ?? 0);

    return {
      word,
      start: index * 0.35,
      end: index * 0.35 + 0.3,
      frequency: index,
      paragraphBreakBefore: index > 0 && /\n\s*\n|\n/.test(separator || prefix),
    };
  });
};

const cleanCompositionText = (text: string): string =>
  text
    .split("\n")
    .map((line) => removeSpecialPunctuation(line))
    .join("\n");

const normalizeTranscriptText = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

const findTranscriptRangeForText = (
  segments: Segment[],
  text: string,
): { startIndex: number; endIndex: number } => {
  const targetText = normalizeTranscriptText(text);
  if (!targetText) {
    return { startIndex: 0, endIndex: Math.min(segments.length - 1, 2) };
  }

  for (let startIndex = 0; startIndex < segments.length; startIndex++) {
    let combinedText = "";
    for (let endIndex = startIndex; endIndex < segments.length; endIndex++) {
      combinedText = normalizeTranscriptText(
        `${combinedText} ${segments[endIndex].text}`,
      );
      if (combinedText === targetText) return { startIndex, endIndex };
      if (combinedText.length > targetText.length + 20) break;
    }
  }

  return { startIndex: 0, endIndex: Math.min(segments.length - 1, 2) };
};

interface TranscriptCompositionSource {
  result: VideoTranscriptSearchResult;
  segments: Segment[];
  startIndex: number;
  endIndex: number;
}

interface UseCompositionControllerParams {
  allChannels: Channel[];
  allVideos: Video[];
  clerkSupabase: any;
  isSignedIn: boolean;
  targetLanguage: LanguageCode | null;
  userId: string | null | undefined;
}

export const useCompositionController = ({
  allChannels,
  allVideos,
  clerkSupabase,
  isSignedIn,
  targetLanguage,
  userId,
}: UseCompositionControllerParams) => {
  const [mode, setMode] = useState<StudioMode>("write");
  const [draft, setDraft] = useState("");
  const [compositionTitle, setCompositionTitle] = useState("");
  const [hasChosenComposition, setHasChosenComposition] = useState(false);
  const [currentComposition, setCurrentComposition] =
    useState<UserComposition | null>(null);
  const [transcriptSource, setTranscriptSource] =
    useState<TranscriptCompositionSource | null>(null);
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
  const [showSaveSignInPrompt, setShowSaveSignInPrompt] = useState(false);
  const [saveCompositionMessage, setSaveCompositionMessage] = useState<
    string | null
  >(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [relayedHighlightedPhrase, setRelayedHighlightedPhrase] = useState("");
  const [videoModeHighlightedWords, setVideoModeHighlightedWords] = useState<
    SegmentWord[]
  >([]);
  const [suggestions, setSuggestions] = useState<WritingSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [memorizeDifficulty, setMemorizeDifficulty] = useState(0);
  const [revealedMemorizeIndices, setRevealedMemorizeIndices] = useState<
    Set<number>
  >(new Set());

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
    return makeDraftMemorizeWords(draft);
  }, [draft]);
  const isVideoMode = Boolean(transcriptSource);
  const videoModeSegments = useMemo(
    () =>
      transcriptSource
        ? transcriptSource.segments.slice(
            transcriptSource.startIndex,
            transcriptSource.endIndex + 1,
          )
        : [],
    [transcriptSource],
  );
  const videoModeWords = useMemo(
    () =>
      videoModeSegments.flatMap((segment, index) =>
        makeParagraphSegmentWords(segment, index > 0),
      ),
    [videoModeSegments],
  );
  const memorizerWords = isVideoMode ? videoModeWords : memorizeWords;
  const memorizeMaskedIndices = useMemo(() => {
    const masked = computeBaseMaskedIndices(memorizerWords, memorizeDifficulty);
    revealedMemorizeIndices.forEach((index) => masked.delete(index));
    return masked;
  }, [memorizeDifficulty, memorizerWords, revealedMemorizeIndices]);

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
    [memorizeDifficulty, memorizerWords],
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
        targetLanguage,
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

  const clearCompositionWorkspace = useCallback(() => {
    setMode("write");
    setSelection({ start: 0, end: 0 });
    setRelayedHighlightedPhrase("");
    setVideoModeHighlightedWords([]);
    setRevealedMemorizeIndices(new Set());
    setTranscriptSource(null);
  }, []);

  const beginComposition = useCallback(
    (text: string, composition: UserComposition | null = null) => {
      clearCompositionWorkspace();
      setDraft(cleanCompositionText(text));
      setCompositionTitle(composition?.title ?? "");
      setCurrentComposition(composition);
      setHasChosenComposition(true);
      setSaveCompositionError(null);
      setSaveCompositionMessage(null);
    },
    [clearCompositionWorkspace],
  );

  const handleDraftChange = useCallback((nextDraft: string) => {
    setDraft(cleanCompositionText(nextDraft));
    setRelayedHighlightedPhrase("");
    setVideoModeHighlightedWords([]);
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

  const loadTranscriptCompositionSegments = useCallback(
    async (videoRecordId: string): Promise<Segment[]> => {
      if (!clerkSupabase) return [];

      const { data, error } = await clerkSupabase
        .from("transcript_segment")
        .select("segment_id,start,end,text,video_id,words")
        .eq("video_id", videoRecordId)
        .order("segment_id");

      if (error) {
        console.error("Error loading saved transcript composition:", error);
        return [];
      }

      return ((data ?? []) as Segment[]).filter((segment) =>
        Boolean(segment.text?.trim()),
      );
    },
    [clerkSupabase],
  );

  const handleChooseSavedComposition = useCallback(
    async (composition: UserComposition) => {
      if (!composition.video_id) {
        beginComposition(composition.text, composition);
        return;
      }

      const video = allVideos.find((item) => item.id === composition.video_id);
      const channel = video
        ? allChannels.find((item) => item.channel_id === video.channel_id)
        : null;
      const segments = await loadTranscriptCompositionSegments(
        composition.video_id,
      );

      if (!video || !segments.length) {
        beginComposition(composition.text, composition);
        return;
      }

      const restoredRange = findTranscriptRangeForText(
        segments,
        composition.text,
      );
      const result: VideoTranscriptSearchResult = {
        videoId: video.video_id,
        videoRecordId: video.id,
        channelId: video.channel_id,
        title: video.title,
        channelTitle: channel?.title ?? "Tempo channel",
        thumbnailUrl: video.thumbnail_url,
        matchedSegmentId:
          segments[restoredRange.startIndex]?.segment_id ?? null,
      };

      clearCompositionWorkspace();
      setMode("memorize");
      setTranscriptSource({
        result,
        segments,
        startIndex: restoredRange.startIndex,
        endIndex: restoredRange.endIndex,
      });
      setDraft(cleanCompositionText(composition.text));
      setCompositionTitle(composition.title ?? "");
      setCurrentComposition(composition);
      setHasChosenComposition(true);
      setSaveCompositionError(null);
      setSaveCompositionMessage(null);
    },
    [
      allChannels,
      allVideos,
      beginComposition,
      clearCompositionWorkspace,
      loadTranscriptCompositionSegments,
    ],
  );

  const handleChooseVideoTranscript = useCallback(
    (result: VideoTranscriptSearchResult, segments: Segment[]) => {
      if (!segments.length) return;

      const matchedIndex = result.matchedSegmentId
        ? segments.findIndex(
            (segment) => segment.segment_id === result.matchedSegmentId,
          )
        : -1;
      const startIndex = matchedIndex >= 0 ? matchedIndex : 0;
      const endIndex = Math.min(segments.length - 1, startIndex + 2);

      clearCompositionWorkspace();
      setMode("memorize");
      setTranscriptSource({
        result,
        segments,
        startIndex,
        endIndex,
      });
      setDraft(
        cleanCompositionText(
          makeTranscriptRangeText(segments, startIndex, endIndex),
        ),
      );
      setCompositionTitle(result.title);
      setCurrentComposition(null);
      setHasChosenComposition(true);
      setSaveCompositionError(null);
      setSaveCompositionMessage(null);
    },
    [clearCompositionWorkspace],
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

  const updateTranscriptRange = useCallback(
    (startDisplayIndex: number, endDisplayIndex: number) => {
      if (!transcriptSource) return;

      const start = Math.max(
        0,
        Math.min(startDisplayIndex - 1, transcriptSource.segments.length - 1),
      );
      const end = Math.max(
        0,
        Math.min(endDisplayIndex - 1, transcriptSource.segments.length - 1),
      );
      const nextSource = {
        ...transcriptSource,
        startIndex: Math.min(start, end),
        endIndex: Math.max(start, end),
      };

      setTranscriptSource(nextSource);
      setVideoModeHighlightedWords([]);
      setRelayedHighlightedPhrase("");
      setDraft(
        cleanCompositionText(
          makeTranscriptRangeText(
            transcriptSource.segments,
            nextSource.startIndex,
            nextSource.endIndex,
          ),
        ),
      );
      setSaveCompositionError(null);
      setSaveCompositionMessage(null);
    },
    [transcriptSource],
  );

  const handleTranscriptStartChange = useCallback(
    (value: string) => {
      const nextStart = Number.parseInt(value, 10);
      if (!transcriptSource || Number.isNaN(nextStart)) return;
      const currentEnd = transcriptSource.endIndex + 1;
      updateTranscriptRange(nextStart, Math.max(nextStart, currentEnd));
    },
    [transcriptSource, updateTranscriptRange],
  );

  const handleTranscriptEndChange = useCallback(
    (value: string) => {
      const nextEnd = Number.parseInt(value, 10);
      if (!transcriptSource || Number.isNaN(nextEnd)) return;
      const currentStart = transcriptSource.startIndex + 1;
      updateTranscriptRange(Math.min(currentStart, nextEnd), nextEnd);
    },
    [transcriptSource, updateTranscriptRange],
  );

  const moveTranscriptRange = useCallback(
    (direction: -1 | 1) => {
      if (!transcriptSource) return;

      const width = transcriptSource.endIndex - transcriptSource.startIndex + 1;
      const nextStart =
        direction === 1
          ? transcriptSource.endIndex + 1
          : transcriptSource.startIndex - width;
      const nextEnd = nextStart + width - 1;

      if (nextStart < 0 || nextEnd >= transcriptSource.segments.length) return;
      updateTranscriptRange(nextStart + 1, nextEnd + 1);
    },
    [transcriptSource, updateTranscriptRange],
  );

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
      setSaveCompositionError(null);
      setSaveCompositionMessage(null);
      setShowSaveSignInPrompt(true);
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
            videoId: transcriptSource?.result.videoRecordId ?? null,
          })
        : await createUserComposition({
            supabase: clerkSupabase,
            userId,
            title,
            text: draft,
            videoId: transcriptSource?.result.videoRecordId ?? null,
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
    transcriptSource,
    userId,
  ]);
  const closeSaveSignInPrompt = useCallback(() => {
    setShowSaveSignInPrompt(false);
  }, []);

  const handleRelayHighlightedWords = useCallback((words: SegmentWord[]) => {
    const phrase = removeSpecialPunctuation(
      words
        .map((word) => word.word)
        .join(" ")
        .replace(/\s+/g, " "),
    ).trim();
    setVideoModeHighlightedWords(words);
    setRelayedHighlightedPhrase(phrase);
  }, []);

  const videoModeClipMatch = useMemo<TranscriptPhraseMatch | null>(() => {
    if (!transcriptSource || !videoModeHighlightedWords.length) return null;

    const firstHighlightedWord = videoModeHighlightedWords[0];
    const lastHighlightedWord =
      videoModeHighlightedWords[videoModeHighlightedWords.length - 1];
    const startIndex = videoModeWords.findIndex(
      (word) =>
        word.word === firstHighlightedWord.word &&
        word.start === firstHighlightedWord.start &&
        word.end === firstHighlightedWord.end,
    );
    const endIndex = videoModeWords.findIndex(
      (word) =>
        word.word === lastHighlightedWord.word &&
        word.start === lastHighlightedWord.start &&
        word.end === lastHighlightedWord.end,
    );
    const safeStartIndex = startIndex >= 0 ? startIndex : 0;
    const safeEndIndex =
      endIndex >= 0
        ? endIndex
        : Math.max(safeStartIndex, videoModeHighlightedWords.length - 1);
    const containingSegment =
      videoModeSegments.find(
        (segment) =>
          firstHighlightedWord.start >= segment.start &&
          firstHighlightedWord.start <= segment.end,
      ) ?? videoModeSegments[0];
    const segmentWords = videoModeWords.map((word) => word.word.trim());
    const clipText = videoModeHighlightedWords
      .map((word) => word.word.trim())
      .filter(Boolean)
      .join(" ");

    return {
      videoId: transcriptSource.result.videoId,
      videoRecordId: transcriptSource.result.videoRecordId,
      channelId: transcriptSource.result.channelId,
      title: transcriptSource.result.title,
      thumbnailUrl: transcriptSource.result.thumbnailUrl,
      segmentId: containingSegment?.segment_id ?? transcriptSource.startIndex,
      segmentText: videoModeSegments
        .map((segment) => segment.text.trim())
        .filter(Boolean)
        .join(" "),
      segmentWords,
      highlightStartIndex: safeStartIndex,
      highlightEndIndex: safeEndIndex,
      clipText,
      start: Math.max(0, firstHighlightedWord.start - 1),
      end: lastHighlightedWord.end + 1,
      anchorTime: firstHighlightedWord.start,
      score: 1,
    };
  }, [
    transcriptSource,
    videoModeHighlightedWords,
    videoModeSegments,
    videoModeWords,
  ]);

  const transcriptRange = useMemo(
    () =>
      transcriptSource
        ? {
            startDisplayIndex: transcriptSource.startIndex + 1,
            endDisplayIndex: transcriptSource.endIndex + 1,
            canGoPrevious: transcriptSource.startIndex > 0,
            canGoNext:
              transcriptSource.endIndex < transcriptSource.segments.length - 1,
            onStartSegmentChange: handleTranscriptStartChange,
            onEndSegmentChange: handleTranscriptEndChange,
            onPreviousRange: () => moveTranscriptRange(-1),
            onNextRange: () => moveTranscriptRange(1),
          }
        : null,
    [
      handleTranscriptEndChange,
      handleTranscriptStartChange,
      moveTranscriptRange,
      transcriptSource,
    ],
  );

  const transcriptSourceSegmentRange = useMemo(
    () =>
      transcriptSource
        ? {
            start:
              transcriptSource.segments[transcriptSource.startIndex]
                ?.segment_id ?? transcriptSource.startIndex,
            end:
              transcriptSource.segments[transcriptSource.endIndex]
                ?.segment_id ?? transcriptSource.endIndex,
          }
        : null,
    [transcriptSource],
  );

  return {
    activeSearchPhrase,
    draft,
    handleBlankCanvas,
    handleChooseSavedComposition,
    handleChooseTemplate,
    handleChooseVideoTranscript,
    handleDraftChange,
    handleNewComposition,
    handleRelayHighlightedWords,
    handleTitleChange,
    closeSaveSignInPrompt,
    hasChosenComposition,
    isLoadingSavedCompositions,
    isLoadingSuggestions,
    isSavingComposition,
    isSignedIn,
    isVideoMode,
    memorizeDifficulty,
    memorizeMaskedIndices,
    memorizeWords: memorizerWords,
    mode,
    revealMemorizeWord,
    saveComposition,
    saveCompositionError,
    saveCompositionMessage,
    savedCompositionError,
    savedCompositions,
    selection,
    setMemorizeDifficultyAndReset,
    setMode,
    setSelection,
    showSaveSignInPrompt,
    suggestionError,
    suggestions,
    title: compositionTitle,
    transcriptRange,
    transcriptSource,
    transcriptSourceSegmentRange,
    videoModeClipMatch,
    videoModeWords,
  };
};

export type CompositionController = ReturnType<typeof useCompositionController>;
