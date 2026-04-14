import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import AppIcon from "./common/AppIcon";
import LanguageModal from "./settings/LanguageModal";
import ProfileModal from "./ProfileModal";

export const getFlagForLanguage = (language: string): string => {
  switch (language) {
    case "es":
      return "🇲🇽";
    case "pt":
      return "🇧🇷";
    case "en":
    default:
      return "🇺🇸";
  }
};

const TopNavBar: React.FC<{ minimal?: boolean }> = ({ minimal = false }) => {
  const [profileVisible, setProfileVisible] = useState(false);
  const [languageVisible, setLanguageVisible] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.leftFlagContainer} />
      <View style={styles.titleContainer}>
        <Text style={styles.appName}>Tempo Spanish</Text>
      </View>
      {minimal ? (
        <View style={styles.leftFlagContainer} />
      ) : (
        <>
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={() => setProfileVisible(true)}
          >
            <Ionicons name="person" size={16} color="#5a5680" />
          </TouchableOpacity>

          <LanguageModal
            visible={languageVisible}
            onClose={() => setLanguageVisible(false)}
          />

          <ProfileModal
            visible={profileVisible}
            onClose={() => setProfileVisible(false)}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#d0d8f0",
  },
  leftFlagContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  titleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  appName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#3d3a52",
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#d0d8f0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#5a5680",
  },
});

export default TopNavBar;
