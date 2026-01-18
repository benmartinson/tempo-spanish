import * as React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import HomeScreen from "./src/components/HomeScreen";
import { Provider } from 'react-redux';
import store from "./src/store/store";

const Stack = createStackNavigator();

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <NavigationContainer>
      <Stack.Navigator
        id="MainStack"
        initialRouteName="Index"
        screenOptions={{ title: "SpeakUp Spanish" }}
      >
          <Stack.Screen name="Index" component={HomeScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </Provider>
  );
}

export default App;
