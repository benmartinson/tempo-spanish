import OAuthButton from "./OAuthButton";
import { StyleSheet, Text, View } from "react-native";

function SignInScreen() {
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
        <View style={styles.buttons}>
          <OAuthButton strategy="oauth_apple" />
          <OAuthButton strategy="oauth_google" />
        </View>
      </View>
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
});

export default SignInScreen;
