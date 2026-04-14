import * as React from "react";
import { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import SignInScreen from "./src/components/SignInScreen";
import SignUpScreen from "./src/components/SignUpScreen";
import HomeTab from "./src/components/tabs/HomeTab";
import VideosTab from "./src/components/tabs/VideosTab";
import { Provider, useDispatch, useSelector } from "react-redux";
import store from "./src/store/store";
import {
  setCurrentTab,
  setCurrentVideo,
  setAllVocabulary,
  setUserKnownVocab,
  setUserVideoViews,
  setAllVideos,
  setAllChannels,
  setAllTopics,
  setChannelTopics,
  setUserSettings,
  setCurrentShadowTab,
  setMemorizeDifficulty,
  setUserCredits,
} from "./src/store/actions/dataActions";
import { useSupabaseWithClerk } from "./utils/supabase";
import { VideoView, Vocabulary, RootState, UserUIState } from "./src/types";
import { createVocabHash } from "./src/helpers/helpers";
import {
  fetchVideoContext,
  fetchAllVideos,
  fetchAllVocabulary,
  fetchUserKnownVocab,
  fetchUserVideoViews,
  restoreUserUIState,
  persistUserUITab,
  loadAndCacheTTSResponses,
  fetchUserCredits,
} from "./src/requests";
import { useUIStateSync } from "./src/hooks/useUIStateSync";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache as clerkTokenCache } from "@clerk/clerk-expo/token-cache";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import TabIcon from "./src/components/tabs/TabIcon";
import WatchTab from "./src/components/speed-run/SpeedRunTab";
import TopNavBar from "./src/components/TopNavBar";
import ReviewTab from "./src/components/discuss/ReviewTab";
import VideoList from "./src/components/video-list/VideoList";
import SelectedVideoBanner from "./src/components/common/SelectedVideoBanner";
import NavTabBanner from "./src/components/common/NavTabBanner";
import ShadowTab from "./src/components/shadow/ShadowTab";
import SelectedVideoTabs from "./src/components/common/SelectedVideoTabs";
import Constants from "expo-constants";
import AppIcon from "./src/components/common/AppIcon";
const tokenCache = clerkTokenCache
  ? {
      getToken: async (key: string) => {
        const result = await clerkTokenCache.getToken(key);
        if (!result) {
          console.warn(
            "[Auth] tokenCache.getToken returned null for key:",
            key,
          );
        }
        return result;
      },
      saveToken: async (key: string, token: string) => {
        console.log("[Auth] tokenCache.saveToken for key:", key);
        return clerkTokenCache.saveToken(key, token);
      },
    }
  : undefined;

