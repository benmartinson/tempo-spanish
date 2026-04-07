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
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
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
import YouTubePlayer, { YouTubePlayerHandle } from "./YouTubePlayer";
import SpeedRunTab from "../speed-run/SpeedRunTab";
import ShadowTab from "../shadow/ShadowTab";
import ReviewTab from "../discuss/ReviewTab";
import TranslateTab from "../translate/TranslateTab";
import RecordingsTab from "../recordings/RecordingsTab";
import TurnTakingTab from "../turn-taking/TurnTakingTab";
import {
  capitalize,
  isInterestingVocab,
  normalizeWord,
  stripPunctuation,
  vocabFormatWord,
} from "../../helpers/helpers";
import SlideModal from "./SlideModal";

interface SelectedVideoTabsProps {
  selectedNavTab:
    | "watch"
    | "shadow"
    | "review"
    | "speed-run"
    | "translate"
    | "recordings"
    | "turn-taking";
  onSelectNavTab: (
    tab:
      | "watch"
      | "shadow"
      | "review"
      | "speed-run"
      | "translate"
      | "recordings",
    reviewDetails?: AutoReviewDetails | null,
  ) => void;
}

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SelectedVideoTabs: React.FC<SelectedVideoTabsProps> = ({
  selectedNavTab,
  onSelectNavTab,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const videoRefreshKey = useSelector(
    (state: RootState) => state.videoRefreshKey,
  );
  const dispatch = useDispatch();

  const [autoShadowDetails, setAutoShadowDetails] =
    useState<AutoShadowDetails | null>(null);
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
  const [sentenceTranslation, setSentenceTranslation] = useState<string | null>(
    null,
  );

  const hintWords = useMemo(() => {
    const sentenceWords = currentSentenceObject?.words || [];
    const knownVocabSet = new Set(userKnownVocab);
    if (sentenceWords.length === 0) return [];
    const uniqueWords = [
      ...new Map(sentenceWords.map((sw) => [sw.word, sw])).values(),
    ];

    const properNounSet = new Set(
      orderedCharacters.map((name) => name.toLowerCase()),
    );

    const result: SegmentWord[] = uniqueWords
      .map((sw) => {
        const normalized = stripPunctuation(sw.word.toLowerCase()).trim();
        const vocab = allVocabulary[normalized];
        const cleanedWord = stripPunctuation(sw.word).trim();
        return vocab ? { sw: { ...sw, word: cleanedWord }, vocab } : null;
      })
      .filter(
        (item): item is { sw: SegmentWord; vocab: any } =>
          item?.vocab?.word &&
          isInterestingVocab(item.vocab) &&
          !properNounSet.has(item.vocab.word.toLowerCase()),
      )
      .sort((a, b) => b.vocab.percentile - a.vocab.percentile)
      .sort((a, b) => {
        const aTranslationMatchesWord =
          normalizeWord(a.vocab.translation) === normalizeWord(a.vocab.word);
        const bTranslationMatchesWord =
          normalizeWord(b.vocab.translation) === normalizeWord(b.vocab.word);
        if (aTranslationMatchesWord === bTranslationMatchesWord) return 0;
        return aTranslationMatchesWord ? 1 : -1;
      })
      .map((item) => {
        return {
          ...item.sw,
          isKnown: knownVocabSet.has(item.vocab.id),
        };
      });

    return result;
  }, [
    currentSentenceObject.start,
    userKnownVocab,
    allVocabulary,
    orderedCharacters,
  ]);

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
    if (
      !currentSentenceObject?.text ||
      !supabase ||
      !currentVideo ||
      selectedNavTab === "speed-run" ||
      selectedNavTab === "review"
    ) {
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

      setSentenceTranslation(result.translation);
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
  const [playerSpeed, _setPlayerSpeed] = useState<number>(1);
  const setPlayerSpeed = useCallback((speed: number) => {
    _setPlayerSpeed(speed);
    playerRef.current?.setSpeed(speed);
  }, []);
  const [autoplay, setAutoplay] = useState<boolean>(false);
  const [playerIsPlaying, setPlayerIsPlaying] = useState<boolean>(false);
  const playingStateQueueRef = useRef<boolean[]>([]);
  const playingStateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const userPressedPlayPause = useRef(false);

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

  useEffect(() => {
    if (selectedNavTab !== "turn-taking") {
      setPlayerSpeed(1);
    }
    if (selectedNavTab !== "review" && selectedNavTab !== "translate") {
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

    // During recordings playback, just update time without sentence transitions
    if (selectedNavTab === "recordings") {
      prevTimeRef.current = newTime;
      setTime(newTime);
      return;
    }

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
      if (clipEndTime !== undefined && newTime >= clipEndTime) {
        pausePlayer();
        return;
      }
      if (selectedNavTab === "shadow" || selectedNavTab === "review") {
        // playerRef.current?.pause();
      } else if (selectedNavTab === "turn-taking") {
        // Just advance the sentence index — video keeps playing freely
        setCurrentSentence((prev) => prev + 1);
        setTime(newTime);
        return;
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
    const next = currentVideo?.sentences[currentSentenceObject?.index + 1];
    setCurrentSentence(next?.index);
    setTime(next?.start);
    prevTimeRef.current = -1;
    setPlayerIsPlaying(true);
    playerRef.current?.setClip(next?.start ?? 0, next?.end ?? 0);
    playerRef.current?.seekAndPlay(next?.start ?? 0);
  }, [currentSentenceObject?.index, currentVideo?.sentences.length]);

  // Turn-taking variant: advances without setting clip end so the player flows freely
  const handleNextSentenceFree = useCallback(() => {
    if (currentSentenceObject?.index === currentVideo?.sentences.length - 1) {
      return;
    }

    handleTransition();
    const next = currentVideo?.sentences[currentSentenceObject?.index + 1];
    setCurrentSentence(next?.index);
    setTime(next?.start);
    prevTimeRef.current = -1;
    setPlayerIsPlaying(true);
    playerRef.current?.disableClipEnforcement();
    playerRef.current?.seekAndPlay(next?.start ?? 0);
  }, [currentSentenceObject?.index, currentVideo?.sentences.length]);

  const handlePreviousSentence = useCallback(() => {
    if (currentSentenceObject?.index === 0) {
      return;
    }
    handleTransition();

    const previous = currentVideo?.sentences[currentSentenceObject?.index - 1];
    setCurrentSentence(previous?.index);
    setTime(previous?.start);
    prevTimeRef.current = -1;
    setPlayerIsPlaying(true);
    playerRef.current?.setClip(previous?.start ?? 0, previous?.end ?? 0);
    playerRef.current?.seekAndPlay(previous?.start ?? 0);
  }, [currentSentenceObject?.index, currentVideo?.sentences]);

  const handlePreviousSentenceFree = useCallback(() => {
    if (currentSentenceObject?.index === 0) {
      return;
    }
    handleTransition();

    const previous = currentVideo?.sentences[currentSentenceObject?.index - 1];
    setCurrentSentence(previous?.index);
    setTime(previous?.start);
    prevTimeRef.current = -1;
    setPlayerIsPlaying(true);
    playerRef.current?.disableClipEnforcement();
    playerRef.current?.seekAndPlay(previous?.start ?? 0);
  }, [currentSentenceObject?.index, currentVideo?.sentences]);

  const handleReviewSegment = useCallback(
    (details: AutoReviewDetails) => {
      onSelectNavTab("review", details);
    },
    [onSelectNavTab],
  );

  const playSentence = useCallback(() => {
    handleTransition();
    setAutoplay(true);
    setTime(currentSentenceObject?.start);
    setPlayKey((k) => k + 1);
    prevTimeRef.current = -1;
    setPlayerIsPlaying(true);
    currentClipSnippetRef.current = null;
    playerRef.current?.setClip(
      currentSentenceObject?.start ?? 0,
      selectedNavTab === "watch" ||
        selectedNavTab === "speed-run" ||
        selectedNavTab === "turn-taking"
        ? undefined
        : (currentSentenceObject?.end ?? undefined),
    );
    playerRef.current?.seekAndPlay(currentSentenceObject?.start ?? 0);
  }, [currentSentenceObject?.start]);

  const playClipSnippet = useCallback(
    (start: number, end: number) => {
      setAutoplay(true);
      handleTransition();
      setTime(start);
      prevTimeRef.current = -1;
      setPlayerIsPlaying(true);
      playerRef.current?.setClip(start, end);
      playerRef.current?.seekAndPlay(start);
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
    userPressedPlayPause.current = true;
    playerRef.current?.pause();
  }, [playerRef]);

  const playPlayer = useCallback(() => {
    userPressedPlayPause.current = true;
    playerRef.current?.play();
  }, [playerRef]);

  const [playerMuted, setPlayerMuted] = useState(false);

  const mutePlayer = useCallback(() => {
    setPlayerMuted(true);
    playerRef.current?.mute();
  }, []);

  const unMutePlayer = useCallback(() => {
    setPlayerMuted(false);
    playerRef.current?.unMute();
  }, []);

  // Mute when on Recordings tab, unmute when switching away
  // Hide video initially on recordings tab, but once shown (by playback), keep it visible
  const recordingsVideoShownRef = useRef(false);
  useEffect(() => {
    if (selectedNavTab === "recordings") {
      mutePlayer();
      if (!recordingsVideoShownRef.current) {
        setShowVideo(false);
      }
    } else if (selectedNavTab !== "turn-taking") {
      recordingsVideoShownRef.current = false;
      unMutePlayer();
      setShowVideo(true);
    } else {
      recordingsVideoShownRef.current = false;
      setShowVideo(true);
    }
  }, [selectedNavTab]);

  const [clipEndTime, setClipEndTime] = useState<number | undefined>(undefined);

  const setClipEnd = useCallback(
    (end: number | undefined) => {
      setClipEndTime(end);
      playerRef.current?.setClip(currentSentenceObject?.start ?? 0, end);
    },
    [currentSentenceObject?.start],
  );

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

  const endTime =
    selectedNavTab !== "watch" &&
    selectedNavTab !== "speed-run" &&
    selectedNavTab !== "recordings" &&
    selectedNavTab !== "turn-taking"
      ? currentSentenceObject?.end
      : undefined;
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
            start: currentSentenceObject?.start,
            end: endTime,
          }}
          autoplay={selectedNavTab === "shadow"}
          refreshKey={effectiveRefreshKey}
          setTime={handleSetTime}
          muted={playerMuted}
          playbackSpeed={playerSpeed}
          startTime={startTimeForPlayer}
          onPlayingStateChange={handlePlayingStateChange}
        />
      </View>
      {/* {!showVideo && !isKeyboardVisible && (
        <TouchableOpacity
          style={styles.showVideoButton}
          onPress={() => setShowVideo(true)}
        >
          <Text style={styles.showVideoButtonText}>Show Video</Text>
        </TouchableOpacity>
      )} */}

      <View style={getTabStyle(selectedNavTab === "shadow")}>
        <ShadowTab
          time={time}
          playKey={playKey}
          handleNextSentence={handleNextSentence}
          handlePreviousSentence={handlePreviousSentence}
          playSentence={playSentence}
          isActive={selectedNavTab === "shadow"}
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
          onReviewSegment={handleReviewSegment}
          autoShadowDetails={autoShadowDetails}
          onAutoShadowHandled={() => setAutoShadowDetails(null)}
          mutePlayer={mutePlayer}
          unMutePlayer={unMutePlayer}
        />
      </View>
      <View style={getTabStyle(selectedNavTab === "speed-run")}>
        <SpeedRunTab
          time={time}
          currentSentence={currentSentenceObject}
          setCurrentSentence={setCurrentSentence}
          setAutoplay={setAutoplay}
          refreshPlayer={refreshPlayer}
          isActive={selectedNavTab === "speed-run"}
          hintWords={hintWords}
          handlePlayWordSnippet={(word: SegmentWord) =>
            playClipSnippet(word.start - 0.3, word.end + 0.3)
          }
          isPlayingWordSnippet={!!currentClipSnippetRef.current}
          handleNextSentence={handleNextSentence}
          handlePreviousSentence={handlePreviousSentence}
          onPlayClip={handlePlayClip}
          playSentence={playSentence}
          pausePlayer={pausePlayer}
          resumePlayer={playPlayer}
          playerIsPlaying={playerIsPlaying}
          setPlayerSpeed={setPlayerSpeed}
          orderedCharacters={orderedCharacters}
          targetLanguage={userSettings.targetLanguage}
          mutePlayer={mutePlayer}
          unMutePlayer={unMutePlayer}
          onTimeUpdate={handleSetTime}
          setClipEnd={setClipEnd}
        />
      </View>

      {selectedNavTab === "recordings" && (
        <View style={getTabStyle(selectedNavTab === "recordings")}>
          <RecordingsTab
            time={time}
            isActive={selectedNavTab === "recordings"}
            playerRef={playerRef}
            pausePlayer={pausePlayer}
            resumePlayer={playPlayer}
            setPlayerSpeed={setPlayerSpeed}
            onShowVideo={(show) => {
              if (show) recordingsVideoShownRef.current = true;
              setShowVideo(show);
            }}
            playerIsPlaying={playerIsPlaying}
            onNavigateToShadow={(sentenceIndex) => {
              setCurrentSentence(sentenceIndex);
              onSelectNavTab("shadow");
            }}
          />
        </View>
      )}

      {selectedNavTab === "review" && (
        <View style={getTabStyle(selectedNavTab === "review")}>
          <ReviewTab
            onPlayClip={playClipSnippet}
            isKeyboardVisible={isKeyboardVisible}
            setShowVideo={setShowVideo}
          />
        </View>
      )}

      <View style={getTabStyle(selectedNavTab === "turn-taking")}>
        <TurnTakingTab
          time={time}
          playKey={playKey}
          playerSpeed={playerSpeed}
          handleNextSentence={handleNextSentenceFree}
          handlePreviousSentence={handlePreviousSentenceFree}
          isActive={selectedNavTab === "turn-taking"}
          playSentence={playSentence}
          setPlayerSpeed={setPlayerSpeed}
          pausePlayer={pausePlayer}
          resumePlayer={playPlayer}
          playerIsPlaying={playerIsPlaying}
          mutePlayer={mutePlayer}
          unMutePlayer={unMutePlayer}
          orderedCharacters={orderedCharacters}
          targetLanguage={userSettings.targetLanguage}
        />
      </View>

      {selectedNavTab === "translate" && (
        <View style={getTabStyle(selectedNavTab === "translate")}>
          <TranslateTab
            onPlayClip={(segment) =>
              playClipSnippet(segment.start, segment.end)
            }
            onPlayClipStart={handlePlayClip}
            isKeyboardVisible={isKeyboardVisible}
            playerIsPlaying={playerIsPlaying}
            setShowVideo={setShowVideo}
            playSentence={playSentence}
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
