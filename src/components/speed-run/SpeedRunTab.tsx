import React, { useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  TouchableOpacity,
} from "react-native";
import { RootState, SegmentWord, Sentence } from "../../types";
import { useSelector } from "react-redux";
import FullSegmentTranscriptBubble from "../common/FullSegmentTranscriptBubble";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import NavSwitcher from "../common/NavSwitcher";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRecording } from "../useRecording";

interface SpeedRunTabProps {
  time: number;
  currentSentence: Sentence;
  setCurrentSentence: React.Dispatch<React.SetStateAction<number>>;
  setAutoplay: (autoplay: boolean) => void;
  refreshPlayer: () => void;
  isActive?: boolean;
  hintWords: SegmentWord[];
  handlePlayWordSnippet: (word: SegmentWord) => void;
  isPlayingWordSnippet: boolean;
  pausePlayer: () => void;
  resumePlayer: () => void;
  playerIsPlaying: boolean;
  setPlayerSpeed: (speed: number) => void;
  handleNextSentence: () => void;
  handlePreviousSentence: () => void;
  onPlayClip: (time: number) => void;
  playSentence: () => void;
}

const SpeedRunTab: React.FC<SpeedRunTabProps> = ({
  time,
  currentSentence,
  handleNextSentence,
  handlePreviousSentence,
  onPlayClip,
  playSentence,
  pausePlayer,
  playerIsPlaying,
  setPlayerSpeed,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);

  const handleRecordingComplete = useCallback((audioUri: string) => {
    console.log("Speed run recording complete:", audioUri);
  }, []);

  const { isRecording, startRecording, stopRecording } = useRecording({
    onRecordingComplete: handleRecordingComplete,
  });

  const handleRecord = useCallback(async () => {
    setPlayerSpeed(1);
    await startRecording();
    playSentence();
  }, [startRecording, playSentence, setPlayerSpeed]);

  const handleStop = useCallback(async () => {
    await stopRecording();
    pausePlayer();
  }, [stopRecording, pausePlayer]);

  const currentSentenceIndex = currentVideo ? currentVideo.currentSentence : 0;

  if (!currentVideo) {
    return <SelectVideoPrompt />;
  }

  return (
    <View style={styles.container}>
      <NavSwitcher
        onPrev={handlePreviousSentence}
        onNext={handleNextSentence}
        currentIndex={currentSentenceIndex}
        totalItems={currentVideo.sentences.length}
        sentences={currentVideo.sentences}
        onPlayClip={onPlayClip}
        videoId={currentVideo.videoId}
      >
        <Text style={styles.segmentNavText}>
          Segment {currentSentenceIndex + 1} of{" "}
          {currentVideo.sentences.length + 1}
        </Text>
      </NavSwitcher>
      <ScrollView style={styles.transcriptContainer}>
        <FullSegmentTranscriptBubble
          words={currentSentence.words || []}
          time={time}
          playerIsPlaying={playerIsPlaying}
          showFullText
        />
      </ScrollView>

      <View style={styles.recordButtonContainer}>
        {isRecording ? (
          <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
            <MaterialIcons name="stop" size={24} color="#ff6b6b" />
            <Text style={styles.stopButtonText}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.recordButton} onPress={handleRecord}>
            <MaterialIcons name="mic" size={24} color="black" />
            <Text style={styles.recordButtonText}>Record</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    paddingBottom: 24,
  },
  segmentNavText: {
    opacity: 0.6,
  },
  transcriptContainer: {
    flex: 1,
  },
  recordButtonContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#3d3a52",
    borderRadius: 24,
    gap: 8,
  },
  recordButtonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "600",
  },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ff6b6b",
    borderRadius: 24,
    gap: 8,
  },
  stopButtonText: {
    color: "#ff6b6b",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default SpeedRunTab;
