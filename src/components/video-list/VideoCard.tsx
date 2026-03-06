import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  ViewStyle,
} from "react-native";
import { Video } from "../../types";
import { formatTimestamp } from "../../helpers";

const VideoCard: React.FC<{
  video: Video;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  thumbnailStyle?: ViewStyle;
}> = ({ video, onPress, disabled, style, thumbnailStyle }) => {
  return (
    <TouchableOpacity
      style={[styles.videoItem, style]}
      onPress={onPress}
      disabled={disabled}
    >
      <View>
        <Image
          source={{ uri: video.thumbnail_url }}
          style={[styles.videoThumbnail, thumbnailStyle]}
        />
        {video.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {formatTimestamp(video.duration)}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.videoTitle} numberOfLines={2}>
        {video.title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  videoItem: {},
  videoThumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 8,
    marginBottom: 4,
  },
  videoTitle: {
    fontSize: 14,
    color: "black",
    lineHeight: 16,
  },
  durationBadge: {
    position: "absolute",
    bottom: 8,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  durationText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
});

export default VideoCard;
