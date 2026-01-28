import React from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { Segment } from "../../types";

interface YouTubePlayerProps {
  clip: Segment & { videoId: string };
  autoplay: boolean;
  refreshKey: number;
  setTime: (time: number) => void;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  clip,
  autoplay,
  refreshKey,
  setTime,
}) => {
  console.log("clip", clip);
  const getVideoUrl = (clip) => {
    const baseUrl = "https://yt-relay.vercel.app";
    const params = new URLSearchParams({
      v: clip.videoId,
      autoplay: autoplay ? "1" : "0",
      mute: "1",
      start: clip.start.toString(),
      end: clip.end.toString(),
      controls: "1",
    });
    return `${baseUrl}?${params.toString()}`;
  };

  return (
    <View style={styles.container}>
      <WebView
        key={`${clip.videoId}-${clip.start}-${clip.end}-${refreshKey}`}
        source={{ uri: getVideoUrl(clip) }}
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
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
});

export default YouTubePlayer;
