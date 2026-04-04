import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

const SPEED_OPTIONS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1.0];

interface SpeedControlProps {
  label?: string;
  speed: number;
  onSpeedChange: (speed: number) => void;
  options?: number[];
}

const SpeedControl: React.FC<SpeedControlProps> = ({
  label = "Playback Speed:",
  speed,
  onSpeedChange,
  options = SPEED_OPTIONS,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.option, speed === opt && styles.optionActive]}
            onPress={() => onSpeedChange(opt)}
          >
            <Text
              style={[
                styles.optionText,
                speed === opt && styles.optionTextActive,
              ]}
            >
              {opt === 0 ? "Off" : `${opt}x`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    color: "black",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  options: {
    flexDirection: "row",
    gap: 8,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  optionActive: {
    backgroundColor: "#3d3a52",
    borderColor: "#3d3a52",
  },
  optionText: {
    color: "#666",
    fontSize: 13,
    fontWeight: "500",
  },
  optionTextActive: {
    color: "#fff",
  },
});

export default SpeedControl;
