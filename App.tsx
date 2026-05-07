import * as React from "react";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  NavigationContainer,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
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
  setSelectedChannelId,
  addUserVideoView,
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
import { ActivityIndicator, Platform, View } from "react-native";
import TopNavBar from "./src/components/TopNavBar";
import VideoList from "./src/components/video-list/VideoList";
import NavTabBanner from "./src/components/common/NavTabBanner";
import SelectedVideoPage from "./src/components/common/SelectedVideoPage";
import CreditStore from "./src/components/CreditStore";
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

const CREDIT_PACK_CREDITS: Record<string, number> = {
  tempo_credits_1000: 1000,
  tempo_credits_5000: 5000,
  tempo_credits_10000: 10000,
};

const linking: any = {
  prefixes: [],
  getStateFromPath(path: string) {
    const [pathname] = path.split("?");
    const segments = pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));

    const params: { channelId?: string; videoId?: string } = {};
    if (segments[0] === "channel" && segments[1]) {
      params.channelId = segments[1];
    }
    if (segments[0] === "video" && segments[1]) {
      params.videoId = segments[1];
    }

    return {
      routes: [{ name: "MainApp", params }],
    };
  },
  getPathFromState(state: any) {
    const route = state.routes[state.index ?? 0];
    if (route?.name !== "MainApp") return "";

    const { channelId, videoId } = route.params ?? {};
    if (videoId) {
      return `/video/${encodeURIComponent(videoId)}`;
    }
    if (channelId) return `/channel/${encodeURIComponent(channelId)}`;
    return "/";
  },
};

