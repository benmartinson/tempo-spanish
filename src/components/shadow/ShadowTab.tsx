import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { RootState } from "../../types";
import {
  setSegmentByTime,
  setNextSegment,
  refreshVideoPlayer,
} from "../../store/actions/dataActions";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import SelectedVideoBanner from "../common/SelectedVideoBanner";
import YouTubePlayer from "../common/YouTubePlayer";
import FullSegmentTranscriptBubble from "../watch/FullSegmentTranscriptBubble";
import { useRecording } from "../useRecording";
import {
  sendAudioForTranscription,
  calculateAccuracy,
  AccuracyResult,
} from "../streaming_helpers";

interface ShadowTabProps {
  segmentId?: string;
}
const ShadowTab: React.FC<ShadowTabProps> = ({ segmentId }) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const clip = currentVideo?.segments[segmentId || currentVideo.currentSegment];
  const [time, setTime] = useState<number>(0);
  const timeRemaining = Math.floor(Math.max(clip?.end - time, 0));
  const videoRefreshKey = useSelector(
    (state: RootState) => state.videoRefreshKey
  );
  const dispatch = useDispatch();

  // useEffect(() => {
  //   if (clip) {
  //     setTime(clip.start);
  //     dispatch(refreshVideoPlayer());
  //   }
  // }, [clip]);

  // Recording and transcription state
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [accuracyResult, setAccuracyResult] = useState<AccuracyResult | null>(
    null
  );
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);

  // Track if recording should auto-stop when segment ends
  const shouldAutoStopRef = useRef<boolean>(false);

  const clipWords = clip?.words || [];

  // Handle recording completion - send audio for transcription
  const handleRecordingComplete = useCallback(
    async (audioUri: string) => {
      setIsProcessing(true);
      setError(null);

      try {
        // Send audio to backend for transcription
        const result = await sendAudioForTranscription(audioUri);

        // Extract words from transcript
        const spokenWords = result.transcript.split(/\s+/).filter(Boolean);

        // Get target words from clip
        const targetWords = clipWords.map((w) => w.word);

        // Calculate accuracy
        const accuracy = calculateAccuracy(spokenWords, targetWords);

        setAccuracyResult(accuracy);
      } catch (err) {
        console.error("Transcription error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to process audio"
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [clipWords]
  );

  const { isRecording, hasPermission, startRecording, stopRecording } =
    useRecording({
      onRecordingComplete: handleRecordingComplete,
      onError: (message) => setError(message),
    });

  // Reset state when segment changes
  useEffect(() => {
    setError(null);
    setAccuracyResult(null);
    setIsProcessing(false);
    setIsVideoMuted(false);
    shouldAutoStopRef.current = false;
  }, [currentVideo?.currentSegment]);

  // Auto-stop recording when segment ends
  useEffect(() => {
    if (isRecording && timeRemaining <= 0 && shouldAutoStopRef.current) {
      stopRecording();
      shouldAutoStopRef.current = false;
      // Don't refresh video after auto-stop - let it continue playing
    }
  }, [timeRemaining, isRecording, stopRecording]);

  const handleSetTime = (newTime: number) => {
    // if (newTime >= 1 && (newTime <= clip?.start || newTime >= clip?.end)) {
    // this causes bugs
    //   console.log("newTime", newTime);
    //   console.log("clip", clip?.start, clip?.end);
    //   dispatch(setSegmentByTime(newTime));
    //   return;
    // }
    setTime(newTime);
  };

  const handleStartRecording = async () => {
    // Reset previous results
    setAccuracyResult(null);
    setError(null);
    setTime(clip?.start || 0);
    shouldAutoStopRef.current = true;
    setIsVideoMuted(true);
    await startRecording();

    dispatch(refreshVideoPlayer());
  };

  const handleStopRecording = async () => {
    shouldAutoStopRef.current = false;
    // pause video
    await stopRecording();
    // Keep muted until user takes action (results will be shown)
  };

  const handleNextSegment = () => {
    // Move to next segment and unmute
    setIsVideoMuted(false);
    dispatch(setNextSegment());
  };

  if (!currentVideo) {
    return <SelectVideoPrompt />;
  }

  // Determine what message to show during recording
  const getRecordingMessage = () => {
    if (isProcessing) return "Processing...";
    if (isRecording) return `Listening... segment ends in ${timeRemaining}`;
    return null;
  };

  const recordingMessage = getRecordingMessage();

  const handlePlaySnippetAgain = () => {
    dispatch(refreshVideoPlayer());
  };

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
            muted={isVideoMuted}
          />
          {recordingMessage && (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{recordingMessage}</Text>
            </View>
          )}
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <ScrollView style={styles.transcriptContainer}>
          {!accuracyResult && (
            <FullSegmentTranscriptBubble
              words={clipWords}
              time={time}
              mode="video"
            />
          )}

          {/* Recording button or processing indicator */}
          {isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#4ade80" />
              <Text style={styles.processingText}>
                Analyzing your pronunciation...
              </Text>
            </View>
          ) : accuracyResult ? (
            // Show results
            <View style={styles.resultsContainer}>
              <View style={styles.accuracyCircle}>
                <Text style={styles.accuracyPercentage}>
                  {accuracyResult.percentage}%
                </Text>
                <Text style={styles.accuracyLabel}>Accuracy</Text>
              </View>
              <Text style={styles.accuracyDetails}>
                {accuracyResult.matchedWords} of {accuracyResult.totalWords}{" "}
                words matched
              </Text>

              {/* Action buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.tryAgainButton]}
                  onPress={handleStartRecording}
                >
                  <MaterialIcons name="replay" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Re-Try Recording</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.nextButton]}
                  onPress={handleNextSegment}
                >
                  <Text style={styles.actionButtonText}>Next Segment</Text>
                  <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.playAgainButton]}
                  onPress={handlePlaySnippetAgain}
                >
                  <Text style={styles.playAgainButtonText}>
                    Re-Play Video Section
                  </Text>
                  <MaterialIcons name="play-arrow" size={20} color="black" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.recordButtonContainer}>
              <TouchableOpacity
                style={styles.playSegmentButton}
                onPress={handlePlaySnippetAgain}
              >
                <Text style={styles.playSegmentButtonText}>Play Segment</Text>
                <MaterialIcons name="play-arrow" size={20} color="black" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.recordButton,
                  isRecording && styles.recordButtonActive,
                ]}
                onPress={
                  isRecording ? handleStopRecording : handleStartRecording
                }
                disabled={!hasPermission || isProcessing}
              >
                {isRecording && (
                  <MaterialIcons
                    name="fiber-manual-record"
                    size={20}
                    color="#ff4757"
                  />
                )}
                <Text style={styles.recordButtonText}>
                  {isRecording ? "Stop Recording" : "Record Yourself"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
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
  transcriptContainer: {
    flex: 1,
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
  processingContainer: {
    alignItems: "center",
    marginTop: 24,
    gap: 12,
  },
  processingText: {
    color: "#666",
    fontSize: 14,
  },
  resultsContainer: {
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 16,
  },
  accuracyCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#2d2a40",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  accuracyPercentage: {
    color: "#4ade80",
    fontSize: 32,
    fontWeight: "700",
  },
  accuracyLabel: {
    color: "#fff",
    fontSize: 14,
    opacity: 0.8,
  },
  accuracyDetails: {
    color: "#666",
    fontSize: 14,
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  tryAgainButton: {
    backgroundColor: "#3d3a52",
  },
  playAgainButton: {
    backgroundColor: "white",
    marginVertical: 16,
    borderWidth: 1,
    borderColor: "#3d3a52",
  },
  playAgainButtonText: {
    color: "black",
    fontSize: 14,
    fontWeight: "600",
  },
  nextButton: {
    backgroundColor: "#4ade80",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  recordButtonContainer: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  playSegmentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3d3a52",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    alignSelf: "center",
    marginTop: 16,
  },
  playSegmentButtonText: {
    color: "black",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default ShadowTab;
