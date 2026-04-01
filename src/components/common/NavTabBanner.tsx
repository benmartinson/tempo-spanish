import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { RootState } from "../../types";
import { useDispatch, useSelector } from "react-redux";
import {
  setCurrentVideo,
  setCurrentTab,
} from "../../store/actions/dataActions";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";
import {
  saveLastSentenceWatched,
  persistVideoUnselection,
} from "../../requests";

type NavTab = "watch" | "shadow" | "review" | "speed-run";

interface NavTabBannerProps {
  selectedTab: NavTab;
  onTabSelect: (tab: NavTab) => void;
}

const NavTabBanner: React.FC<NavTabBannerProps> = ({
  selectedTab,
  onTabSelect,
}) => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);

  if (!currentVideo) {
    return null;
  }

  const handleBackPress = async () => {
    if (supabase && currentVideo?.videoViewId) {
      saveLastSentenceWatched({
        supabase,
        videoViewId: currentVideo.videoViewId,
        currentSentence: currentVideo.currentSentence,
      });
    }

    dispatch(setCurrentVideo(null));
    dispatch(setCurrentTab("videos"));

    persistVideoUnselection({ supabase, userId });
  };

  const tabs: { key: NavTab; label: string }[] = [
    { key: "shadow", label: "Shadow" },
    { key: "speed-run", label: "Speed Run" },
    { key: "review", label: "Review" },
  ];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
        <MaterialIcons name="chevron-left" size={28} color="#d0d8f0" />
      </TouchableOpacity>
      <View style={styles.tabsContainer}>
        {tabs.map((tab, index) => (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [
              styles.tabButton,
              index > 0 && styles.tabButtonWithBorder,
              selectedTab === tab.key && styles.tabButtonSelected,
              pressed && { opacity: 0.6 },
            ]}
            onPress={() => onTabSelect(tab.key)}
          >
            <Text
              style={[
                selectedTab !== tab.key && styles.tabText,
                selectedTab === tab.key && styles.tabTextSelected,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 64,
    backgroundColor: "white",
    width: "100%",
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d0d8f0",
  },
  backButton: {
    width: 44,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#d0d8f0",
  },
  tabsContainer: {
    flex: 1,
    flexDirection: "row",
    height: "100%",
  },
  tabButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  tabButtonWithBorder: {
    borderLeftWidth: 1,
    borderLeftColor: "#d0d8f0",
  },
  tabButtonSelected: {
    backgroundColor: "#fafafa",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "gray",
  },
  tabTextSelected: {
    fontWeight: "700",
    color: "#5a5680",
  },
});

export default NavTabBanner;
