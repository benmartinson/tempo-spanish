import * as React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Chat from "./src/components/discuss/Chat";
import SignInScreen from "./src/components/SignInScreen";
import SignUpScreen from "./src/components/SignUpScreen";
import HomeTab from "./src/components/tabs/HomeTab";
import VideosTab from "./src/components/tabs/VideosTab";
import { Provider, useDispatch } from "react-redux";
import store from "./src/store/store";
import { setCurrentTab, setAllVocabulary } from "./src/store/actions/dataActions";
import { useSupabaseWithClerk } from "./utils/supabase";
import { useEffect } from "react";
import { Vocabulary } from "./src/types";
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
import ShadowTab from "./src/components/shadow/ShadowTab";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Main tabs for authenticated users
const MainTabs: React.FC = () => {
  const dispatch = useDispatch();

  return (
    <Tab.Navigator
      id="MainTabs"
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
            <TabIcon icon="chat-outline" label="Discuss" focused={focused} />
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

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("vocabulary")
      .select("id, word, translation")
      .then(({ data, error }) => {
        if (error) console.error(error);
        dispatch(setAllVocabulary((data as Vocabulary[]) ?? []));
      });
  }, [supabase, dispatch]);

  return (
    <View style={{ flex: 1 }}>
      <TopNavBar />
      <MainTabs />
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
