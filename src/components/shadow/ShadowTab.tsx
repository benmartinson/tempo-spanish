import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { RootState } from "../../types";
import {
  setCurrentTab,
  setCurrentVideo,
  setSegmentByTime,
} from "../../store/actions/dataActions";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import { useNavigation } from "@react-navigation/native";
import SelectedVideoBanner from "../common/SelectedVideoBanner";
import YouTubePlayer from "../common/YouTubePlayer";
import FullSegmentTranscriptBubble from "../watch/FullSegmentTranscriptBubble";
import { useRecording } from "../useRecording";
import { softMatch, TranscriptWord } from "../streaming_helpers";

const ShadowTab: React.FC = () => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const clip = currentVideo?.segments[currentVideo.currentSegment];
  const [time, setTime] = useState<number>(0);
  const timeRemaining = Math.floor(Math.max(clip?.end - time, 0));
  const videoRefreshKey = useSelector(
    (state: RootState) => state.videoRefreshKey,
  );
  const dispatch = useDispatch();
  const [isUserTurn, setIsUserTurn] = useState<boolean>(false);
  const [currentTargetIndex, setCurrentTargetIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const clipWords = clip?.words || [];

  // Use ref to track currentTargetIndex in callback to avoid stale closures
  const currentTargetIndexRef = useRef(currentTargetIndex);
  useEffect(() => {
    //what does this do? I'll tell you, it's a ref to the currentTargetIndex state,
    currentTargetIndexRef.current = currentTargetIndex;
  }, [currentTargetIndex]);

  // Accumulate transcript stream text
  const streamTextRef = useRef<string>("");

  // Handle incoming transcripts from Soniox
  const handleTranscript = useCallback(
    (transcript: string, isFinal: boolean, words?: TranscriptWord[]) => {
      if (clipWords.length === 0) return;

      // Accumulate the transcript text
      streamTextRef.current += transcript + " ";

      // Split accumulated text into words
      const spokenWords = streamTextRef.current
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0);

      console.log("spokenWords", spokenWords);

      // Check each spoken word against current target
      for (const spokenWord of spokenWords) {
        const targetWord = clipWords[currentTargetIndexRef.current];
        console.log(
          "currentTargetIndexRef.current",
          currentTargetIndexRef.current,
        );
        console.log("targetWord", targetWord);
        if (targetWord && softMatch(spokenWord, targetWord.word)) {
          // Match found! Move to next word
          setCurrentTargetIndex((prev) =>
            Math.min(prev + 1, clipWords.length - 1),
          );
          // Reset stream text after match
          // break; // Only advance one word per transcript batch
        }
      }
      streamTextRef.current = "";
    },
    [clipWords],
  );

  const {
    isRecording,
    isConnecting,
    hasPermission,
    startRecording,
    stopRecording,
  } = useRecording({
    onTranscript: handleTranscript,
    onError: (message) => setError(message),
  });

  // Reset state when segment changes
  useEffect(() => {
    setIsUserTurn(false);
    setCurrentTargetIndex(0);
    setError(null);
    streamTextRef.current = "";
  }, [currentVideo?.currentSegment]);

  // Start recording when segment ends
  useEffect(() => {
    if (timeRemaining === 0 && !isUserTurn && hasPermission) {
      setIsUserTurn(true);
      // startRecording();
    }
  }, [timeRemaining, isUserTurn, hasPermission, startRecording]);

  const handleSetTime = (newTime: number) => {
    if (newTime >= 1 && (newTime < clip?.start || newTime > clip?.end)) {
      dispatch(setSegmentByTime(newTime));
      return;
    }
    setTime(newTime);
  };

  const handleRecordingPress = () => {
    if (isRecording || isConnecting) {
      stopRecording();
    } else {
      setIsUserTurn(true);
      startRecording();
    }
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
            clip={{ ...clip, videoId: currentVideo.videoId }}
            videoId={currentVideo.videoId}
            autoplay={true}
            refreshKey={videoRefreshKey}
            setTime={handleSetTime}
          />
          {timeRemaining < 5 && timeRemaining > 0 && !isUserTurn && (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>
                Your turn in {timeRemaining}
              </Text>
            </View>
          )}
          {isUserTurn && (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>
                {isConnecting
                  ? "Connecting..."
                  : isRecording
                    ? "Listening..."
                    : "Your turn!"}
              </Text>
            </View>
          )}
        </View>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        <ScrollView style={styles.transcriptContainer}>
          <FullSegmentTranscriptBubble
            words={clipWords}
            time={time}
            mode={isUserTurn ? "shadow" : "video"}
            currentTargetIndex={currentTargetIndex}
          />
          <TouchableOpacity
            style={[
              styles.recordButton,
              (isRecording || isConnecting) && styles.recordButtonActive,
            ]}
            onPress={handleRecordingPress}
            disabled={!hasPermission}
          >
            {(isRecording || isConnecting) && (
              <MaterialIcons
                name="fiber-manual-record"
                size={20}
                color="#ff4757"
              />
            )}
            <Text style={styles.recordButtonText}>
              {isConnecting
                ? "Connecting..."
                : isRecording
                  ? "Stop Recording"
                  : "Start Recording"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
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
  errorContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: "#ff4757",
    borderRadius: 8,
  },
  errorText: {
    color: "#fff",
    textAlign: "center",
  },
  loader: {
    marginLeft: 8,
  },
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#3d3a52",
    borderRadius: 24,
    gap: 8,
  },
  recordButtonActive: {
    backgroundColor: "#2d2a40",
  },
  recordButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
export default ShadowTab;
