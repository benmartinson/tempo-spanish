import React, { useState, useCallback, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useSelector } from "react-redux";
import { AutoReviewDetails, RootState, ContextSegment, QuizType } from "../../types";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import ReviewChat from "./ReviewChat";

interface DiscussTabProps {
  onPlayClip: (start: number, end: number) => void;
  isKeyboardVisible: boolean;
  setShowVideo: (show: boolean) => void;
  autoReviewDetails?: AutoReviewDetails | null;
  onBackToShadow?: () => void;
  playerIsPlaying: boolean;
}

const DiscussTab: React.FC<DiscussTabProps> = ({
  onPlayClip,
  isKeyboardVisible,
  setShowVideo,
  autoReviewDetails,
  onBackToShadow,
  playerIsPlaying,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);

  const [selectedQuizType, setSelectedQuizType] =
    useState<QuizType>(autoReviewDetails?.quizType ?? "Translate");

  useEffect(() => {
    if (autoReviewDetails) {
      setSelectedQuizType(autoReviewDetails.quizType);
    }
  }, [autoReviewDetails]);

  useEffect(() => {
    setShowVideo(selectedQuizType !== "Translate");
  }, [selectedQuizType, currentVideo.currentSentence]);

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
        isKeyboardVisible={isKeyboardVisible}
        selectedQuizType={selectedQuizType}
        onSelectQuizType={setSelectedQuizType}
        autoReviewDetails={autoReviewDetails}
        onBackToShadow={onBackToShadow}
        playerIsPlaying={playerIsPlaying}
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
