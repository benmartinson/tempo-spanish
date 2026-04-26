import React from "react";
import { StyleSheet, View, TouchableOpacity, ScrollView } from "react-native";
import { Channel, Video } from "../../types";
import { Ionicons } from "@expo/vector-icons";
import VideoCard from "./VideoCard";
import FilterVideos from "./FilterVideos";
import ChannelHeader from "./ChannelHeader";

const ChannelVideoList: React.FC<{
  channel: Channel;
  videos: Video[];
  handleWatchPress: (videoId: string, recordId: string) => void;
  loadingVideo: boolean;
  onBack: () => void;
}> = ({ channel, videos, handleWatchPress, loadingVideo, onBack }) => {
  return (
    <FilterVideos videos={videos}>
      {({ filteredVideos, filterButton, activeFilterBar }) => (
        <View style={styles.allContainer}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Ionicons name="arrow-back" size={24} color="#5a5680" />
            </TouchableOpacity>
            {filterButton}
          </View>
          <ChannelHeader
            channel={channel}
            videoCount={videos.length}
            countLabel="videos"
          />

          {activeFilterBar}

          <ScrollView style={styles.listContainer}>
            <View style={styles.videoList}>
              {filteredVideos.map((video) => (
                <VideoCard
                  key={video.video_id}
                  video={video}
                  onPress={() => handleWatchPress(video.video_id, video.id)}
                  disabled={loadingVideo}
                  style={styles.videoItem}
                  fullWidth
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
  listContainer: {
    flex: 1,
    backgroundColor: "white",
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
});

export default ChannelVideoList;
