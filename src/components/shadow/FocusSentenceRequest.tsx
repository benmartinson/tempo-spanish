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
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../types";
import {
  addFocusSentence,
  removeFocusSentence,
} from "../../store/actions/dataActions";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useEffect, useState } from "react";
import SlideModal from "../common/SlideModal";
import { evaluateTranslation } from "../../requests";

interface FocusSentenceRequestProps {
  sentenceIndex: number;
  sentenceText: string;
  segmentIndex: number;
  videoViewId: number;
  markedId: number | null;
  sentenceTranslation: string | null;
  isLoadingTranslation: boolean;
  onReplay: () => void;
  playerIsPlaying: boolean;
}

const FocusSentenceRequest: React.FC<FocusSentenceRequestProps> = ({
  sentenceIndex,
  sentenceText,
  segmentIndex,
  videoViewId,
  markedId,
  sentenceTranslation,
  isLoadingTranslation,
  onReplay,
  playerIsPlaying,
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

  useEffect(() => {
    setUserTranslation("");
    setIsEvaluating(false);
    setScore(null);
    setShowTranslation(false);
  }, [modalVisible]);

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
    } else {
      await saveFocusSentence();
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
        setShowTranslation(true);
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

  return (
    <>
      <TouchableOpacity style={styles.container} onPress={handlePress}>
        <MaterialIcons name="translate" size={32} color="black" />
      </TouchableOpacity>

      <SlideModal
        visible={modalVisible}
        onRequestClose={handleCloseModal}
        title="Guess the Translation"
      >
        <View style={styles.modalContent}>
          {/* <Text style={styles.sentenceText}>{sentenceText}</Text> */}

          {!showTranslation && (
            <>
              <Text style={styles.instructions}>
                Before seeing the translation, it's good practice to attempt
                your best guess first.
              </Text>

              <Text style={styles.questionText}>
                What do you think the sentence means?
              </Text>
              <TouchableOpacity
                style={[
                  styles.replayButton,
                  playerIsPlaying && styles.replayButtonDisabled,
                ]}
                onPress={onReplay}
                disabled={playerIsPlaying}
              >
                <MaterialIcons
                  name="replay"
                  size={20}
                  color={playerIsPlaying ? "#aaa" : "#4a69bd"}
                />
                <Text
                  style={[
                    styles.replayButtonText,
                    playerIsPlaying && { color: "#aaa" },
                  ]}
                >
                  Replay
                </Text>
              </TouchableOpacity>

              {sentenceText && (
                <Text style={styles.sentenceHint}>
                  Sentence starts with:{" "}
                  {sentenceText.split(/\s+/).slice(0, 2).join(" ")}...
                </Text>
              )}
            </>
          )}

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
              <Text style={styles.sentenceText}>{sentenceText}</Text>
              <Text style={styles.translationLabel}>Translation:</Text>
              <Text style={styles.translationText}>{sentenceTranslation}</Text>
              <Text style={styles.markedText}>
                This segment is marked for later review!
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCloseModal}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            score !== null && (
              <View style={styles.translationResult}>
                <View style={styles.scoreCard}>
                  <Text style={styles.scoreLabel}>
                    Your answer was judged as
                  </Text>
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
            )
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
  instructions: {
    opacity: 0.5,
    textAlign: "center",
  },
  sentenceHint: {
    fontSize: 14,
    opacity: 0.5,
    color: "#888",
    fontStyle: "italic" as const,
  },
  replayButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    alignSelf: "flex-start" as const,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#4a69bd",
    backgroundColor: "#f0f4ff",
  },
  replayButtonDisabled: {
    borderColor: "#ddd",
    backgroundColor: "#f5f5f5",
  },
  replayButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#4a69bd",
  },
  sentenceText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#222",
    lineHeight: 28,
  },
  questionText: {
    fontSize: 16,
    fontWeight: 600,
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
    backgroundColor: "#f0f0f0",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    marginTop: 8,
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
