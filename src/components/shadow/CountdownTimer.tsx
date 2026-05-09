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
import { useDraggableWebPanelWidth } from "../common/DraggableWebPanel";

type RecordingPhase = "countdown" | "recording" | "buffer" | "complete";

const WEB_PANEL_WIDE_HEADER_BREAKPOINT = 1000;

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
  const webPanelWidth = useDraggableWebPanelWidth();
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
  const shouldFillNarrowWebPanel =
    webPanelWidth !== null && webPanelWidth < 450;
  const shouldUseCompactWideWebPanel =
    webPanelWidth !== null && webPanelWidth >= WEB_PANEL_WIDE_HEADER_BREAKPOINT;
  const shouldShowActions = !!onTrash || !shouldUseCompactWideWebPanel;

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
    <View
      style={[
        styles.container,
        shouldFillNarrowWebPanel && styles.narrowWebPanelContainer,
        shouldUseCompactWideWebPanel && styles.compactWideWebPanelContainer,
      ]}
    >
      <View
        style={[
          styles.recordingPhase,
          shouldUseCompactWideWebPanel && styles.compactRecordingPhase,
        ]}
      >
        <View
          style={[
            styles.recordingIndicatorRow,
            shouldUseCompactWideWebPanel && styles.compactRecordingIndicatorRow,
          ]}
        >
          <Animated.View
            style={[
              styles.recordingDot,
              shouldUseCompactWideWebPanel && styles.compactRecordingDot,
              { transform: [{ scale: pulseAnim }] },
            ]}
          />
          <Text
            style={[
              styles.recordingText,
              shouldUseCompactWideWebPanel && styles.compactRecordingText,
            ]}
          >
            Recording
          </Text>
          {showTimeWarning && warningSeconds > 0 && (
            <Animated.View
              style={[
                styles.timeWarningBadge,
                shouldUseCompactWideWebPanel && styles.compactTimeWarningBadge,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Text
                style={[
                  styles.timeWarningText,
                  shouldUseCompactWideWebPanel && styles.compactTimeWarningText,
                ]}
              >
                {warningSeconds}s
              </Text>
            </Animated.View>
          )}
        </View>
        {shouldShowActions && (
          <View
            style={[
              styles.buttonRow,
              shouldUseCompactWideWebPanel && styles.compactButtonRow,
            ]}
          >
            {onTrash && (
              <TouchableOpacity onPress={onTrash} style={styles.trashButton}>
                <FontAwesome name="trash-o" size={22} color={"red"} />
              </TouchableOpacity>
            )}
            {!shouldUseCompactWideWebPanel && (
              <TouchableOpacity
                onPress={onStopRecording}
                style={styles.submitButton}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#2d2a40",
    borderRadius: 16,
  },
  narrowWebPanelContainer: {
    borderRadius: 0,
  },
  compactWideWebPanelContainer: {
    width: "auto",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 0,
    backgroundColor: "#f7f9ff",
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
  compactRecordingPhase: {
    width: "auto",
    gap: 0,
  },
  recordingIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compactRecordingIndicatorRow: {
    gap: 6,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ff4757",
  },
  compactRecordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  compactRecordingText: {
    fontSize: 13,
    color: "#2d2a40",
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
  compactButtonRow: {
    gap: 8,
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
  compactTimeWarningBadge: {
    marginLeft: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  timeWarningText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ff4757",
    letterSpacing: 0.5,
  },
  compactTimeWarningText: {
    fontSize: 13,
  },
});

export default CountdownTimer;
