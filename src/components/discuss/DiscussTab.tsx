import React, { useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { useSelector } from "react-redux";
import {
  RootState,
  ContextSegment,
  QuizType,
} from "../../types";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import ReviewChat from "./ReviewChat";

interface DiscussTabProps {
  onPlayClip: (start: number, end: number) => void;
  isKeyboardVisible: boolean;
  setShowVideo: (show: boolean) => void;
  onSeekAndPause?: (time: number) => void;
}

const DiscussTab: React.FC<DiscussTabProps> = ({
  onPlayClip,
  isKeyboardVisible,
  setShowVideo,
  onSeekAndPause,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);

  const [selectedQuizType, setSelectedQuizType] =
    useState<QuizType>("Translate");

  // Handle clicking a context segment timestamp
  const handlePlayClip = useCallback(
    (segment: ContextSegment) => {
      setShowVideo(true);
      onPlayClip(segment.start, segment.end);
    },
    [onPlayClip],
  );

  if (!currentVideo) {
    return (
      <View style={styles.noVideoContainer}>
        <SelectVideoPrompt
          title="No Video Selected"
          subtitle="Select a video first to start reviewing"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ReviewChat
        videoId={currentVideo.videoId}
        onPlayClip={handlePlayClip}
        onSeekAndPause={onSeekAndPause}
        isKeyboardVisible={isKeyboardVisible}
        selectedQuizType={selectedQuizType}
        onSelectQuizType={setSelectedQuizType}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  noVideoContainer: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
});

export default DiscussTab;
