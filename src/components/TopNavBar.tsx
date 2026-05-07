import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  useWindowDimensions,
  Image,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import ProfileModal from "./ProfileModal";
import { isWebScreenWidth } from "../helpers/helpers";

const TopNavBar: React.FC<{ minimal?: boolean }> = ({ minimal = false }) => {
  const { isSignedIn } = useAuth();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isWebScreen = isWebScreenWidth(width);
  const [profileVisible, setProfileVisible] = useState(false);

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
                  {isSignedIn ? "Account" : "Sign in"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <ProfileModal
            visible={profileVisible}
            onClose={() => setProfileVisible(false)}
          />
        </View>
      </View>
    );
  }

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
    color: "#1f2433",
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
  },
  webActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  webFlagButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7f9ff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.24)",
  },
  webFlagText: {
    fontSize: 20,
    lineHeight: 24,
  },
  webAuthButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
