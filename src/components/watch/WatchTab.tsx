import FeaturedVocab from "./FeaturedVocab";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  TouchableOpacity,
} from "react-native";
import { RootState, SegmentWord, Sentence, Vocabulary } from "../../types";
import { setFocusVocab } from "../../store/actions/dataActions";
import { useDispatch, useSelector } from "react-redux";
import FullSegmentTranscriptBubble from "./FullSegmentTranscriptBubble";
import TranslationBubble from "./TranslationBubble";
import BubbleSelector from "./BubbleSelector";
import SlideModal from "../common/SlideModal";
import VocabSelector from "./VocabSelector";
import VocabReview from "./VocabReview";
import {
  randomlySelectVocabFromVocabulary,
  normalizeWord,
  ignoreVocab,
  autoSelectVocabForVideo,
} from "../../helpers";
import TooltipModal from "../common/TooltipModal";
import WordHints from "../common/WordHints";
import ToggleHeader from "../common/ToggleHeader";
import NavSwitcher from "../common/NavSwitcher";
import PlayerControls from "../shadow/PlayerControls";
import VoiceCommands from "../shadow/VoiceCommands";
import { useVoiceCommand } from "../useVoiceCommand";
import { setCurrentTab } from "../../store/actions/dataActions";
import { VoiceCommand } from "../../types";

interface WatchTabProps {
  time: number;
  currentSentence: Sentence;
  setCurrentSentence: React.Dispatch<React.SetStateAction<number>>;
  setAutoplay: (autoplay: boolean) => void;
  refreshPlayer: () => void;
  isActive?: boolean;
  hintWords: SegmentWord[];
  handlePlayWordSnippet: (word: SegmentWord) => void;
  isPlayingWordSnippet: boolean;
  pausePlayer: () => void;
  resumePlayer: () => void;
  playerIsPlaying: boolean;
  setPlayerSpeed: (speed: number) => void;
  handleNextSentence: () => void;
  handlePreviousSentence: () => void;
  onPlayClip: (time: number) => void;
  playSentence: () => void;
}

