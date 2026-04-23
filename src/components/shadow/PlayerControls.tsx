import React, { useState } from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
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
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, styles.buttonLeft]}
        onPress={onReplay}
      >
        <MaterialIcons name="replay" size={24} color="black" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.buttonMiddle]}
        onPress={onReplaySlow}
      >
        <MaterialIcons name="slow-motion-video" size={24} color="black" />
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
          styles.buttonMiddle,
          playDisabled && { opacity: 0.4 },
        ]}
        onPress={onPlayPause}
        disabled={playDisabled && !isPlaying}
      >
        <MaterialIcons
          name={isPlaying ? "pause" : "play-arrow"}
          size={24}
          color={playDisabled && !isPlaying ? "#ccc" : "black"}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#d0d8f0",
    borderRadius: 24,
  },
  button: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
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
