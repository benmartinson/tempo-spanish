import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useSelector } from "react-redux";
import { Channel, RootState } from "../../types";
import { normalizeChannelDifficulty } from "../../helpers/channelDifficulty";

const difficultyColor = (difficulty: string): string => {
  switch (normalizeChannelDifficulty(difficulty)) {
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

const webChannelThumbnailStyle = (variant: ChannelHeaderVariant) =>
  ({
    width: variant === "card" ? 56 : 100,
    height: variant === "card" ? 56 : 100,
    borderRadius: variant === "card" ? 56 : 100,
    marginRight: variant === "card" ? 12 : 10,
    objectFit: "cover",
    flexShrink: 0,
  }) as React.CSSProperties;

type ChannelHeaderVariant = "row" | "card";

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
  variant?: ChannelHeaderVariant;
  style?: StyleProp<ViewStyle>;
}

const ChannelHeader: React.FC<ChannelHeaderProps> = ({
  channel,
  videoCount,
  onPress,
  countLabel = "videos available",
  variant = "row",
  style,
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
          style: webChannelThumbnailStyle(variant),
          onError: () => setThumbnailFailed(true),
        })
      ) : (
        <Image
          source={{ uri: channel.thumbnail_url }}
          style={[
            styles.channelThumbnail,
            variant === "card" && styles.cardChannelThumbnail,
          ]}
          onError={() => setThumbnailFailed(true)}
        />
      )
    ) : null;

  const content = (
    <>
      {thumbnail}
      <View style={[styles.channelInfo, variant === "card" && styles.cardInfo]}>
        <Text
          style={[
            styles.channelTitle,
            variant === "card" && styles.cardChannelTitle,
          ]}
          numberOfLines={variant === "card" ? 2 : undefined}
        >
          {channel.title}
        </Text>
        <View style={styles.channelBadges}>
          {topicNames.length > 0 ? (
            <Text
              style={styles.mutedText}
              numberOfLines={variant === "card" ? 1 : undefined}
            >
              {topicNames.join(", ")}
            </Text>
          ) : null}
          <Text style={styles.mutedText}>
            {videoCount} {countLabel}
          </Text>
          {/* {channel.difficulty ? (
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
          ) : null} */}
        </View>
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[
          styles.container,
          variant === "card" && styles.cardContainer,
          style,
        ]}
        onPress={onPress}
      >
        {content}
      </TouchableOpacity>
    );
  }
  return (
    <View
      style={[
        styles.container,
        variant === "card" && styles.cardContainer,
        style,
      ]}
    >
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
  channelThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 100,
    marginRight: 10,
  },
  cardChannelThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  channelInfo: {
    flex: 1,
    paddingRight: 8,
    paddingTop: 8,
  },
  cardInfo: {
    paddingTop: 0,
    paddingRight: 0,
  },
  channelTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "black",
    flexShrink: 1,
  },
  cardChannelTitle: {
    fontSize: 16,
    lineHeight: 20,
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
  cardContainer: {
    marginBottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.16)",
    borderRadius: 8,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
});

export default ChannelHeader;
