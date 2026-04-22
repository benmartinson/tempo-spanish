import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
} from "react-native";
import SlideModal from "../common/SlideModal";
import SpeedControl from "../common/SpeedControl";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../types";
import { setUserSettings } from "../../store/actions/dataActions";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  recordSpeed: number;
  setRecordSpeed: (speed: number) => void;
  initMute: boolean;
  setMuteWhenRecording: (mute: boolean) => void;
  onSave: (settings: {
    showWordsHints: boolean;
    showCharacters: boolean;
    showPhrases: boolean;
  }) => void;
  hideToggles?: boolean;
}

const SettingRow: React.FC<{
  label: string;
  value: boolean;
  onToggle: (val: boolean) => void;
  isLast?: boolean;
}> = ({ label, value, onToggle, isLast = false }) => (
  <View style={[rowStyles.row, !isLast && rowStyles.border]}>
    <Text style={rowStyles.label}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: "#ddd", true: "#3d3a52" }}
      thumbColor="#fff"
    />
  </View>
);

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ebebef",
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1a1a2e",
  },
});

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  recordSpeed,
  setRecordSpeed,
  initMute,
  setMuteWhenRecording,
  onSave,
  hideToggles = false,
}) => {
  const dispatch = useDispatch();
  const userSettings = useSelector((state: RootState) => state.userSettings);

  const recordSpeedOptions = [0.25, 0.35, 0.45, 0.6, 0.75, 1];
  const [editedRecordSpeed, setEditedRecordSpeed] = useState(
    userSettings.playbackSpeedDuringRecording,
  );
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
  const [editedAutoSaveRecordings, setEditedAutoSaveRecordings] = useState(
    userSettings.autoSaveRecordings,
  );
  const [editedShowReviewMode, setEditedShowReviewMode] = useState(
    userSettings.showReviewMode,
  );
  const [editedReviewFrequency, setEditedReviewFrequency] = useState(
    userSettings.reviewFrequency,
  );
  const [editedSaveMemorizeDifficulty, setEditedSaveMemorizeDifficulty] =
    useState(userSettings.saveMemorizeDifficulty);
  const [editedDefaultMemorizeDifficulty, setEditedDefaultMemorizeDifficulty] =
    useState(userSettings.defaultMemorizeDifficulty);
  const [editedAutoSelectDifficulty, setEditedAutoSelectDifficulty] = useState(
    userSettings.autoSelectDifficulty,
  );
  const [editedAutoSelectDifficultyLevel, setEditedAutoSelectDifficultyLevel] =
    useState(userSettings.autoSelectDifficultyLevel);

  const difficultyOptions = [
    { value: 0, label: "No Hidden Words" },
    { value: 1, label: "Hide Every Third Word" },
    { value: 2, label: "Hide Every Other Word" },
    { value: 3, label: "Hide Two out of Three Words" },
    { value: 4, label: "Hide Every Word" },
  ];

  const userSettingsRef = useRef(userSettings);
  userSettingsRef.current = userSettings;

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Auto-save whenever any edited setting changes
  useEffect(() => {
    setRecordSpeed(editedRecordSpeed);
    setMuteWhenRecording(muteVideoWhenRecording);
    // When auto-select is on, force save-difficulty off
    if (editedAutoSelectDifficulty && editedSaveMemorizeDifficulty) {
      setEditedSaveMemorizeDifficulty(false);
      return; // will re-run with updated value
    }
    const newSettings = {
      ...userSettingsRef.current,
      playbackSpeedDuringRecording: editedRecordSpeed,
      showWordsHints: editedShowWordsHints,
      showCharacters: editedShowCharacters,
      showPhrases: editedShowPhrases,
      saveMemorizeDifficulty: editedSaveMemorizeDifficulty,
      defaultMemorizeDifficulty: editedDefaultMemorizeDifficulty,
      autoSaveRecordings: editedAutoSaveRecordings,
      showReviewMode: editedShowReviewMode,
      reviewFrequency: editedReviewFrequency,
      autoSelectDifficulty: editedAutoSelectDifficulty,
      autoSelectDifficultyLevel: editedAutoSelectDifficultyLevel,
    };
    dispatch(setUserSettings(newSettings));
    onSaveRef.current(newSettings);
  }, [
    editedRecordSpeed,
    editedAutoSaveRecordings,
    editedShowReviewMode,
    editedReviewFrequency,
    muteVideoWhenRecording,
    editedShowWordsHints,
    editedShowCharacters,
    editedShowPhrases,
    editedSaveMemorizeDifficulty,
    editedDefaultMemorizeDifficulty,
    editedAutoSelectDifficulty,
    editedAutoSelectDifficultyLevel,
    dispatch,
    setRecordSpeed,
    setMuteWhenRecording,
  ]);

  return (
    <SlideModal visible={visible} onRequestClose={onClose} title="Settings">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* General */}
        <Text style={styles.sectionHeader}>GENERAL</Text>
        <View style={styles.card}>
          <View style={styles.cardInner}>
            <SpeedControl
              speed={editedRecordSpeed}
              onSpeedChange={setEditedRecordSpeed}
              options={recordSpeedOptions}
              label="Recording Speed"
            />
          </View>
          <View style={styles.cardDivider} />
          <SettingRow
            label="Show Review Popups?"
            value={editedShowReviewMode}
            onToggle={setEditedShowReviewMode}
            isLast={!editedShowReviewMode}
          />
          {editedShowReviewMode && (
            <>
              <View style={styles.cardDivider} />
              <View style={styles.frequencyRow}>
                <Text style={rowStyles.label}>Review Popup Frequency</Text>
                <View style={styles.frequencyControls}>
                  <TouchableOpacity
                    style={styles.frequencyButton}
                    onPress={() =>
                      setEditedReviewFrequency(
                        Math.max(2, editedReviewFrequency - 1),
                      )
                    }
                    disabled={editedReviewFrequency <= 1}
                  >
                    <Text style={styles.frequencyButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.frequencyValue}>
                    {editedReviewFrequency}
                  </Text>
                  <TouchableOpacity
                    style={styles.frequencyButton}
                    onPress={() =>
                      setEditedReviewFrequency(
                        Math.min(10, editedReviewFrequency + 1),
                      )
                    }
                    disabled={editedReviewFrequency >= 10}
                  >
                    <Text style={styles.frequencyButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.frequencyHint}>
                Review every {editedReviewFrequency} segments
                {editedReviewFrequency === 2 && ". Max Frequency."}
              </Text>
            </>
          )}
        </View>

        {/* Transcript */}
        {!hideToggles && (
          <>
            <Text style={styles.sectionHeader}>TRANSCRIPT</Text>
            <View style={styles.card}>
              <SettingRow
                label="Auto-Select Hint Difficulty?"
                value={editedAutoSelectDifficulty}
                onToggle={setEditedAutoSelectDifficulty}
                isLast={!editedAutoSelectDifficulty}
              />
              {editedAutoSelectDifficulty && (
                <>
                  <View style={styles.cardDivider} />
                  <View style={styles.difficultyInner}>
                    {(
                      [
                        { value: "moderate", label: "Moderate" },
                        { value: "challenging", label: "Challenging" },
                        { value: "difficult", label: "Difficult" },
                        { value: "hardest", label: "Hardest" },
                      ] as const
                    ).map((option, index) => {
                      const isActive =
                        editedAutoSelectDifficultyLevel === option.value;
                      const isLast = index === 3;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.difficultyOption,
                            !isLast && styles.difficultyOptionBorder,
                          ]}
                          onPress={() =>
                            setEditedAutoSelectDifficultyLevel(option.value)
                          }
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.difficultyOptionText,
                              isActive && styles.difficultyOptionTextActive,
                            ]}
                          >
                            {option.label}
                          </Text>
                          <View
                            style={[
                              styles.radio,
                              isActive && styles.radioActive,
                            ]}
                          >
                            {isActive && <View style={styles.radioDot} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
            {!editedAutoSelectDifficulty && (
              <View style={styles.card}>
                <SettingRow
                  label="Save Hint Difficulty?"
                  value={editedSaveMemorizeDifficulty}
                  onToggle={setEditedSaveMemorizeDifficulty}
                  isLast
                />
              </View>
            )}
            {!editedAutoSelectDifficulty && !editedSaveMemorizeDifficulty && (
              <>
                <Text style={styles.subsectionLabel}>Default Difficulty</Text>
                <View style={styles.card}>
                  <View style={styles.difficultyInner}>
                    {difficultyOptions.map((option, index) => {
                      const isActive =
                        editedDefaultMemorizeDifficulty === option.value;
                      const isLast = index === difficultyOptions.length - 1;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.difficultyOption,
                            !isLast && styles.difficultyOptionBorder,
                          ]}
                          onPress={() =>
                            setEditedDefaultMemorizeDifficulty(option.value)
                          }
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.difficultyOptionText,
                              isActive && styles.difficultyOptionTextActive,
                            ]}
                          >
                            {option.label}
                          </Text>
                          <View
                            style={[
                              styles.radio,
                              isActive && styles.radioActive,
                            ]}
                          >
                            {isActive && <View style={styles.radioDot} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </>
            )}
          </>
        )}

        {/* Insights */}
        {!hideToggles && (
          <>
            <Text style={styles.sectionHeader}>INSIGHTS</Text>
            <View style={styles.card}>
              <SettingRow
                label="Show Word Hints by Default?"
                value={editedShowWordsHints}
                onToggle={setEditedShowWordsHints}
              />
              <SettingRow
                label="Show Characters List by Default?"
                value={editedShowCharacters}
                onToggle={setEditedShowCharacters}
              />
              <SettingRow
                label="Show Phrases by Default?"
                value={editedShowPhrases}
                onToggle={setEditedShowPhrases}
                isLast
              />
            </View>
          </>
        )}
      </ScrollView>
    </SlideModal>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8e8e93",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 14,
  },
  cardInner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ebebef",
    marginHorizontal: 16,
  },
  subsectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8e8e93",
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  difficultyInner: {
    paddingVertical: 2,
  },
  difficultyOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  difficultyOptionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ebebef",
  },
  difficultyOptionText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1a1a2e",
  },
  difficultyOptionTextActive: {
    color: "#3d3a52",
    fontWeight: "600",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#d0d0d4",
    justifyContent: "center",
    alignItems: "center",
  },
  radioActive: {
    borderColor: "#3d3a52",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3d3a52",
  },
  frequencyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  frequencyControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  frequencyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f2",
    alignItems: "center",
    justifyContent: "center",
  },
  frequencyButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#3d3a52",
  },
  frequencyValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
    minWidth: 24,
    textAlign: "center",
  },
  frequencyHint: {
    fontSize: 12,
    color: "#8e8e93",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
});

export default SettingsModal;
