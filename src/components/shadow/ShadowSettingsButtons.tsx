import React, { useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Foundation from "@expo/vector-icons/Foundation";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import ModeSwitcher from "./ModeSwitcher";
import SpeedDial from "./SpeedDial";

type Mode = "shadow" | "stream";
type ModeOption = Mode | "help";

const MODE_OPTIONS: { key: ModeOption; label: string }[] = [
  { key: "shadow", label: "Shadow" },
  { key: "stream", label: "Stream" },
  { key: "help", label: "Help" },
];

const SPEED_OPTIONS = [0.25, 0.35, 0.45, 0.6, 0.75, 1];

interface ShadowSettingsButtonsProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onHelpSelect: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  onSettingsPress: () => void;
  showPreviousResults?: boolean;
  onPreviousResultsPress?: () => void;
  previousResultsDisabled?: boolean;
}

const ShadowSettingsButtons: React.FC<ShadowSettingsButtonsProps> = ({
  mode,
  onModeChange,
  onHelpSelect,
  speed,
  onSpeedChange,
  onSettingsPress,
  showPreviousResults = false,
  onPreviousResultsPress,
  previousResultsDisabled = false,
}) => {
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const isWeb = Platform.OS === "web";

  const formatSpeed = (s: number) =>
    s === 0 ? "Off" : `${String(s).replace(/^0/, "")}x`;

  const renderModeIcon = (key: ModeOption, color: string, size = 18) => {
    if (key === "shadow") {
      return (
        <MaterialIcons name="record-voice-over" size={size} color={color} />
      );
    }
    if (key === "help") {
      return <Feather name="help-circle" size={size} color={color} />;
    }
    return (
      <MaterialCommunityIcons name="play-speed" size={size} color={color} />
    );
  };

  const handleModeSelect = (key: ModeOption) => {
    setModeMenuOpen(false);
    if (key === "help") {
      onHelpSelect();
      return;
    }
    onModeChange(key);
  };

  const handleSpeedSelect = (nextSpeed: number) => {
    setSpeedMenuOpen(false);
    onSpeedChange(nextSpeed);
  };

  return (
    <View style={styles.container}>
      {showPreviousResults && (
        <TouchableOpacity
          style={styles.previousResultsButton}
          onPress={onPreviousResultsPress}
          disabled={previousResultsDisabled}
        >
          <Foundation name="clipboard-notes" size={32} color="#4a69bd" />
        </TouchableOpacity>
      )}
      {isWeb ? (
        <>
          <View style={styles.webMenuHost}>
            <TouchableOpacity
              style={styles.webBubble}
              onPress={() => {
                setModeMenuOpen((open) => !open);
                setSpeedMenuOpen(false);
              }}
            >
              {renderModeIcon(mode, "#647089")}
            </TouchableOpacity>
            {modeMenuOpen && (
              <View style={styles.webPopover}>
                {MODE_OPTIONS.map((option) => {
                  const isSelected = option.key === mode;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.webOption,
                        isSelected && styles.webOptionSelected,
                      ]}
                      onPress={() => handleModeSelect(option.key)}
                    >
                      {renderModeIcon(
                        option.key,
                        isSelected ? "#ffffff" : "#3d3a52",
                        16,
                      )}
                      <Text
                        style={[
                          styles.webOptionText,
                          isSelected && styles.webOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
          {/* <View style={styles.webMenuHost}>
            <TouchableOpacity
              style={[styles.webBubble, styles.webSpeedBubble]}
              onPress={() => {
                setSpeedMenuOpen((open) => !open);
                setModeMenuOpen(false);
              }}
            >
              <Text style={styles.webSpeedText}>{formatSpeed(speed)}</Text>
            </TouchableOpacity>
            {speedMenuOpen && (
              <View style={[styles.webPopover, styles.webSpeedPopover]}>
                {SPEED_OPTIONS.map((option) => {
                  const isSelected = option === speed;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.webOption,
                        isSelected && styles.webOptionSelected,
                      ]}
                      onPress={() => handleSpeedSelect(option)}
                    >
                      <Text
                        style={[
                          styles.webOptionText,
                          isSelected && styles.webOptionTextSelected,
                        ]}
                      >
                        {formatSpeed(option)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View> */}
        </>
      ) : (
        <>
          <ModeSwitcher
            mode={mode}
            onModeChange={onModeChange}
            onHelpSelect={onHelpSelect}
          />
          {/* <SpeedDial speed={speed} onSpeedChange={onSpeedChange} /> */}
        </>
      )}
      <TouchableOpacity onPress={onSettingsPress}>
        <Feather name="settings" size={30} color="#222222" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  previousResultsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
    paddingVertical: 12,
    borderRadius: 24,
  },
  webMenuHost: {
    position: "relative",
  },
  webBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fafafa",
    alignItems: "center",
    justifyContent: "center",
  },
  webSpeedBubble: {
    width: 44,
  },
  webSpeedText: {
    color: "#3d3a52",
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.75,
  },
  webPopover: {
    position: "absolute",
    top: 42,
    right: 0,
    minWidth: 132,
    zIndex: 300,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.18)",
    padding: 4,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  webSpeedPopover: {
    minWidth: 84,
  },
  webOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  webOptionSelected: {
    backgroundColor: "#4a69bd",
  },
  webOptionText: {
    color: "#3d3a52",
    fontSize: 13,
    fontWeight: "600",
  },
  webOptionTextSelected: {
    color: "#ffffff",
  },
});

export default ShadowSettingsButtons;
