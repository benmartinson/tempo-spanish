import {
  Text,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import Entypo from "@expo/vector-icons/Entypo";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../types";
import {
  addFocusSentence,
  removeFocusSentence,
} from "../../store/actions/dataActions";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useState } from "react";
import SlideModal from "../common/Modal";
import { evaluateTranslation } from "../../requests";

interface FocusSentenceRequestProps {
  sentenceIndex: number;
  sentenceText: string;
  segmentIndex: number;
  videoViewId: number;
  markedId: number | null;
  sentenceTranslation: string | null;
  isLoadingTranslation: boolean;
}

const FocusSentenceRequest: React.FC<FocusSentenceRequestProps> = ({
  sentenceIndex,
  sentenceText,
  segmentIndex,
  videoViewId,
  markedId,
  sentenceTranslation,
  isLoadingTranslation,
}) => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const userSettings = useSelector((state: RootState) => state.userSettings);

  const isMarked = Boolean(markedId);
  const [modalVisible, setModalVisible] = useState(false);
  const [userTranslation, setUserTranslation] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  const handlePress = async () => {
    if (isMarked) {
      const { data, error } = await supabase
        .from("video_view_focus_sentence")
        .delete()
        .eq("video_view_id", videoViewId)
        .eq("id", markedId);
      if (error) {
        console.error(error);
        return;
      }

      dispatch(removeFocusSentence(markedId));
      return;
    }

    setModalVisible(true);
  };

  const saveFocusSentence = async () => {
    const { data, error } = await supabase
      .from("video_view_focus_sentence")
      .insert({
        video_view_id: videoViewId,
        text: sentenceText,
        segment_index: segmentIndex,
        sentence_index: sentenceIndex,
      })
      .select("id, text, segment_index, sentence_index")
      .single();

    if (error) {
      console.error(error);
      return;
    }

    dispatch(
      addFocusSentence({
        id: data.id,
        text: data.text,
        segment_index: data.segment_index,
        sentence_index: data.sentence_index,
      }),
    );
  };

  const handleSubmitTranslation = async () => {
    if (!sentenceTranslation) return;

    Keyboard.dismiss();
    setIsEvaluating(true);

    try {
      const result = await evaluateTranslation({
        sentenceText,
        translation: sentenceTranslation,
        translationLanguage: userSettings.translationLanguage,
        userTranslation: userTranslation.trim(),
      });

      if (result) {
        setScore(result.score);
        if (result.score >= 80) {
          setShowTranslation(true);
          await saveFocusSentence();
        }
      }
    } catch (err) {
      console.error("Error evaluating translation:", err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSubmitAgain = () => {
    setScore(null);
    setShowTranslation(false);
    handleSubmitTranslation();
  };

  const handleShowTranslation = async () => {
    setShowTranslation(true);
    await saveFocusSentence();
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setUserTranslation("");
    setScore(null);
    setShowTranslation(false);
    setIsEvaluating(false);
  };

  const submitted = score !== null;

  return (
    <>
      <TouchableOpacity style={styles.container} onPress={handlePress}>
        <Entypo name="pencil" size={32} color={isMarked ? "#222222" : "gray"} />
      </TouchableOpacity>

      <SlideModal
        visible={modalVisible}
        onRequestClose={handleCloseModal}
        title="Translate"
      >
        <View style={styles.modalContent}>
          <Text style={styles.sentenceText}>{sentenceText}</Text>

          <Text style={styles.questionText}>
            What do you think the sentence means?
          </Text>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Type your translation..."
              placeholderTextColor="#999"
              value={userTranslation}
              onChangeText={setUserTranslation}
              multiline
              autoCorrect={false}
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={() => {
                if (userTranslation.trim() && sentenceTranslation) {
                  if (score !== null) {
                    handleSubmitAgain();
                  } else {
                    handleSubmitTranslation();
                  }
                }
              }}
            />
            {userTranslation.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setUserTranslation("")}
              >
                <Entypo name="cross" size={16} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {isEvaluating || (isLoadingTranslation && !sentenceTranslation) ? (
            <View style={styles.translationResult}>
              <ActivityIndicator size="small" color="#4a69bd" />
            </View>
          ) : showTranslation ? (
            <View style={styles.translationResult}>
              <View
                style={[
                  styles.scoreCard,
                  score >= 80 && styles.scoreCardSuccess,
                ]}
              >
                <Text style={styles.scoreLabel}>Your answer was judged as</Text>
                <Text
                  style={[
                    styles.scoreValue,
                    score >= 80 && styles.scoreValueSuccess,
                  ]}
                >
                  {score}%
                </Text>
                <Text style={styles.scoreLabel}>correct</Text>
              </View>
              <Text style={styles.translationLabel}>Translation:</Text>
              <Text style={styles.translationText}>{sentenceTranslation}</Text>
              <Text style={styles.markedText}>
                This sentence is marked for later review!
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCloseModal}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.translationResult}>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Your answer was judged as</Text>
                <Text style={styles.scoreValue}>{score}%</Text>
                <Text style={styles.scoreLabel}>correct</Text>
              </View>
              <Text style={styles.tryAgainText}>Try again!</Text>
              <TouchableOpacity
                style={styles.showTranslationButton}
                onPress={handleShowTranslation}
              >
                <Text style={styles.showTranslationButtonText}>
                  Show Translation
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SlideModal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
    paddingVertical: 12,
    borderRadius: 24,
  },
  modalContent: {
    padding: 24,
    gap: 20,
  },
  sentenceText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#222",
    lineHeight: 28,
  },
  questionText: {
    fontSize: 16,
    color: "#555",
  },
  inputWrapper: {
    position: "relative",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 14,
    paddingRight: 32,
    fontSize: 16,
    color: "#222",
    minHeight: 80,
    textAlignVertical: "top",
  },
  clearButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    backgroundColor: "#4a69bd",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  translationResult: {
    paddingTop: 8,
    alignItems: "center",
    gap: 8,
  },
  scoreCard: {
    backgroundColor: "#f0f4ff",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d6e0f5",
    width: "100%",
  },
  scoreCardSuccess: {
    backgroundColor: "#edfcf2",
    borderColor: "#b6e9c8",
  },
  scoreLabel: {
    fontSize: 14,
    color: "#666",
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#4a69bd",
    marginVertical: 2,
  },
  scoreValueSuccess: {
    color: "#22a655",
  },
  translationLabel: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
    marginTop: 4,
  },
  translationText: {
    fontSize: 18,
    color: "#222",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 26,
  },
  tryAgainText: {
    fontSize: 15,
    color: "#888",
    fontWeight: "500",
    marginTop: 4,
  },
  showTranslationButton: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  showTranslationButtonText: {
    color: "#555",
    fontSize: 15,
    fontWeight: "600",
  },
  markedText: {
    fontSize: 14,
    color: "#22a655",
    fontWeight: "500",
    marginTop: 8,
    textAlign: "center",
  },
  closeButton: {
    backgroundColor: "#4a69bd",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default FocusSentenceRequest;
