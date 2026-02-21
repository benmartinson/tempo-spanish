import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { VideoQuestion } from "../../types";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Modal from "./Modal";

type NavSwitcherProps = {
  onPrev: () => void;
  onNext: () => void;
  currentIndex: number;
  children: React.ReactNode;
  totalItems: number;
};
const NavSwitcher: React.FC<NavSwitcherProps> = ({
  onPrev,
  onNext,
  currentIndex,
  children,
  totalItems,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [sentenceNumberQuery, setSentenceNumberQuery] = useState("");
  const [wordQuery, setWordQuery] = useState("");

  const handleSubmit = () => {
    console.log("sentenceNumberQuery", sentenceNumberQuery);
    console.log("wordQuery", wordQuery);
  };
  return (
    <View style={styles.navHeader}>
      <TouchableOpacity
        style={[
          styles.navButton,
          currentIndex === 0 && styles.navButtonDisabled,
        ]}
        onPress={onPrev}
        disabled={currentIndex === 0}
      >
        <MaterialIcons
          name="chevron-left"
          size={24}
          color={currentIndex === 0 ? "#ccc" : "#333"}
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setIsSearchOpen(true)}
        style={styles.navCenter}
      >
        <View style={styles.hiddenSearchIconContainer}>
          <MaterialIcons name="search" size={24} color="#333" />
        </View>
        {children}
        <View style={styles.searchIconContainer}>
          <MaterialIcons name="search" size={24} color="#333" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.navButton,
          currentIndex === totalItems - 1 && styles.navButtonDisabled,
        ]}
        onPress={onNext}
        disabled={currentIndex === totalItems - 1}
      >
        <MaterialIcons
          name="chevron-right"
          size={24}
          color={currentIndex === totalItems - 1 ? "#ccc" : "#333"}
        />
      </TouchableOpacity>
      {isSearchOpen && (
        <Modal
          visible={isSearchOpen}
          onRequestClose={() => setIsSearchOpen(false)}
          title="Search"
        >
          <View style={styles.searchContainer}>
            <TextInput
              placeholder="By Sentence Number"
              value={sentenceNumberQuery}
              onChangeText={setSentenceNumberQuery}
            />
            <TextInput
              placeholder="By Word/Phrase"
              value={wordQuery}
              onChangeText={setWordQuery}
            />
            <TouchableOpacity
              onPress={handleSubmit}
              style={styles.submitButton}
            >
              <Text>Submit</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fafafa",
  },
  searchButton: {
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  hiddenSearchIconContainer: {
    padding: 4,
    opacity: 0,
  },
  searchIconContainer: {
    padding: 4,
  },
  navButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  navButtonDisabled: {
    backgroundColor: "#f8f8f8",
  },
  navCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  navCounter: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  searchContainer: {
    flexDirection: "column",
    gap: 8,
  },
  submitButton: {
    backgroundColor: "#5a5680",
    padding: 16,
    borderRadius: 16,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default NavSwitcher;
