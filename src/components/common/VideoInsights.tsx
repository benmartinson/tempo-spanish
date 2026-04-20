import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "../../types";

interface VideoInsightsProps {
  onSeeAllVideos: () => void;
}

const VideoInsights: React.FC<VideoInsightsProps> = ({ onSeeAllVideos }) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const allVideos = useSelector((state: RootState) => state.allVideos);
  const allChannels = useSelector((state: RootState) => state.allChannels);

  const video = allVideos.find((v) => v.video_id === currentVideo?.videoId);
  const channel = allChannels.find((c) => c.channel_id === video?.channel_id);

  const sentences = currentVideo?.sentences ?? [];
  const totalWords = sentences.reduce(
    (sum, s) => sum + s.text.split(/\s+/).length,
    0,
  );
  const totalMinutes =
    sentences.length > 0
      ? (sentences[sentences.length - 1].end - sentences[0].start) / 60
      : 0;
  const wordsPerMinute =
    totalMinutes > 0 ? Math.round(totalWords / totalMinutes) : 0;

  return (
    <View style={styles.container}>
      {video?.title && <Text style={styles.title}>{video.title}</Text>}
      {video?.release_date && (
        <View style={styles.row}>
          <Text style={styles.label}>Released</Text>
          <Text style={styles.value}>{video.release_date}</Text>
        </View>
      )}
      {channel && (
        <View style={styles.row}>
          <Text style={styles.label}>Channel</Text>
          <Text style={styles.value}>{channel.title}</Text>
        </View>
      )}
      <View style={styles.row}>
        <Text style={styles.label}>Avg. words/min</Text>
        <Text style={styles.value}>{wordsPerMinute}</Text>
      </View>
      {channel && (
        <TouchableOpacity style={styles.linkButton} onPress={onSeeAllVideos}>
          <Text style={styles.linkText}>
            See all videos from {channel.title}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    color: "#888",
  },
  value: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3d3a52",
  },
  linkButton: {
    marginTop: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3d3a52",
  },
  releaseDate: {
    fontSize: 14,
    color: "#888",
  },
  linkText: {
    fontSize: 14,
    color: "#4a69bd",
    textDecorationLine: "underline",
  },
});

export default VideoInsights;
