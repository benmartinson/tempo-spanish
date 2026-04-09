import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import ActivateModeButton from "../common/ActivateModeButton";

interface StreamContentProps {
  isActive: boolean;
  playerIsPlaying: boolean;
  playStream: () => void;
  pausePlayer: () => void;
  playSentence: () => void;
}

const StreamContent: React.FC<StreamContentProps> = ({
  isActive,
  playerIsPlaying,
  playStream,
  pausePlayer,
  playSentence,
}) => {
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    if (!isActive && streaming) {
      setStreaming(false);
    }
  }, [isActive]);

  const handleActivate = () => {
    setStreaming(true);
    playStream();
  };

  const handleDisable = () => {
    setStreaming(false);
    pausePlayer();
    playSentence();
  };

  if (!streaming) {
    return (
      <View style={styles.container}>
        <ActivateModeButton
          label="Activate Stream Mode"
          onPress={handleActivate}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.streamingMessage}>
        When you're ready to shadow a segment, disable stream mode and switch to
        one of the other tabs...
      </Text>
      <ActivateModeButton label="Disable Stream Mode" onPress={handleDisable} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,

    gap: 16,
  },
  streamingMessage: {
    fontSize: 15,
    color: "#555",
    textAlign: "center",
    lineHeight: 22,
  },
});

export default StreamContent;
