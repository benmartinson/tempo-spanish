import React, { useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import { WebView } from "react-native-webview";
import { Segment } from "../../types";

interface YouTubePlayerProps {
  clip?: Segment & { videoId: string };
  videoId: string;
  autoplay: boolean;
  refreshKey: number;
  setTime: (time: number) => void;
  muted?: boolean;
  videoText?: string;
  playbackSpeed?: number;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  clip,
  autoplay,
  refreshKey,
  videoText,
  setTime,
  muted = false,
  playbackSpeed = 1,
}) => {
  const getVideoUrl = (videoId, clip, autoplay, muted, playbackSpeed) => {
    const baseUrl = "https://yt-relay.vercel.app";
    const params = new URLSearchParams({
      v: videoId,
      autoplay: autoplay ? "1" : "0",
      muted: muted ? "1" : "0",
      start: clip ? clip.start.toString() : "0",
      end: clip ? clip.end.toString() : null,
      controls: "1",
      speed: playbackSpeed.toString(),
    });
    return `${baseUrl}?${params.toString()}`;
  };

  return (
    <View style={styles.container}>
      <WebView
        key={
          clip
            ? `${clip.videoId}-${clip.start}-${clip.end}-${refreshKey}-${muted}-${playbackSpeed}`
            : `${videoId}-${refreshKey}-${muted}-${playbackSpeed}`
        }
        source={{
          uri: getVideoUrl(videoId, clip, autoplay, muted, playbackSpeed),
        }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        onMessage={(e) => {
          const msg = JSON.parse(e.nativeEvent.data);
          if (msg.type === "YT_TIME") {
            setTime(msg.time);
          }
        }}
      />
      {videoText && (
        <View style={styles.videoTextContainer}>
          <Text style={styles.videoText}>{videoText}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    borderRadius: 16,
    overflow: "hidden",
  },
  videoTextContainer: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  videoText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
});

export default YouTubePlayer;
