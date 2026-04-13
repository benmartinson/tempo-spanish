import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { RootState } from "../../types";
import { useDispatch, useSelector } from "react-redux";
import {
  setCurrentVideo,
  setCurrentTab,
  setSelectedChannelId,
} from "../../store/actions/dataActions";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";
import {
  saveLastSentenceWatched,
  persistVideoUnselection,
} from "../../requests";
import VideoInsights from "./VideoInsights";
import ProfileModal from "../ProfileModal";

type NavTab =
  | "watch"
  | "shadow"
  | "review"
  | "speed-run"
  | "translate"
  | "recordings"
  | "turn-taking";

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
  const allVideos = useSelector((state: RootState) => state.allVideos);
  const video = allVideos.find((v) => v.video_id === currentVideo?.videoId);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    x: 0,
    y: 0,
    width: 0,
  });
  const selectorRef = useRef<View>(null);

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

  const tabs: { key: NavTab; label: string; icon: string }[] = [
    { key: "shadow", label: "Shadow", icon: "record-voice-over" },
    { key: "turn-taking", label: "Stream", icon: "swap-horiz" },
    // { key: "recordings", label: "Recordings", icon: "library-music" },
    { key: "review", label: "Review", icon: "rate-review" },
  ];

  const currentTab = tabs.find((t) => t.key === selectedTab) || tabs[0];

  const handleOpenDropdown = () => {
    selectorRef.current?.measureInWindow((x, y, width, height) => {
      setDropdownPosition({ x, y: y + height + 4, width });
      setDropdownOpen(true);
    });
  };

  const handleSeeAllVideos = async () => {
    setInsightsOpen(false);
    if (video?.channel_id) {
      dispatch(setSelectedChannelId(video.channel_id));
    }
    await handleBackPress();
  };

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <MaterialIcons name="arrow-back" size={22} color="#666" />
        </TouchableOpacity>

        <View style={styles.centerArea}>
          <TouchableOpacity
            style={styles.tabSelector}
            onPress={() => setInsightsOpen(!insightsOpen)}
            activeOpacity={0.7}
          >
            <Text style={styles.selectedTabText} numberOfLines={1}>
              {video?.title ?? ""}
            </Text>
            <MaterialIcons
              name={insightsOpen ? "expand-less" : "expand-more"}
              size={20}
              color="#888"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => setProfileVisible(true)}
        >
          <Ionicons name="person" size={16} color="#5a5680" />
        </TouchableOpacity>

        <Modal
          visible={dropdownOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setDropdownOpen(false)}
        >
          <TouchableWithoutFeedback onPress={() => setDropdownOpen(false)}>
            <View style={styles.modalOverlay}>
              <View
                style={[
                  styles.dropdown,
                  {
                    top: dropdownPosition.y,
                    left: dropdownPosition.x + dropdownPosition.width / 2 - 90,
                  },
                ]}
              >
                {tabs.map((tab, index) => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.dropdownItem,
                      selectedTab === tab.key && styles.dropdownItemSelected,
                      selectedTab === tab.key &&
                        index === 0 && {
                          borderTopLeftRadius: 4,
                          borderTopRightRadius: 4,
                        },
                      selectedTab === tab.key &&
                        index === tabs.length - 1 && {
                          borderBottomLeftRadius: 4,
                          borderBottomRightRadius: 4,
                        },
                    ]}
                    onPress={() => {
                      onTabSelect(tab.key);
                      setDropdownOpen(false);
                    }}
                  >
                    <MaterialIcons
                      name={tab.icon as any}
                      size={18}
                      color={selectedTab === tab.key ? "#3d3a52" : "#888"}
                    />
                    <Text
                      style={[
                        styles.dropdownItemText,
                        selectedTab === tab.key &&
                          styles.dropdownItemTextSelected,
                      ]}
                    >
                      {tab.label}
                    </Text>
                    {selectedTab === tab.key && (
                      <MaterialIcons name="check" size={16} color="#3d3a52" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <ProfileModal
          visible={profileVisible}
          onClose={() => setProfileVisible(false)}
        />
      </View>
      {insightsOpen && (
        <>
          <TouchableWithoutFeedback onPress={() => setInsightsOpen(false)}>
            <View style={styles.insightsOverlay} />
          </TouchableWithoutFeedback>
          <View style={styles.insightsDropdown}>
            <VideoInsights onSeeAllVideos={handleSeeAllVideos} />
          </View>
        </>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f2f2f2",
    justifyContent: "center",
    alignItems: "center",
  },
  centerArea: {
    flex: 1,
    alignItems: "center",
  },
  tabSelector: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f4f8",
    gap: 4,
    maxWidth: "80%",
  },
  selectedTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3d3a52",
    flexShrink: 1,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#d0d8f0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#5a5680",
  },
  modalOverlay: {
    flex: 1,
  },
  dropdown: {
    position: "absolute",
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  dropdownItemSelected: {
    backgroundColor: "#f5f4f8",
  },
  dropdownItemText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#666",
    flex: 1,
  },
  dropdownItemTextSelected: {
    fontWeight: "600",
    color: "#3d3a52",
  },
  insightsOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  insightsDropdown: {
    position: "absolute",
    top: 90,
    left: 16,
    right: 16,
    zIndex: 100,
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
});

export default NavTabBanner;
