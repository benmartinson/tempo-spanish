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
  AppState,
  useWindowDimensions,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-expo";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import {
  AutoReviewDetails,
  AutoShadowDetails,
  RootState,
  SegmentWord,
} from "../../types";
import { loadSentenceInsights } from "../../requests";
import {
  setSentenceByTime,
  setCurrentSentence as setCurrentSentenceAction,
  refreshVideoPlayer as refreshVideoPlayerAction,
} from "../../store/actions/dataActions";
import AsyncStorage from "@react-native-async-storage/async-storage";
import YouTubePlayer, { YouTubePlayerHandle } from "./YouTubePlayer";
import ShadowTab from "../shadow/ShadowTab";
import { stripPunctuation } from "../../helpers/helpers";
import SlideModal from "./SlideModal";
import WalkthroughModal from "./WalkthroughModal";
import { setHasSeenWelcomeModals } from "../../store/actions/dataActions";
import { SPANISH_PREPOSITIONS, SPANISH_PRONOUNS } from "../../constants";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SelectedVideoPage: React.FC = () => {
  const { width: windowWidth } = useWindowDimensions();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const videoRefreshKey = useSelector(
    (state: RootState) => state.videoRefreshKey,
  );
  const dispatch = useDispatch();
  const hasSeenWelcomeModals = useSelector(
    (state: RootState) => state.hasSeenWelcomeModals,
  );
  const profileModalOpen = useSelector(
    (state: RootState) => state.profileModalOpen,
  );
  const signInScreenOpen = useSelector(
    (state: RootState) => state.signInScreenOpen,
  );

  const [autoShadowDetails, setAutoShadowDetails] =
    useState<AutoShadowDetails | null>(null);
  const [playerMuted, setPlayerMuted] = useState(false);

  // Refresh player when app returns from background
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        dispatch(refreshVideoPlayerAction());
      }
    });
    return () => subscription.remove();
  }, [dispatch]);

  const [time, setTime] = useState<number>(0);
  const [playKey, setPlayKey] = useState(0);
  const [isConfirmingStartOver, setIsConfirmingStartOver] =
    useState<boolean>(false);

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

  // Translation insights state (shared across tabs)
  const supabase = useSupabaseWithClerk();
  // const handleWalkthroughComplete = useCallback(async () => {
  //   dispatch(setHasSeenWelcomeModals(true));
  //   await AsyncStorage.setItem("has_seen_welcome_modals", "true");
  // }, [dispatch]);

  const userSettings = useSelector((state: RootState) => state.userSettings);
  const translationLanguage = userSettings.translationLanguage;
  const [isLoadingInsights, setIsLoadingInsights] = useState<boolean>(true);
  const [orderedCharacters, setOrderedCharacters] = useState<string[]>([]);
  const [sentenceTranslation, setSentenceTranslation] = useState<{
    index: number;
    text: string;
  } | null>(null);

  const hintWords = useMemo(() => {
    const sentenceWords = currentSentenceObject?.words || [];
    if (sentenceWords.length === 0) return [];
    const uniqueWords = [
      ...new Map(sentenceWords.map((sw) => [sw.word, sw])).values(),
    ];

    const properNounSet = new Set(
      orderedCharacters.map((name) => name.toLowerCase()),
    );

    const result: SegmentWord[] = uniqueWords
      .filter((sw) => {
        const normalized = stripPunctuation(sw.word.toLowerCase()).trim();
        return (
          normalized.length > 3 &&
          !SPANISH_PREPOSITIONS.includes(normalized) &&
          !SPANISH_PRONOUNS.includes(normalized) &&
          !properNounSet.has(normalized)
        );
      })
      .map((sw) => ({
        ...sw,
        word: stripPunctuation(sw.word).trim(),
      }))
      .sort((a, b) => a.frequency - b.frequency);

    return result;
  }, [currentSentenceObject.start, orderedCharacters]);

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

    try {
      const result = await loadSentenceInsights({
        supabase,
        sentenceText: currentSentenceObject.text,
        videoRecordId: currentVideo.recordId,
        sentenceIndex: currentSentenceIndex,
        translationLanguage,
      });

      if (result.properNouns.length > 0) {
        const ordered = orderCharactersByAppearance(
          result.properNouns,
          currentSentenceObject.text,
        );
        setOrderedCharacters(ordered);
      }

      setSentenceTranslation({
        index: currentSentenceIndex,
        text: result.translation,
      });
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
    if (
      !userSettings.translationLanguage ||
      (!currentSentenceIndex && currentSentenceIndex !== 0)
    ) {
      return;
    }
    loadTranslationInsights();
  }, [currentSentenceIndex, userSettings.translationLanguage]);

  const getEndPadding = useCallback(
    (sentenceIndex: number) => {
      const next = currentVideo?.sentences[sentenceIndex + 1];
      if (!next) return 0.4;
      const current = currentVideo?.sentences[sentenceIndex];
      const gap = next.start - (current?.end ?? 0);
      return gap > 0.5 ? 0.4 : 0;
    },
    [currentVideo?.sentences],
  );

  const getStartPadding = useCallback(
    (sentenceIndex: number) => {
      const prev = currentVideo?.sentences[sentenceIndex - 1];
      if (!prev) return 0.4;
      const current = currentVideo?.sentences[sentenceIndex];
      const gap = (current?.start ?? 0) - prev.end;
      return gap > 0.5 ? 0.4 : 0;
    },
    [currentVideo?.sentences],
  );

  const [showVideo, setShowVideo] = useState<boolean>(true);
  const [clipRefreshKey, setClipRefreshKey] = useState(0);

  // Player state
  const [playerSpeed, _setPlayerSpeed] = useState<number>(1);
  const setPlayerSpeed = useCallback((speed: number) => {
    _setPlayerSpeed(speed);
    playerRef.current?.setSpeed(speed);
  }, []);
  const [autoplay, setAutoplay] = useState<boolean>(true);
  const [playerIsPlaying, setPlayerIsPlaying] = useState<boolean>(false);
  const playingStateQueueRef = useRef<boolean[]>([]);
  const playingStateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const userPressedPlayPause = useRef(false);

  useEffect(() => {
    setAutoplay(hasSeenWelcomeModals && !profileModalOpen && !signInScreenOpen);
  }, [hasSeenWelcomeModals, profileModalOpen, signInScreenOpen]);

  useEffect(() => {
    refreshPlayer();
  }, [autoplay]);

  const handlePlayingStateChange = useCallback((isPlaying: boolean) => {
    if (playingStateTimerRef.current && !userPressedPlayPause.current) {
      // Timer is running, queue the state change
      playingStateQueueRef.current.push(isPlaying);
      return;
    }
    if (userPressedPlayPause.current) {
      playingStateQueueRef.current = [];
      if (playingStateTimerRef.current) {
        clearTimeout(playingStateTimerRef.current);
        playingStateTimerRef.current = null;
      }
    }
    userPressedPlayPause.current = false;

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
  const currentClipSnippetRef = useRef<{ start: number; end: number } | null>(
    null,
  );

  // Seek detection refs
  const prevTimeRef = useRef<number>(-1);
  const isTransitioningRef = useRef<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startStallTimerRef = useRef<() => void>(() => {});
  const [shadowMode, setShadowMode] = useState<"shadow" | "stream">("shadow");

  useEffect(() => {
    if (shadowMode === "stream") {
      playerRef.current?.disableClipEnforcement();
    } else {
      playerRef.current?.setClip(
        (currentSentenceObject?.start ?? 0) -
          getStartPadding(currentSentenceIndex),
        (currentSentenceObject?.end ?? 0) + getEndPadding(currentSentenceIndex),
      );
    }
  }, [shadowMode]);

  const handleSetTime = (newTime: number, force = false) => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    if (isTransitioningRef.current && !force) return;

    const prevTime = prevTimeRef.current;
    prevTimeRef.current = newTime;
    if (
      force ||
      (prevTime !== -1 &&
        prevTime !== 0 &&
        Math.abs(newTime - prevTime) > 2 &&
        currentSentenceObject !== undefined &&
        (newTime < currentSentenceObject.start - 0.5 ||
          newTime > currentSentenceObject.end + 0.5))
    ) {
      if (newTime === 0 && currentSentenceObject?.index > 0) {
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
      if (shadowMode === "stream") {
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
    const next = currentVideo?.sentences[currentSentenceObject?.index + 1];
    setCurrentSentence(next?.index);
    setTime(next?.start);
    prevTimeRef.current = -1;
    setPlayerIsPlaying(true);
    if (shadowMode === "stream") {
      playerRef.current?.disableClipEnforcement();
    } else {
      playerRef.current?.setClip(
        (next?.start ?? 0) - getStartPadding(next?.index ?? 0),
        (next?.end ?? 0) + getEndPadding(next?.index ?? 0),
      );
    }
    playerRef.current?.seekAndPlay(
      (next?.start ?? 0) - getStartPadding(next?.index ?? 0),
    );
    startStallTimerRef.current();
  }, [
    currentSentenceObject?.index,
    currentVideo?.sentences.length,
    getEndPadding,
    getStartPadding,
  ]);

  const handlePreviousSentence = useCallback(
    (n = 1) => {
      if (currentSentenceObject?.index === 0) {
        return;
      }
      handleTransition();

      const targetIndex = Math.max(0, currentSentenceObject?.index - n);
      const target = currentVideo?.sentences[targetIndex];
      setCurrentSentence(target?.index);
      setTime(target?.start);
      prevTimeRef.current = -1;
      setPlayerIsPlaying(true);
      if (shadowMode === "stream") {
        playerRef.current?.disableClipEnforcement();
      } else {
        playerRef.current?.setClip(
          (target?.start ?? 0) - getStartPadding(target?.index ?? 0),
          (target?.end ?? 0) + getEndPadding(target?.index ?? 0),
        );
      }
      playerRef.current?.seekAndPlay(
        (target?.start ?? 0) - getStartPadding(target?.index ?? 0),
      );
      startStallTimerRef.current();
    },
    [currentSentenceObject?.index, currentVideo?.sentences],
  );

  const playSentence = useCallback(() => {
    handleTransition();
    setAutoplay(true);
    setTime(currentSentenceObject?.start);
    setPlayKey((k) => k + 1);
    prevTimeRef.current = -1;
    setPlayerIsPlaying(true);
    currentClipSnippetRef.current = null;
    const startPad = getStartPadding(currentSentenceIndex);
    playerRef.current?.setClip(
      (currentSentenceObject?.start ?? 0) - startPad,
      shadowMode === "stream"
        ? undefined
        : (currentSentenceObject?.end ?? 0) +
            getEndPadding(currentSentenceIndex),
    );
    playerRef.current?.seekAndPlay(
      (currentSentenceObject?.start ?? 0) - startPad,
    );
    startStallTimerRef.current();
  }, [currentSentenceObject?.start, shadowMode]);

  const playClipSnippet = useCallback(
    (start: number, end: number) => {
      setAutoplay(true);
      handleTransition();
      setTime(start);
      prevTimeRef.current = -1;
      setPlayerIsPlaying(true);
      playerRef.current?.setClip(start, end);
      playerRef.current?.seekAndPlay(start);
      startStallTimerRef.current();
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

  const startStallTimer = useCallback(() => {
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    stallTimerRef.current = setTimeout(() => {
      stallTimerRef.current = null;
      console.log("Playback stall detected — refreshing player");
      refreshPlayer();
    }, 3000);
  }, [refreshPlayer]);
  startStallTimerRef.current = startStallTimer;

  const handlePlayClip = useCallback((start) => {
    console.log("playing clip", start);
    setAutoplay(true);
    handleTransition();
    handleSetTime(start, true);
  }, []);

  const effectiveRefreshKey = videoRefreshKey + clipRefreshKey;
  const startTimeForPlayer = time;

  const pausePlayer = useCallback(() => {
    userPressedPlayPause.current = true;
    playerRef.current?.pause();
  }, [playerRef]);

  const playPlayer = useCallback(() => {
    userPressedPlayPause.current = true;
    playerRef.current?.play();
  }, [playerRef]);

  const mutePlayer = useCallback(() => {
    setPlayerMuted(true);
    playerRef.current?.mute();
  }, []);

  const unMutePlayer = useCallback(() => {
    setPlayerMuted(false);
    playerRef.current?.unMute();
  }, []);

  if (!currentVideo) return null;

  const startTime =
    (currentSentenceObject?.start ?? 0) - getStartPadding(currentSentenceIndex);
  const endTime =
    (currentSentenceObject?.end ?? 0) + getEndPadding(currentSentenceIndex);
  const playerHeight =
    Platform.OS === "web" && windowWidth >= 850
      ? 480
      : windowWidth > 600
        ? Math.round((windowWidth * 9) / 16)
        : 230;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.videoContainer,
          { height: playerHeight },
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
            start: startTime,
            end: endTime,
          }}
          autoplay={autoplay}
          refreshKey={effectiveRefreshKey}
          setTime={handleSetTime}
          muted={playerMuted}
          playbackSpeed={playerSpeed}
          startTime={startTimeForPlayer}
          onPlayingStateChange={handlePlayingStateChange}
        />
      </View>
      <View style={styles.shadowContainer}>
        <ShadowTab
          time={time}
          playKey={playKey}
          handleNextSentence={handleNextSentence}
          handlePreviousSentence={handlePreviousSentence}
          playSentence={playSentence}
          setPlayerSpeed={setPlayerSpeed}
          pausePlayer={pausePlayer}
          resumePlayer={playPlayer}
          playWordSnippet={(word: SegmentWord) =>
            playClipSnippet(word.start - 0.3, word.end + 0.3)
          }
          isPlayingWordSnippet={!!currentClipSnippetRef.current}
          hintWords={hintWords}
          onPlayClip={handlePlayClip}
          playClipSnippet={playClipSnippet}
          playerIsPlaying={playerIsPlaying}
          playerSpeed={playerSpeed}
          isLoadingInsights={isLoadingInsights}
          orderedCharacters={orderedCharacters}
          sentenceTranslation={sentenceTranslation}
          autoShadowDetails={autoShadowDetails}
          onAutoShadowHandled={() => setAutoShadowDetails(null)}
          mutePlayer={mutePlayer}
          unMutePlayer={unMutePlayer}
          shadowMode={shadowMode}
          setShadowMode={setShadowMode}
          setAutoplay={setAutoplay}
        />
      </View>

      {/* <WalkthroughModal
        visible={!hasSeenWelcomeModals}
        onComplete={handleWalkthroughComplete}
      /> */}

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
    backgroundColor: "#000",
    position: "relative",
    marginTop: 0,
    overflow: "hidden",
  },
  shadowContainer: {
    flex: 1,
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

export default SelectedVideoPage;
