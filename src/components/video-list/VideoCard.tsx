import React from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
  ViewStyle,
  ImageStyle,
} from "react-native";
import { Channel, Video } from "../../types";
import { formatTimestamp } from "../../helpers";

const VideoCard: React.FC<{
  video: Video;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  thumbnailStyle?: ImageStyle;
  fullWidth?: boolean;
  channel?: Channel;
  onChannelPress?: () => void;
}> = ({
  video,
  onPress,
  disabled,
  style,
  thumbnailStyle,
  fullWidth,
  channel,
  onChannelPress,
}) => {
  return (
    <View style={[styles.videoItem, style]}>
      <Pressable
        style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        onPress={onPress}
        disabled={disabled}
        unstable_pressDelay={150}
      >
        <View style={{ overflow: "hidden" }}>
          <Image
            source={{ uri: video.thumbnail_url }}
            style={[
              styles.videoThumbnail,
              fullWidth && styles.fullWidthThumbnail,
              thumbnailStyle,
              { marginBottom: -3 },
            ]}
          />
          {video.duration && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>
                {formatTimestamp(video.duration)}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
      {channel ? (
        <View style={styles.channelRow}>
          <Pressable
            onPress={onChannelPress}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            unstable_pressDelay={150}
          >
            <Image
              source={{ uri: channel.thumbnail_url }}
              style={styles.channelThumb}
            />
          </Pressable>
          <View style={styles.channelTextContainer}>
            <Pressable
              onPress={onPress}
              disabled={disabled}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              unstable_pressDelay={150}
            >
              <Text style={styles.videoTitleBold} numberOfLines={2}>
                {video.title}
              </Text>
            </Pressable>
            <Pressable
              onPress={onChannelPress}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              unstable_pressDelay={150}
            >
              <Text style={styles.channelName}>{channel.title}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={onPress}
          disabled={disabled}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          unstable_pressDelay={150}
        >
          <Text
            style={[styles.videoTitle, fullWidth && styles.fullWidthVideoTitle]}
            numberOfLines={2}
          >
            {video.title}
          </Text>
        </Pressable>
      )}
    </View>
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
  fullWidthThumbnail: {
    borderRadius: 0,
  },
  videoTitle: {
    paddingTop: 4,
    fontSize: 14,
    color: "black",
    lineHeight: 16,
  },
  fullWidthVideoTitle: {
    paddingHorizontal: 16,
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
  channelRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  channelThumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  channelTextContainer: {
    flex: 1,
  },
  videoTitleBold: {
    fontSize: 14,
    fontWeight: "bold",
    color: "black",
    lineHeight: 18,
  },
  channelName: {
    fontSize: 13,
    color: "black",
    opacity: 0.65,
    marginTop: 2,
  },
});

export default VideoCard;
