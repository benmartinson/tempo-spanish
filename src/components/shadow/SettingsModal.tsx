import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import SlideModal from "../common/Modal";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  playbackSpeed: number;
  recordSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  setRecordSpeed: (speed: number) => void;
}
const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  playbackSpeed,
  recordSpeed,
  setPlaybackSpeed,
  setRecordSpeed,
}) => {
  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5];
  return (
    <SlideModal
      visible={visible}
      onRequestClose={onClose}
      title="Shadow Settings"
    >
      {/* Speed Controls */}
      <View style={styles.speedControlsContainer}>
        <View style={styles.speedControlRow}>
          <Text style={styles.speedLabel}>Playback Speed:</Text>
          <View style={styles.speedOptions}>
            {speedOptions.map((speed) => (
              <TouchableOpacity
                key={`playback-${speed}`}
                style={[
                  styles.speedOption,
                  playbackSpeed === speed && styles.speedOptionActive,
                ]}
                onPress={() => setPlaybackSpeed(speed)}
              >
                <Text
                  style={[
                    styles.speedOptionText,
                    playbackSpeed === speed && styles.speedOptionTextActive,
                  ]}
                >
                  {speed}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.speedControlRow}>
          <Text style={styles.speedLabel}>Record Speed:</Text>
          <View style={styles.speedOptions}>
            {speedOptions.map((speed) => (
              <TouchableOpacity
                key={`record-${speed}`}
                style={[
                  styles.speedOption,
                  recordSpeed === speed && styles.speedOptionActive,
                ]}
                onPress={() => setRecordSpeed(speed)}
              >
                <Text
                  style={[
                    styles.speedOptionText,
                    recordSpeed === speed && styles.speedOptionTextActive,
                  ]}
                >
                  {speed}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </SlideModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  speedControlsContainer: {
    marginTop: 16,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  speedControlRow: {
    gap: 8,
  },
  speedLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  speedOptions: {
    flexDirection: "row",
    gap: 8,
  },
  speedOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  speedOptionActive: {
    backgroundColor: "#3d3a52",
    borderColor: "#3d3a52",
  },
  speedOptionText: {
    color: "#666",
    fontSize: 13,
    fontWeight: "500",
  },
  speedOptionTextActive: {
    color: "#fff",
  },
});

export default SettingsModal;
