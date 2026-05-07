import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useMemo,
} from "react";
import { StyleSheet, View, Text, Linking, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { Sentence } from "../../types";

export interface YouTubePlayerHandle {
  pause: () => void;
  play: () => void;
  togglePlayback: () => void;
  seekTo: (time: number) => void;
  seekAndPlay: (time: number) => void;
  setClip: (start: number, end?: number) => void;
  setSpeed: (speed: number) => void;
  mute: () => void;
  unMute: () => void;
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
  webFillContainer?: boolean;
}

const isWeb = Platform.OS === "web";

const getWebPlayerHtml = ({
  videoId,
  autoplay,
  muted,
  start,
  end,
  playbackSpeed,
  fillContainer,
}: {
  videoId: string;
  autoplay: boolean;
  muted: boolean;
  start: number;
  end?: number;
  playbackSpeed: number;
  fillContainer: boolean;
}) => {
  const config = JSON.stringify({
    videoId,
    autoplay,
    muted,
    start,
    end,
    playbackSpeed,
    fillContainer,
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #000;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #playerShell {
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #000;
        pointer-events: none;
      }
      body.fullBleed #playerShell {
        width: 100%;
        height: 100%;
      }
      #player {
        width: 100% !important;
        height: 100% !important;
        display: block;
      }
      #playerShell iframe {
        width: 100% !important;
        height: 100% !important;
        display: block;
      }
      @media (max-width: 968px) {
        #player {
          width: 900% !important;
          margin-left: -400%;
        }
        #playerShell iframe {
          width: 900% !important;
          margin-left: -400%;
        }
      }
      @media (min-width: 969px) {
        #player {
          width: 300% !important;
          margin-left: -100%;
        }
        #playerShell iframe {
          width: 300% !important;
          margin-left: -100%;
        }
      }
    </style>
  </head>
  <body>
    <div id="playerShell">
      <div id="player"></div>
    </div>
    <script>
      const config = ${config};
      let player;
      let clipStart = Number(config.start) || 0;
      let clipEnd = Number.isFinite(Number(config.end)) ? Number(config.end) : null;
      let clipEnabled = clipEnd !== null;
      let reporter = null;

      function postToApp(message) {
        window.parent.postMessage(JSON.stringify(message), "*");
      }

      function startReporter() {
        if (reporter) window.clearInterval(reporter);
        reporter = window.setInterval(function () {
          if (!player || typeof player.getCurrentTime !== "function") return;
          const time = player.getCurrentTime();
          postToApp({ type: "YT_TIME", time });
          if (clipEnabled && clipEnd !== null && time >= clipEnd) {
            player.pauseVideo();
          }
        }, 100);
      }

      function setFullBleed(enabled) {
        document.body.classList.toggle("fullBleed", !!enabled);
      }

      function postPlayingState(isPlaying) {
        postToApp({ type: "YT_PLAYING_STATE", isPlaying: !!isPlaying });
      }

      function togglePlayback() {
        if (!player || typeof player.getPlayerState !== "function") return;
        const state = player.getPlayerState();
        if (state === 1 || state === 3) {
          player.pauseVideo();
        } else {
          player.playVideo();
        }
      }

      setFullBleed(config.fillContainer);

      window.onYouTubeIframeAPIReady = function () {
        player = new YT.Player("player", {
          width: "100%",
          height: "100%",
          videoId: config.videoId,
          playerVars: {
            autoplay: config.autoplay ? 1 : 0,
            controls: 0,
            modestBranding: 0,
            fs: 0,
            playsinline: 1,
            rel: 0,
            start: Math.max(0, Math.floor(clipStart)),
          },
          events: {
            onReady: function () {
              try {
                player.setPlaybackRate(Number(config.playbackSpeed) || 1);
                if (config.muted) player.mute();
                if (clipStart > 0) player.seekTo(clipStart, true);
                if (config.autoplay) player.playVideo();
              } catch (error) {}
              postToApp({ type: "YT_READY" });
              startReporter();
            },
            onError: function (event) {
              postToApp({ type: "YT_ERROR", code: event.data });
            },
            onStateChange: function (event) {
              if (event.data === 1) postPlayingState(true);
              else if (event.data === 0 || event.data === 2 || event.data === 5) postPlayingState(false);
            },
          },
        });
      };

      function handleCommand(rawCommand) {
        const command = typeof rawCommand === "string" ? rawCommand : rawCommand?.command;
        if (!command) return;

        try {
          if (command.startsWith("SET_FULL_BLEED:")) {
            setFullBleed(command.slice(16) === "true");
            return;
          }
          if (!player) return;
          if (command === "PLAY") player.playVideo();
          else if (command === "PAUSE") player.pauseVideo();
          else if (command === "TOGGLE_PLAYBACK") togglePlayback();
          else if (command === "MUTE") player.mute();
          else if (command === "UNMUTE") player.unMute();
          else if (command === "DISABLE_CLIP") clipEnabled = false;
          else if (command.startsWith("SEEK:")) player.seekTo(Number(command.slice(5)), true);
          else if (command.startsWith("SEEK_AND_PLAY:")) {
            player.seekTo(Number(command.slice(14)), true);
            player.playVideo();
          } else if (command.startsWith("SET_SPEED:")) {
            player.setPlaybackRate(Number(command.slice(10)) || 1);
          } else if (command.startsWith("SET_CLIP:")) {
            const nextClip = JSON.parse(command.slice(9));
            clipStart = Number(nextClip.start) || 0;
            clipEnd = Number.isFinite(Number(nextClip.end)) ? Number(nextClip.end) : null;
            clipEnabled = clipEnd !== null;
          }
        } catch (error) {}
      }

      window.addEventListener("message", function (event) {
        handleCommand(event.data);
      });

      document.addEventListener("keydown", function (event) {
        if (event.code !== "Space" && event.key !== " ") return;
        event.preventDefault();
        togglePlayback();
      });
    </script>
    <script src="https://www.youtube.com/iframe_api"></script>
  </body>
