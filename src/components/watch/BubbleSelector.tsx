import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface BubbleSelectorProps {
  selectedBubble: string;
  setSelectedBubble: (selectedBubble: string) => void;
}

const BubbleSelector: React.FC<BubbleSelectorProps> = ({
  selectedBubble,
  setSelectedBubble,
}) => {
  const handleBubbleSelection = (selection: string) => {
    if (selection === selectedBubble) {
      setSelectedBubble("");
      return;
    }
    setSelectedBubble(selection);
  };
  return (
    <View style={styles.outerContainer}>
      <View style={styles.container}>
        {/* <TouchableOpacity
          style={[
            styles.button,
            selectedBubble === "small" && styles.selectedButton,
            { borderRightWidth: 1 },
          ]}
          onPress={() => handleBubbleSelection("small")}
        >
          <Text style={styles.buttonText}>Small</Text>
        </TouchableOpacity> */}
        <TouchableOpacity
          style={[
            styles.button,
            selectedBubble === "large" && styles.selectedButton,
            { borderRightWidth: 1 },
          ]}
          onPress={() => handleBubbleSelection("large")}
        >
          <Text style={styles.buttonText}>Spanish</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            selectedBubble === "translation" && styles.selectedButton,
          ]}
          onPress={() => handleBubbleSelection("translation")}
        >
          <Text style={styles.buttonText}>English</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    paddingHorizontal: 16,
    width: "100%",
    marginTop: 16,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "black",
    overflow: "hidden",
    width: "100%",
  },
  button: {
    width: "50%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderColor: "black",
    height: 28,
  },
  selectedButton: {
    backgroundColor: "#e0e0e0", // Light grey
  },
  buttonText: {
    color: "black",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default BubbleSelector;
