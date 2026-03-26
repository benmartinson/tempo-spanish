import FeaturedVocab from "./FeaturedVocab";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View, ScrollView, Text } from "react-native";
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
        <ScrollView style={styles.transcriptContainer}>
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
        </ScrollView>
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
    paddingHorizontal: 20,
    marginTop: 16,
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
});

export default WatchTab;
