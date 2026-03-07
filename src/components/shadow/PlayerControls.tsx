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
      <TouchableOpacity
        style={[
          styles.button,
          styles.buttonRight,
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
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#3d3a52",
    borderRadius: 24,
  },
  button: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
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
