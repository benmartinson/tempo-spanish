import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import FontAwesome from "@expo/vector-icons/FontAwesome";

type RecordingPhase = "countdown" | "recording" | "buffer" | "complete";

interface CountdownTimerProps {
  onStartRecording: () => void;
  onStopRecording: () => void;
  onTrash?: () => void;
  bufferDuration?: number;
  countdownDuration?: number;
  maxRecordingDuration?: number;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({
  onStartRecording,
  onStopRecording,
  onTrash,
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
  const showTimeWarning = phase === "buffer";
  const warningSeconds = Math.max(0, Math.ceil(bufferCountdown));

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

  // When the recording duration runs out, drop into the buffer phase so the
  // user gets the visible 5s warning before we actually submit.
  useEffect(() => {
    if (remainingSeconds <= 0 && phase === "recording") {
      setPhase("buffer");
      setBufferCountdown(bufferDuration);
    }
  }, [remainingSeconds, phase, bufferDuration]);

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
  }, [bufferCountdown, phase]);

  return (
    <View style={styles.container}>
      <View style={styles.recordingPhase}>
        <View style={styles.recordingIndicatorRow}>
          <Animated.View
            style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]}
          />
          <Text style={styles.recordingText}>Recording</Text>
          {showTimeWarning && warningSeconds > 0 && (
            <Animated.View
              style={[
                styles.timeWarningBadge,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Text style={styles.timeWarningText}>{warningSeconds}s</Text>
            </Animated.View>
          )}
        </View>
        <View style={styles.buttonRow}>
          {onTrash && (
            <TouchableOpacity onPress={onTrash} style={styles.trashButton}>
              <FontAwesome name="trash-o" size={22} color={"red"} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onStopRecording}
            style={styles.submitButton}
          >
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#2d2a40",
    borderRadius: 16,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  recordingIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ff4757",
  },
  recordingText: {
    fontSize: 16,
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
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pauseButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  trashButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "white",
    borderRadius: 100,
  },
  submitButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  timeWarningBadge: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeWarningText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ff4757",
    letterSpacing: 0.5,
  },
});

export default CountdownTimer;
