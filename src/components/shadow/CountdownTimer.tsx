import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type RecordingPhase = "countdown" | "recording" | "buffer" | "complete";

interface CountdownTimerProps {
  onStartRecording: () => void;
  onStopRecording: () => void;
  sentenceEnded: boolean;
  bufferDuration?: number;
  countdownDuration?: number;
  maxRecordingDuration?: number;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({
  onStartRecording,
  onStopRecording,
  sentenceEnded,
  bufferDuration = 5,
  countdownDuration = 0,
  maxRecordingDuration = 60,
}) => {
  const [phase, setPhase] = useState<RecordingPhase>("countdown");
  const [countdown, setCountdown] = useState<number>(countdownDuration);
  const [bufferCountdown, setBufferCountdown] =
    useState<number>(bufferDuration);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hasStartedRecording = useRef(false);
  const hasStoppedRecording = useRef(false);
  const remainingSeconds = maxRecordingDuration - elapsedSeconds;
  const showTimeWarning = phase === "recording" && remainingSeconds <= 10;

  // Pulse animation for recording indicator
  useEffect(() => {
    if (phase === "recording" || phase === "buffer") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [phase, pulseAnim]);

  useEffect(() => {
    if (remainingSeconds <= 0 && phase === "recording") {
      if (!hasStoppedRecording.current) {
        hasStoppedRecording.current = true;
        setPhase("complete");
        onStopRecording();
      }
    }
  }, [remainingSeconds]);

  // Track elapsed recording time
  useEffect(() => {
    if (phase !== "recording") return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  // Pre-recording countdown (3, 2, 1)
  useEffect(() => {
    console.log({ phase, countdown });
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      // Start recording when countdown reaches 0
      if (!hasStartedRecording.current) {
        console.log("countdown stopped ", countdown);
        hasStartedRecording.current = true;
        onStartRecording();
        setPhase("recording");
      }
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, phase, onStartRecording]);

  // Transition to buffer phase when sentence ends
  useEffect(() => {
    if (phase === "recording" && sentenceEnded) {
      setPhase("buffer");
      setBufferCountdown(bufferDuration);
    }
  }, [sentenceEnded, phase, bufferDuration]);

  // Buffer countdown (5, 4, 3, 2, 1)
  useEffect(() => {
    if (phase !== "buffer") return;

    if (bufferCountdown <= 0) {
      // Stop recording when buffer countdown reaches 0
      if (!hasStoppedRecording.current) {
        console.log("buffer countdown stopped ", bufferCountdown);
        hasStoppedRecording.current = true;
        setPhase("complete");
        onStopRecording();
      }
      return;
    }

    const timer = setTimeout(() => {
      setBufferCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [bufferCountdown, phase, onStopRecording]);

  const renderContent = () => {
    switch (phase) {
      // case "countdown":
      //   return (
      //     <View style={styles.countdownPhase}>
      //       <Text style={styles.countdownNumber}>{countdown}</Text>
      //       <Text style={styles.countdownLabel}>Get ready to record...</Text>
      //     </View>
      //   );

      case "recording":
        return (
          <View style={styles.recordingPhase}>
            <View style={styles.recordingIndicatorRow}>
              <Animated.View
                style={[
                  styles.recordingDot,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              />
              <Text style={styles.recordingText}>Recording</Text>
            </View>
            {showTimeWarning && remainingSeconds > 0 ? (
              <Text style={styles.timeWarningText}>
                Stopping in {remainingSeconds}s
              </Text>
            ) : (
              <Text style={styles.recordingInstructions}>
                Read aloud the highlighted words
              </Text>
            )}
            <TouchableOpacity
              onPress={onStopRecording}
              style={styles.stopButton}
            >
              <Text style={styles.stopButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        );

      // case "buffer":
      //   return (
      //     <View style={styles.bufferPhase}>
      //       <View style={styles.recordingIndicatorRow}>
      //         <Animated.View
      //           style={[
      //             styles.recordingDot,
      //             styles.bufferDot,
      //             { transform: [{ scale: pulseAnim }] },
      //           ]}
      //         />
      //         <Text style={styles.bufferText}>
      //           Recording stopping in {bufferCountdown}
      //         </Text>
      //       </View>
      //       <TouchableOpacity
      //         onPress={onStopRecording}
      //         style={styles.stopButton}
      //       >
      //         <Text style={styles.stopButtonText}>Stop Recording</Text>
      //       </TouchableOpacity>
      //     </View>
      //   );

      // case "complete":
      //   return (
      //     <View style={styles.completePhase}>
      //       <MaterialIcons name="check-circle" size={32} color="#4ade80" />
      //       <Text style={styles.completeText}>Recording complete</Text>
      //     </View>
      //   );

      default:
        return null;
    }
  };

  return <View style={styles.container}>{renderContent()}</View>;
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    margin: 16,
    backgroundColor: "#2d2a40",
    borderRadius: 16,
    minHeight: 120,
  },
  countdownPhase: {
    alignItems: "center",
  },
  countdownNumber: {
    fontSize: 64,
    fontWeight: "700",
    color: "#4ade80",
  },
  countdownLabel: {
    fontSize: 16,
    color: "#fff",
    opacity: 0.8,
    marginTop: 8,
  },
  recordingPhase: {
    alignItems: "center",
  },
  recordingIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recordingDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ff4757",
  },
  recordingText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#fff",
  },
  recordingInstructions: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.8,
    marginTop: 12,
  },
  bufferPhase: {
    alignItems: "center",
  },
  bufferDot: {
    backgroundColor: "#ffa502",
  },
  bufferText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffa502",
  },
  bufferInstructions: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.8,
    marginTop: 12,
  },
  completePhase: {
    alignItems: "center",
    gap: 8,
  },
  completeText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4ade80",
  },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  stopButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  timeWarningText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ff4757",
    marginTop: 12,
  },
});

export default CountdownTimer;
