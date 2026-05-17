import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  fetchVocabTranslation,
  type TranscriptPhraseMatch,
} from "../../requests";
import { capitalize, stripPunctuation } from "../../helpers/helpers";
import type { Sentence } from "../../types";
import YouTubePlayer from "../common/YouTubePlayer";
import PlayerControls from "../shadow/PlayerControls";
import type { ClipMatcherController } from "./useClipMatcher";

interface ClipMatcherProps {
  clipMatcher: ClipMatcherController;
  channelTitleById: Map<string, string>;
  resetKey?: string;
  hideSegmentTranscript?: boolean;
  hideClipNavigation?: boolean;
  onOpenSelectedVideo: () => void;
  onClearHighlightedWords?: () => void;
  onShowWelcomeHelp?: () => void;
}

const makeClipSentence = (match: TranscriptPhraseMatch): Sentence => ({
  index: match.segmentId,
  start: match.start,
  end: match.end,
  text: match.clipText,
  words: [],
});

const formatSelectedTranslationText = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const words = trimmed.split(/\s+/).filter(Boolean);
  const displayValue = words.length === 1 ? stripPunctuation(trimmed) : trimmed;
  return capitalize(displayValue);
};

const stripTrailingPhrasePunctuation = (value: string): string =>
  value.trim().replace(/[.,!?;:…]+$/, "");

const formatClipStartTime = (value: number): string => `${Math.floor(value)}s`;

const formatClipEndTime = (value: number): string => `${Math.ceil(value)}s`;

const isEditableKeyboardTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;

  const tagName = element.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    element.isContentEditable
  );
};

