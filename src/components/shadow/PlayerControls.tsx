import React, { useState } from "react";
import {
  StyleProp,
  StyleSheet,
  View,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

interface PlayerControlsProps {
  onReplay?: () => void;
  onReplaySlow?: () => void;
  onPlayPause: () => void;
  isPlaying: boolean;
  playDisabled?: boolean;
  segmentText?: string;
  videoId?: number;
  sentenceIndex?: number;
  onBeforeAction?: () => Promise<void>;
  containerStyle?: StyleProp<ViewStyle>;
  compact?: boolean;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
  onReplay,
  onReplaySlow,
  onPlayPause,
  isPlaying,
  playDisabled,
  segmentText,
  videoId,
  sentenceIndex,
  onBeforeAction,
  containerStyle,
  compact = false,
}) => {
  const iconSize = compact ? 18 : 24;

  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
        containerStyle,
      ]}
    >
      <TouchableOpacity
        style={[
          styles.button,
          compact && styles.buttonCompact,
          styles.buttonLeft,
        ]}
        onPress={onReplay}
      >
        <MaterialIcons name="replay" size={iconSize} color="black" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.button,
          compact && styles.buttonCompact,
          styles.buttonMiddle,
        ]}
        onPress={onReplaySlow}
      >
        <MaterialIcons name="slow-motion-video" size={iconSize} color="black" />
      </TouchableOpacity>
      {/* <TouchableOpacity
        style={[styles.button, styles.buttonRight]}
        onPress={handleAiSpeak}
        disabled={!segmentText || aiLoading}
      >
        {aiLoading ? (
          <ActivityIndicator size="small" color="#7C3AED" />
        ) : (
          <MaterialIcons
            name="record-voice-over"
            size={24}
            color={segmentText ? "black" : "#ccc"}
          />
        )}
      </TouchableOpacity> */}
      <TouchableOpacity
        style={[
          styles.button,
          compact && styles.buttonCompact,
          styles.buttonMiddle,
          playDisabled && { opacity: 0.4 },
        ]}
        onPress={onPlayPause}
        disabled={playDisabled && !isPlaying}
      >
        <MaterialIcons
          name={isPlaying ? "pause" : "play-arrow"}
          size={iconSize}
          color={playDisabled && !isPlaying ? "#ccc" : "black"}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    maxWidth: "100%",
    borderWidth: 1,
    borderColor: "#d0d8f0",
    borderRadius: 24,
  },
  containerCompact: {
    borderRadius: 16,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  buttonCompact: {
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  buttonLeft: {
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
  },
  buttonMiddle: {},
  buttonRight: {
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
  },
});

export default PlayerControls;
