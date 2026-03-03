import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { RootState } from "../../types";
import { useDispatch, useSelector } from "react-redux";
import {
  setCurrentVideo,
  setCurrentTab,
} from "../../store/actions/dataActions";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";

type NavTab = "watch" | "shadow" | "review";

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
    // Save last_sentence_watched before clearing
    if (supabase && currentVideo?.videoViewId) {
      const { error: sentenceError } = await supabase
        .from("video_views")
        .update({ last_sentence_watched: currentVideo.currentSentence })
        .eq("id", currentVideo.videoViewId);
      if (sentenceError)
        console.error("Error saving last_sentence_watched:", sentenceError);
    }

    dispatch(setCurrentVideo(null));
    dispatch(setCurrentTab("videos"));

    // Persist video unselection to user_ui_state
    if (supabase && userId) {
      const { error } = await supabase.from("user_ui_state").upsert(
        {
          user_id: userId,
          current_video: null,
          updated_at: new Date(),
        },
        { onConflict: "user_id" },
      );
      if (error) console.error("Error persisting video unselection:", error);
    }
  };

  const tabs: { key: NavTab; label: string }[] = [
    { key: "shadow", label: "Shadow" },
    { key: "watch", label: "Watch" },
    { key: "review", label: "Review" },
  ];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
        <MaterialIcons name="chevron-left" size={28} color="gray" />
      </TouchableOpacity>
      <View style={styles.tabsContainer}>
        {tabs.map((tab, index) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabButton,
              index > 0 && styles.tabButtonWithBorder,
              selectedTab === tab.key && styles.tabButtonSelected,
            ]}
            onPress={() => onTabSelect(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === tab.key && styles.tabTextSelected,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    width: "100%",
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "gray",
  },
  backButton: {
    width: 44,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "gray",
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
    borderLeftColor: "gray",
  },
  tabButtonSelected: {
    backgroundColor: "#f0f0f0",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "gray",
  },
  tabTextSelected: {
    fontWeight: "bold",
    color: "black",
  },
});

export default NavTabBanner;
