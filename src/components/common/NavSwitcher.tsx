import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { VideoQuestion } from "../../types";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type NavSwitcherProps = {
  onPrev: () => void;
  onNext: () => void;
  currentIndex: number;
  children: React.ReactNode;
  totalItems: number;
};
const NavSwitcher: React.FC<NavSwitcherProps> = ({
  onPrev,
  onNext,
  currentIndex,
  children,
  totalItems,
}) => {
  return (
    <View style={styles.navHeader}>
      <TouchableOpacity
        style={[
          styles.navButton,
          currentIndex === 0 && styles.navButtonDisabled,
        ]}
        onPress={onPrev}
        disabled={currentIndex === 0}
      >
        <MaterialIcons
          name="chevron-left"
          size={24}
          color={currentIndex === 0 ? "#ccc" : "#333"}
        />
      </TouchableOpacity>

      <View style={styles.navCenter}>{children}</View>

      <TouchableOpacity
        style={[
          styles.navButton,
          currentIndex === totalItems - 1 && styles.navButtonDisabled,
        ]}
        onPress={onNext}
        disabled={currentIndex === totalItems - 1}
      >
        <MaterialIcons
          name="chevron-right"
          size={24}
          color={currentIndex === totalItems - 1 ? "#ccc" : "#333"}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fafafa",
  },
  navButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  navButtonDisabled: {
    backgroundColor: "#f8f8f8",
  },
  navCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navCounter: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
});

export default NavSwitcher;
