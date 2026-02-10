import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SegmentWord, Vocabulary } from "../../types";
import { capitalize, normalizeWord, stripPunctuation } from "../../helpers";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../types";
import { setFocusVocab, addUserKnownVocab } from "../../store/actions/dataActions";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";

interface VocabReviewProps {
  selectedVocabRecords: Vocabulary[];
  userSelectedVocab: string[];
  userIgnoredVocab: string[];
  setUserIgnoredVocab: (userIgnoredVocab: string[]) => void;
  allWords: SegmentWord[];
  onConfirm: () => void;
  onGoBack: () => void;
}

const VocabReview: React.FC<VocabReviewProps> = ({
  selectedVocabRecords,
  userSelectedVocab,
  userIgnoredVocab,
  setUserIgnoredVocab,
  allWords,
  onConfirm,
  onGoBack,
}) => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const [confirming, setConfirming] = useState(false);

  const getTranslation = (word: string): string => {
    const normalizedWord = stripPunctuation(word.toLowerCase());
    const found = allWords.find(
      (w) => stripPunctuation(w.word.toLowerCase()) === normalizedWord
    );
    return capitalize(stripPunctuation(found?.translation)) || "—";
  };

  const handleUndo = (word: string) => {
    setUserIgnoredVocab(userIgnoredVocab.filter((w) => w !== word));
  };

  const handleConfirm = async () => {
    setConfirming(true);
    if (
      currentVideo?.videoViewId &&
      supabase &&
      selectedVocabRecords.length > 0
    ) {
      const videoViewId = Number(currentVideo.videoViewId);
      const rows = selectedVocabRecords.map((record) => ({
        video_view_id: videoViewId,
        vocabulary_id: record.id,
      }));
      const { data, error } = await supabase
        .from("video_view_focus_vocab")
        .upsert(rows, { onConflict: "video_view_id,vocabulary_id" });
      if (error) console.error(error);
    }

    // Insert ignored vocab as known
    if (userIgnoredVocab.length > 0 && supabase && userId) {
      const ignoredVocabIds = Object.values(allVocabulary)
        .filter((v) =>
          userIgnoredVocab.some(
            (w) => normalizeWord(w) === normalizeWord(v.word)
          )
        )
        .map((v) => v.id);

      if (ignoredVocabIds.length > 0) {
        const knownRows = ignoredVocabIds.map((vocabId) => ({
          vocabulary_id: vocabId,
          user_id: userId,
        }));

        const { error } = await supabase
          .from("user_known_vocab")
          .upsert(knownRows, { onConflict: "vocabulary_id,user_id" });
        
        if (error) {
          console.error(error);
        } else {
          dispatch(addUserKnownVocab(ignoredVocabIds));
        }
      }
    }

    dispatch(setFocusVocab(selectedVocabRecords));
    setConfirming(false);
    onConfirm();
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        {/* Selected Vocab Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Review the vocab you're choosing to focus on
          </Text>
          {selectedVocabRecords.length === 0 ? (
            <Text style={styles.emptyText}>No vocab selected</Text>
          ) : (
            <View style={styles.vocabList}>
              {selectedVocabRecords.map((v, index) => (
                <View
                  key={`selected-${v.id}-${index}`}
                  style={styles.wordContainer}
                >
                  <Text style={styles.wordText}>
                    {capitalize(v.word)} <Text style={styles.arrow}>→</Text>{" "}
                    <Text style={styles.translationText}>
                      {capitalize(stripPunctuation(v.translation)) || "—"}
                    </Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.undoButton}
                    onPress={() => handleUndo(v.word)}
                  >
                    <Text style={styles.undoButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Ignored Vocab Section */}
        {userIgnoredVocab.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Removed / Ignored Vocab (These will not be included in the vocab
              lists going forward!)
            </Text>
            <View style={styles.vocabList}>
              {userIgnoredVocab.map((word, index) => (
                <View
                  key={`ignored-${word}-${index}`}
                  style={styles.wordContainer}
                >
                  <Text style={styles.wordText}>
                    {capitalize(word)} <Text style={styles.arrow}>→</Text>{" "}
                    <Text style={styles.translationText}>
                      {getTranslation(word)}
                    </Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.undoButton}
                    onPress={() => handleUndo(word)}
                  >
                    <MaterialIcons name="undo" size={18} color="#5a5680" />
                    <Text style={styles.undoButtonText}>Undo</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.confirmButtonContainer}>
        <TouchableOpacity
          style={styles.goBackButton}
          onPress={onGoBack}
          disabled={confirming}
        >
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirm}
          disabled={confirming}
        >
          {confirming ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.confirmButtonText}>
              Confirm and Start Watching
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    margin: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  vocabList: {
    gap: 8,
  },
  wordContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fafafa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  wordText: {
    fontSize: 16,
    color: "#333",
  },
  arrow: {
    color: "#888",
  },
  translationText: {
    color: "#5a5680",
    fontStyle: "italic",
  },
  emptyText: {
    fontSize: 14,
    color: "#888",
    fontStyle: "italic",
    paddingVertical: 8,
  },
  undoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#f0eef5",
    borderRadius: 6,
  },
  undoButtonText: {
    fontSize: 14,
    color: "#5a5680",
    fontWeight: "500",
  },
  confirmButtonContainer: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  confirmButton: {
    backgroundColor: "#5a5680",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  goBackButton: {
    backgroundColor: "5#a5680",
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#5a5680",
    alignItems: "center",
  },
  goBackButtonText: {
    color: "#5a5680",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default VocabReview;
