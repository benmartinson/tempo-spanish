import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ContextSegment } from "../../types";
import { formatTimestamp } from "../../helpers";
import ToggleHeader from "../common/ToggleHeader";

interface ContextClipsSectionProps {
  loading: boolean;
  segments: ContextSegment[];
  onPlayClip: (segment: ContextSegment) => void;
  isVocabMode: boolean;
}

const ContextClipsSection: React.FC<ContextClipsSectionProps> = ({
  loading,
  segments,
  onPlayClip,
  isVocabMode,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  if (loading) {
    return (
      <View style={styles.contextSection}>
        <View style={styles.contextLoadingRow}>
          <ActivityIndicator size="small" color="#4a69bd" />
          <Text style={styles.contextLoadingText}>
            Loading context clips...
          </Text>
        </View>
      </View>
    );
  }

  if (segments.length === 0) {
    return null;
  }

  return (
    <View style={styles.contextSection}>
      <ToggleHeader
        title="Context Clips"
        isVisible={isVisible}
        onToggle={() => setIsVisible((v) => !v)}
      />
      {isVisible && (
        <View style={styles.timestampRow}>
          {segments.map((segment, index) => (
            <TouchableOpacity
              key={`${segment.segment_id}-${index}`}
              style={styles.timestampButton}
              onPress={() => onPlayClip(segment)}
            >
              <MaterialIcons
                name="play-circle-outline"
                size={16}
                color="#4a69bd"
              />
              <Text style={styles.timestampText}>
                {formatTimestamp(segment.start)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  contextSection: {
    marginBottom: 16,
  },
  contextLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  contextLoadingText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  timestampRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  timestampButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d0d8f0",
  },
  timestampText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4a69bd",
  },
});

export default ContextClipsSection;
