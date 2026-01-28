import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import YouTubePlayer from "./YouTubePlayer";
import { KeyVocabulary, VideoContext } from "../../types";
import { useNavigation } from "@react-navigation/native";
import { setCurrentTab } from "../../store/actions/dataActions";
import { useDispatch } from "react-redux";

interface VideoProps {
  video: VideoContext;
  refreshKey: number;
  onBackButton: () => void;
  // onNextButton: () => void;
}

const Video: React.FC<VideoProps> = ({ video, refreshKey, onBackButton }) => {
  const navigation = useNavigation();
  const clip = video.segments[video.currentSegment];
  const [translations, setTranslations] = useState<KeyVocabulary[]>([]);
  const [time, setTime] = useState<number>(0);
  const timeRemaining = Math.floor(Math.max(clip.end - time, 0));
  const dispatch = useDispatch();

  const translateWord = async (word: KeyVocabulary) => {
    const needsRemoval = translations.find(
      (translation) => translation.value === word.value,
    );
    if (needsRemoval) {
      setTranslations((prev) =>
        prev.filter((translation) => translation.value !== word.value),
      );
    } else {
      setTranslations((prev) => [...prev, word]);
    }
  };

  const handleSetTime = (newTime: number) => {
    const newTimeRemaining = Math.max(Math.ceil(clip.end - newTime), 0);
    if (newTimeRemaining < 1 && timeRemaining >= 0) {
      dispatch(setCurrentTab("discuss"));
      navigation.navigate("Discuss" as never);
      setTime(newTime);
      return;
    }
    setTime(newTime);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* <TouchableOpacity style={styles.button} onPress={onBackButton}> */}
        {/* <Text style={styles.buttonText}>Back to Videos</Text> */}
        {/* </TouchableOpacity> */}
      </View>
      <View style={styles.videoContainer}>
        <YouTubePlayer
          clip={{ ...clip, videoId: video.videoId }}
          autoplay={true}
          refreshKey={refreshKey}
          setTime={handleSetTime}
        />
        {timeRemaining < 10 && timeRemaining > 0 && (
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownText}>
              Segment ends in {timeRemaining}
            </Text>
          </View>
        )}
      </View>
      <ScrollView>
        {clip.key_vocabulary && clip.key_vocabulary.length > 0 && (
          <View style={styles.vocabCard}>
            <Text style={styles.vocabTitle}>Vocab in this segment</Text>
            <ScrollView style={styles.vocabList}>
              {clip.key_vocabulary.map((word, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.vocabItem}
                  onPress={() => translateWord(word)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.vocabWord}>{word.value}</Text>
                  {translations.find(
                    (translation) => translation.value === word.value,
                  ) && (
                    <Text style={styles.vocabTranslation}>
                      {" => "}
                      {
                        translations.find(
                          (translation) => translation.value === word.value,
                        )?.translation
                      }
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
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
  vocabCard: {
    margin: 16,
    backgroundColor: "#2d2a40",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    // maxHeight: 200,
  },
  vocabTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  vocabList: {
    flexGrow: 0,
  },
  vocabItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#3d3a52",
    borderRadius: 10,
    marginBottom: 8,
  },
  vocabWord: {
    color: "#a0a0b0",
    fontSize: 15,
    fontWeight: "600",
  },
  vocabTranslation: {
    color: "#a0a0b0",
    fontSize: 15,
    fontWeight: "500",
  },
  loader: {
    marginLeft: 8,
  },
});

export default Video;
