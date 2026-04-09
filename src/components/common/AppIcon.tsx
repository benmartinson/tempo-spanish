import React from "react";
import { View, StyleSheet } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

interface AppIconProps {
  size?: number;
}

const AppIcon: React.FC<AppIconProps> = ({ size = 24 }) => {
  const containerSize = size * 1.6;
  const borderRadius = containerSize * 0.22;

  return (
    <View
      style={[
        styles.container,
        { width: containerSize, height: containerSize, borderRadius },
      ]}
    >
      <MaterialCommunityIcons name="waves" size={size} color="#3d3a52" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#d0d8f0",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default AppIcon;
