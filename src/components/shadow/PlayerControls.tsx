import React from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

interface PlayerControlsProps {
  onReplay: () => void;
  onReplaySlow: () => void;
  onPlayPause: () => void;
  isPlaying: boolean;
  playDisabled?: boolean;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
  onReplay,
  onReplaySlow,
  onPlayPause,
  isPlaying,
  playDisabled,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.controlsRow}>
        <TouchableOpacity style={styles.button} onPress={onReplay}>
          <MaterialIcons name="replay" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={onReplaySlow}>
          <MaterialIcons name="slow-motion-video" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, playDisabled && { opacity: 0.4 }]}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3d3a52",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 24,
  },
  button: {
    padding: 4,
  },
});

export default PlayerControls;
