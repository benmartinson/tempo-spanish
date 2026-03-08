import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { Channel, RootState, Video } from "../../types";
import { Ionicons } from "@expo/vector-icons";
import VideoCard from "./VideoCard";
import FilterVideos from "./FilterVideos";
import { useSelector } from "react-redux";

const ChannelVideoList: React.FC<{
  channel: Channel;
  videos: Video[];
  handleWatchPress: (videoId: string, recordId: string) => void;
  loadingVideo: boolean;
  onBack: () => void;
}> = ({ channel, videos, handleWatchPress, loadingVideo, onBack }) => {
  const allTopics = useSelector((state: RootState) => state.allTopics);
  const channelTopics = useSelector((state: RootState) => state.channelTopics);

  const topicIds = channelTopics
    .filter((ct) => ct.channel_id === channel.id)
    .map((ct) => ct.topic_id);
  const topicNames = allTopics
    .filter((t) => topicIds.includes(t.id))
    .map((t) => t.description);
  return (
    <FilterVideos videos={videos}>
      {({ filteredVideos, filterButton, activeFilterBar }) => (
        <ScrollView style={styles.container}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Ionicons name="arrow-back" size={24} color="black" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            {filterButton}
          </View>

          <View style={styles.channelHeader}>
            <Image
              source={{ uri: channel.thumbnail_url }}
              style={styles.channelThumbnail}
            />
            <View style={styles.channelInfo}>
              <Text style={styles.channelTitle}>{channel.title}</Text>
              <View style={styles.channelBadges}>
                {topicNames.length > 0 && <Text>{topicNames.join(", ")}</Text>}
                <Text>{videos.length} videos</Text>
              </View>
            </View>
          </View>

          {activeFilterBar}

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
      )}
    </FilterVideos>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
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
    color: "black",
  },
  channelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    marginVertical: 16,
  },
  channelThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 10,
  },
  channelInfo: {
    flex: 1,
    paddingRight: 8,
    paddingTop: 8,
  },
  channelTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "black",
  },
  channelBadges: {
    marginTop: 4,
    gap: 2,
  },
  videoList: {
    gap: 16,
  },
  videoItem: {
    marginBottom: 16,
  },
});

export default ChannelVideoList;