const publishableKey =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
  throw new Error("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set");
}

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Main tabs for authenticated users
const MainTabs: React.FC = () => {
  const dispatch = useDispatch();

  return (
    <Tab.Navigator
      id="MainTabs"
      initialRouteName="Videos"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "white",
          borderTopColor: "gray",
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeTab}
        listeners={{
          tabPress: () => {
            dispatch(setCurrentTab("home"));
          },
        }}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="home-outline" label="Home" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Videos"
        component={VideoList}
        listeners={{
          tabPress: () => {
            dispatch(setCurrentTab("videos"));
          },
        }}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="video-list" label="Browse" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Watch"
        component={WatchTab}
        listeners={{
          tabPress: () => {
            dispatch(setCurrentTab("watch"));
          },
        }}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="video-outline" label="Watch" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Shadow"
        component={ShadowTab}
        listeners={{
          tabPress: () => {
            dispatch(setCurrentTab("shadow"));
          },
        }}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="people-outline" label="Shadow" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Discuss"
        component={ReviewTab}
        listeners={{
          tabPress: () => {
            dispatch(setCurrentTab("discuss"));
          },
        }}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="chat-outline" label="Review" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// Wrapper component that includes TopNavBar and MainTabs
const AuthenticatedApp: React.FC = () => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const [selectedNavTab, setSelectedNavTab] = useState<
    | "watch"
    | "shadow"
    | "review"
    | "speed-run"
    | "translate"
    | "recordings"
    | "turn-taking"
  >("watch");
  const [isRestoringState, setIsRestoringState] = useState(true);

  // Sync currentSentence changes to the database
  useUIStateSync();

  useEffect(() => {
    if (!supabase) return;
    fetchAllVideos({ supabase }).then(
      ({ channelData, videoData, topicData, channelTopicData }) => {
        dispatch(setAllChannels(channelData));
        dispatch(setAllVideos(videoData));
        dispatch(setAllTopics(topicData));
        dispatch(setChannelTopics(channelTopicData));
      },
    );

    // Pre-load and cache TTS responses in the background
    loadAndCacheTTSResponses({ supabase, dispatch }).catch((err) =>
      console.error("Failed to load cached TTS responses:", err),
    );
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;

    // Fetch all vocabulary
    fetchAllVocabulary({
      supabase,
      targetLanguage: userSettings.targetLanguage,
      translationLanguage: userSettings.translationLanguage,
    }).then((allVocab) => {
      const vocabHash = createVocabHash(allVocab);
      dispatch(setAllVocabulary(vocabHash));
    });

    // Fetch user's known vocabulary
    fetchUserKnownVocab({ supabase }).then((vocabIds) => {
      dispatch(setUserKnownVocab(vocabIds));
    });

    // Fetch video views
    fetchUserVideoViews({ supabase }).then((videoViews) => {
      dispatch(setUserVideoViews(videoViews));
    });

    // Fetch and restore user UI state
    const restoreState = async () => {
      const {
        videoContext,
        currentTab,
        currentShadowTab,
        memorizeDifficulty,
        settings,
      } = await restoreUserUIState({
        supabase,
        userId,
      });

      dispatch(setUserSettings(settings));

      if (currentShadowTab) {
        dispatch(setCurrentShadowTab(currentShadowTab));
      }

      if (settings.saveMemorizeDifficulty && memorizeDifficulty !== null) {
        dispatch(setMemorizeDifficulty(memorizeDifficulty));
      } else {
        dispatch(setMemorizeDifficulty(settings.defaultMemorizeDifficulty));
      }

      if (
        currentTab &&
        [
          "watch",
          "discuss",
          "shadow",
          "speed-run",
          "translate",
          "recordings",
          "turns",
        ].includes(currentTab)
      ) {
        if ((currentTab as string) === "recordings") {
          setSelectedNavTab("recordings");
        } else if ((currentTab as string) === "turns") {
          setSelectedNavTab("turn-taking");
        } else {
          // speed-run and translate are now subtabs of shadow
          const resolvedTab =
            currentTab === "translate" || currentTab === "speed-run"
              ? "shadow"
              : currentTab;
          dispatch(
            setCurrentTab(resolvedTab === "discuss" ? "discuss" : resolvedTab),
          );
          if (resolvedTab === "discuss") {
            setSelectedNavTab("review");
          } else if (resolvedTab === "watch" || resolvedTab === "shadow") {
            setSelectedNavTab(resolvedTab);
          }
        }
      }

      if (videoContext) {
        dispatch(setCurrentVideo(videoContext));
      }

      // Fetch user credits
      const credits = await fetchUserCredits({ supabase, userId });
      dispatch(setUserCredits(credits));

      setIsRestoringState(false);
    };

    restoreState();
  }, [supabase, dispatch, userId, userSettings.targetLanguage]);

  const showTabsBelow = false;

  // Track if this is first video selection after restoration
  const isInitialVideoRef = React.useRef(true);

  // When a video is selected (not from restoration), reset to shadow tab
  useEffect(() => {
    if (currentVideo && !isRestoringState) {
      // Skip the first video set during restoration
      if (isInitialVideoRef.current) {
        isInitialVideoRef.current = false;
        return;
      }
    }
  }, [currentVideo?.videoId, isRestoringState]);

  const handleNavTabSelect = async (
    tab:
      | "watch"
      | "shadow"
      | "review"
      | "speed-run"
      | "translate"
      | "recordings"
      | "turn-taking",
  ) => {
    setSelectedNavTab(tab);
    // Also update redux current tab for consistency
    const reduxTab = tab === "review" ? "discuss" : tab;
    dispatch(
      setCurrentTab(
        reduxTab as "watch" | "shadow" | "discuss" | "home" | "videos",
      ),
    );

    // Persist tab to database
    const persistTab =
      tab === "review" ? "discuss" : tab === "turn-taking" ? "turns" : tab;
    await persistUserUITab({ supabase, userId, currentTab: persistTab });
  };

  const renderTabContent = () => {
    return (
      <SelectedVideoTabs
        selectedNavTab={selectedNavTab}
        onSelectNavTab={handleNavTabSelect}
      />
    );
  };

  if (showTabsBelow) {
    return (
      <View style={{ flex: 1 }}>
        <TopNavBar />
        <MainTabs />
      </View>
    );
  }

  // When showTabsBelow is false, use NavTabBanner navigation
  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      {(!currentVideo || isRestoringState) && <TopNavBar />}
      {isRestoringState ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "white",
          }}
        >
          <ActivityIndicator size="large" color="#5a5680" />
          <Text style={{ marginTop: 16, color: "#666" }}>
            Loading your session...
          </Text>
        </View>
      ) : currentVideo ? (
        <>
          <NavTabBanner
            selectedTab={selectedNavTab}
            onTabSelect={handleNavTabSelect}
          />
          {renderTabContent()}
        </>
      ) : (
        <VideoList />
      )}
    </View>
  );
};

// Separate component that uses auth hooks (must be inside ClerkProvider)
const AppNavigator: React.FC = () => {
  const { isSignedIn, isLoaded } = useAuth();

  console.log("[Auth]", { isLoaded, isSignedIn });

  // Show loading spinner while Clerk initializes
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: "white" }}>
        <TopNavBar minimal />
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "white",
          }}
        >
          <ActivityIndicator size="large" color="#5a5680" />
        </View>
      </View>
    );
  }

  return (
    <Stack.Navigator id="MainStack" screenOptions={{ headerShown: false }}>
      {isSignedIn ? (
        // Protected screens - now using tab navigator with TopNavBar
        <Stack.Screen name="AuthenticatedApp" component={AuthenticatedApp} />
      ) : (
        // Auth screens
        <>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

const App: React.FC = () => {
  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <Provider store={store}>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </Provider>
    </ClerkProvider>
  );
};

export default App;
