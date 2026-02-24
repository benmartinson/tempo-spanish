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
import { RootState, SegmentWord } from "../../types";
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
  const currentSentence = currentVideo
    ? currentVideo.sentences[currentVideo.currentSentence]
    : null;
  const setCurrentSentence = useCallback(
    (next: React.SetStateAction<number>) => {
      dispatch(setCurrentSentenceAction(next));
    },
    [dispatch],
  );
  const currentSentenceIndex = currentVideo ? currentVideo.currentSentence : 0;
  const currentSentenceObject = currentVideo
    ? currentVideo.sentences[currentSentenceIndex]
    : null;

  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const userKnownVocab = useSelector(
    (state: RootState) => state.userKnownVocab,
  );
  const unknownWords = useMemo(() => {
    const sentenceWords = currentSentenceObject?.words || [];
    const knownVocabSet = new Set(userKnownVocab);
    if (sentenceWords.length === 0) return [];
    // get set of SegmentWOrd[]
    const uniqueWords = [
      ...new Map(sentenceWords.map((sw) => [sw.word, sw])).values(),
    ];

    const result: SegmentWord[] = uniqueWords
      .map((sw) => {
        const normalized = stripPunctuation(sw.word.toLowerCase()).trim();
        const vocab = allVocabulary[normalized];
        sw.word = stripPunctuation(sw.word).trim();
        return vocab ? { sw, vocab } : null;
      })
      .filter(
        (item): item is { sw: SegmentWord; vocab: any } =>
          item?.vocab?.word &&
          isInterestingVocab(item.vocab) &&
          !knownVocabSet.has(item.vocab.id),
      )
      .sort((a, b) => b.vocab.percentile - a.vocab.percentile)
      .map((item) => item.sw);

    return result;
  }, [currentSentenceObject, userKnownVocab, allVocabulary]);

  useEffect(() => {
    refreshPlayer();
  }, [selectedNavTab]);

  const [showVideo, setShowVideo] = useState<boolean>(true);
  const [clipRefreshKey, setClipRefreshKey] = useState(0);

  // Player state
  const [playerMuted, setPlayerMuted] = useState<boolean>(false);
  const [playerSpeed, setPlayerSpeed] = useState<number>(1);
  const [autoplay, setAutoplay] = useState<boolean>(false);

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
    setPlayerMuted(false);
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

    if (
      prevTime !== -1 &&
      prevTime !== 0 &&
      Math.abs(newTime - prevTime) > 2 &&
      currentSentence !== undefined &&
      (newTime < currentSentence.start - 0.5 ||
        newTime > currentSentence.end + 0.5)
    ) {
      if (
        selectedNavTab === "shadow" &&
        newTime === 0 &&
        !isConfirmingStartOver &&
        currentSentence.index > 0
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
    if (newTime < currentSentence.start) return;
    // Pause at sentence end (enforces sentence clipping without URL reload)

    if (newTime >= currentSentence.end) {
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
    if (currentSentence.index === currentVideo?.sentences.length - 1) {
      return;
    }

    handleTransition();
    setCurrentSentence((prev) => {
      const next = currentVideo?.sentences[prev + 1];
      setTime(next?.start);
      return next?.index;
    });
    refreshPlayer();
  }, [currentSentence?.index, currentVideo?.sentences.length]);

  const handlePreviousSentence = useCallback(() => {
    if (currentSentence.index === 0) {
      return;
    }
    handleTransition();

    setCurrentSentence((prev) => {
      const previous = currentVideo?.sentences[prev - 1];
      setTime(previous?.start);
      return previous?.index;
    });
    refreshPlayer();
  }, [currentSentence?.index, currentVideo?.sentences]);

  const playSentence = useCallback(() => {
    handleTransition();
    setAutoplay(true);
    setTime(currentSentence.start);
    refreshPlayer();
  }, [currentSentence.start]);

  const playWordSnippet = useCallback(
    (word: SegmentWord) => {
      setAutoplay(true);
      handleTransition();
      setTime(word.start);
      console.log("playing word snippet", word.start, word.end);
      currentWordSnippetRef.current = { start: word.start, end: word.end };
      refreshPlayer();
      setTimeout(() => {
        currentWordSnippetRef.current = null;
      }, 1000);
    },
    [currentSentence.start],
  );

  const refreshPlayer = useCallback(() => {
    prevTimeRef.current = -1;
    dispatch(refreshVideoPlayerAction());
  }, [dispatch, currentSentence.start]);

  const handlePlayClip = useCallback((start) => {
    setAutoplay(true);
    isTransitioningRef.current = true;
    setTimeout(() => {
      isTransitioningRef.current = false;
    }, 1500);
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
    const topUnknownWord = unknownWords?.length ? unknownWords[0] : null;
    if (!topUnknownWord) return "";

    const match =
      time >= topUnknownWord.start - 1 && time <= topUnknownWord.start + 3;
    let vocabulary = null;
    if (match) {
      vocabulary = allVocabulary[vocabFormatWord(topUnknownWord.word)];
      return `${capitalize(topUnknownWord.word)} => ${capitalize(vocabulary.translation)}`;
    }

    return "";
  }, [unknownWords, time, selectedNavTab]);

  if (!currentVideo) return null;

  const getTabStyle = (isActive: boolean) =>
    ({
      display: isActive ? "flex" : "none",
      flex: 1,
    }) as const;

  let endTime;
  if (selectedNavTab === "shadow") {
    if (currentWordSnippetRef.current) {
      endTime = currentWordSnippetRef.current.end;
    } else {
      endTime = currentSentence.end;
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
            index: currentSentence.index,
            text: currentSentence.text,
            full_translation: currentSentence.full_translation,
            words: currentSentence.words,
            start:
              currentWordSnippetRef.current?.start || currentSentence.start,
            end: endTime,
          }}
          autoplay={effectiveAutoplay}
          refreshKey={effectiveRefreshKey}
          setTime={handleSetTime}
          muted={playerMuted}
          playbackSpeed={playerSpeed}
          startTime={startTimeForPlayer}
          videoText={currentVideoText}
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
          currentSentence={currentSentence}
          setCurrentSentence={setCurrentSentence}
          setAutoplay={setAutoplay}
          refreshPlayer={refreshPlayer}
          isActive={selectedNavTab === "watch"}
          unknownWords={unknownWords}
          handlePlayWordSnippet={playWordSnippet}
          isPlayingWordSnippet={!!currentWordSnippetRef.current}
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
          setPlayerMuted={setPlayerMuted}
          setPlayerSpeed={setPlayerSpeed}
          pausePlayer={pausePlayer}
          playWordSnippet={playWordSnippet}
          isPlayingWordSnippet={!!currentWordSnippetRef.current}
          unknownWords={unknownWords}
          onPlayClip={handlePlayClip}
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
