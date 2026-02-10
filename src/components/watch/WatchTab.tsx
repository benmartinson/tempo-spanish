import FeaturedVocab from "./FeaturedVocab";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Text,
} from "react-native";
import {
  RootState,
  Segment,
  SegmentWord,
  VideoContext,
  Vocabulary,
} from "../../types";
import { useNavigation } from "@react-navigation/native";
import {
  setCurrentTab,
  refreshVideoPlayer,
  setFocusVocab,
  addUserKnownVocab,
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
  findSentenceWithVocab,
  splitIntoSentences,
  findNextSegmentWithVocab,
  autoSelectVocabForVideo,
} from "../../helpers";
import TooltipModal from "../common/TooltipModal";

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
  seekToTime: (targetTime: number, targetSentenceIndex?: number) => void;
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
  seekToTime,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const userKnownVocab = useSelector(
    (state: RootState) => state.userKnownVocab,
  );
  const navigation = useNavigation();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isVocabTestVisible, setIsVocabTestVisible] = useState(false);
  const [isActionsModalVisible, setIsActionsModalVisible] = useState(false);
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const allWords = useSelector(
    (state: RootState) => state.currentVideo?.allWords,
  );

  const [userSelectedVocab, setUserSelectedVocab] = useState<string[]>([]);
  const [userIgnoredVocab, setUserIgnoredVocab] = useState<string[]>([]);
  const [showNoVocabFoundTooltip, setShowNoVocabFoundTooltip] =
    useState<boolean>(false);
  const [isAutoSelectingVocab, setIsAutoSelectingVocab] = useState(
    currentVideo?.focusVocab.length === 0,
  );

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

  useEffect(() => {
    if (
      isAutoSelectingVocab &&
      currentVideo &&
      Object.keys(allVocabulary).length > 0 &&
      currentVideo.focusVocab.length === 0
    ) {
      const selectedVocab = autoSelectVocabForVideo(
        currentVideo.allWords,
        allVocabulary,
        userKnownVocab,
      );
      console.log({ selectedVocab });
      dispatch(setFocusVocab(selectedVocab));
      setIsAutoSelectingVocab(false);
    }
  }, [isAutoSelectingVocab, currentVideo, allVocabulary, userKnownVocab]);

  const vocabularyForVideo = useMemo(
    () =>
      Object.values(allVocabulary).filter(
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

  const vocabLoading =
    allWords?.length > 0 && Object.keys(allVocabulary).length === 0;

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

  const handleSkipToVocab = (word: SegmentWord) => {
    const [nextSegment, nextFocusVocabTime] = findNextSegmentWithVocab(
      focusVocabTimes,
      word,
      currentVideo!.segments,
      currentVideo!.currentSegment,
    );
    if (nextSegment && nextFocusVocabTime) {
      const sentence = findSentenceWithVocab(
        nextSegment,
        nextFocusVocabTime.start,
      );
      if (sentence && sentence >= 0) {
        const sentencesInSegment = splitIntoSentences(nextSegment.words);
        setAutoplay(true);
        seekToTime(sentencesInSegment[sentence][0].start, sentence);
        return;
      }
    }
    setShowNoVocabFoundTooltip(true);
  };

  const featuredVocab = useMemo(() => {
    // find the latest focus vocab time that is before the current time
    let latest = null;
    for (const v of focusVocabTimes) {
      if (
        time >= v.start - 1 &&
        time <= v.end + 4 &&
        v.start > (latest?.start || 0)
      ) {
        latest = v;
      }
    }
    return latest;
  }, [focusVocabTimes, time]);

  const handleMarkKnown = async (word: SegmentWord) => {
    if (!currentVideo) return;

    // 1. Remove from Redux focus vocab
    const newFocusVocab = currentVideo.focusVocab.filter(
      (v) => normalizeWord(v.word) !== normalizeWord(word.word),
    );
    dispatch(setFocusVocab(newFocusVocab));

    // 2. Add to Redux known vocab
    const vocabItem = currentVideo.focusVocab.find(
      (v) => normalizeWord(v.word) === normalizeWord(word.word),
    );

    if (vocabItem) {
      dispatch(addUserKnownVocab([vocabItem.id]));

      // 3. Update Supabase
      if (supabase && userId && currentVideo.videoViewId) {
        // Add to user_known_vocab
        const { error: insertError } = await supabase
          .from("user_known_vocab")
          .upsert(
            { vocabulary_id: vocabItem.id, user_id: userId },
            { onConflict: "vocabulary_id,user_id" },
          );

        if (insertError)
          console.error("Error adding to known vocab:", insertError);

        // Remove from video_view_focus_vocab
        const { error: deleteError } = await supabase
          .from("video_view_focus_vocab")
          .delete()
          .match({
            video_view_id: currentVideo.videoViewId,
            vocabulary_id: vocabItem.id,
          });

        if (deleteError)
          console.error("Error removing from focus vocab:", deleteError);
      }
    }
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
          {/* {selectedBubble === "small" && (
            <TranscriptBubble words={clip?.words || []} time={time} />
          )} */}
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
          {featuredVocab && (
            <FeaturedVocab word={featuredVocab} onMarkKnown={handleMarkKnown} />
          )}

          {/* {focusVocabTimes && (
            <>
              <VocabList
                vocab={focusVocabTimes}
                time={time}
                onSkipToVocab={handleSkipToVocab}
                addToFocusVocab={handleAddToFocusVocab}
              />
            </>
          )} */}
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
