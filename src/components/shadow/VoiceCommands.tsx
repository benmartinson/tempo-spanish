import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { VoiceCommand } from "../../types";

export interface CommandEntry {
  command: VoiceCommand;
  label: string;
  description: string;
}

interface VoiceCommandsProps {
  isListening: boolean;
  isClipPlaying: boolean;
  activeCommand: VoiceCommand;
  hasError: boolean;
  timedOut: boolean;
  permissionDenied: boolean;
  onActivate: () => void;
  commands: CommandEntry[];
  /** When set, only these commands are shown initially with a "Show More" expander */
  priorityCommands?: VoiceCommand[];
  onCommandPress?: (command: VoiceCommand) => void;
}

const VoiceCommands: React.FC<VoiceCommandsProps> = ({
  isListening,
  isClipPlaying,
  activeCommand,
  hasError,
  timedOut,
  permissionDenied,
  onActivate,
  commands,
  priorityCommands,
  onCommandPress,
}) => {
  const [expanded, setExpanded] = useState(false);

  const priorityKey = priorityCommands?.join(",") ?? "";
  useEffect(() => {
    setExpanded(false);
  }, [priorityKey]);

  useEffect(() => {
    if (activeCommand) {
      setExpanded(true);
    }
  }, [activeCommand]);

  if (permissionDenied) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>
          Speech recognition permission is required for voice commands.
        </Text>
        <TouchableOpacity onPress={() => Linking.openSettings()}>
          <Text style={styles.activateText}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (hasError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error occurred.</Text>
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

  if (timedOut || !isListening) {
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
      <View style={styles.listeningHeader}>
        <MaterialIcons name="hearing" size={16} color="#4a69bd" />
        <Text style={styles.listeningHeaderText}>Listening for commands</Text>
      </View>
      {(priorityCommands && !expanded
        ? (priorityCommands
            .map((cmd) => commands.find((c) => c.command === cmd))
            .filter(Boolean) as CommandEntry[])
        : commands
      ).map(({ command, label, description }) => (
        <TouchableOpacity
          key={command}
          style={[styles.commandRow]}
          onPress={() => onCommandPress?.(command)}
        >
          <Text style={[styles.commandText]}>"{label}"</Text>
          <Text style={styles.commandDescription}>— {description}</Text>
        </TouchableOpacity>
      ))}
      {priorityCommands && !expanded && (
        <TouchableOpacity onPress={() => setExpanded(true)}>
          <Text style={styles.showMoreText}>Show All</Text>
        </TouchableOpacity>
      )}
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
  showMoreText: {
    fontSize: 14,
    color: "#4a69bd",
    fontWeight: "600",
    textAlign: "center",
    textDecorationLine: "underline",
    paddingVertical: 10,
  },
});

export default VoiceCommands;
