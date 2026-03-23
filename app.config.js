export default {
  expo: {
    name: "rn-starter",
    slug: "rn-starter",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    scheme: "tempo",
    plugins: ["expo-web-browser"],
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.benmartinson92.tempo",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSMicrophoneUsageDescription:
          "This app uses the microphone to record audio.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      package: "com.benmartinson92.tempo",
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      eas: {
        projectId: "5125c995-e30c-4914-a96f-ec9c59acea81",
      },
      // Development URLs - for local testing
      devBaseUrl: "http://192.168.1.124:8000",
      devWsUrl: "ws://192.168.1.124:8000/ws/transcribe",
      // devBaseUrl: "https://aqgubuisev.us-west-2.awsapprunner.com",
      // devWsUrl: "wss://aqgubuisev.us-west-2.awsapprunner.com/ws/transcribe",
      // Production URLs - set via EAS environment variables or replace with your actual URLs
      productionBaseUrl: "https://aqgubuisev.us-west-2.awsapprunner.com",
      productionWsUrl:
        "wss://aqgubuisev.us-west-2.awsapprunner.com/ws/transcribe",
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    },
    owner: "benmartinson92",
  },
};
