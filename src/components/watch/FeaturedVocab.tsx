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

interface FeaturedVocabProps {
  word: SegmentWord;
}

const FeaturedVocab: React.FC<FeaturedVocabProps> = ({ word }) => {
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
          <Text style={styles.word}>{capitalize(word.word)}</Text>
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
