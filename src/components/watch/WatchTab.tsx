import SelectVideoPrompt from "../common/SelectVideoPrompt";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Text,
} from "react-native";
import { RootState, Segment, SegmentWord, VideoContext, Vocabulary } from "../../types";
import { useNavigation } from "@react-navigation/native";
import {
  setCurrentTab,
  refreshVideoPlayer,
} from "../../store/actions/dataActions";
import { useDispatch, useSelector } from "react-redux";
import TranscriptBubble from "./TranscriptBubble";
import FullSegmentTranscriptBubble from "./FullSegmentTranscriptBubble";
import TranslationBubble from "./TranslationBubble";
import BubbleSelector from "./BubbleSelector";
import SlideModal from "../common/Modal";
import VocabList from "./VocabList";
import VocabSelector from "./VocabSelector";
import VocabReview from "./VocabReview";
import VocabTestModal from "./VocabTestModal";
import ActionsModal from "./ActionsModal";
import {
  randomlySelectVocabFromVocabulary,
  normalizeWord,
  alreadyKnownVocab,
  ignoreVocab,
} from "../../helpers";

interface WatchTabProps {
  time: number;
  currentSentence: number;
  setCurrentSentence: React.Dispatch<React.SetStateAction<number>>;
  clip: Segment | undefined;
  sentences: SegmentWord[][];
  sentencesText: string[];
  sentenceStart: number;
  sentenceEnd: number;
  focusVocabTimes: SegmentWord[];
  setAutoplay: (autoplay: boolean) => void;
  refreshPlayer: () => void;
}

