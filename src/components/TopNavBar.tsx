import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

import { useClerk, useUser } from "@clerk/clerk-expo";
import { useSelector } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import SlideModal from "./common/SlideModal";
import LanguageModal from "./settings/LanguageModal";
import { RootState } from "../types";

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

const TopNavBar: React.FC = () => {
  const [profileVisible, setProfileVisible] = useState(false);
  const [languageVisible, setLanguageVisible] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  const userSettings = useSelector((state: RootState) => state.userSettings);

  const handleSignOut = async () => {
    setProfileVisible(false);
    await signOut();
  };

  return (
    <View style={styles.container}>
      <View
        style={styles.leftFlagContainer}
        // onPress={() => setLanguageVisible(true)}
      >
        {/* <Text style={styles.countryFlag}>
          {getFlagForLanguage(userSettings.targetLanguage)}
        </Text> */}
      </View>
      <View style={styles.titleContainer}>
        <Text style={styles.appName}>Tempo Spanish</Text>
        <MaterialCommunityIcons name="waves" size={24} color="#3d3a52" />
      </View>
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

      <SlideModal
        visible={profileVisible}
        onRequestClose={() => setProfileVisible(false)}
        title="Profile"
      >
        <View style={styles.profileContent}>
          <View style={styles.profileSection}>
            <View style={styles.avatar}>
              <Text style={styles.profileAvatarText}>👤</Text>
            </View>
            {user?.primaryEmailAddress && (
              <Text style={styles.email}>
                {user.primaryEmailAddress.emailAddress}
              </Text>
            )}
          </View>

          <View style={styles.menuSection}>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SlideModal>
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
  countryFlag: {
    textAlign: "center",
    fontSize: 18,
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
  avatarText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#dfe2ea",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  profileContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#3d3a52",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "#5a5680",
  },
  profileAvatarText: {
    fontSize: 36,
  },
  email: {
    fontSize: 16,
    color: "#888",
  },
  menuSection: {
    marginTop: 20,
  },
  signOutButton: {
    backgroundColor: "#3d3a52",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  signOutText: {
    color: "#ff6b6b",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default TopNavBar;