const ClipMatcher: React.FC<ClipMatcherProps> = (props) => {
  const {
    clipMatcher: cm,
    channelTitleById,
    resetKey = "",
    hideSegmentTranscript = false,
    hideClipNavigation = false,
    onOpenSelectedVideo,
    onClearHighlightedWords,
    onShowWelcomeHelp,
  } = props;

  const segmentTranscript = useMemo(() => {
    const match = cm.selectedMatch;
    if (!match) return null;

    const words = match.segmentWords.length
      ? match.segmentWords
      : match.segmentText.split(/\s+/).filter(Boolean);

    return words.map((word, index) => {
      const isHighlighted =
        match.highlightStartIndex !== null &&
        match.highlightEndIndex !== null &&
        index >= match.highlightStartIndex &&
        index <= match.highlightEndIndex;

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
  }, [cm.selectedMatch]);
  const [translation, setTranslation] = useState<string | null>(null);
  const [alternateMeanings, setAlternateMeanings] = useState<string[]>([]);
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const translationCacheRef = useRef<
    Record<
      string,
      {
        translation: string | null;
        alternateMeanings: string[];
      }
    >
  >({});
  const lastResetKeyRef = useRef(resetKey);
  const selectedMatchRef = useRef<TranscriptPhraseMatch | null>(null);
  const toggleMatchPlaybackRef = useRef(cm.toggleMatchPlayback);
  const hasSelectedMatchRef = useRef(Boolean(cm.selectedMatch));
  selectedMatchRef.current = cm.selectedMatch;
  toggleMatchPlaybackRef.current = cm.toggleMatchPlayback;
  hasSelectedMatchRef.current = Boolean(cm.selectedMatch);
  const hasSelectedMatch = Boolean(cm.selectedMatch);
  const selectedTranslationText = useMemo(
    () => stripTrailingPhrasePunctuation(cm.selectedMatchPhrase),
    [cm.selectedMatchPhrase],
  );
  const translationLookupText = useMemo(() => {
    const words = selectedTranslationText.split(/\s+/).filter(Boolean);
    return words.length === 1
      ? stripPunctuation(selectedTranslationText)
      : selectedTranslationText;
  }, [selectedTranslationText]);
  const selectedTranslationLabel = useMemo(
    () => formatSelectedTranslationText(selectedTranslationText),
    [selectedTranslationText],
  );
  const clipStartLabel = cm.selectedMatch
    ? formatClipStartTime(cm.selectedMatch.start)
    : "0s";
  const clipEndLabel = cm.selectedMatch
    ? formatClipEndTime(cm.selectedMatch.end)
    : "0s";
  const showEmptyHelpButton = Boolean(
    !cm.selectedMatch && !cm.phraseError && onShowWelcomeHelp,
  );

  useEffect(() => {
    if (lastResetKeyRef.current === resetKey) return;

    lastResetKeyRef.current = resetKey;
    translationCacheRef.current = {};
    setTranslation(null);
    setAlternateMeanings([]);
    setIsLoadingTranslation(false);
    setTranslationError(null);
  }, [resetKey]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isSpacebar = event.code === "Space" || event.key === " ";
      if (!isSpacebar || event.repeat) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (isEditableKeyboardTarget(event.target)) return;
      if (!hasSelectedMatchRef.current) return;

      event.preventDefault();
      toggleMatchPlaybackRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const selectedMatch = selectedMatchRef.current;
    if (!selectedMatch || !translationLookupText) {
      setTranslation(null);
      setAlternateMeanings([]);
      setIsLoadingTranslation(false);
      setTranslationError(null);
      return;
    }

    const selectedSegmentText = selectedMatch.segmentText;
    const cacheKey = translationLookupText.toLocaleLowerCase();
    const cached = translationCacheRef.current[cacheKey];
    if (cached) {
      setTranslation(cached.translation);
      setAlternateMeanings(cached.alternateMeanings);
      setIsLoadingTranslation(false);
      setTranslationError(null);
      return;
    }

    let cancelled = false;
    setTranslation(null);
    setAlternateMeanings([]);
    setTranslationError(null);
    setIsLoadingTranslation(true);

    fetchVocabTranslation({
      vocabWord: translationLookupText,
      sentenceText: selectedSegmentText,
    })
      .then((result) => {
        if (cancelled) return;
        setTranslation(result.translation);
        setAlternateMeanings(result.alternateMeanings);
        translationCacheRef.current = {
          ...translationCacheRef.current,
          [cacheKey]: {
            translation: result.translation,
            alternateMeanings: result.alternateMeanings,
          },
        };
      })
      .catch(() => {
        if (!cancelled) {
          setTranslationError("Translation is unavailable.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTranslation(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasSelectedMatch, translationLookupText]);

  return (
    <View style={styles.clipColumn}>
      <View style={styles.videoPane}>
        <View
          style={[
            styles.paneHeader,
            styles.videoPaneHeader,
            showEmptyHelpButton && styles.emptyPaneHeader,
          ]}
        >
          {showEmptyHelpButton && (
            <TouchableOpacity
              accessibilityLabel="Show getting started help"
              style={styles.helpButton}
              onPress={onShowWelcomeHelp}
              activeOpacity={0.74}
            >
              <Ionicons name="help-circle-outline" size={18} color="#697187" />
            </TouchableOpacity>
          )}
        </View>

        {cm.selectedMatch ? (
          <>
            <View style={styles.playerShell}>
              <YouTubePlayer
                ref={cm.playerRef}
                videoId={cm.selectedMatch.videoId}
                clip={makeClipSentence(cm.selectedMatch)}
                autoplay
                refreshKey={cm.playerRefreshKey}
                setTime={cm.setPlayerTime}
                startTime={cm.playerTime}
                // videoText={cm.selectedMatchPhrase}
                onPlayingStateChange={cm.setPlayerIsPlaying}
                onPress={cm.toggleMatchPlayback}
                webCropMode="narrow"
              />
            </View>
            <View style={styles.matchTitleRow}>
              <View style={styles.matchTitleTextGroup}>
                <Text style={styles.matchTitle} numberOfLines={1}>
                  {cm.selectedMatch.title}
                </Text>
                <Text style={styles.matchChannel} numberOfLines={1}>
                  {channelTitleById.get(cm.selectedMatch.channelId) ??
                    "Tempo clip"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.openVideoButton}
                onPress={onOpenSelectedVideo}
                activeOpacity={0.76}
              >
                <Ionicons name="open-outline" size={18} color="#26705d" />
              </TouchableOpacity>
            </View>
            <View style={styles.clipActionRow}>
              <View style={styles.clipControlsGroup}>
                <Text style={styles.clipTimeLabel}>
                  Playing clip {clipStartLabel} - {clipEndLabel}
                </Text>
                <PlayerControls
                  onReplay={() => cm.replaySelectedMatch(1)}
                  onReplaySlow={() => cm.replaySelectedMatch(0.75)}
                  onPlayPause={cm.toggleMatchPlayback}
                  isPlaying={cm.playerIsPlaying}
                  playDisabled={!cm.selectedMatch}
                  compact
                  containerStyle={styles.clipPlayerControls}
                />
              </View>
              {cm.isSearchingPhrase && hideClipNavigation ? (
                <View style={styles.findingClipsStatus}>
                  <Text style={styles.findingClipsText}>
                    Finding more clips...
                  </Text>
                  <ActivityIndicator size="small" color="#5a5680" />
                </View>
              ) : !hideClipNavigation || cm.hasOtherClips ? (
                <View style={styles.clipNavHeader}>
                  <TouchableOpacity
                    style={[
                      styles.clipNavArrow,
                      !cm.previousMatch && styles.clipNavArrowDisabled,
                    ]}
                    onPress={() =>
                      cm.previousMatch && cm.playMatch(cm.previousMatch)
                    }
                    disabled={!cm.previousMatch}
                  >
                    <Ionicons name="arrow-back" size={18} color="#3d3a52" />
                  </TouchableOpacity>
                  <Text style={styles.clipNavCount}>
                    Clip {cm.selectedMatchIndex + 1} of {cm.matches.length}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.clipNavArrow,
                      !cm.nextMatch && styles.clipNavArrowDisabled,
                    ]}
                    onPress={() => cm.nextMatch && cm.playMatch(cm.nextMatch)}
                    disabled={!cm.nextMatch}
                  >
                    <Ionicons name="arrow-forward" size={18} color="#3d3a52" />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
            {selectedTranslationText ? (
              <View style={styles.translationPanel}>
                <View style={styles.translationHeader}>
                  <Text style={styles.vocabText} numberOfLines={1}>
                    {selectedTranslationLabel}
                  </Text>
                  <TouchableOpacity
                    accessibilityLabel="Close translation"
                    style={styles.translationCloseButton}
                    onPress={onClearHighlightedWords}
                    disabled={!onClearHighlightedWords}
                    activeOpacity={0.72}
                  >
                    <Ionicons name="close" size={16} color="#5a5680" />
                  </TouchableOpacity>
                </View>
                {isLoadingTranslation ? (
                  <ActivityIndicator size="small" color="#4a69bd" />
                ) : translation ? (
                  <View style={styles.translationContainer}>
                    <Text style={styles.translationLabel}>
                      Translation in context
                    </Text>
                    <Text style={styles.translationText}>
                      {capitalize(translation)}
                    </Text>
                  </View>
                ) : translationError ? (
                  <Text style={styles.translationError}>
                    {translationError}
                  </Text>
                ) : null}
                {!isLoadingTranslation && alternateMeanings.length > 0 && (
                  <View style={styles.altMeaningsContainer}>
                    <Text style={styles.altMeaningsLabel}>Other meanings</Text>
                    {alternateMeanings
                      .sort((a, b) => a.length - b.length)
                      .map((meaning, index) => (
                        <Text
                          key={`${meaning}-${index}`}
                          style={styles.altMeaningText}
                        >
                          {capitalize(meaning)}
                        </Text>
                      ))}
                  </View>
                )}
              </View>
            ) : null}
            {!hideSegmentTranscript && (
              <Text style={styles.segmentTranscript}>{segmentTranscript}</Text>
            )}
          </>
        ) : (
          <View style={styles.emptyVideoState}>
            <Ionicons name="film-outline" size={24} color="#5a5680" />
            <Text style={styles.emptyText}>
              {cm.phraseError ||
                "Matched video clips will appear after you highlight text."}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  clipColumn: {
    flex: 1,
    gap: 16,
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
  emptyPaneHeader: {
    justifyContent: "flex-end",
  },
  helpButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7f9ff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.14)",
  },
  paneTitle: {
    color: "#2f3140",
    fontSize: 16,
    fontWeight: "900",
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
    minHeight: 50,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  clipControlsGroup: {
    minHeight: 48,
    justifyContent: "center",
    gap: 4,
  },
  clipTimeLabel: {
    color: "#697187",
    fontSize: 10,
    fontWeight: "800",
  },
  findingClipsStatus: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  findingClipsText: {
    color: "#5a5680",
    fontSize: 12,
    fontWeight: "800",
  },
  translationPanel: {
    marginTop: 10,
    gap: 10,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.16)",
    backgroundColor: "#f7f9ff",
  },
  translationHeader: {
    width: "100%",
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
  },
  translationCloseButton: {
    position: "absolute",
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.16)",
  },
  vocabText: {
    color: "#222",
    fontSize: 20,
    fontWeight: "800",
  },
  translationContainer: {
    alignItems: "center",
    gap: 6,
    width: "100%",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d6e0f5",
    backgroundColor: "#f0f4ff",
  },
  translationLabel: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
  },
  translationText: {
    color: "#222",
    fontSize: 20,
    fontWeight: "800",
  },
  altMeaningsContainer: {
    gap: 4,
    alignItems: "center",
  },
  altMeaningsLabel: {
    color: "#999",
    fontSize: 13,
    fontWeight: "600",
  },
  altMeaningText: {
    color: "#555",
    fontSize: 14,
  },
  translationError: {
    color: "#a03a3a",
    fontSize: 12,
    fontWeight: "700",
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
  emptyVideoState: {
    flex: 1,
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
});

export default ClipMatcher;
