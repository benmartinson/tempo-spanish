import React, { useRef, useImperativeHandle, forwardRef } from "react";
import { StyleSheet, View, Text, Linking } from "react-native";
import { WebView } from "react-native-webview";
import { Segment } from "../../types";

export interface YouTubePlayerHandle {
  pause: () => void;
  play: () => void;
  seekTo: (time: number) => void;
  /** Clears the relay's clip-enforcement intervals and sets up our own
   *  time reporter. Call this when switching to a mode that should play
   *  freely past the relay's original end time. */
  disableClipEnforcement: () => void;
}

interface YouTubePlayerProps {
  clip?: Segment & { videoId: string };
  videoId: string;
  autoplay: boolean;
  refreshKey: number;
  setTime: (time: number) => void;
  muted?: boolean;
  videoText?: string;
  playbackSpeed?: number;
  startTime?: number;
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  (
    {
      videoId,
      clip,
      autoplay,
      refreshKey,
      videoText,
      setTime,
      muted = false,
      playbackSpeed = 1,
      startTime,
    },
    ref,
  ) => {
    const webViewRef = useRef<WebView>(null);

    useImperativeHandle(ref, () => ({
      pause: () => {
        webViewRef.current?.injectJavaScript(
          `try { if(typeof player !== 'undefined') player.pauseVideo(); } catch(e) {} true;`,
        );
      },
      play: () => {
        webViewRef.current?.injectJavaScript(
          `try { if(typeof player !== 'undefined') player.playVideo(); } catch(e) {} true;`,
        );
      },
      seekTo: (time: number) => {
        webViewRef.current?.injectJavaScript(
          `try { if(typeof player !== 'undefined') player.seekTo(${time}, true); } catch(e) {} true;`,
        );
      },
      disableClipEnforcement: () => {
        webViewRef.current?.injectJavaScript(
          `window.postMessage("DISABLE_CLIP", "*"); true;`,
        );
      },
    }));

    const getVideoUrl = () => {
      const baseUrl = "https://yt-relay.vercel.app";
      const params = new URLSearchParams({
        v: videoId,
        autoplay: autoplay ? "1" : "0",
        muted: muted ? "1" : "0",
        start: clip ? clip.start.toString() : (startTime?.toString() ?? "0"),
        end: clip ? clip.end.toString() : null,
        controls: "1",
        speed: playbackSpeed.toString(),
      });
      return `${baseUrl}?${params.toString()}`;
    };

    // Memoize the source URI so it only recalculates when refreshKey changes.
    // This prevents tab switches (which change clip/startTime but NOT refreshKey)
    // from causing the WebView to navigate and reload the video.
    // Explicit actions (next sentence, play snippet, etc.) call refreshPlayer()
    // which increments refreshKey and triggers a proper URL recalculation.
    const prevRefreshKeyRef = useRef<number>(refreshKey);
    const sourceUriRef = useRef<string>(getVideoUrl());
    if (prevRefreshKeyRef.current !== refreshKey) {
      sourceUriRef.current = getVideoUrl();
      prevRefreshKeyRef.current = refreshKey;
    }

    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          key={`${refreshKey}`}
          source={{ uri: sourceUriRef.current }}
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
          onShouldStartLoadWithRequest={(request) => {
            if (request.url.includes("youtube.com/watch")) {
              Linking.openURL(request.url);
              return false;
            }
            return true;
          }}
        />
        {videoText && (
          <View style={styles.videoTextContainer}>
            <Text style={styles.videoText}>{videoText}</Text>
          </View>
        )}
      </View>
    );
  },
);

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
