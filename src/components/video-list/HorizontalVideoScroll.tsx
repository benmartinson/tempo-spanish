import {
  ScrollView,
  TouchableOpacity,
  Image,
  Text,
  StyleSheet,
  View,
} from "react-native";
import { Video } from "../../types";
import { formatTimestamp } from "../../helpers";

const HorizontalVideoScroll: React.FC<{
  videos: Video[];
  handleWatchPress: (videoId: string, recordId: string, clip?: number) => void;
  loadingVideo: boolean;
  showClips?: boolean;
}> = ({ videos, handleWatchPress, loadingVideo, showClips = false }) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.videoScrollContent,
        { marginBottom: showClips ? 20 : 0 },
      ]}
    >
      {videos.map((video) => (
        <TouchableOpacity
          key={video.video_id}
          style={styles.videoItem}
          onPress={() => handleWatchPress(video.video_id, video.id)}
          disabled={loadingVideo}
        >
          <Image
            source={{ uri: video.thumbnail_url }}
            style={styles.videoThumbnail}
          />
          <Text style={styles.videoTitle} numberOfLines={2}>
            {video.title}
          </Text>
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
        </TouchableOpacity>
      ))}
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
    borderRadius: 8,
    marginBottom: 4,
  },
  videoClips: {
    textAlign: "left",
    lineHeight: 16,
    fontSize: 14,
    fontWeight: "600",
    color: "#4a69bd",
  },
  videoTitle: {
    fontSize: 14,
    color: "black",
    textAlign: "left",
    lineHeight: 16,
  },
  videoClipsContainer: {
    marginTop: 4,
    flexDirection: "row",
    gap: 10,
  },
});

export default HorizontalVideoScroll;
