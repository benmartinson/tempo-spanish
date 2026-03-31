import {
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from "react-native";
import { Video } from "../../types";
import { formatTimestamp } from "../../helpers/helpers";
import VideoCard from "./VideoCard";

const MAX_VISIBLE = 10;

const HorizontalVideoScroll: React.FC<{
  videos: Video[];
  handleWatchPress: (videoId: string, recordId: string, clip?: number) => void;
  loadingVideo: boolean;
  showClips?: boolean;
  onViewAll?: () => void;
}> = ({
  videos,
  handleWatchPress,
  loadingVideo,
  showClips = false,
  onViewAll,
}) => {
  const displayedVideos = videos.slice(0, MAX_VISIBLE);
  const hasMore = videos.length > MAX_VISIBLE;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.videoScrollContent,
        { marginBottom: showClips ? 20 : 0 },
      ]}
    >
      {displayedVideos.map((video) => (
        <View key={video.video_id} style={styles.videoItem}>
          <VideoCard
            video={video}
            onPress={() => handleWatchPress(video.video_id, video.id)}
            disabled={loadingVideo}
            thumbnailStyle={styles.videoThumbnail}
          />
          <View style={styles.videoClipsContainer}>
            {showClips &&
              video.clips &&
              video.clips.slice(0, 5).map((clip) => (
                <TouchableOpacity
                  key={clip}
                  onPress={() =>
                    handleWatchPress(video.video_id, video.id, clip)
                  }
                >
                  <Text style={styles.videoClips}>{formatTimestamp(clip)}</Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>
      ))}
      {hasMore && onViewAll && (
        <TouchableOpacity style={styles.viewAllCard} onPress={onViewAll}>
          <Text style={styles.viewAllText}>View All</Text>
          <Text style={styles.viewAllCount}>{videos.length} videos</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  videoScrollContent: {
    paddingHorizontal: 16,
  },
  videoItem: {
    width: 320,
    height: 240,
    marginRight: 12,
  },
  videoThumbnail: {
    width: 320,
    height: 180,
  },
  videoClips: {
    textAlign: "left",
    lineHeight: 16,
    fontSize: 14,
    fontWeight: "600",
    color: "#4a69bd",
  },
  videoClipsContainer: {
    marginTop: 4,
    flexDirection: "row",
    gap: 10,
  },
  viewAllCard: {
    width: 160,
    height: 180,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  viewAllCount: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
  },
});

export default HorizontalVideoScroll;