const WatchTab: React.FC<WatchTabProps> = ({
  time,
  currentSentence,
  setCurrentSentence,
  clip,
  sentences,
  sentencesText,
  sentenceStart,
  sentenceEnd,
  focusVocabTimes,
  setAutoplay,
  refreshPlayer,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const userKnownVocab = useSelector(
    (state: RootState) => state.userKnownVocab,
  );
  const navigation = useNavigation();
  const [isModalVisible, setIsModalVisible] = useState(
    currentVideo && currentVideo.focusVocab.length > 0 ? false : true,
  );
  const [isVocabTestVisible, setIsVocabTestVisible] = useState(false);
  const [isActionsModalVisible, setIsActionsModalVisible] = useState(false);
  const dispatch = useDispatch();
  const allWords = useSelector(
    (state: RootState) => state.currentVideo?.allWords,
  );

  const [userSelectedVocab, setUserSelectedVocab] = useState<string[]>([]);
  const [userIgnoredVocab, setUserIgnoredVocab] = useState<string[]>([]);

  const handleAddToFocusVocab = () => {
    setUserSelectedVocab(currentVideo?.focusVocab.map((v) => v.word) || []);
    setUserIgnoredVocab([]);
    setVocabSelectionStep(1);
    setIsModalVisible(true);
  };

  const uniqueWordsFromVideo = useMemo(
    () =>
      allWords?.length
        ? new Set(
            allWords
              .filter((w) => w.word.length > 3)
              .map((w) => normalizeWord(w.word))
              .filter(Boolean),
          )
        : new Set<string>(),
    [allWords],
  );

  const vocabularyForVideo = useMemo(
    () =>
      allVocabulary.filter(
        (v) =>
          uniqueWordsFromVideo.has(normalizeWord(v.word)) &&
          !userKnownVocab.includes(v.id),
      ),
    [allVocabulary, uniqueWordsFromVideo, userKnownVocab],
  );

  const [randomlySelectedVocab, setRandomlySelectedVocab] = useState<
    Vocabulary[]
  >([]);
  const vocabularyForVideoRef = useRef<Vocabulary[]>([]);

  useEffect(() => {
    const normalizedExcluded = new Set(
      [...userSelectedVocab, ...userIgnoredVocab].map(normalizeWord),
    );

    // Check if this is a new video (vocabularyForVideo reference changed)
    const isNewVideo = vocabularyForVideoRef.current !== vocabularyForVideo;
    vocabularyForVideoRef.current = vocabularyForVideo;

    setRandomlySelectedVocab((prev) => {
      // If new video or no items yet, do full initialization
      if (isNewVideo || prev.length === 0) {
        return randomlySelectVocabFromVocabulary(vocabularyForVideo, 20, [
          ...userSelectedVocab,
          ...userIgnoredVocab,
        ]);
      }

      // Otherwise, incremental update - filter out excluded items
      const stillValid = prev.filter(
        (v) => !normalizedExcluded.has(normalizeWord(v.word)),
      );

      const targetCount = 20;
      const needed = targetCount - stillValid.length;

      if (needed <= 0) return stillValid;

      // Get available vocab that's not already displayed and not excluded
      const currentWords = new Set(
        stillValid.map((v) => normalizeWord(v.word)),
      );
      const availableVocab = vocabularyForVideo.filter(
        (v) =>
          !currentWords.has(normalizeWord(v.word)) &&
          !normalizedExcluded.has(normalizeWord(v.word)) &&
          !alreadyKnownVocab.includes(v.word.toLowerCase()) &&
          !ignoreVocab.some((i) => i.toLowerCase() === v.word.toLowerCase()) &&
          v.translation !== v.word,
      );

      // Add only the needed amount of new items
      const newItems = availableVocab
        .sort(() => Math.random() - 0.5)
        .slice(0, needed);

      return [...stillValid, ...newItems];
    });
  }, [vocabularyForVideo, userSelectedVocab, userIgnoredVocab]);

  const selectedVocabRecords = useMemo(
    () =>
      vocabularyForVideo.filter((v) =>
        userSelectedVocab.some(
          (w) => normalizeWord(w) === normalizeWord(v.word),
        ),
      ),
    [vocabularyForVideo, userSelectedVocab],
  );

  const vocabLoading = allWords?.length > 0 && allVocabulary.length === 0;

  const [vocabSelectionStep, setVocabSelectionStep] = useState<number>(1);
  const [selectedBubble, setSelectedBubble] = useState<string>("large");

  const handleConfirmVocab = () => {
    setIsModalVisible(false);
    setAutoplay(true);
    refreshPlayer();
  };

  const handleOpenVocabTest = () => {
    setIsActionsModalVisible(false);
    setIsVocabTestVisible(true);
  };

  const handleShadow = () => {
    setIsActionsModalVisible(false);
    dispatch(setCurrentTab("shadow"));
  };

  const handleDiscuss = () => {
    setIsActionsModalVisible(false);
    dispatch(setCurrentTab("discuss"));
  };

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
          {selectedBubble === "small" && (
            <TranscriptBubble words={clip?.words || []} time={time} />
          )}
          {selectedBubble === "large" && (
            <FullSegmentTranscriptBubble
              words={clip?.words || []}
              time={time}
            />
          )}
          {selectedBubble === "translation" && (
            <TranslationBubble
              translation={clip?.full_text_translation.split(" ") || []}
              words={clip?.words || []}
              time={time}
            />
          )}
          {focusVocabTimes && (
            <>
              <VocabList
                vocab={focusVocabTimes}
                time={time}
                addToFocusVocab={handleAddToFocusVocab}
              />
              <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
                <TouchableOpacity
                  style={styles.vocabTestButton}
                  onPress={() => setIsActionsModalVisible(true)}
                >
                  <Text style={styles.vocabTestButtonText}>Actions</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </View>

      <SlideModal
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
        title="Video Vocab Selection"
      >
        {vocabSelectionStep === 1 && (
          <VocabSelector
            vocab={randomlySelectedVocab}
            vocabLoading={vocabLoading}
            userSelectedVocab={userSelectedVocab}
            setUserSelectedVocab={setUserSelectedVocab}
            userIgnoredVocab={userIgnoredVocab}
            setUserIgnoredVocab={setUserIgnoredVocab}
            onNext={() => setVocabSelectionStep(2)}
          />
        )}
        {vocabSelectionStep === 2 && (
          <VocabReview
            selectedVocabRecords={selectedVocabRecords}
            userSelectedVocab={userSelectedVocab}
            userIgnoredVocab={userIgnoredVocab}
            setUserIgnoredVocab={setUserIgnoredVocab}
            allWords={allWords || []}
            onConfirm={handleConfirmVocab}
            onGoBack={() => setVocabSelectionStep(1)}
          />
        )}
      </SlideModal>

      <VocabTestModal
        visible={isVocabTestVisible}
        onClose={() => setIsVocabTestVisible(false)}
        vocab={currentVideo.focusVocab}
      />

      <ActionsModal
        visible={isActionsModalVisible}
        onClose={() => setIsActionsModalVisible(false)}
        onStartVocabTest={handleOpenVocabTest}
        onShadow={handleShadow}
        onDiscuss={handleDiscuss}
      />
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
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    margin: 16,
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
