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
import SlideModal from "../common/Modal";
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
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showNoVocabFoundTooltip, setShowNoVocabFoundTooltip] =
    useState<boolean>(false);
  const [selectedBubble, setSelectedBubble] = useState<string>("large");

  // Close modals when tab becomes inactive
  useEffect(() => {
    if (!isActive) {
      setIsModalVisible(false);
      // setIsVocabTestVisible(false);
      setShowNoVocabFoundTooltip(false);
    }
  }, [isActive]);

  if (!currentVideo) {
    return <SelectVideoPrompt />;
  }

  return (
    <>
      <View style={styles.container}>
        <ScrollView style={styles.transcriptContainer}>
          <BubbleSelector
            selectedBubble={selectedBubble}
            setSelectedBubble={setSelectedBubble}
          />
          <View style={styles.transcriptContentContainer}>
            {selectedBubble === "large" && (
              <FullSegmentTranscriptBubble
                words={currentSentence.words || []}
                time={time}
              />
            )}
            {selectedBubble === "translation" && (
              <TranslationBubble
                translation={currentSentence.full_translation.split(" ") || []}
                words={currentSentence.words || []}
                time={time}
              />
            )}
          </View>
          {hintWords.length > 0 && (
            <WordHints
              hintWords={hintWords}
              handlePlayWordSnippet={handlePlayWordSnippet}
              isPlayingWordSnippet={isPlayingWordSnippet}
              showSwitcher={false}
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
  transcriptContentContainer: {
    marginBottom: 32,
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
