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

const compactWebChannelThumbnailStyle: React.CSSProperties = {
  ...webChannelThumbnailStyle,
  width: 48,
  height: 48,
  borderRadius: 48,
  marginRight: 8,
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
  compact?: boolean;
}

const ChannelHeader: React.FC<ChannelHeaderProps> = ({
  channel,
  videoCount,
  onPress,
  countLabel = "videos available",
  compact = false,
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
          style: compact
            ? compactWebChannelThumbnailStyle
            : webChannelThumbnailStyle,
          onError: () => setThumbnailFailed(true),
        })
      ) : (
        <Image
          source={{ uri: channel.thumbnail_url }}
          style={[
            styles.channelThumbnail,
            compact && styles.compactChannelThumbnail,
          ]}
          onError={() => setThumbnailFailed(true)}
        />
      )
    ) : null;

  const content = (
    <>
      {thumbnail}
      <View style={[styles.channelInfo, compact && styles.compactChannelInfo]}>
        <Text
          style={[styles.channelTitle, compact && styles.compactChannelTitle]}
        >
          {channel.title}
        </Text>
        <View
          style={[styles.channelBadges, compact && styles.compactChannelBadges]}
        >
          {topicNames.length > 0 ? (
            <Text
              style={[styles.mutedText, compact && styles.compactMutedText]}
              numberOfLines={1}
            >
              {topicNames.join(", ")}
            </Text>
          ) : null}
          <Text style={[styles.mutedText, compact && styles.compactMutedText]}>
            {videoCount} {countLabel}
          </Text>
          {channel.difficulty ? (
            <View
              style={[
                styles.difficultyBadge,
                compact && styles.compactDifficultyBadge,
                { backgroundColor: difficultyColor(channel.difficulty) },
              ]}
            >
              <Text
                style={[
                  styles.difficultyBadgeText,
                  compact && styles.compactDifficultyBadgeText,
                ]}
              >
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
      <TouchableOpacity
        style={[styles.container, compact && styles.compactContainer]}
        onPress={onPress}
      >
        {content}
      </TouchableOpacity>
    );
  }
  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  compactContainer: {
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  channelThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 100,
    marginRight: 10,
  },
  compactChannelThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 8,
  },
  channelInfo: {
    flex: 1,
    paddingRight: 8,
    paddingTop: 8,
  },
  compactChannelInfo: {
    paddingTop: 2,
  },
  channelTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "black",
    flexShrink: 1,
  },
  compactChannelTitle: {
    fontSize: 15,
    lineHeight: 19,
  },
  channelBadges: {
    alignItems: "flex-start",
    marginTop: 2,
    gap: 2,
  },
  compactChannelBadges: {
    marginTop: 1,
    gap: 1,
  },
  mutedText: {
    opacity: 0.65,
  },
  compactMutedText: {
    fontSize: 11,
  },
  difficultyBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  compactDifficultyBadge: {
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 5,
  },
  difficultyBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  compactDifficultyBadgeText: {
    fontSize: 10,
  },
});

export default ChannelHeader;
