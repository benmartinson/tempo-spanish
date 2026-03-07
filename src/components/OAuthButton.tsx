import { styles } from "../constants/AuthStyles";
import { useSSO } from "@clerk/clerk-expo";
import { OAuthStrategy } from "@clerk/types";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect } from "react";
import { Platform, Text, TouchableOpacity } from "react-native";

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

interface Props {
  // The OAuthStrategy type from Clerk allows you to specify the provider you want to use in this specific instance of the OAuthButton component
  strategy: OAuthStrategy;
  children: React.ReactNode;
}

export default function OAuthButton({ strategy, children }: Props) {
  useWarmUpBrowser();
  // useSSO hook from Clerk SDK to support various SSO providers
  const { startSSOFlow } = useSSO();

  const onPress = useCallback(async () => {
    try {
      const redirectUrl = AuthSession.makeRedirectUri();
      console.log("Redirect URI:", redirectUrl);
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        redirectUrl,
      });

      if (createdSessionId) {
        setActive!({ session: createdSessionId });
      } else {
        throw new Error("Failed to create session");
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
    <TouchableOpacity onPress={onPress} style={styles.button}>
      <Text style={styles.buttonText}>{children}</Text>
    </TouchableOpacity>
  );
}
