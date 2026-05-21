import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  SentenceImprovementSuggestion,
  type TranscriptPhraseMatch,
  UserComposition,
  createUserComposition,
  deleteUserComposition,
  fetchUserCompositions,
  fetchSentenceImprovementSuggestion,
  persistCurrentComposition,
  updateUserComposition,
} from "../../requests";
import { setCurrentCompositionId } from "../../store/actions/dataActions";
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
  RootState,
} from "../../types";
import type { CompositionTemplate } from "./ChooseComposition";
import type { VideoTranscriptSearchResult } from "./VideoTranscriptImport";
import {
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

const normalizeVideoMatchToken = (value: string): string =>
  removeSpecialPunctuation(value).trim().toLowerCase();

const findVideoModePhraseSpan = (
  words: SegmentWord[],
  phrase: string,
): { startIndex: number; endIndex: number } | null => {
  const phraseTokens = removeSpecialPunctuation(phrase)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!phraseTokens.length) return null;

  const normalizedWords = words.map((word) =>
    normalizeVideoMatchToken(word.word),
  );

  for (let startIndex = 0; startIndex < normalizedWords.length; startIndex++) {
    if (normalizedWords[startIndex] !== phraseTokens[0]) continue;

    let phraseIndex = 0;
    let endIndex = startIndex;
    for (
      let wordIndex = startIndex;
      wordIndex < normalizedWords.length && phraseIndex < phraseTokens.length;
      wordIndex++
    ) {
      const normalizedWord = normalizedWords[wordIndex];
      if (!normalizedWord) continue;
      if (normalizedWord !== phraseTokens[phraseIndex]) break;
      phraseIndex += 1;
      endIndex = wordIndex;
    }

    if (phraseIndex === phraseTokens.length) {
      return { startIndex, endIndex };
    }
  }

  return null;
};

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

const makeVideoDraftMemorizeWords = (
  text: string,
  referenceWords: SegmentWord[],
): SegmentWord[] =>
  makeDraftMemorizeWords(text).map((word, index) => {
    const referenceWord = referenceWords[index];
    if (!referenceWord) return word;

    return {
      ...word,
      start: referenceWord.start,
      end: referenceWord.end,
      frequency: referenceWord.frequency,
      paragraphBreakBefore:
        word.paragraphBreakBefore || referenceWord.paragraphBreakBefore,
    };
  });

const cleanCompositionText = (text: string): string =>
  text
    .split("\n")
    .map((line) => removeSpecialPunctuation(line))
    .join("\n");

interface CompletedSuggestionSentence {
  sentence: string;
  periodIndex: number;
}

const getCompletedSentenceAtPunctuation = (
  text: string,
  punctuationIndex: number,
): CompletedSuggestionSentence | null => {
  const punctuation = text[punctuationIndex];
  if (!/[.!?]/.test(punctuation ?? "")) return null;

  const sentenceStart =
    Math.max(
      text.lastIndexOf(".", punctuationIndex - 1),
      text.lastIndexOf("!", punctuationIndex - 1),
      text.lastIndexOf("?", punctuationIndex - 1),
      text.lastIndexOf("\n", punctuationIndex - 1),
    ) + 1;
  const sentence = text.slice(sentenceStart, punctuationIndex + 1).trim();
  const wordCount = sentence
    .replace(/[.!?]+$/g, "")
    .split(/\s+/)
    .filter(Boolean).length;

  if (wordCount <= 4) return null;
  return { sentence, periodIndex: punctuationIndex };
};

const getLatestCompletedSentence = (
  text: string,
): CompletedSuggestionSentence | null => {
  const punctuationIndex = Math.max(
    text.lastIndexOf("."),
    text.lastIndexOf("!"),
    text.lastIndexOf("?"),
  );
  if (punctuationIndex < 0) return null;
  return getCompletedSentenceAtPunctuation(text, punctuationIndex);
};

