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
  Platform,
  Linking,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import ProfileModal from "./ProfileModal";
import LanguageModal from "./settings/LanguageModal";
import { getInitials, isWebScreenWidth } from "../helpers/helpers";
import { LanguageCode, RootState } from "../types";

const SHOW_LANGUAGE_SELECTOR = Platform.OS === "web";
const APP_STORE_URL =
  "https://apps.apple.com/us/app/tempo-spanish/id6763132237";

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

const TopNavBar: React.FC<{ minimal?: boolean; composeActive?: boolean }> = ({
  minimal = false,
}) => {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const initials = getInitials(user);
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isWebScreen = isWebScreenWidth(width);
  const [profileVisible, setProfileVisible] = useState(false);
  const [languageVisible, setLanguageVisible] = useState(false);
  const targetLanguage = useSelector(
    (state: RootState) => state.userSettings.targetLanguage,
  );
  const targetLanguageLabel = targetLanguage
    ? languageLabelByCode[targetLanguage]
    : null;
  const targetLanguageFlag = targetLanguage
    ? languageFlagByCode[targetLanguage]
    : null;
  const showMobileAppBanner = Platform.OS === "web" && !isWebScreen;
  const navigateCompose = () =>
    navigation.navigate({
      name: "MainApp",
      params: { compose: true },
      merge: false,
    });
  const openAppStore = () => {
    void Linking.openURL(APP_STORE_URL);
  };

  useEffect(() => {
    if (
      SHOW_LANGUAGE_SELECTOR &&
      isWebScreen &&
      isLoaded &&
      !isSignedIn &&
      !targetLanguage
    ) {
      setLanguageVisible(true);
    }
  }, [isLoaded, isSignedIn, isWebScreen, targetLanguage]);

  if (isWebScreen) {
    return (
      <View style={styles.webContainer}>
        <View style={styles.webInner}>
          <TouchableOpacity
            style={styles.webBrand}
            onPress={navigateCompose}
            activeOpacity={0.78}
          >
            <View style={styles.webBrandMark}>
              <Image
                source={require("../../public/try/assets/icon.png")}
                style={styles.webBrandIcon}
              />
            </View>
            <View>
              <Text style={styles.webAppName}>Tempo</Text>
              <Text style={styles.webAppSubname}>
                {targetLanguageLabel ?? "Language"}
              </Text>
            </View>
          </TouchableOpacity>

          {!minimal && (
            <View style={styles.webActions}>
              {SHOW_LANGUAGE_SELECTOR && targetLanguageFlag && (
                <TouchableOpacity
                  style={styles.webFlagButton}
                  onPress={() => setLanguageVisible(true)}
                  disabled={!targetLanguage}
                  activeOpacity={0.72}
                >
                  <Text style={styles.webFlagText}>{targetLanguageFlag}</Text>
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
        </View>
      </View>
    );
  }

  return (
    <>
      {showMobileAppBanner && (
        <TouchableOpacity
          style={styles.mobileAppBanner}
          onPress={openAppStore}
          activeOpacity={0.82}
        >
          <Text style={styles.mobileAppBannerText}>
            Try Tempo Spanish on Mobile
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#ffffff" />
        </TouchableOpacity>
      )}
      <View
        style={[
          styles.container,
          showMobileAppBanner && styles.containerBelowMobileAppBanner,
        ]}
      >
        <TouchableOpacity
          style={styles.webBrand}
          onPress={navigateCompose}
          activeOpacity={0.78}
        >
          <View style={styles.webBrandMark}>
            <Image
              source={require("../../public/try/assets/icon.png")}
              style={styles.webBrandIcon}
            />
          </View>
          <View style={styles.mobileBrandTextGroup}>
            <Text style={styles.mobileAppName}>Tempo</Text>
            <Text style={styles.mobileAppSubname}>Spanish</Text>
          </View>
        </TouchableOpacity>

        <>
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
        </>
      </View>
    </>
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
  containerBelowMobileAppBanner: {
    marginTop: 0,
  },
  mobileAppBanner: {
    width: "100%",
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    backgroundColor: "#3d3a52",
  },
  mobileAppBannerText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
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
  mobileBrandTextGroup: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  mobileAppSubname: {
    color: "#6f7890",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    paddingLeft: 1,
  },
  webActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  webFlagButton: {
    width: 38,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    backgroundColor: "#f7f9ff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.24)",
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
