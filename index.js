import { registerRootComponent } from "expo";

try {
  const App = require("./App").default;
  registerRootComponent(App);
} catch (e) {
  const { View, Text } = require("react-native");
  const ErrorApp = () => (
    <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
      <Text selectable>{String(e)}</Text>
    </View>
  );
  registerRootComponent(ErrorApp);
}