const getInsertedPunctuationSentence = (
  previousText: string,
  nextText: string,
): CompletedSuggestionSentence | null => {
  if (nextText.length !== previousText.length + 1) return null;

  let start = 0;
  while (
    start < previousText.length &&
    previousText[start] === nextText[start]
  ) {
    start += 1;
  }

  let previousEnd = previousText.length - 1;
  let nextEnd = nextText.length - 1;
  while (
    previousEnd >= start &&
    nextEnd > start &&
    previousText[previousEnd] === nextText[nextEnd]
  ) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  if (nextEnd !== start || !/[.!?]/.test(nextText[start] ?? "")) return null;
  return getCompletedSentenceAtPunctuation(nextText, start);
};

const makeSentenceSuggestionRequestKey = (
  targetLanguage: LanguageCode | null,
  completedSentence: CompletedSuggestionSentence | null,
): string =>
  targetLanguage && completedSentence
    ? [
        targetLanguage,
        completedSentence.periodIndex,
        completedSentence.sentence,
      ].join("|")
    : "";

const makeFirstSaveCompositionTitle = (text: string): string => {
  const words = text.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  if (!words.length) return "Untitled composition";
  return `${words.join(" ")}...`;
};

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

const resolveSavedTranscriptRange = (
  composition: UserComposition,
  segments: Segment[],
): { startIndex: number; endIndex: number } => {
  const savedStart =
    typeof composition.segment_start === "number"
      ? composition.segment_start
      : null;
  const savedEnd =
    typeof composition.segment_end === "number"
      ? composition.segment_end
      : null;

  if (
    savedStart !== null &&
    savedEnd !== null &&
    savedStart >= 0 &&
    savedEnd >= savedStart &&
    savedEnd < segments.length
  ) {
    return { startIndex: savedStart, endIndex: savedEnd };
  }

  return findTranscriptRangeForText(segments, composition.text);
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
  const [isRestoringCurrentComposition, setIsRestoringCurrentComposition] =
    useState(false);
  const [saveCompositionError, setSaveCompositionError] = useState<
    string | null
  >(null);
  const [showSaveSignInPrompt, setShowSaveSignInPrompt] = useState(false);
  const [saveCompositionMessage, setSaveCompositionMessage] = useState<
    string | null
  >(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [draftHighlightedPhrase, setDraftHighlightedPhrase] = useState("");
  const [relayedHighlightedPhrase, setRelayedHighlightedPhrase] = useState("");
  const [videoModeHighlightedWords, setVideoModeHighlightedWords] = useState<
    SegmentWord[]
  >([]);
  const [highlightedWordsResetKey, setHighlightedWordsResetKey] = useState(0);
  const [sentenceImprovementSuggestions, setSentenceImprovementSuggestions] =
    useState<SentenceImprovementSuggestion[]>([]);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [appliedSentenceSuggestionDraft, setAppliedSentenceSuggestionDraft] =
    useState<string | null>(null);
  const [sentenceSuggestionTrigger, setSentenceSuggestionTrigger] =
    useState<CompletedSuggestionSentence | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [memorizeDifficulty, setMemorizeDifficulty] = useState(0);
  const [revealedMemorizeIndices, setRevealedMemorizeIndices] = useState<
    Set<number>
  >(new Set());
  const dispatch = useDispatch();
  const currentCompositionId = useSelector(
    (state: RootState) => state.currentCompositionId,
  );
  const restoredCompositionIdRef = useRef<string | number | null>(null);
  const lastTargetLanguageRef = useRef(targetLanguage);
  const lastSuggestionRequestKeyRef = useRef("");

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

  const activeSearchPhrase =
    draftHighlightedPhrase || relayedHighlightedPhrase;
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
  const videoModeDraftWords = useMemo(
    () => makeVideoDraftMemorizeWords(draft, videoModeWords),
    [draft, videoModeWords],
  );
  const memorizerWords = isVideoMode ? videoModeDraftWords : memorizeWords;
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
  const resetRevealedMemorizeWords = useCallback(() => {
    setRevealedMemorizeIndices(new Set());
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
    if (!hasChosenComposition || !targetLanguage || !isSignedIn) {
      setIsLoadingSuggestions(false);
      setSuggestionError(null);
      return;
    }

    if (!sentenceSuggestionTrigger) return;

    const requestKey = makeSentenceSuggestionRequestKey(
      targetLanguage,
      sentenceSuggestionTrigger,
    );
    if (lastSuggestionRequestKeyRef.current === requestKey) return;

    lastSuggestionRequestKeyRef.current = requestKey;
    let cancelled = false;
    setIsLoadingSuggestions(true);
    setSuggestionError(null);

    fetchSentenceImprovementSuggestion({
      draftText: draft,
      sentence: sentenceSuggestionTrigger.sentence,
      targetLanguage,
    })
      .then((nextSuggestion) => {
        if (cancelled) return;
        setSentenceImprovementSuggestions((previousSuggestions) => [
          nextSuggestion,
          ...previousSuggestions,
        ]);
        setCurrentSuggestionIndex(0);
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestionError("Suggestion is unavailable right now.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSuggestions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    draft,
    hasChosenComposition,
    isSignedIn,
    sentenceSuggestionTrigger,
    targetLanguage,
  ]);

  const clearCompositionWorkspace = useCallback(() => {
    setMode("write");
    setSelection({ start: 0, end: 0 });
    setDraftHighlightedPhrase("");
    setRelayedHighlightedPhrase("");
    setVideoModeHighlightedWords([]);
    setRevealedMemorizeIndices(new Set());
    setTranscriptSource(null);
    setSentenceImprovementSuggestions([]);
    setCurrentSuggestionIndex(0);
    setAppliedSentenceSuggestionDraft(null);
    setSentenceSuggestionTrigger(null);
    lastSuggestionRequestKeyRef.current = "";
  }, []);

  const beginComposition = useCallback(
    (text: string, composition: UserComposition | null = null) => {
      clearCompositionWorkspace();
      const cleanedText = cleanCompositionText(text);
      const latestCompletedSentence = getLatestCompletedSentence(cleanedText);
      lastSuggestionRequestKeyRef.current = makeSentenceSuggestionRequestKey(
        targetLanguage,
        latestCompletedSentence,
      );
      setDraft(cleanedText);
      setCompositionTitle(composition?.title ?? "");
      setCurrentComposition(composition);
      setHasChosenComposition(true);
      setSaveCompositionError(null);
      setSaveCompositionMessage(null);
    },
    [clearCompositionWorkspace, targetLanguage],
  );

  useEffect(() => {
    if (currentCompositionId || !currentComposition) return;

    clearCompositionWorkspace();
    setDraft("");
    setCompositionTitle("");
    setCurrentComposition(null);
    setHasChosenComposition(false);
    restoredCompositionIdRef.current = null;
    setSaveCompositionError(null);
    setSaveCompositionMessage(null);
  }, [clearCompositionWorkspace, currentComposition, currentCompositionId]);

  useEffect(() => {
    if (lastTargetLanguageRef.current === targetLanguage) return;

    lastTargetLanguageRef.current = targetLanguage;
    clearCompositionWorkspace();
    setDraft("");
    setCompositionTitle("");
    setCurrentComposition(null);
    setHasChosenComposition(false);
    restoredCompositionIdRef.current = null;
    setIsRestoringCurrentComposition(false);
    setSaveCompositionError(null);
    setSaveCompositionMessage(null);
    setSentenceImprovementSuggestions([]);
    setCurrentSuggestionIndex(0);
    setAppliedSentenceSuggestionDraft(null);
    setSentenceSuggestionTrigger(null);
    setSuggestionError(null);
    setIsLoadingSuggestions(false);
  }, [clearCompositionWorkspace, targetLanguage]);

  const handleDraftChange = useCallback(
    (nextDraft: string) => {
      const cleanedDraft = cleanCompositionText(nextDraft);
      const completedSentence = getInsertedPunctuationSentence(
        draft,
        cleanedDraft,
      );

      setDraft(cleanedDraft);
      if (completedSentence) {
        setSentenceSuggestionTrigger(completedSentence);
      }
      setAppliedSentenceSuggestionDraft(null);
      setSaveCompositionError(null);
      setSaveCompositionMessage(null);
    },
    [draft],
  );

  const handleDraftSelectionChange = useCallback(
    (nextSelection: { start: number; end: number }) => {
      setSelection(nextSelection);

      const phrase = getSelectedPhrase(draft, nextSelection);
      if (!phrase) return;

      setDraftHighlightedPhrase(phrase);
      setRelayedHighlightedPhrase("");
      setVideoModeHighlightedWords([]);
    },
    [draft],
  );

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
      const savedText = cleanCompositionText(composition.text);

      dispatch(setCurrentCompositionId(composition.id));
      void persistCurrentComposition({
        supabase: clerkSupabase,
        userId,
        compositionId: composition.id,
      });

      if (!composition.video_id) {
        beginComposition(savedText, composition);
        return;
      }

      const video = allVideos.find(
        (item) => String(item.id) === String(composition.video_id),
      );
      const channel = video
        ? allChannels.find((item) => item.channel_id === video.channel_id)
        : null;
      const segments = await loadTranscriptCompositionSegments(
        composition.video_id,
      );

      if (!video || !segments.length) {
        beginComposition(savedText, composition);
        return;
      }

      const restoredRange = resolveSavedTranscriptRange(composition, segments);
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
      setDraft(savedText);
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
      clerkSupabase,
      dispatch,
      loadTranscriptCompositionSegments,
      userId,
    ],
  );

  const compositionToRestore = useMemo(
    () =>
      currentCompositionId
        ? savedCompositions.find(
            (item) =>
              String(item.id) === String(currentCompositionId) &&
              item.language === targetLanguage,
          )
        : null,
    [currentCompositionId, savedCompositions, targetLanguage],
  );
  const isWaitingForCompositionVideo = Boolean(
    compositionToRestore?.video_id && !allVideos.length,
  );
  const isResolvingCurrentComposition = Boolean(
    currentCompositionId &&
    !hasChosenComposition &&
    (isLoadingSavedCompositions ||
      isRestoringCurrentComposition ||
      isWaitingForCompositionVideo ||
      (compositionToRestore &&
        restoredCompositionIdRef.current !== currentCompositionId)),
  );

  useEffect(() => {
    if (
      !currentCompositionId ||
      hasChosenComposition ||
      isLoadingSavedCompositions ||
      restoredCompositionIdRef.current === currentCompositionId
    ) {
      return;
    }

    if (!compositionToRestore) return;
    if (isWaitingForCompositionVideo) return;

    restoredCompositionIdRef.current = currentCompositionId;
    setIsRestoringCurrentComposition(true);
    void handleChooseSavedComposition(compositionToRestore).finally(() => {
      setIsRestoringCurrentComposition(false);
    });
  }, [
    compositionToRestore,
    currentCompositionId,
    handleChooseSavedComposition,
    hasChosenComposition,
    isLoadingSavedCompositions,
    isWaitingForCompositionVideo,
  ]);

  const handleChooseVideoTranscriptRange = useCallback(
    (
      result: VideoTranscriptSearchResult,
      segments: Segment[],
      startIndex: number,
      endIndex: number,
    ) => {
      if (!segments.length) return;

      const normalizedStart = Math.max(
        0,
        Math.min(startIndex, segments.length - 1),
      );
      const normalizedEnd = Math.max(
        0,
        Math.min(endIndex, segments.length - 1),
      );
      const rangeStart = Math.min(normalizedStart, normalizedEnd);
      const rangeEnd = Math.max(normalizedStart, normalizedEnd);

      clearCompositionWorkspace();
      setMode("memorize");
      setTranscriptSource({
        result,
        segments,
        startIndex: rangeStart,
        endIndex: rangeEnd,
      });
      setDraft(
        cleanCompositionText(
          makeTranscriptRangeText(segments, rangeStart, rangeEnd),
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

  const handleChooseVideoTranscript = useCallback(
    (result: VideoTranscriptSearchResult, segments: Segment[]) => {
      if (!segments.length) return;

      const matchedIndex = result.matchedSegmentId
        ? segments.findIndex(
            (segment) => segment.segment_id === result.matchedSegmentId,
          )
        : -1;
      const startIndex = matchedIndex >= 0 ? matchedIndex : 0;
      const endIndex = Math.min(segments.length - 1, startIndex + 1);

      handleChooseVideoTranscriptRange(result, segments, startIndex, endIndex);
    },
    [handleChooseVideoTranscriptRange],
  );

  const handleNewComposition = useCallback(() => {
    clearCompositionWorkspace();
    setDraft("");
    setCompositionTitle("");
    setCurrentComposition(null);
    setHasChosenComposition(false);
    dispatch(setCurrentCompositionId(null));
    restoredCompositionIdRef.current = null;
    void persistCurrentComposition({
      supabase: clerkSupabase,
      userId,
      compositionId: null,
    });
    setSaveCompositionError(null);
    setSaveCompositionMessage(null);
  }, [clearCompositionWorkspace, clerkSupabase, dispatch, userId]);

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

  const handleDeleteSavedComposition = useCallback(
    async (composition: UserComposition) => {
      await deleteUserComposition({
        supabase: clerkSupabase,
        userId,
        compositionId: composition.id,
      });

      setSavedCompositions((prev) =>
        prev.filter((item) => String(item.id) !== String(composition.id)),
      );

      if (String(currentCompositionId) === String(composition.id)) {
        dispatch(setCurrentCompositionId(null));
        restoredCompositionIdRef.current = null;
        await persistCurrentComposition({
          supabase: clerkSupabase,
          userId,
          compositionId: null,
        });
      }
    },
    [clerkSupabase, currentCompositionId, dispatch, userId],
  );

  const handleCopySavedComposition = useCallback(
    async (composition: UserComposition) => {
      const copiedComposition = await createUserComposition({
        supabase: clerkSupabase,
        userId,
        title: `${composition.title || "Untitled composition"} COPY`,
        text: composition.text,
        language: composition.language ?? targetLanguage,
        videoId: composition.video_id ?? null,
        segmentStart: composition.segment_start ?? null,
        segmentEnd: composition.segment_end ?? null,
      });

      mergeSavedComposition(copiedComposition);
    },
    [clerkSupabase, mergeSavedComposition, targetLanguage, userId],
  );

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
      const trimmedTitle = compositionTitle.trim();
      const title =
        trimmedTitle ||
        (currentComposition
          ? makeCompositionTitle(text)
          : makeFirstSaveCompositionTitle(text));
      const savedComposition = currentComposition
        ? await updateUserComposition({
            supabase: clerkSupabase,
            userId,
            compositionId: currentComposition.id,
            title,
            text: draft,
            videoId: transcriptSource?.result.videoRecordId ?? null,
            segmentStart: transcriptSource?.startIndex ?? null,
            segmentEnd: transcriptSource?.endIndex ?? null,
          })
        : await createUserComposition({
            supabase: clerkSupabase,
            userId,
            title,
            text: draft,
            language: targetLanguage,
            videoId: transcriptSource?.result.videoRecordId ?? null,
            segmentStart: transcriptSource?.startIndex ?? null,
            segmentEnd: transcriptSource?.endIndex ?? null,
          });

      setCurrentComposition(savedComposition);
      if (!trimmedTitle) {
        setCompositionTitle(title);
      }
      mergeSavedComposition(savedComposition);
      dispatch(setCurrentCompositionId(savedComposition.id));
      await persistCurrentComposition({
        supabase: clerkSupabase,
        userId,
        compositionId: savedComposition.id,
      });
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
    dispatch,
    isSignedIn,
    mergeSavedComposition,
    targetLanguage,
    transcriptSource,
    userId,
  ]);
  const closeSaveSignInPrompt = useCallback(() => {
    setShowSaveSignInPrompt(false);
  }, []);

  const handleRelayHighlightedWords = useCallback(
    (words: SegmentWord[]) => {
      const phrase = removeSpecialPunctuation(
        words
          .map((word) => word.word)
          .join(" ")
          .replace(/\s+/g, " "),
      ).trim();
      setDraftHighlightedPhrase("");
      setVideoModeHighlightedWords(isVideoMode ? [] : words);
      setRelayedHighlightedPhrase(phrase);
    },
    [isVideoMode],
  );
  const clearHighlightedWords = useCallback(() => {
    setSelection({ start: 0, end: 0 });
    setDraftHighlightedPhrase("");
    setRelayedHighlightedPhrase("");
    setVideoModeHighlightedWords([]);
    setHighlightedWordsResetKey((key) => key + 1);
  }, []);

  const videoModeClipMatch = useMemo<TranscriptPhraseMatch | null>(() => {
    if (!transcriptSource) return null;
    const selectedVideoPhrase = activeSearchPhrase.trim();

    if (!videoModeHighlightedWords.length) {
      const startSegment =
        transcriptSource.segments[transcriptSource.startIndex];
      const endSegment = transcriptSource.segments[transcriptSource.endIndex];
      if (!startSegment || !endSegment) return null;

      const segmentText = videoModeSegments
        .map((segment) => segment.text.trim())
        .filter(Boolean)
        .join(" ");

      if (selectedVideoPhrase) {
        const phraseSpan = findVideoModePhraseSpan(
          videoModeWords,
          selectedVideoPhrase,
        );
        if (!phraseSpan) return null;

        const firstMatchedWord = videoModeWords[phraseSpan.startIndex];
        const lastMatchedWord = videoModeWords[phraseSpan.endIndex];
        const containingSegment =
          videoModeSegments.find(
            (segment) =>
              firstMatchedWord.start >= segment.start &&
              firstMatchedWord.start <= segment.end,
          ) ?? videoModeSegments[0];
        const clipText = videoModeWords
          .slice(phraseSpan.startIndex, phraseSpan.endIndex + 1)
          .map((word) => word.word.trim())
          .filter(Boolean)
          .join(" ");

        return {
          videoId: transcriptSource.result.videoId,
          videoRecordId: transcriptSource.result.videoRecordId,
          channelId: transcriptSource.result.channelId,
          title: transcriptSource.result.title,
          thumbnailUrl: transcriptSource.result.thumbnailUrl,
          segmentId:
            containingSegment?.segment_id ?? transcriptSource.startIndex,
          segmentText,
          segmentWords: videoModeWords.map((word) => word.word.trim()),
          highlightStartIndex: phraseSpan.startIndex,
          highlightEndIndex: phraseSpan.endIndex,
          clipText,
          start: Math.max(0, firstMatchedWord.start - 1),
          end: lastMatchedWord.end + 1,
          anchorTime: firstMatchedWord.start,
          score: 1,
        };
      }

      return {
        videoId: transcriptSource.result.videoId,
        videoRecordId: transcriptSource.result.videoRecordId,
        channelId: transcriptSource.result.channelId,
        title: transcriptSource.result.title,
        thumbnailUrl: transcriptSource.result.thumbnailUrl,
        segmentId: startSegment.segment_id ?? transcriptSource.startIndex,
        segmentText,
        segmentWords: videoModeWords.map((word) => word.word.trim()),
        highlightStartIndex: null,
        highlightEndIndex: null,
        clipText: segmentText,
        start: startSegment.start,
        end: endSegment.end,
        anchorTime: startSegment.start,
        score: 1,
      };
    }

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
    if (startIndex < 0 || endIndex < 0) return null;
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
      highlightStartIndex: startIndex,
      highlightEndIndex: endIndex,
      clipText,
      start: Math.max(0, firstHighlightedWord.start - 1),
      end: lastHighlightedWord.end + 1,
      anchorTime: firstHighlightedWord.start,
      score: 1,
    };
  }, [
    activeSearchPhrase,
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
  const currentSentenceImprovementSuggestion =
    sentenceImprovementSuggestions[currentSuggestionIndex] ?? null;
  const showPreviousSentenceSuggestion = useCallback(() => {
    setCurrentSuggestionIndex((index) =>
      Math.min(sentenceImprovementSuggestions.length - 1, index + 1),
    );
  }, [sentenceImprovementSuggestions.length]);
  const showNextSentenceSuggestion = useCallback(() => {
    setCurrentSuggestionIndex((index) => Math.max(0, index - 1));
  }, []);
  const applySentenceImprovementSuggestion = useCallback(() => {
    if (!currentSentenceImprovementSuggestion?.improvedSentence.trim()) return;

    const sentenceIndex = draft.lastIndexOf(
      currentSentenceImprovementSuggestion.sentence,
    );
    if (sentenceIndex < 0) {
      setSuggestionError("Could not find that sentence in the draft.");
      return;
    }

    const nextDraft = cleanCompositionText(
      `${draft.slice(0, sentenceIndex)}${currentSentenceImprovementSuggestion.improvedSentence}${draft.slice(
        sentenceIndex + currentSentenceImprovementSuggestion.sentence.length,
      )}`,
    );
    setAppliedSentenceSuggestionDraft(draft);
    setDraft(nextDraft);
    lastSuggestionRequestKeyRef.current = makeSentenceSuggestionRequestKey(
      targetLanguage,
      getLatestCompletedSentence(nextDraft),
    );
    setSuggestionError(null);
    setSaveCompositionError(null);
    setSaveCompositionMessage(null);
  }, [currentSentenceImprovementSuggestion, draft, targetLanguage]);
  const undoSentenceImprovementSuggestion = useCallback(() => {
    if (appliedSentenceSuggestionDraft === null) return;

    setDraft(appliedSentenceSuggestionDraft);
    lastSuggestionRequestKeyRef.current = makeSentenceSuggestionRequestKey(
      targetLanguage,
      getLatestCompletedSentence(appliedSentenceSuggestionDraft),
    );
    setAppliedSentenceSuggestionDraft(null);
    setSuggestionError(null);
    setSaveCompositionError(null);
    setSaveCompositionMessage(null);
  }, [appliedSentenceSuggestionDraft, targetLanguage]);

  return {
    activeSearchPhrase,
    applySentenceImprovementSuggestion,
    draft,
    handleBlankCanvas,
    handleChooseSavedComposition,
    handleChooseTemplate,
    handleChooseVideoTranscript,
    handleChooseVideoTranscriptRange,
    handleCopySavedComposition,
    handleDeleteSavedComposition,
    handleDraftChange,
    handleDraftSelectionChange,
    handleNewComposition,
    handleRelayHighlightedWords,
    handleTitleChange,
    clearHighlightedWords,
    closeSaveSignInPrompt,
    hasChosenComposition,
    highlightedWordsResetKey,
    isLoadingSavedCompositions,
    isResolvingCurrentComposition,
    isLoadingSuggestions,
    isSavingComposition,
    isSignedIn,
    isVideoMode,
    memorizeDifficulty,
    memorizeMaskedIndices,
    memorizeWords: memorizerWords,
    mode,
    revealMemorizeWord,
    resetRevealedMemorizeWords,
    saveComposition,
    saveCompositionError,
    saveCompositionMessage,
    savedCompositionError,
    savedCompositions,
    selection,
    sentenceImprovementSuggestion: currentSentenceImprovementSuggestion,
    sentenceImprovementSuggestionApplied:
      appliedSentenceSuggestionDraft !== null,
    sentenceImprovementSuggestionCount: sentenceImprovementSuggestions.length,
    sentenceImprovementSuggestionIndex: currentSuggestionIndex,
    setMemorizeDifficultyAndReset,
    setMode,
    showNextSentenceSuggestion,
    showSaveSignInPrompt,
    showPreviousSentenceSuggestion,
    suggestionError,
    title: compositionTitle,
    transcriptRange,
    transcriptSource,
    transcriptSourceSegmentRange,
    undoSentenceImprovementSuggestion,
    videoModeClipMatch,
    videoModeWords,
  };
};

export type CompositionController = ReturnType<typeof useCompositionController>;
