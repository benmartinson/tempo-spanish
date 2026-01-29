import React, { useState, useEffect } from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import YouTubePlayer from "../common/YouTubePlayer";
import { RootState, VideoContext } from "../../types";
import { useNavigation } from "@react-navigation/native";
import {
  setCurrentTab,
  setSegmentByTime,
} from "../../store/actions/dataActions";
import { useDispatch, useSelector } from "react-redux";
import TranscriptBubble from "./TranscriptBubble";
import FullSegmentTranscriptBubble from "./FullSegmentTranscriptBubble";
import TranslationBubble from "./TranslationBubble";
import BubbleSelector from "./BubbleSelector";

interface VideoProps {
  video: VideoContext;
  refreshKey: number;
  isClip: boolean;
}

const Video: React.FC<VideoProps> = ({ video, refreshKey, isClip = false }) => {
  const navigation = useNavigation();
  const clip = video.segments[video.currentSegment];
  const [time, setTime] = useState<number>(0);
  const timeRemaining = Math.floor(Math.max(clip.end - time, 0));
  const dispatch = useDispatch();
  const allWords = useSelector(
    (state: RootState) => state.currentVideo?.allWords,
  );
  const [bubbleSelections, setBubbleSelections] = useState<string[]>([
    "small",
    "large",
    "translation",
  ]);

  useEffect(() => {
    if (clip) {
      // console.log("clip", clip);
    }
  }, [clip]);

  const handleSetTime = (newTime: number) => {
    if (newTime >= 1 && (newTime < clip.start || newTime > clip.end)) {
      dispatch(setSegmentByTime(newTime));
      return;
    }
    const newTimeRemaining = Math.max(Math.ceil(clip.end - newTime), 0);
    if (newTimeRemaining < 1 && timeRemaining >= 0) {
      if (isClip) {
        dispatch(setCurrentTab("discuss"));
        navigation.navigate("Discuss" as never);
      }
    }
    setTime(newTime);
  };

  return (
    <View style={styles.container}>
      <View style={styles.videoContainer}>
        <YouTubePlayer
          // clip={{ ...clip, videoId: video.videoId }}
          videoId={video.videoId}
          autoplay={true}
          refreshKey={refreshKey}
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
        <BubbleSelector
          bubbleSelections={bubbleSelections}
          setBubbleSelections={setBubbleSelections}
        />
        {bubbleSelections.includes("small") && (
          <TranscriptBubble words={clip?.words || []} time={time} />
        )}
        {bubbleSelections.includes("large") && (
          <FullSegmentTranscriptBubble words={clip?.words || []} time={time} />
        )}
        {bubbleSelections.includes("translation") && (
          <TranslationBubble
            translation={clip?.full_text_translation.split(" ") || []}
            words={clip?.words || []}
            time={time}
          />
        )}
        {/* {clip.key_vocabulary && clip.key_vocabulary.length > 0 && (
          <VocabList vocab={clip.key_vocabulary} time={time} />
          )} */}
      </ScrollView>
      {/* <View style={styles.buttonContainer}>
        {video.currentSegment > 0 ? (
          <TouchableOpacity
            style={styles.questionContextButton}
            onPress={() => {
              dispatch(setPreviousSegment());
            }}
          >
            <MaterialIcons name="navigate-before" size={24} color="#888" />
            <Text style={styles.questionContextText}>Previous Segment</Text>
          </TouchableOpacity>
        ) : (
          <View></View>
        )}
        {video.currentSegment < video.segments.length - 1 ? (
          <TouchableOpacity
            style={styles.questionContextButton}
            onPress={() => {
              dispatch(setNextSegment());
            }}
          >
            <Text style={styles.questionContextText}>Next Segment</Text>
            <MaterialIcons name="navigate-next" size={24} color="#888" />
          </TouchableOpacity>
        ) : (
          <View></View>
        )}
      </View> */}
    </View>
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

export default Video;
