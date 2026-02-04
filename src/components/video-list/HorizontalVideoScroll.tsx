import {
  ScrollView,
  TouchableOpacity,
  Image,
  Text,
  StyleSheet,
} from "react-native";
import { Video } from "../../types";

const HorizontalVideoScroll: React.FC<{
  videos: Video[];
  handleWatchPress: (videoId: string, recordId: string) => void;
  loadingVideo: boolean;
}> = ({ videos, handleWatchPress, loadingVideo }) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.videoScrollContent}
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
  videoTitle: {
    fontSize: 14,
    color: "black",
    textAlign: "left",
    lineHeight: 16,
  },
});

export default HorizontalVideoScroll;
