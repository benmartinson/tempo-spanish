import * as React from "react";
import { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Chat from "./src/components/discuss/Chat";
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
} from "./src/store/actions/dataActions";
import { useSupabaseWithClerk } from "./utils/supabase";
import {
  VideoView,
  Vocabulary,
  RootState,
  VideoContext,
  Segment,
} from "./src/types";
import { splitSegmentsIntoSentences } from "./src/helpers";
import { BACKEND_BASE_URL } from "./src/components/streaming_helpers";
import { useUIStateSync } from "./src/components/useUIStateSync";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TabIcon from "./src/components/tabs/TabIcon";
import WatchTab from "./src/components/watch/WatchTab";
import TopNavBar from "./src/components/TopNavBar";
import DiscussTab from "./src/components/discuss/DiscussTab";
import VideoList from "./src/components/video-list/VideoList";
import SelectedVideoBanner from "./src/components/common/SelectedVideoBanner";
import NavTabBanner from "./src/components/common/NavTabBanner";
import ShadowTab from "./src/components/shadow/ShadowTab";
import SelectedVideoTabs from "./src/components/common/SelectedVideoTabs";

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
        component={DiscussTab}
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
  const [selectedNavTab, setSelectedNavTab] = useState<
    "watch" | "shadow" | "review"
  >("watch");
  const [isRestoringState, setIsRestoringState] = useState(true);

  // Sync currentSentence changes to the database
  useUIStateSync();

  useEffect(() => {
    if (!supabase) return;

    // Fetch all vocabulary
    const fetchAllVocabulary = async () => {
      let allVocab: Vocabulary[] = [];
      let from = 0;
      const limit = 1000;
      let fetching = true;

      while (fetching) {
        const { data, error } = await supabase
          .from("vocabulary")
          .select("id, word, translation, frequency")
          .range(from, from + limit - 1);

        if (error) {
          console.error(error);
          fetching = false;
        } else {
          const vocabBatch = (data as Vocabulary[]) ?? [];
          allVocab = [...allVocab, ...vocabBatch];
          if (vocabBatch.length < limit) {
            fetching = false;
          } else {
            from += limit;
          }
        }
      }

      const vocabHash = allVocab.reduce(
        (acc, v) => {
          acc[v.word] = v;
          return acc;
        },
        {} as Record<string, Vocabulary>,
      );
      dispatch(setAllVocabulary(vocabHash));
    };

    fetchAllVocabulary();

    // Fetch user's known vocabulary
    supabase
      .from("user_known_vocab")
      .select("vocabulary_id")
      .then(({ data, error }) => {
        if (error) console.error(error);
        const vocabIds = (data ?? []).map(
          (row: { vocabulary_id: number }) => row.vocabulary_id,
        );
        dispatch(setUserKnownVocab(vocabIds));
      });

    // fetch video views
    supabase
      .from("video_views")
      .select("id, video_id, watched_at")
      .then(({ data, error }) => {
        if (error) console.error(error);
        const videoViews = (data as VideoView[]) ?? [];
        dispatch(setUserVideoViews(videoViews));
      });

    // Fetch and restore user UI state
    const restoreUserUIState = async () => {
      if (!userId) {
        setIsRestoringState(false);
        return;
      }

      try {
        const { data: uiState, error } = await supabase
          .from("user_ui_state")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (error) {
          // No existing state is fine, just skip restoration
          if (error.code !== "PGRST116") {
            console.error("Error fetching user UI state:", error);
          }
          setIsRestoringState(false);
          return;
        }

        if (uiState?.current_video) {
          // Fetch the video record to get the video_id string
          const { data: videoRecord, error: videoError } = await supabase
            .from("video")
            .select("video_id")
            .eq("id", uiState.current_video)
            .single();

          if (videoError || !videoRecord) {
            console.error("Error fetching video record:", videoError);
            setIsRestoringState(false);
            return;
          }

          // Fetch video segments from backend
          const response = await fetch(
            `${BACKEND_BASE_URL}/video-segments/${videoRecord.video_id}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            },
          );

          if (!response.ok) {
            console.error("Failed to fetch video segments for restoration");
            setIsRestoringState(false);
            return;
          }

          const data = await response.json();
          if (data.error) {
            console.error("Error in video segments response:", data.error);
            setIsRestoringState(false);
            return;
          }

          // Get or create video view
          const { data: videoViewData, error: videoViewError } = await supabase
            .from("video_views")
            .upsert(
              {
                video_id: uiState.current_video,
                watched_at: new Date(),
              },
              {
                onConflict: "user_id,video_id",
                ignoreDuplicates: false,
              },
            )
            .select("id");

          if (videoViewError) console.error(videoViewError);
          const videoViewId = videoViewData?.[0]?.id ?? "";

          const sentences = splitSegmentsIntoSentences(data.segments);
          const video: VideoContext = {
            videoId: data.video_id,
            recordId: uiState.current_video,
            currentSentence: uiState.current_sentence ?? 0,
            sentences,
            allWords: data.segments.flatMap((s: Segment) => s.words),
            videoViewId: String(videoViewId),
            focusVocab: [],
            focusSentences: [],
          };

          dispatch(setCurrentVideo(video));
          console.log("AuthenticatedApp restoredVideo", video.currentSentence);
          // Restore the tab if it's one of the persisted tabs
          if (
            uiState.current_tab &&
            ["watch", "discuss", "shadow"].includes(uiState.current_tab)
          ) {
            dispatch(setCurrentTab(uiState.current_tab));
            // Also update the local nav tab state
            if (uiState.current_tab === "discuss") {
              setSelectedNavTab("review");
            } else if (
              uiState.current_tab === "watch" ||
              uiState.current_tab === "shadow"
            ) {
              setSelectedNavTab(uiState.current_tab);
            }
          }
        }
      } catch (err) {
        console.error("Error restoring user UI state:", err);
      } finally {
        setIsRestoringState(false);
      }
    };

    restoreUserUIState();
  }, [supabase, dispatch, userId]);

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

  const handleNavTabSelect = async (tab: "watch" | "shadow" | "review") => {
    setSelectedNavTab(tab);
    // Also update redux current tab for consistency
    const reduxTab = tab === "review" ? "discuss" : tab;
    dispatch(setCurrentTab(reduxTab));

    // Persist tab to database (only for watch/discuss/shadow)
    if (supabase && userId) {
      const { error } = await supabase
        .from("user_ui_state")
        .upsert(
          { user_id: userId, current_tab: reduxTab, updated_at: new Date() },
          { onConflict: "user_id" },
        );
      if (error) console.error("Error persisting tab:", error);
    }
  };

  const renderTabContent = () => {
    return <SelectedVideoTabs selectedNavTab={selectedNavTab} />;
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
    <View style={{ flex: 1 }}>
      <TopNavBar />
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

  // Show loading spinner while Clerk initializes
  if (!isLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#1a1a2e",
        }}
      >
        <ActivityIndicator size="large" color="#5a5680" />
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
    <ClerkProvider tokenCache={tokenCache}>
      <Provider store={store}>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </Provider>
    </ClerkProvider>
  );
};

export default App;
