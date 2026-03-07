import React from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
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
    <Pressable
      style={({ pressed }) => [
        styles.videoItem,
        style,
        pressed && { opacity: 0.6 },
      ]}
      onPress={onPress}
      disabled={disabled}
      unstable_pressDelay={150}
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
    </Pressable>
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
