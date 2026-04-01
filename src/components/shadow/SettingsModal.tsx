import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch } from "react-native";
import SlideModal from "../common/SlideModal";
import SpeedControl from "../common/SpeedControl";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../types";
import { setUserSettings } from "../../store/actions/dataActions";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  playbackSpeed: number;
  recordSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  setRecordSpeed: (speed: number) => void;
  initMute: boolean;
  setMuteWhenRecording: (mute: boolean) => void;
  onSave: (settings: {
    playbackSpeed: number;
    showWordsHints: boolean;
    showCharacters: boolean;
    showPhrases: boolean;
  }) => void;
}
const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  playbackSpeed,
  recordSpeed,
  setPlaybackSpeed,
  setRecordSpeed,
  initMute,
  setMuteWhenRecording,
  onSave,
}) => {
  const dispatch = useDispatch();
  const userSettings = useSelector((state: RootState) => state.userSettings);

  const speedOptions = [0.6, 0.7, 0.75, 0.8, 0.9, 1.0];
  const [editedPlaybackSpeed, setEditedPlaybackSpeed] = useState(playbackSpeed);
  const [editedRecordSpeed, setEditedRecordSpeed] = useState(recordSpeed);
  const [muteVideoWhenRecording, setMuteVideoWhenRecording] =
    useState(initMute);
  const [editedShowWordsHints, setEditedShowWordsHints] = useState(
    userSettings.showWordsHints,
  );
  const [editedShowCharacters, setEditedShowCharacters] = useState(
    userSettings.showCharacters,
  );
  const [editedShowPhrases, setEditedShowPhrases] = useState(
    userSettings.showPhrases,
  );

  const handlePlaybackSpeedChange = (speed: number) => {
    setEditedPlaybackSpeed(speed);
  };

  const handleRecordSpeedChange = (speed: number) => {
    setEditedRecordSpeed(speed);
  };

  const handleSubmit = () => {
    setPlaybackSpeed(editedPlaybackSpeed);
    setRecordSpeed(editedRecordSpeed);
    setMuteWhenRecording(muteVideoWhenRecording);
    const newSettings = {
      ...userSettings,
      playbackSpeed: editedPlaybackSpeed,
      showWordsHints: editedShowWordsHints,
      showCharacters: editedShowCharacters,
      showPhrases: editedShowPhrases,
    };
    dispatch(setUserSettings(newSettings));
    onSave(newSettings);
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
        <SpeedControl
          speed={editedPlaybackSpeed}
          onSpeedChange={handlePlaybackSpeedChange}
          options={speedOptions}
        />

        {/* <View style={styles.speedControlRow}>
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
        </View> */}
      </View>
      <View style={styles.togglesContainer}>
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>Show Word Hints by Default?</Text>
          <Switch
            value={editedShowWordsHints}
            onValueChange={setEditedShowWordsHints}
          />
        </View>
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>
            Show Characters List by Default?
          </Text>
          <Switch
            value={editedShowCharacters}
            onValueChange={setEditedShowCharacters}
          />
        </View>
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>Show Phrases by Default?</Text>
          <Switch
            value={editedShowPhrases}
            onValueChange={setEditedShowPhrases}
          />
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
  questionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  questionText: {
    color: "black",
    fontSize: 16,
    fontWeight: "500",
  },
  togglesContainer: {
    marginTop: 16,
    paddingHorizontal: 8,
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
    color: "black",
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
    backgroundColor: "#F8F8F8",
    borderWidth: 1,
    borderColor: "black",
  },
  buttonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default SettingsModal;
