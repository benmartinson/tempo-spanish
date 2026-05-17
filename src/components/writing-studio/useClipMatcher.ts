import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  searchTranscriptPhrase,
  type TranscriptPhraseMatch,
} from "../../requests";
import type { Video } from "../../types";
import type { YouTubePlayerHandle } from "../common/YouTubePlayer";
import { splitDraftIntoSentences } from "./helpers";

interface TranscriptSourceSegmentRange {
  start: number;
  end: number;
}

interface UseClipMatcherParams {
  activeSearchPhrase: string;
  publicSupabase: any;
  targetLanguageVideos: Video[];
  transcriptSourceVideo: Video | null;
  transcriptSourceSegmentRange: TranscriptSourceSegmentRange | null;
  localClipMatch?: TranscriptPhraseMatch | null;
  resetKey?: string;
}

export const useClipMatcher = ({
  activeSearchPhrase,
  publicSupabase,
  targetLanguageVideos,
  transcriptSourceVideo,
  transcriptSourceSegmentRange,
  localClipMatch,
  resetKey = "",
}: UseClipMatcherParams) => {
  const [matches, setMatches] = useState<TranscriptPhraseMatch[]>([]);
  const [selectedMatch, setSelectedMatch] =
    useState<TranscriptPhraseMatch | null>(null);
  const [selectedMatchPhrase, setSelectedMatchPhrase] = useState("");
  const [isSearchingPhrase, setIsSearchingPhrase] = useState(false);
  const [phraseError, setPhraseError] = useState<string | null>(null);
  const [playerTime, setPlayerTime] = useState(0);
  const [playerIsPlaying, setPlayerIsPlaying] = useState(false);
  const [playerRefreshKey, setPlayerRefreshKey] = useState(1);
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const clipPlaybackTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const segmentIdStart = transcriptSourceVideo
    ? transcriptSourceSegmentRange?.start
    : undefined;
  const segmentIdEnd = transcriptSourceVideo
    ? transcriptSourceSegmentRange?.end
    : undefined;
  const transcriptSourceVideoId = transcriptSourceVideo?.id ?? null;
  const targetLanguageVideoIdsKey = useMemo(
    () => targetLanguageVideos.map((video) => video.id).join("|"),
    [targetLanguageVideos],
  );
  const localClipMatchKey = localClipMatch
    ? [
        localClipMatch.videoRecordId,
        localClipMatch.segmentId,
        localClipMatch.start,
        localClipMatch.end,
        localClipMatch.clipText,
      ].join("|")
    : "";
  const lastLocalClipMatchKeyRef = useRef("");
  const lastLocalSearchKeyRef = useRef("");
  const lastResetKeyRef = useRef(resetKey);
  const hasOtherClips = localClipMatch
    ? matches.some(
        (match) =>
          match.videoRecordId !== localClipMatch.videoRecordId ||
          match.segmentId !== localClipMatch.segmentId,
      )
    : matches.length > 1;

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

  const clearPlaybackTimeouts = useCallback(() => {
    clipPlaybackTimeoutsRef.current.forEach(clearTimeout);
    clipPlaybackTimeoutsRef.current = [];
  }, []);

  const queueMatchPlayback = useCallback(
    (match: TranscriptPhraseMatch, delays = [650]) => {
      clearPlaybackTimeouts();
      clipPlaybackTimeoutsRef.current = delays.map((delay) =>
        setTimeout(() => {
          playerRef.current?.setClip(match.start, match.end);
          playerRef.current?.setSpeed(1);
          playerRef.current?.seekAndPlay(match.start);
        }, delay),
      );
    },
    [clearPlaybackTimeouts],
  );

  const clearClipMatches = useCallback(() => {
    clearPlaybackTimeouts();
    setMatches([]);
    setSelectedMatch(null);
    setSelectedMatchPhrase("");
    setIsSearchingPhrase(false);
    setPhraseError(null);
    setPlayerTime(0);
    setPlayerIsPlaying(false);
  }, [clearPlaybackTimeouts]);

  useEffect(() => clearPlaybackTimeouts, [clearPlaybackTimeouts]);

  useEffect(() => {
    if (lastResetKeyRef.current === resetKey) return;

    lastResetKeyRef.current = resetKey;
    lastLocalClipMatchKeyRef.current = "";
    lastLocalSearchKeyRef.current = "";
    clearClipMatches();
  }, [clearClipMatches, resetKey]);

  useEffect(() => {
    if (localClipMatch) {
      let cancelled = false;
      const requestedPhrase = activeSearchPhrase.trim();

      setPhraseError(null);
      setMatches([localClipMatch]);
      setSelectedMatch(localClipMatch);
      setSelectedMatchPhrase(activeSearchPhrase);
      setPlayerTime(localClipMatch.start);

      if (lastLocalClipMatchKeyRef.current !== localClipMatchKey) {
        lastLocalClipMatchKeyRef.current = localClipMatchKey;
        setPlayerRefreshKey((key) => key + 1);
        queueMatchPlayback(localClipMatch);
      }

      if (!requestedPhrase || requestedPhrase.length < 3) {
        setIsSearchingPhrase(false);
        return () => {
          cancelled = true;
        };
      }

      const selectedSentences = splitDraftIntoSentences(requestedPhrase);
      if (selectedSentences.length > 1 || requestedPhrase.length > 180) {
        setIsSearchingPhrase(false);
        setPhraseError("Select no more than one sentence.");
        return () => {
          cancelled = true;
        };
      }

      const localSearchKey = [
        localClipMatchKey,
        requestedPhrase,
        targetLanguageVideoIdsKey,
      ].join("|");
      if (lastLocalSearchKeyRef.current === localSearchKey) {
        setIsSearchingPhrase(false);
        return () => {
          cancelled = true;
        };
      }

      lastLocalSearchKeyRef.current = localSearchKey;
      setIsSearchingPhrase(true);
      searchTranscriptPhrase({
        supabase: publicSupabase,
        phrase: requestedPhrase,
        videos: targetLanguageVideos,
      })
        .then((fullMatches) => {
          if (cancelled) return;
          const otherMatches = fullMatches.filter(
            (match) =>
              match.videoRecordId !== localClipMatch.videoRecordId ||
              match.segmentId !== localClipMatch.segmentId,
          );
          setMatches([localClipMatch, ...otherMatches]);
        })
        .catch(() => {
          if (!cancelled) {
            setPhraseError("Transcript search is unavailable right now.");
          }
        })
        .finally(() => {
          if (!cancelled) setIsSearchingPhrase(false);
        });

      return () => {
        cancelled = true;
      };
    }

    if (!activeSearchPhrase) {
      lastLocalClipMatchKeyRef.current = "";
      lastLocalSearchKeyRef.current = "";
      clearPlaybackTimeouts();
      setMatches([]);
      setSelectedMatch(null);
      setSelectedMatchPhrase("");
      setPhraseError(null);
      setIsSearchingPhrase(false);
      setPlayerTime(0);
      setPlayerIsPlaying(false);
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
        const quickSearchVideos = transcriptSourceVideo
          ? [transcriptSourceVideo]
          : targetLanguageVideos;

        try {
          const quickMatches = await searchTranscriptPhrase({
            supabase: publicSupabase,
            phrase: requestedPhrase,
            videos: quickSearchVideos,
            limit: 1,
            segmentIdStart,
            segmentIdEnd,
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
            setIsSearchingPhrase(false);
          }
          return;
        }

        try {
          const fullMatches = await searchTranscriptPhrase({
            supabase: publicSupabase,
            phrase: requestedPhrase,
            videos: targetLanguageVideos,
          });
          if (cancelled) return;

          const mergedMatches = quickMatch
            ? [
                quickMatch,
                ...fullMatches.filter(
                  (match) =>
                    match.videoRecordId !== quickMatch?.videoRecordId ||
                    match.segmentId !== quickMatch.segmentId,
                ),
              ]
            : fullMatches;

          setMatches(mergedMatches);
          const bestMatch = mergedMatches[0];
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
      clearPlaybackTimeouts();
      clearTimeout(timer);
    };
  }, [
    activeSearchPhrase,
    clearPlaybackTimeouts,
    localClipMatch,
    localClipMatchKey,
    publicSupabase,
    queueMatchPlayback,
    resetKey,
    segmentIdEnd,
    segmentIdStart,
    targetLanguageVideos,
    targetLanguageVideoIdsKey,
    transcriptSourceVideo,
    transcriptSourceVideoId,
  ]);

  const playMatch = useCallback(
    (match: TranscriptPhraseMatch) => {
      setSelectedMatch(match);
      setPlayerTime(match.start);
      setPlayerRefreshKey((key) => key + 1);
      queueMatchPlayback(match, [350]);
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

  return useMemo(
    () => ({
      clearClipMatches,
      hasOtherClips,
      isSearchingPhrase,
      matches,
      nextMatch,
      phraseError,
      playMatch,
      playerIsPlaying,
      playerRef,
      playerRefreshKey,
      playerTime,
      previousMatch,
      replaySelectedMatch,
      selectedMatch,
      selectedMatchIndex,
      selectedMatchPhrase,
      setPlayerIsPlaying,
      setPlayerTime,
      toggleMatchPlayback,
    }),
    [
      clearClipMatches,
      hasOtherClips,
      isSearchingPhrase,
      matches,
      nextMatch,
      phraseError,
      playMatch,
      playerIsPlaying,
      playerRefreshKey,
      playerTime,
      previousMatch,
      replaySelectedMatch,
      selectedMatch,
      selectedMatchIndex,
      selectedMatchPhrase,
      toggleMatchPlayback,
    ],
  );
};

export type ClipMatcherController = ReturnType<typeof useClipMatcher>;
