import React, { useState } from "react";
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
  const speedOptions = [0.6, 0.7, 0.75, 0.8, 0.9, 1.0];
  const [editedPlaybackSpeed, setEditedPlaybackSpeed] = useState(playbackSpeed);
  const [editedRecordSpeed, setEditedRecordSpeed] = useState(recordSpeed);

  const handlePlaybackSpeedChange = (speed: number) => {
    setEditedPlaybackSpeed(speed);
  };

  const handleRecordSpeedChange = (speed: number) => {
    setEditedRecordSpeed(speed);
  };

  const handleSubmit = () => {
    setPlaybackSpeed(editedPlaybackSpeed);
    setRecordSpeed(editedRecordSpeed);
    onClose();
  };
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
                  editedPlaybackSpeed === speed && styles.speedOptionActive,
                ]}
                onPress={() => handlePlaybackSpeedChange(speed)}
              >
                <Text
                  style={[
                    styles.speedOptionText,
                    editedPlaybackSpeed === speed &&
                      styles.speedOptionTextActive,
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
                  editedRecordSpeed === speed && styles.speedOptionActive,
                ]}
                onPress={() => handleRecordSpeedChange(speed)}
              >
                <Text
                  style={[
                    styles.speedOptionText,
                    editedRecordSpeed === speed && styles.speedOptionTextActive,
                  ]}
                >
                  {speed}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Save</Text>
        </TouchableOpacity>
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
  buttonContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    gap: 16,
    marginTop: 16,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "white",
  },
  buttonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default SettingsModal;
