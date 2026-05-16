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

const MAX_VISIBLE = 5;

const HorizontalVideoScroll: React.FC<{
  videos: Video[];
  handleWatchPress: (videoId: string, recordId: string, clip?: number) => void;
  loadingVideo: boolean;
  showClips?: boolean;
  onViewAll?: () => void;
  isChannel?: boolean;
  compact?: boolean;
}> = ({
  videos,
  handleWatchPress,
  loadingVideo,
  showClips = false,
  onViewAll,
  isChannel = true,
  compact = false,
}) => {
  const displayedVideos = videos.slice(0, MAX_VISIBLE);
  const hasMore = videos.length > MAX_VISIBLE;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.videoScrollContent,
        compact && styles.compactVideoScrollContent,
        { marginBottom: showClips ? 20 : 0 },
      ]}
    >
      {displayedVideos.map((video) => (
        <View
          key={video.video_id}
          style={[
            styles.videoItem,
            compact && styles.compactVideoItem,
            !isChannel && { height: compact ? 146 : 230 },
          ]}
        >
          <VideoCard
            video={video}
            onPress={() => handleWatchPress(video.video_id, video.id)}
            disabled={loadingVideo}
            thumbnailStyle={
              compact ? styles.compactVideoThumbnail : styles.videoThumbnail
            }
            compact={compact}
          />
          <View style={styles.videoClipsContainer}>
            {showClips &&
              video.clips &&
              video.clips.slice(0, 6).map((clip) => (
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
        <TouchableOpacity
          style={[styles.viewAllCard, compact && styles.compactViewAllCard]}
          onPress={onViewAll}
        >
          <Text
            style={[styles.viewAllText, compact && styles.compactViewAllText]}
          >
            View All
          </Text>
          <Text
            style={[styles.viewAllCount, compact && styles.compactViewAllCount]}
          >
            {videos.length} videos
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  videoScrollContent: {
    paddingHorizontal: 16,
  },
  compactVideoScrollContent: {
    paddingHorizontal: 10,
  },
  videoItem: {
    width: 320,
    height: 240,
    marginRight: 12,
  },
  compactVideoItem: {
    width: 180,
    height: 142,
    marginRight: 10,
  },
  videoThumbnail: {
    width: 320,
    height: 180,
  },
  compactVideoThumbnail: {
    width: 180,
    height: 101,
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
  compactViewAllCard: {
    width: 112,
    height: 101,
    borderRadius: 7,
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  compactViewAllText: {
    fontSize: 13,
  },
  viewAllCount: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
  },
  compactViewAllCount: {
    fontSize: 11,
  },
});

export default HorizontalVideoScroll;
