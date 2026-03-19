import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useState,
  useCallback,
} from "react";
import { StyleSheet, View, Text, Linking, Platform } from "react-native";
import { WebView } from "react-native-webview";
import YoutubeIframePlayer from "react-native-youtube-iframe";
import { Segment, Sentence } from "../../types";
import { useSession, useUser } from "@clerk/clerk-expo";

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
  clip?: Sentence;
  videoId: string;
  autoplay: boolean;
  refreshKey: number;
  setTime: (time: number) => void;
  muted?: boolean;
  videoText?: string;
  playbackSpeed?: number;
  startTime?: number;
  onPlayingStateChange?: (isPlaying: boolean) => void;
}

const YoutubePlayerWeb = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  (
    {
      videoId,
      clip,
      autoplay,
      setTime,
      muted = false,
      playbackSpeed = 1,
      startTime,
      videoText,
      onPlayingStateChange,
    },
    ref,
  ) => {
    const playerRef = useRef<any>(null);
    const containerId = useRef(
      `player-${Math.random().toString(36).substr(2, 9)}`,
    );
    const timeIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const previousStateRef = useRef<number | null>(null);
    const clipEnforcementEnabledRef = useRef(true);

    const start = clip ? clip.start : (startTime ?? 0);
    const end = clip ? clip.end : null;

    useImperativeHandle(ref, () => ({
      play: () => playerRef.current?.playVideo(),
      pause: () => playerRef.current?.pauseVideo(),
      seekTo: (time: number) => playerRef.current?.seekTo(time, true),
      disableClipEnforcement: () => {
        clipEnforcementEnabledRef.current = false;
      },
    }));

    const stopTimePolling = () => {
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
        timeIntervalRef.current = null;
      }
    };

    const startTimePolling = () => {
      stopTimePolling();
      timeIntervalRef.current = setInterval(() => {
        if (
          !playerRef.current ||
          typeof playerRef.current.getCurrentTime !== "function"
        )
          return;

        const currentTime = playerRef.current.getCurrentTime();
        setTime(currentTime);

        if (clipEnforcementEnabledRef.current && end && currentTime >= end) {
          playerRef.current.pauseVideo();
        }
      }, 100);
    };

    const onPlayerStateChange = (event: any) => {
      const state = event.data;
      const YT = (window as any).YT;

      // Update time immediately on state change
      if (
        playerRef.current &&
        typeof playerRef.current.getCurrentTime === "function"
      ) {
        setTime(playerRef.current.getCurrentTime());
      }

      if (
        previousStateRef.current === YT.PlayerState.ENDED &&
        state === YT.PlayerState.PLAYING
      ) {
        playerRef.current.seekTo(start);
      }

      if (state === YT.PlayerState.PLAYING) {
        startTimePolling();
        onPlayingStateChange?.(true);
      }

      if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.ENDED) {
        stopTimePolling();
        onPlayingStateChange?.(false);
      }

      previousStateRef.current = state;
    };

    useEffect(() => {
      const initPlayer = () => {
        const YT = (window as any).YT;
        playerRef.current = new YT.Player(containerId.current, {
          videoId,
          height: "100%",
          width: "100%",
          playerVars: {
            autoplay: autoplay ? 1 : 0,
            controls: 1,
            start: Math.floor(start),
            rel: 0,
            playsinline: 1,
            mute: muted ? 1 : 0,
          },
          events: {
            onReady: (event: any) => {
              if (playbackSpeed) event.target.setPlaybackRate(playbackSpeed);
              if (autoplay) event.target.playVideo();
              // Report initial time
              if (typeof event.target.getCurrentTime === "function") {
                setTime(event.target.getCurrentTime());
              }
            },
            onStateChange: onPlayerStateChange,
          },
        });
      };

      if (!(window as any).YT) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        (window as any).onYouTubeIframeAPIReady = initPlayer;
      } else {
        initPlayer();
      }

      return () => {
        stopTimePolling();
        if (playerRef.current) {
          playerRef.current.destroy();
        }
      };
    }, []);

    return (
      <View style={styles.container}>
        <div
          id={containerId.current}
          style={{ width: "100%", height: "100%" }}
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

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  (props, ref) => {
    if (Platform.OS === "web") {
      return <YoutubePlayerWeb {...props} ref={ref} key={props.refreshKey} />;
    }

    const {
      videoId,
      clip,
      autoplay,
      refreshKey,
      videoText,
      setTime,
      muted = false,
      playbackSpeed = 1,
      startTime,
      onPlayingStateChange,
    } = props;
    const webViewRef = useRef<WebView>(null);
    const lastTimeRef = useRef<number>(-1);
    const playingRef = useRef<boolean>(false);
    const staleTimerRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef<boolean>(true);

    useEffect(() => {
      return () => {
        mountedRef.current = false;
        if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
      };
    }, []);

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
      const baseUrl =
        Platform.OS === "ios"
          ? "https://yt-relay.vercel.app"
          : "http://192.168.1.100:3000";
      const params = new URLSearchParams({
        v: videoId,
        autoplay: autoplay ? "1" : "0",
        muted: muted ? "1" : "0",
        start: clip?.start
          ? clip.start.toString()
          : (startTime?.toString() ?? "0"),
        end: clip && clip.end ? clip.end.toString() : undefined,
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
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          onMessage={(e) => {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.type === "YT_TIME") {
              setTime(msg.time);

              // Detect playing state from time advancing
              const timeChanged = msg.time !== lastTimeRef.current;
              lastTimeRef.current = msg.time;

              if (timeChanged && !playingRef.current) {
                playingRef.current = true;
                if (mountedRef.current) onPlayingStateChange?.(true);
              }

              // Reset stale timer — if no new time update arrives, player is paused
              if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
              staleTimerRef.current = setTimeout(() => {
                if (playingRef.current && mountedRef.current) {
                  playingRef.current = false;
                  onPlayingStateChange?.(false);
                }
              }, 300);
            }
          }}
          userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
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
        {/* <View style={{ height: 300, marginTop: 10 }}>
          <YoutubeIframePlayer
            height={300}
            videoId={videoId}
            play={autoplay}
            initialPlayerParams={{
              start: Math.floor(clip?.start ?? startTime ?? 0),
              controls: true,
              rel: false,
            }}
          />
        </View> */}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    // borderRadius: 16,
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
