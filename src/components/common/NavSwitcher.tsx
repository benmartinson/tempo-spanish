import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ContextSegment, Sentence } from "../../types";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import SentenceSearchModal from "./SentenceSearchModal";

type NavSwitcherProps = {
  onPrev: () => void;
  onNext: () => void;
  currentIndex: number;
  children: React.ReactNode;
  totalItems: number;
  sentences?: Sentence[];
  onPlayClip?: (start: number) => void;
  videoId?: string;
  hasSearch?: boolean;
};

const NavSwitcher: React.FC<NavSwitcherProps> = ({
  onPrev,
  onNext,
  currentIndex,
  children,
  totalItems,
  sentences = [],
  onPlayClip,
  videoId = "",
  hasSearch = true,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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

      {hasSearch ? (
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
      ) : (
        <View style={styles.navCenter}>{children}</View>
      )}

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

      <SentenceSearchModal
        visible={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        sentences={sentences}
        onPlayClip={onPlayClip}
        videoId={videoId}
      />
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
});

export default NavSwitcher;
