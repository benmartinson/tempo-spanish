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

type SettingsTab = "general" | "insights" | "memorize";

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
  speedOptions?: number[];
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
  playbackSpeed,
  recordSpeed,
  setPlaybackSpeed,
  setRecordSpeed,
  initMute,
  setMuteWhenRecording,
  onSave,
  speedOptions: customSpeedOptions,
  hideToggles = false,
}) => {
  const dispatch = useDispatch();
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  const speedOptions = customSpeedOptions || [0.6, 0.7, 0.75, 0.8, 0.9, 1.0];
  const recordSpeedOptions = [0.25, 0.35, 0.45, 0.6, 0.75, 1];
  const [editedPlaybackSpeed, setEditedPlaybackSpeed] = useState(playbackSpeed);
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
  const [editedPlayVideoWhileRecording, setEditedPlayVideoWhileRecording] =
    useState(userSettings.playVideoWhileRecording);
  const [editedAutoSaveRecordings, setEditedAutoSaveRecordings] = useState(
    userSettings.autoSaveRecordings,
  );
  const [editedSaveMemorizeDifficulty, setEditedSaveMemorizeDifficulty] =
    useState(userSettings.saveMemorizeDifficulty);
  const [editedDefaultMemorizeDifficulty, setEditedDefaultMemorizeDifficulty] =
    useState(userSettings.defaultMemorizeDifficulty);

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
    setPlaybackSpeed(editedPlaybackSpeed);
    setRecordSpeed(editedRecordSpeed);
    setMuteWhenRecording(muteVideoWhenRecording);
    const newSettings = {
      ...userSettingsRef.current,
      playbackSpeed: editedPlaybackSpeed,
      playbackSpeedDuringRecording: editedPlayVideoWhileRecording
        ? editedRecordSpeed
        : 0,
      showWordsHints: editedShowWordsHints,
      showCharacters: editedShowCharacters,
      showPhrases: editedShowPhrases,
      saveMemorizeDifficulty: editedSaveMemorizeDifficulty,
      defaultMemorizeDifficulty: editedDefaultMemorizeDifficulty,
      playVideoWhileRecording: editedPlayVideoWhileRecording,
      autoSaveRecordings: editedAutoSaveRecordings,
    };
    dispatch(setUserSettings(newSettings));
    onSaveRef.current(newSettings);
  }, [
    editedPlaybackSpeed,
    editedRecordSpeed,
    editedPlayVideoWhileRecording,
    editedAutoSaveRecordings,
    muteVideoWhenRecording,
    editedShowWordsHints,
    editedShowCharacters,
    editedShowPhrases,
    editedSaveMemorizeDifficulty,
    editedDefaultMemorizeDifficulty,
    dispatch,
    setPlaybackSpeed,
    setRecordSpeed,
    setMuteWhenRecording,
  ]);

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: "general", label: "General" },
    ...(hideToggles
      ? []
      : [
          { key: "memorize" as const, label: "Transcript" },
          { key: "insights" as const, label: "Insights" },
        ]),
  ];

  return (
    <SlideModal visible={visible} onRequestClose={onClose} title="Settings">
      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "general" && (
          <>
            <View style={styles.card}>
              <View style={styles.cardInner}>
                <SpeedControl
                  speed={editedPlaybackSpeed}
                  onSpeedChange={setEditedPlaybackSpeed}
                  options={speedOptions}
                />
              </View>
              <View style={styles.cardDivider} />
              <SettingRow
                label="Play Video While Recording"
                value={editedPlayVideoWhileRecording}
                onToggle={(val) => {
                  setEditedPlayVideoWhileRecording(val);
                  if (val) setEditedRecordSpeed(0.25);
                }}
                isLast={!editedPlayVideoWhileRecording}
              />
              {!editedPlayVideoWhileRecording && (
                <Text style={styles.warningText}>
                  Saving recordings is disabled when this setting is turned off
                </Text>
              )}
              {editedPlayVideoWhileRecording && (
                <>
                  <View style={styles.cardDivider} />
                  <View style={styles.cardInner}>
                    <SpeedControl
                      speed={editedRecordSpeed}
                      onSpeedChange={setEditedRecordSpeed}
                      options={recordSpeedOptions}
                      label="Recording Speed"
                    />
                  </View>
                  <View style={styles.cardDivider} />
                </>
              )}
            </View>
          </>
        )}

        {activeTab === "insights" && (
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
        )}

        {activeTab === "memorize" && (
          <>
            <View style={styles.card}>
              <SettingRow
                label="Save Hint Difficulty?"
                value={editedSaveMemorizeDifficulty}
                onToggle={setEditedSaveMemorizeDifficulty}
                isLast
              />
            </View>
            {!editedSaveMemorizeDifficulty && (
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
      </ScrollView>
    </SlideModal>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
    gap: 4,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e4",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#3d3a52",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999",
  },
  tabTextActive: {
    color: "#3d3a52",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  card: {
    marginHorizontal: 16,
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
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 20,
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
  warningText: {
    fontSize: 12,
    color: "#e53935",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
});

export default SettingsModal;
