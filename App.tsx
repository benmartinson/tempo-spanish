import * as React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import GeneralChat from "./src/components/GeneralChat";
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
        screenOptions={{ headerShown: false }}
      >
          <Stack.Screen name="Index" component={GeneralChat} />
        </Stack.Navigator>
      </NavigationContainer>
    </Provider>
  );
}

export default App;
