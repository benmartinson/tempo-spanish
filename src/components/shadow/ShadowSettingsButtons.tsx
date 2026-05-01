import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Foundation from "@expo/vector-icons/Foundation";

import ModeSwitcher from "./ModeSwitcher";
import SpeedDial from "./SpeedDial";

interface ShadowSettingsButtonsProps {
  mode: "shadow" | "stream";
  onModeChange: (mode: "shadow" | "stream") => void;
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
      <ModeSwitcher
        mode={mode}
        onModeChange={onModeChange}
        onHelpSelect={onHelpSelect}
      />
      <SpeedDial speed={speed} onSpeedChange={onSpeedChange} />
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
    gap: 8,
  },
  previousResultsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
    paddingVertical: 12,
    borderRadius: 24,
  },
});

export default ShadowSettingsButtons;
