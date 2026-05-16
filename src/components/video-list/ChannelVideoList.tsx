import React from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Channel, Video } from "../../types";
import { Ionicons } from "@expo/vector-icons";
import VideoCard from "./VideoCard";
import FilterVideos from "./FilterVideos";
import ChannelHeader from "./ChannelHeader";

const WEB_VIDEO_GAP = 12;
const WEB_VIDEO_LIST_MARGIN = 16;
const WEB_VIDEO_MIN_WIDTH = 280;

const webVideoGridStyle: any = {
  display: "grid",
  width: `calc(100% - ${WEB_VIDEO_LIST_MARGIN * 2}px)`,
  gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${WEB_VIDEO_MIN_WIDTH}px), 1fr))`,
  gap: `20px ${WEB_VIDEO_GAP}px`,
  alignItems: "start",
};

const webVideoItemStyle: any = {
  width: "100%",
  minWidth: 0,
};

const webVideoThumbnailStyle: any = {
  width: "100%",
  aspectRatio: 16 / 9,
};

const ChannelVideoList: React.FC<{
  channel: Channel;
  videos: Video[];
  handleWatchPress: (videoId: string, recordId: string) => void;
  loadingVideo: boolean;
  onBack: () => void;
  compact?: boolean;
}> = ({
  channel,
  videos,
  handleWatchPress,
  loadingVideo,
  onBack,
  compact = false,
}) => {
  const isWeb = Platform.OS === "web";
  const compactWebVideoGridStyle: any = {
    ...webVideoGridStyle,
    width: "calc(100% - 20px)",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: "14px 10px",
  };

  return (
    <FilterVideos videos={videos}>
      {({ filteredVideos, filterButton, activeFilterBar }) => (
        <View
          style={[
            styles.allContainer,
            isWeb && styles.webAllContainer,
            compact && styles.compactAllContainer,
          ]}
        >
          <View
            style={[
              styles.topBar,
              isWeb && styles.webContentContainer,
              compact && styles.compactTopBar,
            ]}
          >
            <TouchableOpacity
              style={[styles.backButton, compact && styles.compactBackButton]}
              onPress={onBack}
            >
              <Ionicons
                name="arrow-back"
                size={compact ? 18 : 24}
                color="#5a5680"
              />
            </TouchableOpacity>
            {filterButton}
          </View>
          <View style={isWeb && styles.webContentContainer}>
            <ChannelHeader
              channel={channel}
              videoCount={videos.length}
              countLabel="videos"
              compact={compact}
            />
          </View>

          {activeFilterBar && (
            <View style={isWeb && styles.webContentContainer}>
              {activeFilterBar}
            </View>
          )}

          <ScrollView
            style={[styles.listContainer, isWeb && styles.webListContainer]}
            contentContainerStyle={[
              isWeb && styles.webListContent,
              compact && styles.compactWebListContent,
            ]}
          >
            <View
              style={[
                styles.videoList,
                isWeb && styles.webVideoList,
                isWeb &&
                  (compact ? compactWebVideoGridStyle : webVideoGridStyle),
              ]}
            >
              {filteredVideos.map((video) => (
                <VideoCard
                  key={video.video_id}
                  video={video}
                  onPress={() => handleWatchPress(video.video_id, video.id)}
                  disabled={loadingVideo}
                  style={isWeb ? webVideoItemStyle : styles.videoItem}
                  thumbnailStyle={isWeb ? webVideoThumbnailStyle : undefined}
                  fullWidth={!isWeb}
                  compact={compact}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </FilterVideos>
  );
};

const styles = StyleSheet.create({
  allContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  webAllContainer: {
    backgroundColor: "#f6f8fc",
  },
  compactAllContainer: {
    backgroundColor: "#ffffff",
  },
  listContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  webListContainer: {
    backgroundColor: "#f6f8fc",
  },
  topBar: {
    flexDirection: "row",
    backgroundColor: "white",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#d0d8f0",
    marginBottom: 12,
  },
  compactTopBar: {
    marginBottom: 8,
    paddingRight: 10,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  compactBackButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 16,
    color: "#5a5680",
  },
  videoList: {
    gap: 16,
  },
  videoItem: {
    marginBottom: 16,
  },
  webContentContainer: {
    width: "100%",
    alignSelf: "center",
  },
  webListContent: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 40,
  },
  compactWebListContent: {
    paddingTop: 10,
    paddingBottom: 18,
  },
  webVideoList: {
    gap: 0,
  },
});

export default ChannelVideoList;
