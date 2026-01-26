import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Segment } from "../../types";

interface YouTubePlayerProps {
  clip: Segment & { videoId: string };
  autoplay: boolean;
  refreshKey: number;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ clip, autoplay, refreshKey }) => {
  const getVideoUrl = (clip) => {
    const baseUrl = 'https://yt-relay.vercel.app';
    const params = new URLSearchParams({
      v: clip.videoId,
      autoplay: autoplay ? '1' : '0',
      mute: '1', 
      start: clip.start.toString(),
      end: clip.end.toString(),
      controls: '1',
    });
    return `${baseUrl}?${params.toString()}`;
  };

  console.log({clip, refreshKey})

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <meta name="referrer" content="strict-origin-when-cross-origin">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          html, body {
            width: 100%;
            height: 100%;
            background-color: #000;
            overflow: hidden;
          }
          .video-container {
            position: relative;
            width: 100%;
            height: 100%;
          }
          iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
          }
        </style>
      </head>
      <body>
        <div class="video-container">
          <iframe
            src="${getVideoUrl(clip)}"
            title="YouTube video player"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen
          ></iframe>
        </div>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        key={`${clip.videoId}-${clip.start}-${clip.end}-${refreshKey}`}
        source={{ html }}
        style={styles.webview}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});

export default YouTubePlayer;
