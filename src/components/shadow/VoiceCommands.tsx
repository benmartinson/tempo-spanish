import React from "react";
import { View, Text, StyleSheet } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

interface VoiceCommandsProps {
  isListening: boolean;
  isClipPlaying: boolean;
  activeCommand: "record" | "repeat" | null;
}

const VoiceCommands: React.FC<VoiceCommandsProps> = ({
  isListening,
  isClipPlaying,
  activeCommand,
}) => {
  if (isClipPlaying) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Clip playing... no commands available.</Text>
      </View>
    );
  }

  if (!isListening) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Waiting for clip to finish...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.listeningHeader}>
        <MaterialIcons name="hearing" size={16} color="#4a69bd" />
        <Text style={styles.listeningHeaderText}>Listening for commands</Text>
      </View>
      <View
        style={[
          styles.commandRow,
          activeCommand === "repeat" && styles.commandRowActive,
        ]}
      >
        <Text
          style={[
            styles.commandText,
            activeCommand === "repeat" && styles.commandTextActive,
          ]}
        >
          "Repeat"
        </Text>
        <Text style={styles.commandDescription}>— replay the clip</Text>
      </View>
      <View
        style={[
          styles.commandRow,
          activeCommand === "record" && styles.commandRowActive,
        ]}
      >
        <Text
          style={[
            styles.commandText,
            activeCommand === "record" && styles.commandTextActive,
          ]}
        >
          "Record"
        </Text>
        <Text style={styles.commandDescription}>— start recording</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingVertical: 20,
  },
  listeningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  listeningHeaderText: {
    fontSize: 13,
    color: "#4a69bd",
    fontWeight: "600",
  },
  commandRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: "#f8f8f8",
  },
  commandRowActive: {
    backgroundColor: "#e8eeff",
  },
  commandText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  commandTextActive: {
    color: "#4a69bd",
  },
  commandDescription: {
    fontSize: 14,
    color: "#888",
    marginLeft: 6,
  },
});

export default VoiceCommands;
