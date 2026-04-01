import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface BubbleOption {
  key: string;
  label: string;
}

interface BubbleSelectorProps {
  selectedBubble?: string;
  setSelectedBubble?: (selectedBubble: string) => void;
  options?: BubbleOption[];
  selectedKey?: string;
  onSelect?: (key: string) => void;
  allowDeselect?: boolean;
}

const DEFAULT_OPTIONS: BubbleOption[] = [
  { key: "large", label: "Spanish" },
  { key: "translation", label: "English" },
];

const BubbleSelector: React.FC<BubbleSelectorProps> = ({
  selectedBubble,
  setSelectedBubble,
  options,
  selectedKey,
  onSelect,
  allowDeselect = true,
}) => {
  const activeOptions = options || DEFAULT_OPTIONS;
  const activeSelected = selectedKey ?? selectedBubble ?? "";
  const activeOnSelect = onSelect || setSelectedBubble;

  const handleBubbleSelection = (selection: string) => {
    if (!activeOnSelect) return;
    if (allowDeselect && selection === activeSelected) {
      activeOnSelect("");
      return;
    }
    activeOnSelect(selection);
  };

  const buttonWidth = `${100 / activeOptions.length}%` as const;

  return (
    <View style={styles.outerContainer}>
      <View style={styles.container}>
        {activeOptions.map((option, index) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.button,
              { width: buttonWidth },
              activeSelected === option.key && styles.selectedButton,
              index < activeOptions.length - 1 && { borderRightWidth: 1 },
            ]}
            onPress={() => handleBubbleSelection(option.key)}
          >
            <Text style={styles.buttonText}>{option.label}</Text>
          </TouchableOpacity>
        ))}
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
    borderWidth: 1,
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
