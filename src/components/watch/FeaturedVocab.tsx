import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { RootState, SegmentWord } from "../../types";
import { capitalize, normalizeWord, stripPunctuation } from "../../helpers";
import Entypo from "@expo/vector-icons/Entypo";
import { useDispatch, useSelector } from "react-redux";
import {
  addUserKnownVocab,
  setFocusVocab,
} from "../../store/actions/dataActions";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";

interface FeaturedVocabProps {
  word: SegmentWord;
  playSnippet?: (word: SegmentWord) => void;
  isPlayingWordSnippet?: boolean;
}

const FeaturedVocab: React.FC<FeaturedVocabProps> = ({
  word,
  playSnippet,
  isPlayingWordSnippet,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const vocabulary =
    allVocabulary[stripPunctuation(word.word.toLowerCase()).trim()];

  const handleMarkKnown = async (word: SegmentWord) => {
    if (!currentVideo) return;

    const vocabId = Object.values(allVocabulary).find(
      (v) => normalizeWord(v.word) === normalizeWord(word.word),
    )?.id;
    dispatch(addUserKnownVocab([vocabId]));

    // 3. Update Supabase
    if (supabase && userId && currentVideo.videoViewId) {
      // Add to user_known_vocab
      const { error: insertError } = await supabase
        .from("user_known_vocab")
        .upsert(
          { vocabulary_id: vocabId, user_id: userId },
          { onConflict: "vocabulary_id,user_id" },
        );

      if (insertError)
        console.error("Error adding to known vocab:", insertError);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.textContainer}>
          <TouchableOpacity
            onPress={() => playSnippet(word)}
            style={styles.wordContainer}
            disabled={isPlayingWordSnippet}
          >
            <View style={styles.hiddenPlayButton}>
              <MaterialIcons name="play-arrow" size={20} color="black" />
            </View>
            <Text style={styles.word}>{capitalize(word.word)}</Text>
            <View style={styles.playButton}>
              <MaterialIcons name="play-arrow" size={20} color="black" />
            </View>
          </TouchableOpacity>

          <Text style={styles.translation}>
            {capitalize(vocabulary.translation)}
          </Text>
        </View>
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.knownButton}
            onPress={() => handleMarkKnown(word)}
          >
            <Text style={styles.knownButtonText}>Mark as Known</Text>
            <Entypo name="check" size={16} color="#5a5680" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reviewButton}
            onPress={() => handleMarkKnown(word)}
          >
            <Text style={styles.reviewButtonText}>Select for Review</Text>
            <Entypo name="pencil" size={16} color="#5a5680" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  knownButtonText: {
    color: "#5a5680",
    fontSize: 14,
    fontWeight: "600",
  },
  reviewButtonText: {
    color: "#5a5680",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default FeaturedVocab;
