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

const WEB_MAX_CONTENT_WIDTH = 1320;
const WEB_VIDEO_GAP = 12;
const WEB_VIDEO_LIST_MARGIN = 16;
const WEB_VIDEO_MIN_WIDTH = 280;
const WEB_VIDEO_GRID_MAX_WIDTH = WEB_VIDEO_MIN_WIDTH * 4 + WEB_VIDEO_GAP * 3;

const webVideoGridStyle: any = {
  display: "grid",
  width: `calc(100% - ${WEB_VIDEO_LIST_MARGIN * 2}px)`,
  maxWidth: WEB_VIDEO_GRID_MAX_WIDTH,
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
}> = ({ channel, videos, handleWatchPress, loadingVideo, onBack }) => {
  const isWeb = Platform.OS === "web";

  return (
    <FilterVideos videos={videos}>
      {({ filteredVideos, filterButton, activeFilterBar }) => (
        <View style={[styles.allContainer, isWeb && styles.webAllContainer]}>
          <View style={[styles.topBar, isWeb && styles.webContentContainer]}>
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Ionicons name="arrow-back" size={24} color="#5a5680" />
            </TouchableOpacity>
            {filterButton}
          </View>
          <View style={isWeb && styles.webContentContainer}>
            <ChannelHeader
              channel={channel}
              videoCount={videos.length}
              countLabel="videos"
            />
          </View>

          {activeFilterBar && (
            <View style={isWeb && styles.webContentContainer}>
              {activeFilterBar}
            </View>
          )}

          <ScrollView
            style={[styles.listContainer, isWeb && styles.webListContainer]}
            contentContainerStyle={isWeb && styles.webListContent}
          >
            <View
              style={[
                styles.videoList,
                isWeb && styles.webVideoList,
                isWeb && webVideoGridStyle,
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
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
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
    maxWidth: WEB_MAX_CONTENT_WIDTH,
    alignSelf: "center",
  },
  webListContent: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 40,
  },
  webVideoList: {
    gap: 0,
  },
});

export default ChannelVideoList;