const WatchTab: React.FC<WatchTabProps> = ({
  time,
  currentSentence,
  setCurrentSentence,
  setAutoplay,
  refreshPlayer,
  isActive = true,
  hintWords,
  handlePlayWordSnippet,
  isPlayingWordSnippet,
  handleNextSentence,
  handlePreviousSentence,
  onPlayClip,
  playSentence,
  pausePlayer,
  resumePlayer,
  playerIsPlaying,
  setPlayerSpeed,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showNoVocabFoundTooltip, setShowNoVocabFoundTooltip] =
    useState<boolean>(false);
  const [selectedBubble, setSelectedBubble] = useState<string>("large");
  const [showTranscript, setShowTranscript] = useState<boolean>(true);

  // Close modals when tab becomes inactive
  useEffect(() => {
    if (!isActive) {
      setIsModalVisible(false);
      // setIsVocabTestVisible(false);
      setShowNoVocabFoundTooltip(false);
    }
  }, [isActive]);

  const handleReplay = () => {
    setPlayerSpeed(1);
    playSentence();
  };

  const handleReplaySlow = () => {
    setPlayerSpeed(0.8);
    playSentence();
  };

  const handlePlayPause = () => {
    if (playerIsPlaying) {
      pausePlayer();
    } else {
      resumePlayer();
    }
  };

  const dispatch = useDispatch();
  const [selectedTab, setSelectedTab] = useState<"insights" | "voice">(
    "insights",
  );
  const [activeCommand, setActiveCommand] = useState<VoiceCommand>(null);

  const {
    isListening,
    hasError: voiceCommandError,
    timedOut: voiceCommandTimedOut,
    permissionDenied: voicePermissionDenied,
    startListening,
    stopListening,
    closeConnection,
  } = useVoiceCommand({
    persistentListening: true,
    onPlay: async () => {
      setActiveCommand("play");
      resumePlayer();
    },
    onPause: async () => {
      setActiveCommand("pause");
      pausePlayer();
    },
    onRepeat: async () => {
      setActiveCommand("repeat");
      handleReplay();
    },
    onSlow: async () => {
      setActiveCommand("slow");
      handleReplaySlow();
    },
    onNext: async () => {
      setActiveCommand("next");
      handleNextSentence();
    },
    onPrevious: async () => {
      setActiveCommand("previous");
      handlePreviousSentence();
    },
    onShadowMode: async () => {
      setActiveCommand("shadow_mode");
      await closeConnection();
      dispatch(setCurrentTab("shadow"));
    },
    onReviewMode: async () => {
      setActiveCommand("review_mode");
      await closeConnection();
      dispatch(setCurrentTab("discuss"));
    },
  });

  // Start listening when tab is active
  useEffect(() => {
    if (isActive && selectedTab === "voice") {
      startListening();
    }
  }, [isActive, selectedTab]);

  // Stop listening when tab becomes inactive
  useEffect(() => {
    if (!isActive) {
      stopListening();
    }
  }, [isActive]);

  const currentSentenceIndex = currentVideo ? currentVideo.currentSentence : 0;

  if (!currentVideo) {
    return <SelectVideoPrompt />;
  }

  return (
    <>
      <View style={styles.container}>
        <NavSwitcher
          onPrev={handlePreviousSentence}
          onNext={handleNextSentence}
          currentIndex={currentSentenceIndex}
          totalItems={currentVideo.sentences.length}
          sentences={currentVideo.sentences}
          onPlayClip={onPlayClip}
          videoId={currentVideo.videoId}
        >
          <Text style={styles.segmentNavText}>
            Segment {currentSentenceIndex + 1} of{" "}
            {currentVideo.sentences.length + 1}
          </Text>
        </NavSwitcher>
        <View style={styles.controlsContainer}>
          <PlayerControls
            onReplay={handleReplay}
            onReplaySlow={handleReplaySlow}
            onPlayPause={handlePlayPause}
            isPlaying={playerIsPlaying}
          />
          <View></View>
        </View>
        <View style={styles.tabBarContainer}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[
                styles.tab,
                selectedTab === "insights" && styles.tabActive,
              ]}
              onPress={() => setSelectedTab("insights")}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedTab === "insights" && styles.tabTextActive,
                ]}
              >
                Insights
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === "voice" && styles.tabActive]}
              onPress={() => setSelectedTab("voice")}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedTab === "voice" && styles.tabTextActive,
                ]}
              >
                Voice Commands
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.transcriptContainer}
            keyboardShouldPersistTaps="handled"
          >
            {selectedTab === "insights" ? (
              <>
                <View style={styles.toggleHeaderContainer}>
                  <ToggleHeader
                    title="Transcript"
                    isVisible={showTranscript}
                    onToggle={() => setShowTranscript(!showTranscript)}
                  />
                </View>
                {showTranscript && (
                  <View style={styles.transcriptContentContainer}>
                    {selectedBubble === "large" && (
                      <FullSegmentTranscriptBubble
                        words={currentSentence.words || []}
                        time={time}
                        playerIsPlaying={playerIsPlaying}
                      />
                    )}
                  </View>
                )}
                {hintWords.length > 0 && (
                  <WordHints
                    hintWords={hintWords}
                    handlePlayWordSnippet={handlePlayWordSnippet}
                    isPlayingWordSnippet={isPlayingWordSnippet}
                    showSwitcher={false}
                    showWordHints={false}
                    showSlowPlay={false}
                    onReplaySentence={handleReplay}
                    playerIsPlaying={playerIsPlaying}
                  />
                )}
              </>
            ) : (
              <VoiceCommands
                isListening={isListening}
                isClipPlaying={false}
                activeCommand={activeCommand}
                hasError={voiceCommandError}
                timedOut={voiceCommandTimedOut}
                permissionDenied={voicePermissionDenied}
                onActivate={startListening}
                commands={[
                  { command: "play", label: "Play", description: "Resume playback" },
                  { command: "pause", label: "Pause", description: "Pause playback" },
                  { command: "repeat", label: "Repeat", description: "Replay the clip" },
                  { command: "slow", label: "Slowdown", description: "Replay in slow mode" },
                  { command: "next", label: "Next", description: "Go to next segment" },
                  { command: "previous", label: "Previous", description: "Go to previous segment" },
                  { command: "shadow_mode", label: "Shadow Mode", description: "Switch to Shadow tab" },
                  { command: "review_mode", label: "Review Mode", description: "Switch to Review tab" },
                ]}
              />
            )}
          </ScrollView>
        </View>
      </View>

      {showNoVocabFoundTooltip && (
        <TooltipModal
          isVisible={showNoVocabFoundTooltip}
          onRequestClose={() => setShowNoVocabFoundTooltip(false)}
        >
          <Text style={styles.noVocabFoundTooltipText}>
            Vocab is in this segment or a previous segment
          </Text>
        </TooltipModal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    paddingBottom: 24,
  },
  questionContextButton: {
    flexDirection: "row",
    alignSelf: "flex-end",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#2a2a4a",
    borderRadius: 8,
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 12,
  },
  transcriptContentContainer: {
    marginBottom: 12,
  },
  toggleHeaderContainer: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    margin: 16,
  },
  noVocabFoundTooltipText: {
    color: "#fff",
    textAlign: "center",
  },
  segmentNavText: {
    opacity: 0.6,
  },
  questionContextText: {
    color: "#888",
    fontSize: 12,
  },
  transcriptContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: "#3d3a52",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#5a5680",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  countdownContainer: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  countdownText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  loader: {
    marginLeft: 8,
  },
  vocabTestButton: {
    backgroundColor: "white",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 2,
    borderColor: "#3d3a52",
  },
  vocabTestButtonText: {
    color: "#3d3a52",
    fontSize: 16,
    fontWeight: "600",
  },
  tabBarContainer: { flex: 1, marginTop: 12 },
  tabBar: {
    flexDirection: "row",
    paddingTop: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "transparent",
  },
  tabActive: {
    backgroundColor: "#fff",
    borderColor: "#e0e0e0",
    borderBottomWidth: 0,
    marginBottom: -1,
    paddingBottom: 9,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
  },
  tabTextActive: {
    color: "#333",
  },
});

export default WatchTab;
