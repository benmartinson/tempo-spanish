import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

interface ToggleHeaderProps {
  title: string;
  isVisible: boolean;
  onToggle: () => void;
}

const ToggleHeader: React.FC<ToggleHeaderProps> = ({
  title,
  isVisible,
  onToggle,
}) => {
  return (
    <TouchableOpacity onPress={onToggle}>
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <MaterialIcons
          name="visibility"
          size={20}
          color={isVisible ? "black" : "gray"}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "left",
    paddingHorizontal: 4,
  },
});

export default ToggleHeader;
