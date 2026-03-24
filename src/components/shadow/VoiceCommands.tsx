import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { VoiceCommand } from "../../types";

interface VoiceCommandsProps {
  isListening: boolean;
  isClipPlaying: boolean;
  activeCommand: VoiceCommand;
  hasError: boolean;
  timedOut: boolean;
  onActivate: () => void;
}

const VoiceCommands: React.FC<VoiceCommandsProps> = ({
  isListening,
  isClipPlaying,
  activeCommand,
  hasError,
  timedOut,
  onActivate,
}) => {
  if (hasError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Error occurred. Waiting for next clip...
        </Text>
      </View>
    );
  }

  if (isClipPlaying) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>
          Clip playing... no commands available.
        </Text>
      </View>
    );
  }

  if (!isListening) {
    if (timedOut) {
      return (
        <View style={styles.container}>
          <TouchableOpacity onPress={onActivate}>
            <Text style={styles.activateText}>Activate Voice Mode</Text>
          </TouchableOpacity>
        </View>
      );
    }
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
        <Text style={styles.commandDescription}>— Start recording</Text>
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
        <Text style={styles.commandDescription}>— Replay the clip</Text>
      </View>
      <View
        style={[
          styles.commandRow,
          activeCommand === "slow" && styles.commandRowActive,
        ]}
      >
        <Text
          style={[
            styles.commandText,
            activeCommand === "slow" && styles.commandTextActive,
          ]}
        >
          "Slowdown"
        </Text>
        <Text style={styles.commandDescription}>
          — Replay the clip in slow mode
        </Text>
      </View>
      <View
        style={[
          styles.commandRow,
          activeCommand === "translation" && styles.commandRowActive,
        ]}
      >
        <Text
          style={[
            styles.commandText,
            activeCommand === "translation" && styles.commandTextActive,
          ]}
        >
          "Translation"
        </Text>
        <Text style={styles.commandDescription}>— Hear the translation</Text>
      </View>
      {/* <View
        style={[
          styles.commandRow,
          activeCommand === "artificial" && styles.commandRowActive,
        ]}
      >
        <Text
          style={[
            styles.commandText,
            activeCommand === "artificial" && styles.commandTextActive,
          ]}
        >
          "Artificial"
        </Text>
        <Text style={styles.commandDescription}>— Hear AI pronunciation</Text>
      </View> */}
      <View
        style={[
          styles.commandRow,
          activeCommand === "next" && styles.commandRowActive,
        ]}
      >
        <Text
          style={[
            styles.commandText,
            activeCommand === "next" && styles.commandTextActive,
          ]}
        >
          "Next"
        </Text>
        <Text style={styles.commandDescription}>— Go to next segment</Text>
      </View>
      <View
        style={[
          styles.commandRow,
          activeCommand === "previous" && styles.commandRowActive,
        ]}
      >
        <Text
          style={[
            styles.commandText,
            activeCommand === "previous" && styles.commandTextActive,
          ]}
        >
          "Previous"
        </Text>
        <Text style={styles.commandDescription}>— Go to previous segment</Text>
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
  errorText: {
    fontSize: 14,
    color: "#ef4444",
    textAlign: "center",
    paddingVertical: 20,
  },
  activateText: {
    fontSize: 14,
    color: "#4a69bd",
    fontWeight: "600",
    textAlign: "center",
    textDecorationLine: "underline",
    paddingVertical: 20,
  },
});

export default VoiceCommands;
