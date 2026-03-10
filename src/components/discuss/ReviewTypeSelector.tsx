import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { QuizType } from "../../types";

const QUIZ_TYPES: { value: QuizType; label: string; icon: string }[] = [
  { value: "Vocab", label: "Selected Words", icon: "translate" },
  { value: "Phrases", label: "Selected Segments", icon: "short-text" },
  { value: "Uncommon", label: "Uncommon Words", icon: "sort" },
];

interface ReviewTypeSelectorProps {
  selectedQuizType: QuizType;
  onSelectQuizType: (type: QuizType) => void;
}

const ReviewTypeSelector: React.FC<ReviewTypeSelectorProps> = ({
  selectedQuizType,
  onSelectQuizType,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [buttonLayout, setButtonLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const buttonRef = useRef<View>(null);

  const handleSelect = (type: QuizType) => {
    onSelectQuizType(type);
    setIsOpen(false);
  };

  const openDropdown = () => {
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      setButtonLayout({ x, y, width, height });
      setIsOpen(true);
    });
  };

  const selectedItem = QUIZ_TYPES.find((t) => t.value === selectedQuizType);

  return (
    <>
      <View ref={buttonRef} collapsable={false}>
        <TouchableOpacity
          style={styles.button}
          onPress={openDropdown}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name={selectedItem?.icon as any}
            size={16}
            color="#4a69bd"
          />
          <Text style={styles.buttonText}>{selectedQuizType}</Text>
          <MaterialIcons
            name={isOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"}
            size={18}
            color="#666"
          />
        </TouchableOpacity>
      </View>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.dropdown,
                  {
                    top: buttonLayout.y + buttonLayout.height + 4,
                    left: Math.max(8, buttonLayout.x - 30),
                  },
                ]}
              >
                {QUIZ_TYPES.map((type, index) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.dropdownItem,
                      selectedQuizType === type.value &&
                        styles.dropdownItemSelected,
                      index < QUIZ_TYPES.length - 1 &&
                        styles.dropdownItemBorder,
                    ]}
                    onPress={() => handleSelect(type.value)}
                    activeOpacity={0.6}
                  >
                    <MaterialIcons
                      name={type.icon as any}
                      size={20}
                      color={
                        selectedQuizType === type.value ? "#4a69bd" : "#666"
                      }
                    />
                    <Text
                      style={[
                        styles.dropdownItemText,
                        selectedQuizType === type.value &&
                          styles.dropdownItemTextSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                    {selectedQuizType === type.value && (
                      <MaterialIcons name="check" size={18} color="#4a69bd" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    backgroundColor: "#f8f9ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d0d8f0",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  dropdown: {
    position: "absolute",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 240,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  dropdownItemSelected: {
    backgroundColor: "white",
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
  },
  dropdownItemTextSelected: {
    color: "#4a69bd",
    fontWeight: "600",
  },
});

export default ReviewTypeSelector;
