import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../types";
import {
  setCurrentTab,
  setCurrentVideo,
  setSegmentByTime,
} from "../../store/actions/dataActions";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import { useNavigation } from "@react-navigation/native";
import SelectedVideoBanner from "../common/SelectedVideoBanner";
import YouTubePlayer from "../common/YouTubePlayer";
import FullSegmentTranscriptBubble from "../watch/FullSegmentTranscriptBubble";

const ShadowTab: React.FC = () => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const clip = currentVideo?.segments[currentVideo.currentSegment];
  const [time, setTime] = useState<number>(0);
  const isClip = true;
  const timeRemaining = Math.floor(Math.max(clip.end - time, 0));
  const videoRefreshKey = useSelector(
    (state: RootState) => state.videoRefreshKey,
  );
  const dispatch = useDispatch();

  const handleSetTime = (newTime: number) => {
    if (newTime >= 1 && (newTime < clip.start || newTime > clip.end)) {
      dispatch(setSegmentByTime(newTime));
      return;
    }
    setTime(newTime);
  };

  if (!currentVideo) {
    return <SelectVideoPrompt />;
  }
  return (
    <>
      <SelectedVideoBanner />
      <View style={styles.container}>
        <View style={styles.videoContainer}>
          <YouTubePlayer
            // clip={{ ...clip, videoId: video.videoId }}
            videoId={currentVideo.videoId}
            autoplay={true}
            refreshKey={videoRefreshKey}
            setTime={handleSetTime}
          />
          {/* {timeRemaining < 5 && timeRemaining > 0 && (
                  <View style={styles.countdownContainer}>
                    <Text style={styles.countdownText}>
                      Segment ends in {timeRemaining}
                    </Text>
                  </View>
                )} */}
        </View>
        <ScrollView style={styles.transcriptContainer}>
          <FullSegmentTranscriptBubble words={clip?.words || []} time={time} />
        </ScrollView>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  questionContextButton: {
    flexDirection: "row",
    alignSelf: "flex-end",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#2a2a4a",
    borderRadius: 8,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    margin: 16,
  },
  questionContextText: {
    color: "#888",
    fontSize: 12,
  },
  transcriptContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: "#3d3a52",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#5a5680",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  videoContainer: {
    height: 230,
    backgroundColor: "#000",
    position: "relative",
    marginTop: 0,
  },
  countdownContainer: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  countdownText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  loader: {
    marginLeft: 8,
  },
});
export default ShadowTab;
