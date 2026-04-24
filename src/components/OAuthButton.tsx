import { useSSO } from "@clerk/clerk-expo";
import { OAuthStrategy } from "@clerk/types";
import AntDesign from "@expo/vector-icons/AntDesign";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect } from "react";
import { useSupabaseWithClerk } from "../../utils/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeUserCredits } from "../requests";

const INITIAL_CREDITS_GRANTED_KEY = "initial_credits_granted";
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

const providerConfig: Record<
  string,
  { icon: React.ReactNode; label: string }
> = {
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
  children?: React.ReactNode;
}

export default function OAuthButton({ strategy, children }: Props) {
  useWarmUpBrowser();
  const { startSSOFlow } = useSSO();
  const supabase = useSupabaseWithClerk();
  const navigation = useNavigation<any>();
  const config = providerConfig[strategy];

  const onPress = useCallback(async () => {
    try {
      const redirectUrl = AuthSession.makeRedirectUri();
      console.log("Redirect URI:", redirectUrl);
      const { createdSessionId, setActive, signUp } = await startSSOFlow({
        strategy,
        redirectUrl,
      });

      if (createdSessionId) {
        setActive!({ session: createdSessionId });
        const newUserId = signUp?.createdUserId;
        if (newUserId) {
          const alreadyGranted = await AsyncStorage.getItem(
            INITIAL_CREDITS_GRANTED_KEY,
          );
          const defaultCredits = alreadyGranted ? 0 : 100;
          await initializeUserCredits({
            supabase,
            userId: newUserId,
            defaultCredits,
          });
          if (!alreadyGranted) {
            await AsyncStorage.setItem(INITIAL_CREDITS_GRANTED_KEY, "true");
          }
        }
        navigation.goBack();
      }
    } catch (err: any) {
      console.error("Error during SSO flow:", err);
      if (err?.clerkError) {
        console.error("Clerk errors:", JSON.stringify(err.errors, null, 2));
      }
      console.error(JSON.stringify(err, null, 2));
    }
  }, [startSSOFlow, strategy]);

  return (
    <TouchableOpacity onPress={onPress} style={oauthStyles.button} activeOpacity={0.7}>
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
