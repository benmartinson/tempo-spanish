import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { RootState, SegmentWord } from "../../types";
import {
  capitalize,
  normalizeWord,
  stripPunctuation,
  vocabFormatWord,
} from "../../helpers";
import Entypo from "@expo/vector-icons/Entypo";
import { useDispatch, useSelector } from "react-redux";
import {
  addUserKnownVocab,
  addUserSelectedVocab,
  removeUserKnownVocab,
  removeUserSelectedVocab,
  setFocusVocab,
} from "../../store/actions/dataActions";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";

interface FeaturedVocabProps {
  word: SegmentWord;
  playSnippet?: (word: SegmentWord, isSlow?: boolean) => void;
  isPlayingWordSnippet?: boolean;
  handleWordHintChange: (direction: number) => void;
  showSlowPlay?: boolean;
}

const FeaturedVocab: React.FC<FeaturedVocabProps> = ({
  word,
  playSnippet,
  isPlayingWordSnippet,
  handleWordHintChange,
  showSlowPlay = true,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const vocabWord = allVocabulary[vocabFormatWord(word.word)];
  const isSelectedForReview = useMemo(
    () => currentVideo?.focusVocab.find((v) => v === vocabWord.id),
    [currentVideo, word],
  );

  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();

  const handleMarkKnown = async (word: SegmentWord) => {
    if (!currentVideo) return;

    const vocabId = Object.values(allVocabulary).find(
      (v) => normalizeWord(v.word) === normalizeWord(word.word),
    )?.id;

    if (supabase && userId && currentVideo.videoViewId) {
      const { error: insertError } = await supabase
        .from("user_known_vocab")
        .upsert(
          { vocabulary_id: vocabId, user_id: userId },
          { onConflict: "vocabulary_id,user_id" },
        );

      if (insertError)
        console.error("Error adding to known vocab:", insertError);
    }
    dispatch(addUserKnownVocab([vocabId]));
  };

  const handleUnmarkKnown = async (word: SegmentWord) => {
    if (!currentVideo) return;

    const vocabId = Object.values(allVocabulary).find(
      (v) => normalizeWord(v.word) === normalizeWord(word.word),
    )?.id;

    if (supabase && userId) {
      const { error } = await supabase
        .from("user_known_vocab")
        .delete()
        .match({ vocabulary_id: vocabId, user_id: userId });

      if (error) console.error("Error removing from known vocab:", error);
    }
    dispatch(removeUserKnownVocab([vocabId]));
  };

  const handleUnselectForReview = async (word: SegmentWord) => {
    if (!currentVideo) return;

    const normalizedWord = normalizeWord(word.word);
    const vocabId = Object.values(allVocabulary).find(
      (v) => normalizeWord(v.word) === normalizedWord,
    )?.id;

    if (supabase && userId && currentVideo.videoViewId) {
      const { error } = await supabase
        .from("video_view_focus_vocab")
        .delete()
        .match({
          video_view_id: currentVideo.videoViewId,
          vocabulary_id: vocabId,
        });

      if (error) console.error("Error removing from selected vocab:", error);
    }
    dispatch(removeUserSelectedVocab([vocabId]));
  };

  const handleSelectForReview = async (word: SegmentWord) => {
    if (!currentVideo) return;

    const normalizedWord = normalizeWord(word.word);
    const vocabId = Object.values(allVocabulary).find(
      (v) => normalizeWord(v.word) === normalizedWord,
    )?.id;
    dispatch(addUserSelectedVocab([vocabId]));

    if (supabase && userId && currentVideo.videoViewId) {
      const { data, error: insertError } = await supabase
        .from("video_view_focus_vocab")
        .upsert(
          { video_view_id: currentVideo.videoViewId, vocabulary_id: vocabId },
          { onConflict: "video_view_id,vocabulary_id" },
        );

      if (insertError)
        console.error("Error adding to selected vocab:", insertError);

      if (data) {
        dispatch(addUserSelectedVocab([vocabId]));
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.textContainer}>
          <View style={styles.wordContainer}>
            <View style={styles.hiddenPlayButton}>
              <MaterialIcons name="play-arrow" size={20} color="black" />
            </View>
            <View style={styles.hiddenPlayButton}>
              <MaterialIcons name="play-arrow" size={20} color="black" />
            </View>
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

          {/* {word.contextTranslation && (
            <Text style={styles.translation}>
              {capitalize(word.contextTranslation)}
            </Text>
          )} */}
        </View>
        <View style={styles.buttonsContainer}>
          <Pressable
            style={
              !word.isKnown
                ? styles.reviewButton
                : [styles.reviewButton, styles.selectedReviewButton]
            }
            onPress={() =>
              word.isKnown ? handleUnmarkKnown(word) : handleMarkKnown(word)
            }
          >
            <Text
              style={
                word.isKnown
                  ? [styles.reviewButtonText, styles.selectedReviewButtonText]
                  : styles.reviewButtonText
              }
            >
              {word.isKnown ? "Marked as Known" : "Mark as Known"}
            </Text>
            {!word.isKnown && <Entypo name="check" size={16} color="#5a5680" />}
          </Pressable>

          <Pressable
            style={
              !isSelectedForReview
                ? styles.reviewButton
                : [styles.reviewButton, styles.selectedReviewButton]
            }
            onPress={() =>
              isSelectedForReview
                ? handleUnselectForReview(word)
                : handleSelectForReview(word)
            }
          >
            <Text
              style={
                isSelectedForReview
                  ? [styles.reviewButtonText, styles.selectedReviewButtonText]
                  : styles.reviewButtonText
              }
            >
              {isSelectedForReview
                ? "Selected for Review"
                : "Select for Review"}
            </Text>
            {!isSelectedForReview && (
              <Entypo name="pencil" size={16} color="#5a5680" />
            )}
          </Pressable>
        </View>
      </View>
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
    padding: 16,
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
