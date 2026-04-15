import * as React from "react";
import { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import SignInScreen from "./src/components/SignInScreen";
import SignUpScreen from "./src/components/SignUpScreen";
import { Provider, useDispatch, useSelector } from "react-redux";
import store from "./src/store/store";
import {
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
import { RootState } from "./src/types";
import { createVocabHash } from "./src/helpers/helpers";
import {
  fetchVideoContext,
  fetchAllVideos,
  fetchAllVocabulary,
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
import SelectedVideoTabs from "./src/components/common/SelectedVideoTabs";
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

const Stack = createStackNavigator();

// Wrapper component that includes TopNavBar
const AuthenticatedApp: React.FC = () => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const userSettings = useSelector((state: RootState) => state.userSettings);
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
          <SelectedVideoTabs />
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
