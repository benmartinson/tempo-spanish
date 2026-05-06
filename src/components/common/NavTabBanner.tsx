import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  useWindowDimensions,
} from "react-native";
import { RootState } from "../../types";
import { useDispatch, useSelector } from "react-redux";
import {
  setCurrentVideo,
  setSelectedChannelId,
} from "../../store/actions/dataActions";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import {
  saveLastSentenceWatched,
  persistVideoUnselection,
} from "../../requests";
import VideoInsights from "./VideoInsights";
import ProfileModal from "../ProfileModal";
import { isWebScreenWidth } from "../../helpers/helpers";

const NavTabBanner: React.FC = () => {
  const { width } = useWindowDimensions();
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId, isSignedIn } = useAuth();
  const navigation = useNavigation<any>();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const allVideos = useSelector((state: RootState) => state.allVideos);
  const video = allVideos.find((v) => v.video_id === currentVideo?.videoId);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const insightsDropdownWidth = Math.min(Math.max(width - 32, 0), 800);
  const insightsDropdownLeft = (width - insightsDropdownWidth) / 2;

  if (!currentVideo) {
    return null;
  }

  const isWebScreen = isWebScreenWidth(width);
  const isWeb = Platform.OS === "web";

  const navigateToMainApp = (params: { channelId?: string } = {}) => {
    navigation.navigate({
      name: "MainApp",
      params,
      merge: false,
    });
  };

  const leaveVideo = async (params: { channelId?: string } = {}) => {
    if (supabase && currentVideo?.videoViewId) {
      saveLastSentenceWatched({
        supabase,
        videoViewId: currentVideo.videoViewId,
        currentSentence: currentVideo.currentSentence,
      });
    }

    persistVideoUnselection({ supabase, userId });
    if (isWeb) {
      navigateToMainApp(params);
      return;
    }

    dispatch(setCurrentVideo(null));
    if (params.channelId) {
      dispatch(setSelectedChannelId(params.channelId));
    }
  };

  const handleBackPress = () => {
    leaveVideo();
  };

  const handleSeeAllVideos = async () => {
    setInsightsOpen(false);
    if (!isWeb && video?.channel_id) {
      dispatch(setSelectedChannelId(video.channel_id));
    }
    await leaveVideo(video?.channel_id ? { channelId: video.channel_id } : {});
  };

  return (
    <>
      <View style={[styles.container, isWebScreen && styles.webContainer]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <MaterialIcons name="arrow-back" size={22} color="#666" />
        </TouchableOpacity>

        <View style={[styles.centerArea, isWebScreen && styles.webCenterArea]}>
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
          onPress={() => {
            if (isSignedIn) {
              setProfileVisible(true);
            } else {
              navigation.navigate("SignIn");
            }
          }}
        >
          <Ionicons name="person" size={16} color="#5a5680" />
        </TouchableOpacity>

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
          <View
            style={[
              styles.insightsDropdown,
              {
                top: isWeb ? 64 : 90,
                width: insightsDropdownWidth,
                left: insightsDropdownLeft,
              },
            ]}
          >
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
  webContainer: {
    marginTop: 0,
    minHeight: 59,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(74, 105, 189, 0.18)",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    zIndex: 20,
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
    marginTop: Dimensions.get("window").height > 850 ? 12 : 0,
  },
  webCenterArea: {
    marginTop: 0,
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
