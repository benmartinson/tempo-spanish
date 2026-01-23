import * as React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import GeneralChat from "./src/components/protected/GeneralChat";
import SignInScreen from "./src/components/SignInScreen";
import SignUpScreen from "./src/components/SignUpScreen";
import { Provider } from 'react-redux';
import store from "./src/store/store";
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { ActivityIndicator, View } from 'react-native';

const Stack = createStackNavigator();

// Separate component that uses auth hooks (must be inside ClerkProvider)
const AppNavigator: React.FC = () => {
  const { isSignedIn, isLoaded } = useAuth();

  // Show loading spinner while Clerk initializes
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      id="MainStack"
      screenOptions={{ headerShown: false }}
    >
      {isSignedIn ? (
        // Protected screens
        <Stack.Screen name="GeneralChat" component={GeneralChat} />
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
}

export default App;
