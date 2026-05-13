import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  useWindowDimensions,
  Image,
  ActivityIndicator,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import ProfileModal from "./ProfileModal";
import DifficultyModal, {
  difficultyLabelByValue,
} from "./settings/DifficultyModal";
import LanguageModal from "./settings/LanguageModal";
import { getInitials, isWebScreenWidth } from "../helpers/helpers";
import { normalizeChannelDifficulty } from "../helpers/channelDifficulty";
import { LanguageCode, RootState } from "../types";

const SHOW_LANGUAGE_SELECTOR = true;
const SHOW_DIFFICULTY_SELECTOR = true;

const languageLabelByCode: Record<LanguageCode, string> = {
  es: "Spanish",
  en: "English",
  pt: "Portuguese",
  de: "German",
  fr: "French",
};

const languageFlagByCode: Record<LanguageCode, string> = {
  es: "🇪🇸",
  en: "🇺🇸",
  pt: "🇧🇷",
  de: "🇩🇪",
  fr: "🇫🇷",
};

const TopNavBar: React.FC<{ minimal?: boolean }> = ({ minimal = false }) => {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const initials = getInitials(user);
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isWebScreen = isWebScreenWidth(width);
  const [profileVisible, setProfileVisible] = useState(false);
  const [languageVisible, setLanguageVisible] = useState(false);
  const [difficultyVisible, setDifficultyVisible] = useState(false);
  const targetLanguage = useSelector(
    (state: RootState) => state.userSettings.targetLanguage,
  );
  const currentDifficulty = useSelector(
    (state: RootState) => state.userSettings.currentDifficulty,
  );
  const targetLanguageLabel = targetLanguage
    ? languageLabelByCode[targetLanguage]
    : null;
  const targetLanguageFlag = targetLanguage
    ? languageFlagByCode[targetLanguage]
    : null;
  const normalizedCurrentDifficulty =
    normalizeChannelDifficulty(currentDifficulty);
  const currentDifficultyLabel = normalizedCurrentDifficulty
    ? difficultyLabelByValue[normalizedCurrentDifficulty]
    : null;

  useEffect(() => {
    if (!minimal && currentDifficulty === null) {
      setDifficultyVisible(true);
    }
  }, [currentDifficulty, minimal]);

  if (isWebScreen) {
    return (
      <View style={styles.webContainer}>
        <View style={styles.webInner}>
          <View style={styles.webBrand}>
            <View style={styles.webBrandMark}>
              <Image
                source={require("../../public/try/assets/icon.png")}
                style={styles.webBrandIcon}
              />
            </View>
            <View>
              <Text style={styles.webAppName}>Tempo</Text>
              <Text style={styles.webAppSubname}>Spanish</Text>
            </View>
          </View>

          {!minimal && (
            <View style={styles.webActions}>
              {SHOW_LANGUAGE_SELECTOR && (
                <TouchableOpacity
                  style={styles.webFlagButton}
                  onPress={() => setLanguageVisible(true)}
                  disabled={!targetLanguage}
                  activeOpacity={0.72}
                >
                  {targetLanguageLabel && targetLanguageFlag ? (
                    <>
                      <Text style={styles.webFlagLabel}>
                        {targetLanguageLabel}
                      </Text>
                      <Text style={styles.webFlagText}>
                        {targetLanguageFlag}
                      </Text>
                    </>
                  ) : (
                    <ActivityIndicator size="small" color="#3d3a52" />
                  )}
                </TouchableOpacity>
              )}
              {SHOW_DIFFICULTY_SELECTOR && (
                <TouchableOpacity
                  style={styles.webDifficultyButton}
                  onPress={() => setDifficultyVisible(true)}
                  activeOpacity={0.72}
                >
                  <Ionicons
                    name="speedometer-outline"
                    size={17}
                    color="#3d3a52"
                  />
                  {currentDifficultyLabel ? (
                    <Text style={styles.webFlagLabel}>
                      {currentDifficultyLabel}
                    </Text>
                  ) : (
                    <Text style={styles.webFlagLabel}>Difficulty</Text>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.webAuthButton,
                  isSignedIn && styles.webAccountButton,
                ]}
                onPress={() => {
                  if (isSignedIn) {
                    setProfileVisible(true);
                  } else {
                    navigation.navigate("SignIn");
                  }
                }}
              >
                <Ionicons
                  name={isSignedIn ? "person-circle-outline" : "log-in-outline"}
                  size={18}
                  color={isSignedIn ? "#3d3a52" : "#ffffff"}
                />
                <Text
                  style={[
                    styles.webAuthButtonText,
                    isSignedIn && styles.webAccountButtonText,
                  ]}
                >
                  {isSignedIn ? initials.toUpperCase() : "Sign in"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <ProfileModal
            visible={profileVisible}
            onClose={() => setProfileVisible(false)}
          />
          {SHOW_LANGUAGE_SELECTOR && (
            <LanguageModal
              visible={languageVisible}
              onClose={() => setLanguageVisible(false)}
            />
          )}
          {SHOW_DIFFICULTY_SELECTOR && (
            <DifficultyModal
              visible={difficultyVisible}
              onClose={() => setDifficultyVisible(false)}
              required={currentDifficulty === null}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.webBrand}>
        <View style={styles.webBrandMark}>
          <Image
            source={require("../../public/try/assets/icon.png")}
            style={styles.webBrandIcon}
          />
        </View>
        <View style={{ flexDirection: "row" }}>
          <Text style={styles.mobileAppName}>Tempo</Text>
          <Text style={styles.mobileAppSubname}>Spanish</Text>
        </View>
      </View>

      <View style={styles.mobileActions}>
        {!minimal && SHOW_LANGUAGE_SELECTOR && (
          <TouchableOpacity
            style={styles.mobilePillButton}
            onPress={() => setLanguageVisible(true)}
            disabled={!targetLanguage}
            activeOpacity={0.72}
          >
            {targetLanguageFlag ? (
              <Text style={styles.mobilePillText}>{targetLanguageFlag}</Text>
            ) : (
              <ActivityIndicator size="small" color="#3d3a52" />
            )}
          </TouchableOpacity>
        )}

        {!minimal && SHOW_DIFFICULTY_SELECTOR && (
          <TouchableOpacity
            style={styles.mobilePillButton}
            onPress={() => setDifficultyVisible(true)}
            activeOpacity={0.72}
          >
            <Ionicons name="speedometer-outline" size={16} color="#5a5680" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => {
            if (isSignedIn) {
              setProfileVisible(true);
            } else {
              navigation.navigate("SignIn");
            }
          }}
        >
          <Ionicons name="person" size={16} color="#5a5680" />
        </TouchableOpacity>

        <ProfileModal
          visible={profileVisible}
          onClose={() => setProfileVisible(false)}
        />
      </View>
      {SHOW_LANGUAGE_SELECTOR && (
        <LanguageModal
          visible={languageVisible}
          onClose={() => setLanguageVisible(false)}
        />
      )}
      {SHOW_DIFFICULTY_SELECTOR && (
        <DifficultyModal
          visible={difficultyVisible}
          onClose={() => setDifficultyVisible(false)}
          required={currentDifficulty === null}
        />
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
    justifyContent: "space-between",
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
    marginTop: Dimensions.get("window").height > 850 ? 12 : 0,
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
  mobileActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mobilePillButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f7f9ff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.24)",
  },
  mobilePillText: {
    fontSize: 17,
    lineHeight: 20,
  },
  webContainer: {
    marginTop: 0,
    paddingHorizontal: 32,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(74, 105, 189, 0.18)",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    zIndex: 20,
  },
  webInner: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  webBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  webBrandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3d3a52",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.28)",
  },
  webBrandIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
  },
  webAppName: {
    color: "#343147",
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 20,
  },
  webAppSubname: {
    color: "#6f7890",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    paddingLeft: 1,
    opacity: 0.7,
  },
  mobileAppName: {
    color: "#3d3a52",
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 20,
  },
  mobileAppSubname: {
    color: "#6f7890",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 19,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingLeft: 4,
  },
  webActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  webFlagButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    justifyContent: "center",
    backgroundColor: "#f7f9ff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.24)",
  },
  webDifficultyButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
    justifyContent: "center",
    backgroundColor: "#f7f9ff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.24)",
  },
  webFlagLabel: {
    color: "#3d3a52",
    fontSize: 14,
    fontWeight: "800",
  },
  webFlagText: {
    fontSize: 18,
    lineHeight: 24,
  },
  webAuthButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#3d3a52",
    borderWidth: 1,
    borderColor: "#3d3a52",
  },
  webAccountButton: {
    backgroundColor: "#f7f9ff",
    borderColor: "rgba(74, 105, 189, 0.26)",
  },
  webAuthButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  webAccountButtonText: {
    color: "#3d3a52",
  },
});

export default TopNavBar;
