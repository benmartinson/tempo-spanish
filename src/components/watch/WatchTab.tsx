import SelectVideoPrompt from "../common/SelectVideoPrompt";
import SelectedVideoBanner from "../common/SelectedVideoBanner";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import YouTubePlayer from "../common/YouTubePlayer";
import { RootState, SegmentWord, VideoContext, Vocabulary } from "../../types";
import { useNavigation } from "@react-navigation/native";
import {
  setCurrentTab,
  setSegmentByTime,
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
import {
  randomlySelectVocabFromVocabulary,
  normalizeWord,
  randomlySelectVocab,
  alreadyKnownVocab,
  ignoreVocab,
  findTimesForVocab,
} from "../../helpers";
import { refreshVideoPlayer } from "../../store/actions/dataActions";

const WatchTab: React.FC = () => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const userKnownVocab = useSelector((state: RootState) => state.userKnownVocab);
  const navigation = useNavigation();
  const clip = currentVideo?.segments[currentVideo.currentSegment];
  const [time, setTime] = useState<number>(0);
  const [isModalVisible, setIsModalVisible] = useState(
    currentVideo && currentVideo.focusVocab.length > 0 ? false : true
  );
  const timeRemaining = Math.floor(Math.max((clip?.end ?? 0) - time, 0));
  const dispatch = useDispatch();
  const isClip = false;
  const allWords = useSelector(
    (state: RootState) => state.currentVideo?.allWords
  );
  const focusVocabTimes = useMemo(
    () => findTimesForVocab(currentVideo?.focusVocab, allWords),
    [currentVideo?.focusVocab, allWords]
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
              .filter((w) => w.start <= 15 && w.word.length > 3)
              .map((w) => normalizeWord(w.word))
              .filter(Boolean)
          )
        : new Set<string>(),
    [allWords]
  );

  const vocabularyForVideo = useMemo(
    () =>
      allVocabulary.filter(
        (v) =>
          uniqueWordsFromVideo.has(normalizeWord(v.word)) &&
          !userKnownVocab.includes(v.id)
      ),
    [allVocabulary, uniqueWordsFromVideo, userKnownVocab]
  );

  const [randomlySelectedVocab, setRandomlySelectedVocab] = useState<
    Vocabulary[]
  >([]);
  const vocabularyForVideoRef = useRef<Vocabulary[]>([]);

  useEffect(() => {
    const normalizedExcluded = new Set(
      [...userSelectedVocab, ...userIgnoredVocab].map(normalizeWord)
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
        (v) => !normalizedExcluded.has(normalizeWord(v.word))
      );

      const targetCount = 20;
      const needed = targetCount - stillValid.length;

      if (needed <= 0) return stillValid;

      // Get available vocab that's not already displayed and not excluded
      const currentWords = new Set(
        stillValid.map((v) => normalizeWord(v.word))
      );
      const availableVocab = vocabularyForVideo.filter(
        (v) =>
          !currentWords.has(normalizeWord(v.word)) &&
          !normalizedExcluded.has(normalizeWord(v.word)) &&
          !alreadyKnownVocab.includes(v.word.toLowerCase()) &&
          !ignoreVocab.some((i) => i.toLowerCase() === v.word.toLowerCase()) &&
          v.translation !== v.word
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
          (w) => normalizeWord(w) === normalizeWord(v.word)
        )
      ),
    [vocabularyForVideo, userSelectedVocab]
  );

  const vocabLoading = allWords?.length > 0 && allVocabulary.length === 0;

  const [vocabSelectionStep, setVocabSelectionStep] = useState<number>(1);
  const videoRefreshKey = useSelector(
    (state: RootState) => state.videoRefreshKey
  );
  const [selectedBubble, setSelectedBubble] = useState<string>("large");
  const [autoplay, setAutoplay] = useState<boolean>(false);

  const handleSetTime = (newTime: number) => {
    if (newTime >= 1 && (newTime < clip.start || newTime > clip.end)) {
      dispatch(setSegmentByTime(newTime));
      return;
    }
    const newTimeRemaining = Math.max(Math.ceil(clip.end - newTime), 0);
    if (newTimeRemaining < 1 && timeRemaining >= 0) {
      if (isClip) {
        dispatch(setCurrentTab("discuss"));
        navigation.navigate("Discuss" as never);
      }
    }
    setTime(newTime);
  };

  const handleConfirmVocab = () => {
    setIsModalVisible(false);
    setAutoplay(true);
    dispatch(refreshVideoPlayer());
  };

  if (!currentVideo) {
    return <SelectVideoPrompt />;
  }

  return (
    <>
      <SelectedVideoBanner />
      <View style={styles.container}>
        <View style={styles.videoContainer}>
          <YouTubePlayer
            // clip={{ ...clip, videoId: video.videoId }}
            videoId={currentVideo.videoId}
            autoplay={autoplay}
            refreshKey={videoRefreshKey}
            setTime={handleSetTime}
            // videoText={focusedWordCountdownTime ? `Selected vocab word appearing in ${focusedWordCountdownTime}` : undefined}
          />
        </View>
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
          {focusVocabTimes.length > 0 && (
            <VocabList
              vocab={focusVocabTimes}
              time={time}
              addToFocusVocab={handleAddToFocusVocab}
            />
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
  videoContainer: {
    height: 230,
    backgroundColor: "#000",
    position: "relative",
    marginTop: 0,
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
});

export default WatchTab;
