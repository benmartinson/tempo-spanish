import * as React from "react";
import { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SignInScreen from "./src/components/SignInScreen";
import { Provider, useDispatch, useSelector } from "react-redux";
import store from "./src/store/store";
import {
  setCurrentVideo,
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
  setHasSeenWelcomeModals,
} from "./src/store/actions/dataActions";
import { useSupabaseWithClerk } from "./utils/supabase";
import { supabase as rawSupabase } from "./lib/supabase";
import { RootState } from "./src/types";
import {
  fetchVideoContext,
  fetchAllVideos,
  fetchUserKnownVocab,
  fetchUserVideoViews,
  restoreUserUIState,
  loadAndCacheTTSResponses,
  fetchUserCredits,
} from "./src/requests";
import { useUIStateSync } from "./src/hooks/useUIStateSync";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache as clerkTokenCache } from "@clerk/clerk-expo/token-cache";
import { ActivityIndicator, View } from "react-native";
import TopNavBar from "./src/components/TopNavBar";
import VideoList from "./src/components/video-list/VideoList";
import NavTabBanner from "./src/components/common/NavTabBanner";
import SelectedVideoPage from "./src/components/common/SelectedVideoPage";
import Constants from "expo-constants";
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

const Stack = createNativeStackNavigator();

// Main app component — serves both authenticated and guest users
const MainApp: React.FC = () => {
  const dispatch = useDispatch();
  const clerkSupabase = useSupabaseWithClerk();
  const { userId, isSignedIn } = useAuth();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);

  const [isRestoringState, setIsRestoringState] = useState(true);

  // Sync currentSentence changes to the database
  useUIStateSync();

  // Use authenticated client when available, raw client for guests
  const publicSupabase = clerkSupabase ?? rawSupabase;

  // Public data — fetch once client is ready
  useEffect(() => {
    fetchAllVideos({ supabase: publicSupabase }).then(
      ({ channelData, videoData, topicData, channelTopicData }) => {
        dispatch(setAllChannels(channelData));
        dispatch(setAllVideos(videoData));
        dispatch(setAllTopics(topicData));
        dispatch(setChannelTopics(channelTopicData));
      },
    );
  }, [publicSupabase]);

  // User-specific data — only when signed in
  useEffect(() => {
    if (!clerkSupabase || !userId) {
      setIsRestoringState(false);
      return;
    }

    setIsRestoringState(true);

    // Pre-load and cache TTS responses in the background
    loadAndCacheTTSResponses({ supabase: clerkSupabase, dispatch }).catch(
      (err) => console.error("Failed to load cached TTS responses:", err),
    );

    // Fetch user's known vocabulary
    fetchUserKnownVocab({ supabase: clerkSupabase }).then((vocabIds) => {
      dispatch(setUserKnownVocab(vocabIds));
    });

    // Fetch video views
    fetchUserVideoViews({ supabase: clerkSupabase }).then((videoViews) => {
      dispatch(setUserVideoViews(videoViews));
    });

    // Fetch and restore user UI state
    const restoreState = async () => {
      const { videoContext, currentShadowTab, memorizeDifficulty, settings, hasSeenWelcomeModals } =
        await restoreUserUIState({
          supabase: clerkSupabase,
          userId,
        });

      dispatch(setUserSettings(settings));
      dispatch(setHasSeenWelcomeModals(hasSeenWelcomeModals));

      if (currentShadowTab) {
        dispatch(setCurrentShadowTab(currentShadowTab));
      }

      if (settings.saveMemorizeDifficulty && memorizeDifficulty !== null) {
        dispatch(setMemorizeDifficulty(memorizeDifficulty));
      } else {
        dispatch(setMemorizeDifficulty(settings.defaultMemorizeDifficulty));
      }

      if (videoContext) {
        dispatch(setCurrentVideo(videoContext));
      }

      // Fetch user credits
      const credits = await fetchUserCredits({
        supabase: clerkSupabase,
        userId,
      });
      dispatch(setUserCredits(credits ?? 0));

      setIsRestoringState(false);
    };

    restoreState();
  }, [clerkSupabase, dispatch, userId]);

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
        </View>
      ) : currentVideo ? (
        <>
          <NavTabBanner />
          <SelectedVideoPage />
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
      <Stack.Screen name="MainApp" component={MainApp} />
      <Stack.Screen
        name="SignIn"
        component={SignInScreen}
        options={{ presentation: "formSheet" }}
      />
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
