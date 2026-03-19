import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from "react-native";

export const FREQUENCY_OPTIONS = [
  { label: "Most Common (top 3%)", minP: 1, maxP: 3 },
  { label: "Common (3–10%)", minP: 3, maxP: 10 },
  { label: "Intermediate (8–20%)", minP: 8, maxP: 20 },
  { label: "Advanced (20–50%)", minP: 20, maxP: 50 },
  { label: "Rare (30–100%)", minP: 30, maxP: 100 },
];

interface SelectVocabFilterModalProps {
  visible: boolean;
  onClose: () => void;
  selectedRange: [number, number];
  onSelect: (minP: number, maxP: number) => void;
}

const SelectVocabFilterModal: React.FC<SelectVocabFilterModalProps> = ({
  visible,
  onClose,
  selectedRange,
  onSelect,
}) => {
  const isSelected = (opt: (typeof FREQUENCY_OPTIONS)[0]) =>
    selectedRange[0] === opt.minP && selectedRange[1] === opt.maxP;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Word Frequency</Text>
          {FREQUENCY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={`${option.minP}-${option.maxP}`}
              style={[
                styles.option,
                isSelected(option) && styles.optionSelected,
              ]}
              onPress={() => onSelect(option.minP, option.maxP)}
            >
              <Text
                style={[
                  styles.optionText,
                  isSelected(option) && styles.optionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    width: "80%",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#222",
    marginBottom: 8,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: "100%",
    borderRadius: 8,
  },
  optionSelected: {
    backgroundColor: "#3d3a52",
  },
  optionText: {
    fontSize: 16,
    color: "#222",
  },
  optionTextSelected: {
    color: "#fff",
  },
});

export default SelectVocabFilterModal;