// Main app component — serves both authenticated and guest users
const MainApp: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const clerkSupabase = useSupabaseWithClerk();
  const { userId, isSignedIn } = useAuth();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const selectedChannelId = useSelector(
    (state: RootState) => state.selectedChannelId,
  );
  const allVideos = useSelector((state: RootState) => state.allVideos);
  const allChannels = useSelector((state: RootState) => state.allChannels);
  const routeChannelId =
    typeof route.params?.channelId === "string" ? route.params.channelId : null;
  const routeVideoId =
    typeof route.params?.videoId === "string" ? route.params.videoId : null;
  const hasRouteTarget =
    Platform.OS === "web" && !!(routeChannelId || routeVideoId);

  const [isRestoringState, setIsRestoringState] = useState(true);
  const [isLoadingRouteVideo, setIsLoadingRouteVideo] = useState(false);
  const [creditStoreVisible, setCreditStoreVisible] = useState(false);
  const [checkoutSuccessCredits, setCheckoutSuccessCredits] = useState<
    number | null
  >(null);

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
      // Still restore hasSeenWelcomeModals from local storage when signed out
      // DEV: uncomment to reset walkthrough state
      // AsyncStorage.removeItem("has_seen_welcome_modals");
      AsyncStorage.getItem("has_seen_welcome_modals").then((seen) => {
        console.log("[AsyncStorage] has_seen_welcome_modals =", seen);
        if (seen === "true") {
          dispatch(setHasSeenWelcomeModals(true));
        }
      });
      setIsRestoringState(false);
      return;
    }

    setIsRestoringState(true);

    // Pre-load and cache TTS responses in the background
    loadAndCacheTTSResponses({ supabase: clerkSupabase, dispatch }).catch(
      (err) => console.error("Failed to load cached TTS responses:", err),
    );

    const refreshCredits = async () => {
      const credits = await fetchUserCredits({
        supabase: clerkSupabase,
        userId,
      });
      dispatch(setUserCredits(credits ?? 0));
      return credits;
    };

    // Fetch user's known vocabulary
    fetchUserKnownVocab({ supabase: clerkSupabase }).then((vocabIds) => {
      dispatch(setUserKnownVocab(vocabIds));
    });

    // Fetch video views
    fetchUserVideoViews({
      supabase: clerkSupabase,
      userId,
    }).then((videoViews) => {
      dispatch(setUserVideoViews(videoViews));
    });

    // Fetch and restore user UI state
    const restoreState = async () => {
      const {
        videoContext,
        currentShadowTab,
        memorizeDifficulty,
        settings,
        hasSeenWelcomeModals,
      } = await restoreUserUIState({
        supabase: clerkSupabase,
        userId,
      });

      dispatch(setUserSettings(settings));
      AsyncStorage.getItem("has_seen_welcome_modals").then((seen) => {
        if (seen === "true") {
          dispatch(setHasSeenWelcomeModals(true));
        } else {
          dispatch(setHasSeenWelcomeModals(hasSeenWelcomeModals));
        }
      });

      if (currentShadowTab) {
        dispatch(setCurrentShadowTab(currentShadowTab));
      }

      if (settings.saveMemorizeDifficulty && memorizeDifficulty !== null) {
        dispatch(setMemorizeDifficulty(memorizeDifficulty));
      } else {
        dispatch(setMemorizeDifficulty(settings.defaultMemorizeDifficulty));
      }

      if (videoContext && !hasRouteTarget) {
        dispatch(setCurrentVideo(videoContext));
      }

      await refreshCredits();

      setIsRestoringState(false);
    };

    restoreState();
  }, [clerkSupabase, dispatch, userId]);

  useEffect(() => {
    if (Platform.OS !== "web" || !clerkSupabase || !userId) return;
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const checkoutStatus = url.searchParams.get("stripe_checkout");
    if (!checkoutStatus) return;

    const checkoutProductId = url.searchParams.get("stripe_product_id");
    const purchasedCredits = checkoutProductId
      ? (CREDIT_PACK_CREDITS[checkoutProductId] ?? null)
      : null;

    setCheckoutSuccessCredits(
      checkoutStatus === "success" ? purchasedCredits : null,
    );
    setCreditStoreVisible(true);

    url.searchParams.delete("stripe_checkout");
    url.searchParams.delete("stripe_session_id");
    url.searchParams.delete("stripe_product_id");
    window.history.replaceState({}, "", url.toString());

    if (checkoutStatus !== "success") return;

    let cancelled = false;
    const refreshCreditsAfterCheckout = async () => {
      for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
        const credits = await fetchUserCredits({
          supabase: clerkSupabase,
          userId,
        });
        if (credits != null) {
          dispatch(setUserCredits(credits));
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    };

    refreshCreditsAfterCheckout();
    return () => {
      cancelled = true;
    };
  }, [clerkSupabase, dispatch, userId]);

  useEffect(() => {
    if (!creditStoreVisible || checkoutSuccessCredits == null) return;

    const timer = setTimeout(() => {
      setCreditStoreVisible(false);
      setCheckoutSuccessCredits(null);
    }, 4500);

    return () => clearTimeout(timer);
  }, [creditStoreVisible, checkoutSuccessCredits]);

  useEffect(() => {
    if (Platform.OS !== "web" || isRestoringState) return;

    if (!routeChannelId && !routeVideoId) {
      if (currentVideo) dispatch(setCurrentVideo(null));
      if (selectedChannelId) dispatch(setSelectedChannelId(null));
      setIsLoadingRouteVideo(false);
      return;
    }

    if (routeVideoId) {
      if (!allVideos.length) return;

      const routeVideo = allVideos.find(
        (video) => video.video_id === routeVideoId,
      );
      if (!routeVideo) return;

      if (selectedChannelId) dispatch(setSelectedChannelId(null));
      if (
        currentVideo?.videoId === routeVideoId &&
        currentVideo?.recordId === routeVideo.id
      ) {
        setIsLoadingRouteVideo(false);
        return;
      }

      let cancelled = false;
      setIsLoadingRouteVideo(true);
      fetchVideoContext({
        supabase: rawSupabase,
        videoId: routeVideo.video_id,
        recordId: routeVideo.id,
        userId,
      })
        .then(({ videoContext, videoView }) => {
          if (cancelled) return;
          if (userId && videoView) {
            dispatch(addUserVideoView(videoView));
          }
          dispatch(setCurrentVideo(videoContext));
        })
        .catch((error) => {
          if (!cancelled) console.error("Error loading route video:", error);
        })
        .finally(() => {
          if (!cancelled) setIsLoadingRouteVideo(false);
        });

      return () => {
        cancelled = true;
      };
    }

    if (currentVideo) dispatch(setCurrentVideo(null));
    setIsLoadingRouteVideo(false);
    if (allChannels.length && selectedChannelId !== routeChannelId) {
      dispatch(setSelectedChannelId(routeChannelId));
    }
  }, [
    allChannels.length,
    allVideos,
    currentVideo,
    dispatch,
    isRestoringState,
    routeChannelId,
    routeVideoId,
    selectedChannelId,
    userId,
  ]);

  const navigateHome = () => {
    navigation.navigate({
      name: "MainApp",
      params: {},
      merge: false,
    });
  };

  const navigateChannel = (channelId: string) => {
    navigation.navigate({
      name: "MainApp",
      params: { channelId },
      merge: false,
    });
  };

  const navigateVideo = (videoId: string) => {
    navigation.navigate({
      name: "MainApp",
      params: { videoId },
      merge: false,
    });
  };

  const routeVideoIsReady =
    !routeVideoId || currentVideo?.videoId === routeVideoId;
  const shouldShowVideoPage =
    Platform.OS === "web"
      ? !!routeVideoId && routeVideoIsReady
      : !!currentVideo;

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      {(!shouldShowVideoPage || isRestoringState || isLoadingRouteVideo) && (
        <TopNavBar />
      )}
      {isRestoringState || isLoadingRouteVideo || !routeVideoIsReady ? (
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
      ) : shouldShowVideoPage ? (
        <>
          <NavTabBanner />
          <SelectedVideoPage />
        </>
      ) : (
        <VideoList
          routeChannelId={routeChannelId}
          onNavigateHome={navigateHome}
          onNavigateChannel={navigateChannel}
          onNavigateVideo={navigateVideo}
        />
      )}
      <CreditStore
        visible={creditStoreVisible}
        onClose={() => {
          setCreditStoreVisible(false);
          setCheckoutSuccessCredits(null);
        }}
        checkoutSuccessCredits={checkoutSuccessCredits}
      />
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
        options={{ presentation: "transparentModal" }}
      />
    </Stack.Navigator>
  );
};

const App: React.FC = () => {
  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <Provider store={store}>
        <NavigationContainer
          linking={Platform.OS === "web" ? linking : undefined}
          documentTitle={
            Platform.OS === "web" ? { formatter: () => "Tempo" } : undefined
          }
        >
          <AppNavigator />
        </NavigationContainer>
      </Provider>
    </ClerkProvider>
  );
};

export default App;
