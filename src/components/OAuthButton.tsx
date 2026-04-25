import { useSSO, useClerk } from "@clerk/clerk-expo";
import { OAuthStrategy } from "@clerk/types";
import AntDesign from "@expo/vector-icons/AntDesign";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect } from "react";
import { triggerClerkRefresh } from "../helpers/clerkRefresh";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS === "web") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};
WebBrowser.maybeCompleteAuthSession();

const providerConfig: Record<string, { icon: React.ReactNode; label: string }> =
  {
    oauth_google: {
      icon: <AntDesign name="google" size={20} color="#4285F4" />,
      label: "Continue with Google",
    },
    oauth_apple: {
      icon: <FontAwesome name="apple" size={22} color="#000000" />,
      label: "Continue with Apple",
    },
  };

interface Props {
  strategy: OAuthStrategy;
  onAuthenticated?: (newUserId: string | null) => void;
  onError?: () => void;
  children?: React.ReactNode;
}

export default function OAuthButton({
  strategy,
  onAuthenticated,
  onError,
  children,
}: Props) {
  useWarmUpBrowser();
  const { startSSOFlow } = useSSO();
  const { signOut } = useClerk();
  const config = providerConfig[strategy];

  const onPress = useCallback(async () => {
    try {
      const redirectUrl = AuthSession.makeRedirectUri();
      const { createdSessionId, setActive, signUp } = await startSSOFlow({
        strategy,
        redirectUrl,
      });

      if (createdSessionId) {
        setActive!({ session: createdSessionId });
        onAuthenticated?.(signUp?.createdUserId ?? null);
      }
    } catch (err: any) {
      console.error("Error during SSO flow:", err);
      if (err?.clerkError) {
        console.error("Clerk errors:", JSON.stringify(err.errors, null, 2));
      }
      // Prefer the specific inner error code — the top-level code is a generic
      // wrapper like "api_response_error" that masks the actual cause.
      const code = err?.errors?.[0]?.code ?? err?.code;

      // Certain errors leave Clerk's tokenCache in a broken state where
      // every subsequent tap fails with the same error. Flush it so the
      // user can retry successfully. signOut() is safe to call even when
      // there's no active session.
      if (code === "signed_out" || code === "session_exists") {
        console.error("[Auth] Recovery: signOut + clear tokenCache");
        try {
          await signOut();
        } catch (signOutErr) {
          console.error("signOut during recovery failed:", signOutErr);
        }
        // signOut() doesn't always clear the cached client JWT in SecureStore.
        // Force-delete it so the next attempt starts with a fresh client.
        try {
          await SecureStore.deleteItemAsync("__clerk_client_jwt");
          console.error("[Auth] Recovery: deleted __clerk_client_jwt");
        } catch (deleteErr) {
          console.error(
            "Token cache delete during recovery failed:",
            deleteErr,
          );
        }
        // signOut + SecureStore delete leave the Clerk SDK with the bad client
        // still cached in memory. Force the provider to remount so the SDK
        // re-initializes from the now-empty cache.
        triggerClerkRefresh();
        console.error("[Auth] Recovery: triggered Clerk provider refresh");
      }

      // Ignore user cancelling the in-app browser — not an error worth surfacing.
      if (code !== "user_cancelled") {
        onError?.();
      }
    }
  }, [startSSOFlow, strategy, onAuthenticated, onError, signOut]);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={oauthStyles.button}
      activeOpacity={0.7}
    >
      {config && <View style={oauthStyles.icon}>{config.icon}</View>}
      <Text style={oauthStyles.buttonText}>
        {children ?? config?.label ?? strategy}
      </Text>
    </TouchableOpacity>
  );
}

const oauthStyles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  icon: {
    marginRight: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },
});
