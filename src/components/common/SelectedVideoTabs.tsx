import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  View,
  StyleSheet,
  Keyboard,
  Platform,
  LayoutAnimation,
  UIManager,
  TouchableOpacity,
  Text,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { RootState, SegmentWord } from "../../types";
import { fetchTranslationInsights } from "../../requests";
import {
  setSentenceByTime,
  setCurrentSentence as setCurrentSentenceAction,
  refreshVideoPlayer as refreshVideoPlayerAction,
} from "../../store/actions/dataActions";
import YouTubePlayer, { YouTubePlayerHandle } from "./YouTubePlayer";
import WatchTab from "../watch/WatchTab";
import ShadowTab from "../shadow/ShadowTab";
import DiscussTab from "../discuss/DiscussTab";
import {
  capitalize,
  isInterestingVocab,
  normalizeWord,
  stripPunctuation,
  vocabFormatWord,
} from "../../helpers";
import SlideModal from "./Modal";

interface SelectedVideoTabsProps {
  selectedNavTab: "watch" | "shadow" | "review";
}

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SelectedVideoTabs: React.FC<SelectedVideoTabsProps> = ({
  selectedNavTab,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const videoRefreshKey = useSelector(
    (state: RootState) => state.videoRefreshKey,
  );
  const dispatch = useDispatch();

  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setKeyboardVisible(true);
      },
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setKeyboardVisible(false);
      },
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const [time, setTime] = useState<number>(0);
  const [isConfirmingStartOver, setIsConfirmingStartOver] =
    useState<boolean>(false);
  // const currentSentence = currentVideo
  //   ? { ...currentVideo.sentences[currentVideo.currentSentence] }
  //   : null;
  const setCurrentSentence = useCallback(
    (next: React.SetStateAction<number>) => {
      dispatch(setCurrentSentenceAction(next));
    },
    [dispatch],
  );
  const currentSentenceIndex = currentVideo ? currentVideo.currentSentence : 0;
  const currentSentenceObject = currentVideo
    ? { ...currentVideo.sentences[currentSentenceIndex] }
    : null;

  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const userKnownVocab = useSelector(
    (state: RootState) => state.userKnownVocab,
  );

  // Translation insights state (shared across tabs)
  const supabase = useSupabaseWithClerk();
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const translationLanguage = userSettings.translationLanguage;
  const [isLoadingInsights, setIsLoadingInsights] = useState<boolean>(true);
  const [orderedCharacters, setOrderedCharacters] = useState<string[]>([]);
  const [sentenceTranslation, setSentenceTranslation] = useState<string | null>(null);

  const hintWords = useMemo(() => {
    const sentenceWords = currentSentenceObject?.words || [];
    const knownVocabSet = new Set(userKnownVocab);
    if (sentenceWords.length === 0) return [];
    const uniqueWords = [
      ...new Map(sentenceWords.map((sw) => [sw.word, sw])).values(),
    ];

    const result: SegmentWord[] = uniqueWords
      .map((sw) => {
        const normalized = stripPunctuation(sw.word.toLowerCase()).trim();
        const vocab = allVocabulary[normalized];
        const cleanedWord = stripPunctuation(sw.word).trim();
        return vocab ? { sw: { ...sw, word: cleanedWord }, vocab } : null;
      })
      .filter(
        (item): item is { sw: SegmentWord; vocab: any } =>
          item?.vocab?.word && isInterestingVocab(item.vocab),
      )
      .sort((a, b) => b.vocab.percentile - a.vocab.percentile)
      .map((item) => {
        return {
          ...item.sw,
          isKnown: knownVocabSet.has(item.vocab.id),
        };
      });

    return result;
  }, [currentSentenceObject, userKnownVocab, allVocabulary]);

  const orderCharactersByAppearance = (properNouns: string[], text: string) => {
    const textWords = text.split(/\s+/);
    const ordered: string[] = [];
    for (const word of textWords) {
      const cleanWord = word.replace(/[.,!?¿¡;:"""''()]/g, "");
      for (const noun of properNouns) {
        if (cleanWord.toLowerCase() === noun.toLowerCase()) {
          ordered.push(noun);
        }
      }
    }
    return ordered;
  };

  const loadTranslationInsights = useCallback(async () => {
    if (!currentSentenceObject?.text || !supabase || !currentVideo) {
      setOrderedCharacters([]);
      return;
    }

    setIsLoadingInsights(true);
    setOrderedCharacters([]);
    setSentenceTranslation(null);

    const translationColumn = `translation_${translationLanguage}`;

    try {
      // Check Supabase cache first
      const { data: cached, error: cacheError } = (await supabase
        .from("sentence_insights")
        .select(`proper_nouns, ${translationColumn}`)
        .eq("video_id", parseInt(currentVideo.recordId))
        .eq("sentence_index", currentSentenceIndex)
        .maybeSingle()) as { data: any; error: any };

      if (!cacheError && cached) {
        if (cached.proper_nouns) {
          const ordered = orderCharactersByAppearance(
            cached.proper_nouns,
            currentSentenceObject.text,
          );
          setOrderedCharacters(ordered);
        }

        if (cached[translationColumn]) {
          setSentenceTranslation(cached[translationColumn]);
        }

        if (cached.proper_nouns && cached[translationColumn]) {
          return;
        }
      }

      // Fetch from backend
      const result = await fetchTranslationInsights({
        text: currentSentenceObject.text,
        language: translationLanguage,
      });

      if (result) {
        // Save to Supabase for future lookups
        await supabase.from("sentence_insights").upsert(
          {
            video_id: parseInt(currentVideo.recordId),
            sentence_index: currentSentenceIndex,
            proper_nouns: result.properNouns,
            [translationColumn]: result.translation,
          },
          { onConflict: "video_id,sentence_index" },
        );

        if (result.properNouns.length > 0) {
          const ordered = orderCharactersByAppearance(
            result.properNouns,
            currentSentenceObject.text,
          );
          setOrderedCharacters(ordered);
        }

        setSentenceTranslation(result.translation);
      }
    } catch (err) {
      console.error("Failed to load translation insights:", err);
    } finally {
      setIsLoadingInsights(false);
    }
  }, [
    currentSentenceObject?.text,
    supabase,
    currentVideo,
    currentSentenceIndex,
    translationLanguage,
  ]);

  useEffect(() => {
    if (!userSettings.translationLanguage || !currentSentenceIndex) {
      return;
    }
    loadTranslationInsights();
  }, [currentSentenceIndex, userSettings.translationLanguage]);

  useEffect(() => {
    refreshPlayer();
  }, [selectedNavTab]);

  const [showVideo, setShowVideo] = useState<boolean>(true);
  const [clipRefreshKey, setClipRefreshKey] = useState(0);

  // Player state
  const [playerSpeed, setPlayerSpeed] = useState<number>(1);
  const [autoplay, setAutoplay] = useState<boolean>(false);
  const [playerIsPlaying, setPlayerIsPlaying] = useState<boolean>(false);
  const playingStateQueueRef = useRef<boolean[]>([]);
  const playingStateTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePlayingStateChange = useCallback((isPlaying: boolean) => {
    if (playingStateTimerRef.current) {
      // Timer is running, queue the state change
      playingStateQueueRef.current.push(isPlaying);
      return;
    }

    // No timer running, apply immediately and start the cooldown
    setPlayerIsPlaying(isPlaying);
    playingStateTimerRef.current = setTimeout(() => {
      playingStateTimerRef.current = null;
      const queue = playingStateQueueRef.current;
      if (queue.length > 0) {
        const latest = queue[queue.length - 1];
        queue.length = 0;
        // Only trigger a state change + new cooldown if value actually changed
        handlePlayingStateChange(latest);
      }
    }, 1500);
  }, []);

  // Player ref for injecting play/pause commands without reloading
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const currentWordSnippetRef = useRef<{ start: number; end: number } | null>(
    null,
  );

  // Seek detection refs
  const prevTimeRef = useRef<number>(-1);
  const isTransitioningRef = useRef<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setPlayerSpeed(1);
    if (selectedNavTab !== "review") {
      setShowVideo(true);
    }
  }, [selectedNavTab]);

  useEffect(() => {
    if (isKeyboardVisible && selectedNavTab === "review") {
      setShowVideo(false);
    }
  }, [isKeyboardVisible]);

  const handleSetTime = (newTime: number, force = false) => {
    if (isTransitioningRef.current && !force) return;

    const prevTime = prevTimeRef.current;
    prevTimeRef.current = newTime;
    // console.log(
    //   "newTime",
    //   newTime,
    //   prevTime,
    //   Math.abs(newTime - prevTime),
    //   currentSentenceObject?.start,
    //   currentSentenceObject?.end,
    // );
    if (
      force ||
      (prevTime !== -1 &&
        prevTime !== 0 &&
        Math.abs(newTime - prevTime) > 2 &&
        currentSentenceObject !== undefined &&
        (newTime < currentSentenceObject.start - 0.5 ||
          newTime > currentSentenceObject.end + 0.5))
    ) {
      if (
        selectedNavTab !== "watch" &&
        newTime === 0 &&
        !isConfirmingStartOver &&
        currentSentenceObject?.index > 0
      ) {
        pausePlayer();
        setIsConfirmingStartOver(true);
        return;
      }
      setIsConfirmingStartOver(false);
      isTransitioningRef.current = true;
      console.log("transitioning to new time", newTime);
      dispatch(setSentenceByTime(newTime));
      dispatch(refreshVideoPlayerAction());
      setTime(newTime);
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 1500);
      return;
    }
    // Ignore time before sentence start
    if (newTime < currentSentenceObject?.start) {
      return;
    }
    // Pause at sentence end (enforces sentence clipping without URL reload)

    if (newTime >= currentSentenceObject?.end) {
      if (selectedNavTab === "shadow" || selectedNavTab === "review") {
        // playerRef.current?.pause();
      } else {
        setCurrentSentence((prev) => prev + 1);
        setTime(newTime);
        return;
      }
    }
    setTime(newTime);
  };

  const handleTransition = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    isTransitioningRef.current = true;
    timeoutRef.current = setTimeout(() => {
      isTransitioningRef.current = false;
      timeoutRef.current = null;
    }, 2000);
  };

  const handleNextSentence = useCallback(() => {
    if (currentSentenceObject?.index === currentVideo?.sentences.length - 1) {
      return;
    }

    handleTransition();
    setCurrentSentence((prev) => {
      const next = currentVideo?.sentences[prev + 1];
      setTime(next?.start);
      return next?.index;
    });
    refreshPlayer();
  }, [currentSentenceObject?.index, currentVideo?.sentences.length]);

  const handlePreviousSentence = useCallback(() => {
    if (currentSentenceObject?.index === 0) {
      return;
    }
    handleTransition();

    setCurrentSentence((prev) => {
      const previous = currentVideo?.sentences[prev - 1];
      setTime(previous?.start);
      return previous?.index;
    });
    refreshPlayer();
  }, [currentSentenceObject?.index, currentVideo?.sentences]);

  const playSentence = useCallback(() => {
    handleTransition();
    setAutoplay(true);
    setTime(currentSentenceObject?.start);
    refreshPlayer();
  }, [currentSentenceObject?.start]);

  const playWordSnippet = useCallback(
    (word: SegmentWord) => {
      setAutoplay(true);
      handleTransition();
      setTime(word.start);
      currentWordSnippetRef.current = { start: word.start, end: word.end };
      refreshPlayer();
      setTimeout(() => {
        currentWordSnippetRef.current = null;
      }, 1000);
    },
    [currentSentenceObject?.start],
  );

  const refreshPlayer = useCallback(() => {
    prevTimeRef.current = -1;
    setPlayerIsPlaying(true);
    // Clear any pending queue/timer so the refresh doesn't get overridden
    playingStateQueueRef.current.length = 0;
    if (playingStateTimerRef.current) {
      clearTimeout(playingStateTimerRef.current);
      playingStateTimerRef.current = null;
    }
    dispatch(refreshVideoPlayerAction());
  }, [dispatch, currentSentenceObject?.start]);

  const handlePlayClip = useCallback((start) => {
    console.log("playing clip", start);
    setAutoplay(true);
    handleTransition();
    handleSetTime(start, true);
  }, []);

  const effectiveRefreshKey = videoRefreshKey + clipRefreshKey;
  const effectiveAutoplay = true;

  const startTimeForPlayer = selectedNavTab === "watch" ? undefined : time;

  const pausePlayer = useCallback(() => {
    playerRef.current?.pause();
  }, [playerRef]);

  const playPlayer = useCallback(() => {
    playerRef.current?.play();
  }, [playerRef]);

  const currentVideoText = useMemo(() => {
    if (selectedNavTab !== "watch") return "";
    const topHintWord = hintWords?.length ? hintWords[0] : null;
    if (!topHintWord) return "";

    const match =
      time >= topHintWord.start - 1 && time <= topHintWord.start + 3;
    let vocabulary = null;
    if (match) {
      vocabulary = allVocabulary[vocabFormatWord(topHintWord.word)];
      const translation =
        topHintWord.contextTranslation || vocabulary.translation;
      return `${capitalize(topHintWord.word)} => ${capitalize(translation)}`;
    }

    return "";
  }, [hintWords, time, selectedNavTab]);

  if (!currentVideo) return null;

  const getTabStyle = (isActive: boolean) =>
    ({
      display: isActive ? "flex" : "none",
      flex: 1,
    }) as const;

  let endTime;
  if (selectedNavTab !== "watch") {
    if (currentWordSnippetRef.current) {
      endTime = currentWordSnippetRef.current.end;
    } else {
      endTime = currentSentenceObject?.end;
    }
  }
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.videoContainer,
          !showVideo && { height: 0, marginTop: 0 },
        ]}
      >
        <YouTubePlayer
          ref={playerRef}
          videoId={currentVideo.videoId}
          clip={{
            index: currentSentenceObject?.index,
            text: currentSentenceObject?.text,
            words: currentSentenceObject?.words,
            start:
              currentWordSnippetRef.current?.start ||
              currentSentenceObject?.start,
            end: endTime,
          }}
          autoplay={effectiveAutoplay}
          refreshKey={effectiveRefreshKey}
          setTime={handleSetTime}
          muted={false}
          playbackSpeed={playerSpeed}
          startTime={startTimeForPlayer}
          onPlayingStateChange={handlePlayingStateChange}
        />
      </View>
      {!showVideo && !isKeyboardVisible && (
        <TouchableOpacity
          style={styles.showVideoButton}
          onPress={() => setShowVideo(true)}
        >
          <Text style={styles.showVideoButtonText}>Show Video</Text>
        </TouchableOpacity>
      )}

      <View style={getTabStyle(selectedNavTab === "watch")}>
        <WatchTab
          time={time}
          currentSentence={currentSentenceObject}
          setCurrentSentence={setCurrentSentence}
          setAutoplay={setAutoplay}
          refreshPlayer={refreshPlayer}
          isActive={selectedNavTab === "watch"}
          hintWords={hintWords}
          handlePlayWordSnippet={playWordSnippet}
          isPlayingWordSnippet={!!currentWordSnippetRef.current}
          handleNextSentence={handleNextSentence}
          handlePreviousSentence={handlePreviousSentence}
          onPlayClip={handlePlayClip}
          playSentence={playSentence}
          pausePlayer={pausePlayer}
          resumePlayer={playPlayer}
          playerIsPlaying={playerIsPlaying}
          setPlayerSpeed={setPlayerSpeed}
        />
      </View>

      <View style={getTabStyle(selectedNavTab === "shadow")}>
        <ShadowTab
          time={time}
          handleNextSentence={handleNextSentence}
          handlePreviousSentence={handlePreviousSentence}
          isKeyboardVisible={isKeyboardVisible}
          playSentence={playSentence}
          isActive={selectedNavTab === "shadow"}
          setPlayerSpeed={setPlayerSpeed}
          pausePlayer={pausePlayer}
          resumePlayer={playPlayer}
          playWordSnippet={playWordSnippet}
          isPlayingWordSnippet={!!currentWordSnippetRef.current}
          hintWords={hintWords}
          onPlayClip={handlePlayClip}
          playerIsPlaying={playerIsPlaying}
          isLoadingInsights={isLoadingInsights}
          orderedCharacters={orderedCharacters}
        />
      </View>

      {selectedNavTab === "review" && (
        <View style={getTabStyle(selectedNavTab === "review")}>
          <DiscussTab
            onPlayClip={handlePlayClip}
            isKeyboardVisible={isKeyboardVisible}
            setShowVideo={setShowVideo}
          />
        </View>
      )}

      {isConfirmingStartOver && (
        <SlideModal
          visible={isConfirmingStartOver}
          onRequestClose={() => setIsConfirmingStartOver(false)}
          title="Confirm Restart"
        >
          <Text style={styles.confirmStartOverText}>
            Do you want to start over from the beginning of the video?
          </Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.yesButton}
              onPress={() => {
                setIsConfirmingStartOver(false);
                playPlayer();
              }}
            >
              <Text style={styles.yesButtonText}>Yes, Start Over</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.noButton}
              onPress={() => setIsConfirmingStartOver(false)}
            >
              <Text style={styles.noButtonText}>No, Stay Here</Text>
            </TouchableOpacity>
          </View>
        </SlideModal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  yesButton: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4a69bd",
  },
  noButton: {
    backgroundColor: "#4a69bd",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  yesButtonText: {
    color: "#4a69bd",
    fontSize: 14,
    fontWeight: "600",
  },
  noButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  confirmStartOverText: {
    fontSize: 16,
    fontWeight: "600",
    color: "black",
    textAlign: "center",
    margin: 12,
  },
  videoContainer: {
    height: 230,
    backgroundColor: "#000",
    position: "relative",
    marginTop: 0,
    overflow: "hidden",
  },
  showVideoButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  showVideoButtonText: {
    color: "black",
    fontSize: 14,
    opacity: 0.5,
  },
});

export default SelectedVideoTabs;
