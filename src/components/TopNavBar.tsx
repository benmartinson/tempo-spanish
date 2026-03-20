import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

import { useClerk, useUser } from "@clerk/clerk-expo";
import { useSelector } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
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
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.leftFlagContainer}
          onPress={() => setLanguageVisible(true)}
        >
          <Text style={styles.countryFlag}>
            {getFlagForLanguage(userSettings.targetLanguage)}
          </Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.appName}>Tempo</Text>
          <MaterialCommunityIcons name="waves" size={26} color="#1a1a2e" />
          {/* <FontAwesome5 name="wave-square" size={24} color="#1a1a2e" /> */}
        </View>
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => setProfileVisible(true)}
        >
          <Ionicons name="person" size={18} color="#dfe2ea" />
        </TouchableOpacity>
      </View>

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
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#d0d8f0",
    overflow: "hidden",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    height: 95,
  },
  leftFlagContainer: {
    borderWidth: 1,
    borderColor: "#d0d8f0",
    paddingHorizontal: 10,
    borderRadius: 100,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  appName: {
    fontSize: 20,
    fontFamily: "Helvetica",
    fontWeight: "500",
    color: "#1a1a2e",
  },
  countryFlag: {
    textAlign: "center",
    fontSize: 24,
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 20,
    backgroundColor: "#3d3a52",
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
