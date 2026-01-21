export default {
  expo: {
    name: "rn-starter",
    slug: "rn-starter",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.benmartinson92.tempo",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      eas: {
        projectId: "5125c995-e30c-4914-a96f-ec9c59acea81"
      },
      // Development URLs - for local testing
      // devBaseUrl: 'http://192.168.1.124:8000',
      // devWsUrl: 'ws://192.168.1.124:8000/ws/transcribe',
      devBaseUrl: 'https://aqgubuisev.us-west-2.awsapprunner.com',
      devWsUrl: 'ws://aqgubuisev.us-west-2.awsapprunner.com/ws/transcribe',
      // Production URLs - set via EAS environment variables or replace with your actual URLs
      productionBaseUrl: process.env.PRODUCTION_BASE_URL,
      productionWsUrl: process.env.PRODUCTION_WS_URL,
    },
    owner: "benmartinson92"
  }
};
