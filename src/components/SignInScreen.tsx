import OAuthButton from "./OAuthButton";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  setSignInScreenOpen,
  setCurrentVideo,
} from "../store/actions/dataActions";
import { useSupabaseWithClerk } from "../../utils/supabase";
import { initializeUserCredits } from "../requests";

const INITIAL_CREDITS_GRANTED_KEY = "initial_credits_granted";

function SignInScreen() {
  const { isSignedIn } = useAuth();
  const supabase = useSupabaseWithClerk();
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const [pendingNewUserId, setPendingNewUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const postSignInProcessedRef = useRef(false);

  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  const handleAuthError = useCallback(() => {
    setErrorMessage("Something went wrong");
  }, []);

  useEffect(() => {
    dispatch(setSignInScreenOpen(true));
    return () => {
      dispatch(setSignInScreenOpen(false));
    };
  }, [dispatch]);

  useEffect(() => {
    if (!isSignedIn) return;
    if (!supabase) return;
    if (postSignInProcessedRef.current) return;
    postSignInProcessedRef.current = true;

    (async () => {
      try {
        if (pendingNewUserId) {
          const alreadyGranted = await AsyncStorage.getItem(
            INITIAL_CREDITS_GRANTED_KEY,
          );
          const defaultCredits = alreadyGranted ? 10 : 30;
          await initializeUserCredits({
            supabase,
            userId: pendingNewUserId,
            defaultCredits,
          });
          if (!alreadyGranted) {
            await AsyncStorage.setItem(INITIAL_CREDITS_GRANTED_KEY, "true");
          }
        }
        dispatch(setCurrentVideo(null));
      } catch (err) {
        console.error("Post-signin credit init failed:", err);
      } finally {
        navigation.goBack();
      }
    })();
  }, [isSignedIn, supabase, pendingNewUserId, navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", minHeight: "100%" }}>
      <View style={styles.header}>
        <View style={styles.dragIndicator} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Tempo</Text>
        <Text style={styles.subtitle}>
          Sign in to save your progress and unlock all features
        </Text>
        {errorMessage && (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={18} color="#c0392b" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
        <View style={styles.buttons}>
          <OAuthButton
            strategy="oauth_apple"
            onAuthenticated={setPendingNewUserId}
            onError={handleAuthError}
          />
          <OAuthButton
            strategy="oauth_google"
            onAuthenticated={setPendingNewUserId}
            onError={handleAuthError}
          />
        </View>
      </View>
      {isSignedIn && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#5a5680" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
  },
  dragIndicator: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#d0d0d4",
    marginTop: 8,
    marginBottom: 8,
  },
  content: {
    marginTop: 72,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 0,
    padding: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 15,
    color: "#64748B",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 12,
  },
  buttons: {
    width: "100%",
    gap: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fdecea",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: "100%",
  },
  errorText: {
    fontSize: 14,
    color: "#c0392b",
    fontWeight: "500",
  },
});

export default SignInScreen;