</html>`;
};

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  (props, ref) => {
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
      webFillContainer = false,
    } = props;
    const webViewRef = useRef<WebView>(null);
    const webFrameRef = useRef<HTMLIFrameElement | null>(null);
    const lastTimeRef = useRef<number>(-1);
    const playingRef = useRef<boolean>(false);
    const staleTimerRef = useRef<NodeJS.Timeout | null>(null);
    const suppressTimePlayingUntilRef = useRef<number>(0);
    const mountedRef = useRef<boolean>(true);

    const handleTimeMessage = (time: number) => {
      setTime(time);

      // Detect playing state from time advancing
      const timeChanged = time !== lastTimeRef.current;
      lastTimeRef.current = time;

      if (timeChanged && !playingRef.current) {
        if (isWeb && Date.now() < suppressTimePlayingUntilRef.current) return;
        playingRef.current = true;
        if (mountedRef.current) onPlayingStateChange?.(true);
      }

      // Reset stale timer; if no new time update arrives, player is paused.
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
      staleTimerRef.current = setTimeout(() => {
        if (playingRef.current && mountedRef.current) {
          playingRef.current = false;
          onPlayingStateChange?.(false);
        }
      }, 300);
    };

    const postWebCommand = (command: string) => {
      webFrameRef.current?.contentWindow?.postMessage(command, "*");
    };

    useEffect(() => {
      return () => {
        mountedRef.current = false;
        if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
      };
    }, []);

    useEffect(() => {
      if (!isWeb || typeof window === "undefined") return;

      const handleWebMessage = (event: MessageEvent) => {
        if (event.source !== webFrameRef.current?.contentWindow) return;

        try {
          const msg =
            typeof event.data === "string"
              ? JSON.parse(event.data)
              : event.data;
          if (msg.type === "YT_TIME") {
            handleTimeMessage(msg.time);
          } else if (msg.type === "YT_PLAYING_STATE") {
            playingRef.current = !!msg.isPlaying;
            if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
            if (!msg.isPlaying) {
              suppressTimePlayingUntilRef.current = Date.now() + 500;
            }
            if (mountedRef.current) onPlayingStateChange?.(!!msg.isPlaying);
          }
        } catch {
          // Ignore messages from browser extensions or nested YouTube frames.
        }
      };

      window.addEventListener("message", handleWebMessage);
      return () => window.removeEventListener("message", handleWebMessage);
    }, [setTime, onPlayingStateChange]);

    useImperativeHandle(ref, () => ({
      pause: () => {
        if (isWeb) {
          postWebCommand("PAUSE");
          return;
        }
        webViewRef.current?.injectJavaScript(
          `try { if(typeof player !== 'undefined') player.pauseVideo(); } catch(e) {} true;`,
        );
      },
      play: () => {
        if (isWeb) {
          postWebCommand("PLAY");
          return;
        }
        webViewRef.current?.injectJavaScript(
          `try { if(typeof player !== 'undefined') player.playVideo(); } catch(e) {} true;`,
        );
      },
      togglePlayback: () => {
        if (isWeb) {
          postWebCommand("TOGGLE_PLAYBACK");
          return;
        }
        webViewRef.current?.injectJavaScript(
          `try { if(typeof player !== 'undefined') { var state = player.getPlayerState && player.getPlayerState(); if(state === 1 || state === 3) player.pauseVideo(); else player.playVideo(); } } catch(e) {} true;`,
        );
      },
      seekTo: (time: number) => {
        if (isWeb) {
          postWebCommand(`SEEK:${time}`);
          return;
        }
        webViewRef.current?.injectJavaScript(
          `try { if(typeof player !== 'undefined') player.seekTo(${time}, true); } catch(e) {} true;`,
        );
      },
      seekAndPlay: (time: number) => {
        if (isWeb) {
          postWebCommand(`SEEK_AND_PLAY:${time}`);
          return;
        }
        webViewRef.current?.injectJavaScript(
          `window.postMessage("SEEK_AND_PLAY:${time}", "*"); true;`,
        );
      },
      disableClipEnforcement: () => {
        if (isWeb) {
          postWebCommand("DISABLE_CLIP");
          return;
        }
        webViewRef.current?.injectJavaScript(
          `window.postMessage("DISABLE_CLIP", "*"); true;`,
        );
      },
      setClip: (start: number, end?: number) => {
        if (isWeb) {
          postWebCommand(`SET_CLIP:${JSON.stringify({ start, end })}`);
          return;
        }
        const payload = JSON.stringify({ start, end }).replace(/"/g, '\\"');
        webViewRef.current?.injectJavaScript(
          `window.postMessage("SET_CLIP:${payload}", "*"); true;`,
        );
      },
      setSpeed: (speed: number) => {
        if (isWeb) {
          postWebCommand(`SET_SPEED:${speed}`);
          return;
        }
        webViewRef.current?.injectJavaScript(
          `window.postMessage("SET_SPEED:${speed}", "*"); true;`,
        );
      },
      mute: () => {
        if (isWeb) {
          postWebCommand("MUTE");
          return;
        }
        webViewRef.current?.injectJavaScript(
          `try { if(typeof player !== 'undefined') player.mute(); } catch(e) {} true;`,
        );
      },
      unMute: () => {
        if (isWeb) {
          postWebCommand("UNMUTE");
          return;
        }
        webViewRef.current?.injectJavaScript(
          `try { if(typeof player !== 'undefined') player.unMute(); } catch(e) {} true;`,
        );
      },
    }));

    const getVideoUrl = () => {
      const baseUrl =
        Platform.OS === "ios"
          ? "https://yt-relay.vercel.app"
          : "http://192.168.1.100:3000";
      const params = new URLSearchParams();
      params.set("v", videoId);
      params.set("autoplay", autoplay ? "1" : "0");
      params.set("muted", muted ? "1" : "0");
      params.set(
        "start",
        clip?.start ? clip.start.toString() : (startTime?.toString() ?? "0"),
      );
      if (clip?.end) params.set("end", clip.end.toString());
      params.set("controls", "1");
      params.set("speed", playbackSpeed.toString());
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

    const webPlayerHtml = useMemo(
      () =>
        getWebPlayerHtml({
          videoId,
          autoplay,
          muted,
          start: clip?.start ?? startTime ?? 0,
          end: clip?.end,
          playbackSpeed,
          fillContainer: webFillContainer,
        }),
      [refreshKey, webFillContainer],
    );

    if (isWeb) {
      return (
        <View style={styles.container}>
          {React.createElement("iframe", {
            ref: webFrameRef,
            key: `${refreshKey}-${webFillContainer ? "full" : "stage"}`,
            srcDoc: webPlayerHtml,
            style: styles.webFrame,
            allow:
              "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen",
            allowFullScreen: true,
            title: "YouTube video player",
          })}
          {videoText && (
            <View style={styles.videoTextContainer}>
              <Text style={styles.videoText}>{videoText}</Text>
            </View>
          )}
        </View>
      );
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
            try {
              const msg = JSON.parse(e.nativeEvent.data);
              if (msg.type === "YT_TIME") {
                handleTimeMessage(msg.time);
              }
            } catch {
              // Ignore non-JSON messages from the embedded page.
            }
          }}
          userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
          onContentProcessDidTerminate={() => {
            webViewRef.current?.reload();
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
  webFrame: {
    borderWidth: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
});

export default YouTubePlayer;
