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
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState, SegmentWord } from "../../types";
import {
  setSegmentByTime,
  setNextSegment,
  setPreviousSegment,
  refreshVideoPlayer as refreshVideoPlayerAction,
} from "../../store/actions/dataActions";
import YouTubePlayer, { YouTubePlayerHandle } from "./YouTubePlayer";
import WatchTab from "../watch/WatchTab";
import ShadowTab from "../shadow/ShadowTab";
import DiscussTab from "../discuss/DiscussTab";
import {
  findSegmentAndSentenceByTime,
  findTimesForVocab,
  getSentenceData,
} from "../../helpers";

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

  const clip = currentVideo?.segments[currentVideo.currentSegment];
  const [time, setTime] = useState<number>(0);
  const [currentSentence, setCurrentSentence] = useState<number>(0);

  // Player state
  const [playerMuted, setPlayerMuted] = useState<boolean>(false);
  const [playerSpeed, setPlayerSpeed] = useState<number>(1);
  const [autoplay, setAutoplay] = useState<boolean>(false);

  // For DiscussTab clip overrides
  const [clipOverride, setClipOverride] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [clipRefreshKey, setClipRefreshKey] = useState(0);

  // Player ref for injecting play/pause commands without reloading
  const playerRef = useRef<YouTubePlayerHandle>(null);

  // Seek detection refs
  const prevTimeRef = useRef<number>(-1);
  const isTransitioningRef = useRef<boolean>(false);

  // Derived data
  const allWords = useSelector(
    (state: RootState) => state.currentVideo?.allWords,
  );
  const focusVocabTimes = useMemo(
    () => findTimesForVocab(allWords, currentVideo),
    [currentVideo, allWords],
  );

  const clipWords = clip?.words || [];
  const {
    sentences,
    currentSentenceWords,
    sentenceStart,
    sentenceEnd,
    isLastSentence,
    isFirstSentence,
    isFirstSegment,
    sentencesText,
  } = useMemo(
    () =>
      getSentenceData(
        clipWords,
        currentSentence,
        clip?.start ?? 0,
        clip?.end ?? 0,
        currentVideo?.currentSegment ?? 0,
      ),
    [
      clipWords,
      currentSentence,
      clip?.start,
      clip?.end,
      currentVideo?.currentSegment,
    ],
  );

  // Reset on segment change
  useEffect(() => {
    setCurrentSentence(0);
    prevTimeRef.current = -1;
    const transitionTimer = setTimeout(() => {
      isTransitioningRef.current = false;
    }, 500);
    return () => clearTimeout(transitionTimer);
  }, [currentVideo?.currentSegment]);

  // When switching to Watch or Review, disable the relay's clip enforcement
  // (which would otherwise keep pausing the video at the old sentence end)
  // and resume playback. This clears the relay's intervals and sets up our
  // own time reporter, so the video plays freely.
  // When switching to Shadow, the video keeps playing and handleSetTime
  // will pause it at the current sentence end.
  useEffect(() => {
    if (selectedNavTab === "watch") {
      playerRef.current?.disableClipEnforcement();
    }
  }, [selectedNavTab]);

  // Clear clip override when switching away from review tab
  useEffect(() => {
    if (selectedNavTab !== "review") {
      setClipOverride(null);
    }
  }, [selectedNavTab]);

  // Unified handleSetTime - mode-aware
  const handleSetTime = (newTime: number) => {
    if (isTransitioningRef.current) return;

    const prevTime = prevTimeRef.current;
    prevTimeRef.current = newTime;

    if (selectedNavTab === "shadow") {
      // Shadow mode: detect manual seek with large time jumps
      if (
        prevTime !== -1 &&
        Math.abs(newTime - prevTime) > 2 &&
        clip &&
        (newTime < clip.start - 0.5 || newTime > clip.end + 0.5)
      ) {
        const result = findSegmentAndSentenceByTime(
          newTime,
          currentVideo!.segments,
          currentVideo!.currentSegment,
        );
        if (result) {
          isTransitioningRef.current = true;
          setCurrentSentence(result.sentenceIndex);
          dispatch(setSegmentByTime(newTime));
          dispatch(refreshVideoPlayerAction());
          return;
        }
      }
      // Ignore time before sentence start
      if (newTime < sentenceStart) return;
      // Pause at sentence end (enforces sentence clipping without URL reload)
      if (newTime >= sentenceEnd) {
        playerRef.current?.pause();
        setTime(sentenceEnd);
        return;
      }
    } else if (selectedNavTab === "watch") {
      // Watch mode: detect when time goes outside segment bounds
      if (
        newTime >= 1 &&
        clip &&
        (newTime < clip.start || newTime > clip.end)
      ) {
        const result = findSegmentAndSentenceByTime(
          newTime,
          currentVideo!.segments,
          currentVideo!.currentSegment,
        );
        if (result) {
          setCurrentSentence(result.sentenceIndex);
          dispatch(setSegmentByTime(newTime));
        }
        return;
      }
      // Auto-detect sentence by time
      for (let i = 0; i < sentences.length; i++) {
        const words = sentences[i];
        if (words.length === 0) continue;
        const sStart = words[0].start;
        const sEnd = words[words.length - 1].end;
        if (newTime >= sStart && newTime <= sEnd + 0.15) {
          if (i !== currentSentence) setCurrentSentence(i);
          break;
        }
      }
    }
    // For review mode (and all modes): track time
    setTime(newTime);
  };

  // Navigation functions
  const handleNextSegment = useCallback(() => {
    setPlayerMuted(false);
    dispatch(setNextSegment());
  }, [dispatch]);

  const handlePreviousSegment = useCallback(() => {
    setPlayerMuted(false);
    dispatch(setPreviousSegment());
  }, [dispatch]);

  const handleNextSentence = useCallback(() => {
    if (isLastSentence) {
      handleNextSegment();
    } else {
      setCurrentSentence((prev) => prev + 1);
    }
  }, [isLastSentence, handleNextSegment]);

  const handlePreviousSentence = useCallback(() => {
    if (isFirstSentence) {
      if (!isFirstSegment) {
        setCurrentSentence(sentences.length - 1);
        handlePreviousSegment();
      }
    } else {
      setCurrentSentence((prev) => prev - 1);
    }
  }, [
    isFirstSentence,
    isFirstSegment,
    sentences.length,
    handlePreviousSegment,
  ]);

  const refreshPlayer = useCallback(() => {
    prevTimeRef.current = -1;
    dispatch(refreshVideoPlayerAction());
  }, [dispatch]);

  // Seek to a specific time (triggers segment change if needed).
  // In Watch/Review mode: seeks the player directly via injected JS (no reload),
  // preserving free-play behavior.
  // In Shadow mode: reloads the player so the URL gets the correct sentence clip.
  const seekToTime = useCallback(
    (targetTime: number, targetSentenceIndex?: number) => {
      if (targetSentenceIndex !== undefined) {
        setCurrentSentence(targetSentenceIndex);
      }
      dispatch(setSegmentByTime(targetTime));

      if (selectedNavTab === "watch" || selectedNavTab === "review") {
        // Seek directly without reloading - keeps free play intact
        playerRef.current?.seekTo(targetTime);
        prevTimeRef.current = -1;
      } else {
        // Shadow mode needs a reload to set sentence clip boundaries in the URL
        isTransitioningRef.current = true;
        dispatch(refreshVideoPlayerAction());
      }
    },
    [dispatch, selectedNavTab],
  );

  // Callback for DiscussTab to request clip playback
  const handlePlayClip = useCallback(
    (segment: { start: number; end: number }) => {
      setClipOverride({ start: segment.start, end: segment.end });
      setAutoplay(true);
      setClipRefreshKey((prev) => prev + 1);
    },
    [],
  );

  // Determine player clip based on active tab
  const playerClip = useMemo(() => {
    if (!currentVideo) return undefined;

    if (selectedNavTab === "shadow" && clip) {
      return {
        ...clip,
        start: sentenceStart,
        end: sentenceEnd,
        videoId: currentVideo.videoId,
      };
    }

    if (selectedNavTab === "review" && clipOverride) {
      return {
        videoId: currentVideo.videoId,
        start: clipOverride.start,
        end: clipOverride.end,
        text: "",
        full_text_translation: "",
        words: [],
      };
    }

    // WatchTab: no clip (free play)
    return undefined;
  }, [
    selectedNavTab,
    clip,
    sentenceStart,
    sentenceEnd,
    currentVideo,
    clipOverride,
  ]);

  // Use combined key so tab switches don't change refreshKey
  const effectiveRefreshKey = videoRefreshKey + clipRefreshKey;
  const effectiveAutoplay = selectedNavTab === "shadow" ? true : autoplay;

  // When there's no clip, use the current playback time as start position.
  // This is only used when refreshKey changes (URL recalculates), so passing
  // `time` here doesn't cause continuous URL changes.
  const startTimeForPlayer = playerClip ? undefined : time;

  if (!currentVideo) return null;

  const showVideo = !(selectedNavTab === "review" && isKeyboardVisible);

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
          clip={playerClip}
          autoplay={effectiveAutoplay}
          refreshKey={effectiveRefreshKey}
          setTime={handleSetTime}
          muted={playerMuted}
          playbackSpeed={playerSpeed}
          startTime={startTimeForPlayer}
        />
      </View>

      {selectedNavTab === "watch" && (
        <WatchTab
          time={time}
          currentSentence={currentSentence}
          setCurrentSentence={setCurrentSentence}
          clip={clip}
          sentences={sentences}
          sentencesText={sentencesText}
          sentenceStart={sentenceStart}
          sentenceEnd={sentenceEnd}
          focusVocabTimes={focusVocabTimes}
          setAutoplay={setAutoplay}
          refreshPlayer={refreshPlayer}
          seekToTime={seekToTime}
        />
      )}
      {selectedNavTab === "shadow" && (
        <ShadowTab
          time={time}
          setTime={setTime}
          currentSentence={currentSentence}
          setCurrentSentence={setCurrentSentence}
          clip={clip}
          sentences={sentences}
          currentSentenceWords={currentSentenceWords}
          sentenceStart={sentenceStart}
          sentenceEnd={sentenceEnd}
          sentencesText={sentencesText}
          isLastSentence={isLastSentence}
          isFirstSentence={isFirstSentence}
          isFirstSegment={isFirstSegment}
          focusVocabTimes={focusVocabTimes}
          handleNextSentence={handleNextSentence}
          handlePreviousSentence={handlePreviousSentence}
          handleNextSegment={handleNextSegment}
          handlePreviousSegment={handlePreviousSegment}
          setPlayerMuted={setPlayerMuted}
          setPlayerSpeed={setPlayerSpeed}
          refreshPlayer={refreshPlayer}
          seekToTime={seekToTime}
        />
      )}
      {selectedNavTab === "review" && (
        <DiscussTab
          onPlayClip={handlePlayClip}
          isKeyboardVisible={isKeyboardVisible}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  videoContainer: {
    height: 230,
    backgroundColor: "#000",
    position: "relative",
    marginTop: 0,
    overflow: "hidden",
  },
});

export default SelectedVideoTabs;
