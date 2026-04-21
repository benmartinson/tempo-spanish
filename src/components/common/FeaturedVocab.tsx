import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { RootState, SegmentWord, VocabCacheEntry } from "../../types";
import { capitalize, vocabFormatWord } from "../../helpers/helpers";
import { useDispatch, useSelector } from "react-redux";
import { updateFocusVocabTranslation } from "../../store/actions/dataActions";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import WordModal from "./WordModal";
import { saveFocusVocabTranslation } from "../../requests";

interface FeaturedVocabProps {
  word: SegmentWord;
  playSnippet: (word: SegmentWord, isSlow?: boolean) => void;
  showSlowPlay?: boolean;
  onReplaySentence?: () => void;
  playerIsPlaying?: boolean;
  vocabCache?: VocabCacheEntry[];
  onVocabCacheUpdate?: (entry: VocabCacheEntry) => void;
}

const FeaturedVocab: React.FC<FeaturedVocabProps> = ({
  word,
  playSnippet,
  showSlowPlay = true,
  onReplaySentence,
  playerIsPlaying = false,
  vocabCache,
  onVocabCacheUpdate,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);

  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();

  const [modalVisible, setModalVisible] = useState(false);

  const currentSentenceIndex = currentVideo ? currentVideo.currentSentence : 0;
  const currentSentenceObject = currentVideo
    ? currentVideo.sentences[currentSentenceIndex]
    : null;

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.textContainer}>
          <View style={styles.wordContainer}>
            <View style={styles.hiddenPlayButton}>
              <MaterialIcons name="play-arrow" size={20} color="black" />
            </View>
            <TouchableOpacity onPress={() => setModalVisible(true)}>
              <View style={styles.playButton}>
                <MaterialIcons name="translate" size={20} color="black" />
              </View>
            </TouchableOpacity>
            <Text style={styles.word}>{capitalize(word.word)}</Text>
            <TouchableOpacity onPress={() => playSnippet(word)}>
              <View style={styles.playButton}>
                <MaterialIcons name="play-arrow" size={20} color="black" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={showSlowPlay ? () => playSnippet(word, true) : () => {}}
            >
              <View
                style={
                  showSlowPlay ? styles.playButton : styles.hiddenPlayButton
                }
              >
                <MaterialIcons
                  name="slow-motion-video"
                  size={24}
                  color="black"
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <WordModal
        visible={modalVisible}
        onClose={handleCloseModal}
        word={word.word}
        sentenceText={currentSentenceObject?.text}
        onTranslationFetched={(translation) => {
          const wordKey = vocabFormatWord(word.word);
          dispatch(updateFocusVocabTranslation(wordKey, translation));
          if (supabase && currentVideo?.videoViewId) {
            saveFocusVocabTranslation({
              supabase,
              videoViewId: currentVideo.videoViewId,
              word: wordKey,
              translation,
            });
          }
        }}
        onReplaySentence={onReplaySentence}
        playerIsPlaying={playerIsPlaying}
        vocabCache={vocabCache}
        onVocabCacheUpdate={onVocabCacheUpdate}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    width: "100%",
    marginTop: 16,
  },
  buttonsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    alignItems: "center",
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  wordContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  playButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: "#f0f0f5",
  },
  hiddenPlayButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: "#f0f0f5",
    opacity: 0,
  },
  word: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  translation: {
    fontSize: 18,
    color: "#666",
    fontStyle: "italic",
  },
  knownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#f0f0f5",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    flex: 1,
  },
  reviewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#5a5680",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    flex: 1,
  },
  selectedReviewButton: {
    borderColor: "green",
  },
  knownButtonText: {
    color: "#5a5680",
    fontSize: 14,
    fontWeight: "600",
  },
  markedKnownButton: {
    backgroundColor: "#e8e8ec",
  },
  markedKnownButtonText: {
    color: "#888",
    fontSize: 14,
    fontWeight: "600",
  },
  reviewButtonText: {
    color: "#5a5680",
    fontSize: 14,
    fontWeight: "600",
  },
  selectedReviewButtonText: {
    color: "green",
  },
});

export default FeaturedVocab;
