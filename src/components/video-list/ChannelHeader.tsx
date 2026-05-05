import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSelector } from "react-redux";
import { Channel, RootState } from "../../types";

const difficultyColor = (difficulty: string): string => {
  switch (difficulty.toLowerCase()) {
    case "beginner":
      return "#3b82f6"; // blue
    case "lower intermediate":
      return "#eab308"; // yellow
    case "upper intermediate":
      return "#f97316"; // orange
    case "advanced":
      return "#ef4444"; // red
    default:
      return "#6b7280"; // neutral gray fallback
  }
};

const webChannelThumbnailStyle: React.CSSProperties = {
  width: 100,
  height: 100,
  borderRadius: 100,
  marginRight: 10,
  objectFit: "cover",
};

interface ChannelHeaderProps {
  channel: Channel;
  videoCount: number;
  /** When provided, the header is tappable (used in the channel list). */
  onPress?: () => void;
  /**
   * Wording for the count line. Defaults to "videos available". Override for
   * the channel detail view ("videos").
   */
  countLabel?: string;
}

const ChannelHeader: React.FC<ChannelHeaderProps> = ({
  channel,
  videoCount,
  onPress,
  countLabel = "videos available",
}) => {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const allTopics = useSelector((state: RootState) => state.allTopics);
  const channelTopics = useSelector((state: RootState) => state.channelTopics);

  useEffect(() => {
    setThumbnailFailed(false);
  }, [channel.thumbnail_url]);

  const topicNames = channelTopics
    .filter((ct) => ct.channel_id === channel.id)
    .map((ct) => ct.topic_id)
    .map((id) => allTopics.find((t) => t.id === id)?.description)
    .filter(Boolean) as string[];

  const thumbnail =
    !!channel.thumbnail_url && !thumbnailFailed ? (
      Platform.OS === "web" ? (
        React.createElement("img", {
          src: channel.thumbnail_url,
          alt: `${channel.title} thumbnail`,
          referrerPolicy: "no-referrer",
          style: webChannelThumbnailStyle,
          onError: () => setThumbnailFailed(true),
        })
      ) : (
        <Image
          source={{ uri: channel.thumbnail_url }}
          style={styles.channelThumbnail}
          onError={() => setThumbnailFailed(true)}
        />
      )
    ) : null;

  const content = (
    <>
      {thumbnail}
      <View style={styles.channelInfo}>
        <Text style={styles.channelTitle}>{channel.title}</Text>
        <View style={styles.channelBadges}>
          {topicNames.length > 0 ? (
            <Text style={styles.mutedText}>{topicNames.join(", ")}</Text>
          ) : null}
          <Text style={styles.mutedText}>
            {videoCount} {countLabel}
          </Text>
          {channel.difficulty ? (
            <View
              style={[
                styles.difficultyBadge,
                { backgroundColor: difficultyColor(channel.difficulty) },
              ]}
            >
              <Text style={styles.difficultyBadgeText}>
                {channel.difficulty}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.container} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.container}>{content}</View>;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  channelThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 100,
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
    flexShrink: 1,
  },
  channelBadges: {
    alignItems: "flex-start",
    marginTop: 2,
    gap: 2,
  },
  mutedText: {
    opacity: 0.65,
  },
  difficultyBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  difficultyBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
});

export default ChannelHeader;
