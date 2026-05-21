import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
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
import {
  capitalize,
  formatTimestamp,
  stripPunctuation,
} from "../../helpers/helpers";
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
  secondaryOpenOptionLabel?: string;
  onSecondaryOpenOption?: () => void;
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

const formatClipStartTime = (value: number): string => formatTimestamp(value);

const formatClipEndTime = (value: number): string =>
  formatTimestamp(Math.ceil(value));

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
    secondaryOpenOptionLabel,
    onSecondaryOpenOption,
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
  const [openOptionsVisible, setOpenOptionsVisible] = useState(false);
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
  const showLoadingClips = Boolean(
    cm.isSearchingPhrase && !hideClipNavigation && !cm.selectedMatch,
  );
  const hasSecondaryOpenOption = Boolean(
    secondaryOpenOptionLabel && onSecondaryOpenOption,
  );
  const hasTranslationResult = Boolean(
    translation || alternateMeanings.length > 0,
  );
  const shouldShowTranslationContent = Boolean(
    selectedTranslationText &&
      hasTranslationResult &&
      (cm.selectedMatch ||
        (!cm.isSearchingPhrase &&
          cm.phraseError?.startsWith("No matching clips found"))),
  );

  const chooseOpenSelectedVideo = () => {
    setOpenOptionsVisible(false);
    onOpenSelectedVideo();
  };

  const chooseSecondaryOpenOption = () => {
    if (!onSecondaryOpenOption) return;
    setOpenOptionsVisible(false);
    onSecondaryOpenOption();
  };

  const chooseWatchOnYouTube = () => {
    if (!cm.selectedMatch) return;

    setOpenOptionsVisible(false);
    const startSeconds = Math.max(0, Math.floor(cm.selectedMatch.anchorTime));
    void Linking.openURL(
      `https://www.youtube.com/watch?v=${encodeURIComponent(
        cm.selectedMatch.videoId,
      )}&t=${startSeconds}s`,
    );
  };

  useEffect(() => {
    if (lastResetKeyRef.current === resetKey) return;

    lastResetKeyRef.current = resetKey;
    translationCacheRef.current = {};
    setTranslation(null);
    setAlternateMeanings([]);
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
    if (!translationLookupText) {
      setTranslation(null);
      setAlternateMeanings([]);
      return;
    }

    const selectedSegmentText =
      selectedMatch?.segmentText ?? selectedTranslationText;
    const cacheKey = translationLookupText.toLocaleLowerCase();
    const cached = translationCacheRef.current[cacheKey];
    if (cached) {
      setTranslation(cached.translation);
      setAlternateMeanings(cached.alternateMeanings);
      return;
    }

    let cancelled = false;
    setTranslation(null);
    setAlternateMeanings([]);

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
        if (!cancelled) setTranslation(null);
      });

    return () => {
      cancelled = true;
    };
  }, [hasSelectedMatch, selectedTranslationText, translationLookupText]);

  const translationContent = shouldShowTranslationContent ? (
    <View style={styles.translationPanel}>
      <View style={styles.translationHeader}>
        <Text style={styles.vocabText}>{selectedTranslationLabel}</Text>
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
      {translation ? (
        <View style={styles.translationContainer}>
          <Text style={styles.translationLabel}>Translation</Text>
          <Text style={styles.translationText}>{capitalize(translation)}</Text>
        </View>
      ) : null}
      {alternateMeanings.length > 0 && (
        <View style={styles.altMeaningsContainer}>
          <Text style={styles.altMeaningsLabel}>Other meanings</Text>
          {alternateMeanings
            .sort((a, b) => a.length - b.length)
            .map((meaning, index) => (
              <Text key={`${meaning}-${index}`} style={styles.altMeaningText}>
                {capitalize(meaning)}
              </Text>
            ))}
        </View>
      )}
    </View>
  ) : null;

  return (
    <View style={styles.clipColumn}>
      <View style={styles.videoPane}>
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
                onPress={() => setOpenOptionsVisible(true)}
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
            {translationContent}
            {/* {!hideSegmentTranscript && (
              <Text style={styles.segmentTranscript}>{segmentTranscript}</Text>
            )} */}
          </>
        ) : (
          <View style={styles.emptyVideoState}>
            {showLoadingClips ? (
              <View style={styles.loadingClipsRow}>
                <ActivityIndicator size="small" color="#5a5680" />
                <Text style={styles.loadingClipsText}>Loading Clips</Text>
              </View>
            ) : (
              <>
                <Ionicons name="film-outline" size={24} color="#5a5680" />
                <View style={styles.emptyHelpRow}>
                  <Text style={styles.emptyText}>
                    {cm.phraseError ||
                      "Matched video clips will appear after you highlight text."}
                  </Text>
                  {showEmptyHelpButton && (
                    <TouchableOpacity
                      accessibilityLabel="Show getting started help"
                      style={styles.helpButton}
                      onPress={onShowWelcomeHelp}
                      activeOpacity={0.74}
                    >
                      <Ionicons
                        name="help-circle-outline"
                        size={18}
                        color="#697187"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
            {translationContent}
          </View>
        )}
      </View>
      <Modal
        visible={openOptionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenOptionsVisible(false)}
      >
        <TouchableOpacity
          style={styles.optionModalOverlay}
          activeOpacity={1}
          onPress={() => setOpenOptionsVisible(false)}
        >
          <View style={styles.optionModalCard}>
            <View style={styles.optionModalHeader}>
              <Text style={styles.optionModalTitle}>Options</Text>
            </View>
            <View style={styles.optionButtonGroup}>
              <TouchableOpacity
                style={styles.optionButton}
                onPress={chooseOpenSelectedVideo}
                activeOpacity={0.78}
              >
                <View style={styles.optionIconBadge}>
                  <Ionicons name="open-outline" size={18} color="#303446" />
                </View>
                <Text style={styles.optionButtonText}>
                  Focus shadow in full screen
                </Text>
                <Ionicons name="chevron-forward" size={17} color="#9aa2b3" />
              </TouchableOpacity>
              {hasSecondaryOpenOption && (
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={chooseSecondaryOpenOption}
                  activeOpacity={0.78}
                >
                  <View style={styles.optionIconBadge}>
                    <Ionicons name="create-outline" size={18} color="#303446" />
                  </View>
                  <Text style={styles.optionButtonText}>
                    {secondaryOpenOptionLabel}
                  </Text>
                  <Ionicons name="chevron-forward" size={17} color="#9aa2b3" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.optionButton}
                onPress={chooseWatchOnYouTube}
                activeOpacity={0.78}
              >
                <View style={styles.optionIconBadge}>
                  <Ionicons name="logo-youtube" size={18} color="#303446" />
                </View>
                <Text style={styles.optionButtonText}>Watch on Youtube</Text>
                <Ionicons name="chevron-forward" size={17} color="#9aa2b3" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
    justifyContent: "flex-start",
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
    marginTop: 14,
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
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "500",
    textAlign: "center",
  },
  translationContainer: {
    alignItems: "center",
    gap: 6,
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d6e0f5",
    backgroundColor: "#f0f4ff",
  },
  translationLabel: {
    color: "#888",
    fontSize: 13,
    fontWeight: "500",
  },
  translationText: {
    color: "#222",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "500",
    textAlign: "center",
  },
  altMeaningsContainer: {
    gap: 4,
    alignItems: "center",
  },
  altMeaningsLabel: {
    color: "#999",
    fontSize: 13,
    fontWeight: "500",
  },
  altMeaningText: {
    color: "#555",
    fontSize: 14,
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
  emptyHelpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingClipsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingClipsText: {
    color: "#5a5680",
    fontSize: 13,
    fontWeight: "800",
  },
  optionModalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(18,22,32,0.42)",
  },
  optionModalCard: {
    width: "92%",
    maxWidth: 520,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#f8f9fb",
    borderWidth: 1,
    borderColor: "#eef0f4",
  },
  optionModalHeader: {
    gap: 4,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  optionModalTitle: {
    color: "#242838",
    fontSize: 18,
    fontWeight: "900",
  },
  optionModalSubtitle: {
    color: "#737b8c",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  optionButtonGroup: {
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 24,
  },
  optionButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    alignSelf: "stretch",
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e4e7ed",
  },
  optionIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f3f7",
    borderWidth: 1,
    borderColor: "#e4e7ed",
  },
  optionButtonText: {
    flex: 1,
    color: "#303446",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
});

export default ClipMatcher;
