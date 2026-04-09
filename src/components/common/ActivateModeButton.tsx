import React from "react";
import { Text, StyleSheet, TouchableOpacity } from "react-native";

interface ActivateModeButtonProps {
  label: string;
  onPress: () => void;
}

const ActivateModeButton: React.FC<ActivateModeButtonProps> = ({
  label,
  onPress,
}) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  text: {
    fontSize: 14,
    color: "#4a69bd",
    fontWeight: "600",
    textAlign: "center",
    textDecorationLine: "underline",
    paddingVertical: 20,
  },
});

export default ActivateModeButton;
