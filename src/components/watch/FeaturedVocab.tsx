import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  ActivityIndicator,
  Keyboard,
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
import SlideModal from "../common/Modal";
import { evaluateVocabAnswer } from "../../requests";

interface FeaturedVocabProps {
  word: SegmentWord;
  playSnippet?: (word: SegmentWord, isSlow?: boolean) => void;
  isPlayingWordSnippet?: boolean;
  handleWordHintChange: (direction: number) => void;
  showSlowPlay?: boolean;
  onReplaySentence?: () => void;
  playerIsPlaying?: boolean;
}

const FeaturedVocab: React.FC<FeaturedVocabProps> = ({
  word,
  playSnippet,
  isPlayingWordSnippet,
  handleWordHintChange,
  showSlowPlay = true,
  onReplaySentence,
  playerIsPlaying = false,
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

  // Vocab quiz modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<{
    score: "correct" | "incorrect";
    acceptedAnswers: string[];
  } | null>(null);

  const currentSentenceIndex = currentVideo ? currentVideo.currentSentence : 0;
  const currentSentenceObject = currentVideo
    ? currentVideo.sentences[currentSentenceIndex]
    : null;

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

  const saveSelectForReview = async () => {
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

  const handleSelectForReviewPress = () => {
    if (isSelectedForReview) {
      handleUnselectForReview(word);
    } else {
      saveSelectForReview();
      setModalVisible(true);
    }
  };

  const handleSubmitVocabAnswer = async () => {
    Keyboard.dismiss();
    setIsEvaluating(true);

    try {
      const result = await evaluateVocabAnswer({
        question: `What does "${vocabWord.word}" mean in the context of this sentence: "${currentSentenceObject?.text}"?`,
        userAnswer: userAnswer.trim(),
        contextSegments: currentSentenceObject?.text
          ? [{ text: currentSentenceObject.text }]
          : [],
        vocabWord: vocabWord.word,
        quizType: "vocab",
      });

      if (result) {
        setEvalResult(result);
      }
    } catch (err) {
      console.error("Error evaluating vocab answer:", err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSubmitAgain = () => {
    setEvalResult(null);
    handleSubmitVocabAnswer();
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setUserAnswer("");
    setEvalResult(null);
    setIsEvaluating(false);
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
            onPress={handleSelectForReviewPress}
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

      <SlideModal
        visible={modalVisible}
        onRequestClose={handleCloseModal}
        title="Guess the Meaning"
      >
        <View style={modalStyles.content}>
          <Text style={modalStyles.vocabWord}>
            {capitalize(vocabWord?.word || word.word)}
          </Text>

          {/* <Text style={modalStyles.contextLabel}>In context:</Text>
          <Text style={modalStyles.contextText}>
            {currentSentenceObject?.text}
          </Text> */}

          <Text style={modalStyles.questionText}>
            What does this word mean in the context of the clip segment?
          </Text>

          {onReplaySentence && (
            <TouchableOpacity
              style={[
                modalStyles.replayButton,
                playerIsPlaying && modalStyles.replayButtonDisabled,
              ]}
              onPress={onReplaySentence}
              disabled={playerIsPlaying}
            >
              <MaterialIcons
                name="replay"
                size={20}
                color={playerIsPlaying ? "#aaa" : "#4a69bd"}
              />
              <Text
                style={[
                  modalStyles.replayButtonText,
                  playerIsPlaying && { color: "#aaa" },
                ]}
              >
                Replay
              </Text>
            </TouchableOpacity>
          )}

          <View style={modalStyles.inputWrapper}>
            <TextInput
              style={modalStyles.input}
              placeholder="Type your answer..."
              placeholderTextColor="#999"
              value={userAnswer}
              onChangeText={setUserAnswer}
              multiline
              autoCorrect={false}
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={() => {
                if (userAnswer.trim()) {
                  if (evalResult) {
                    handleSubmitAgain();
                  } else {
                    handleSubmitVocabAnswer();
                  }
                }
              }}
            />
            {userAnswer.length > 0 && (
              <TouchableOpacity
                style={modalStyles.clearButton}
                onPress={() => setUserAnswer("")}
              >
                <Entypo name="cross" size={16} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {isEvaluating ? (
            <View style={modalStyles.resultContainer}>
              <ActivityIndicator size="small" color="#4a69bd" />
            </View>
          ) : evalResult?.score === "correct" ? (
            <View style={modalStyles.resultContainer}>
              <View
                style={[modalStyles.scoreCard, modalStyles.scoreCardSuccess]}
              >
                <Text style={modalStyles.scoreText}>Correct!</Text>
              </View>
              <View style={modalStyles.acceptedAnswersContainer}>
                <Text style={modalStyles.acceptedAnswersLabel}>
                  Accepted answers:
                </Text>
                {evalResult.acceptedAnswers.map((answer, i) => (
                  <Text key={i} style={modalStyles.acceptedAnswer}>
                    {answer}
                  </Text>
                ))}
              </View>
              <Text style={modalStyles.markedText}>
                This word is selected for later review!
              </Text>
              <TouchableOpacity
                style={modalStyles.closeButton}
                onPress={handleCloseModal}
              >
                <Text style={modalStyles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            evalResult?.score === "incorrect" && (
              <View style={modalStyles.resultContainer}>
                <View style={modalStyles.scoreCard}>
                  <Text style={modalStyles.scoreTextIncorrect}>Incorrect</Text>
                </View>
                <View style={modalStyles.acceptedAnswersContainer}>
                  <Text style={modalStyles.acceptedAnswersLabel}>
                    Accepted answers:
                  </Text>
                  {evalResult.acceptedAnswers.map((answer, i) => (
                    <Text key={i} style={modalStyles.acceptedAnswer}>
                      {answer}
                    </Text>
                  ))}
                </View>
                <Text style={modalStyles.markedText}>
                  This word is selected for later review!
                </Text>
                <TouchableOpacity
                  style={modalStyles.closeButton}
                  onPress={handleCloseModal}
                >
                  <Text style={modalStyles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            )
          )}
        </View>
      </SlideModal>
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

const modalStyles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 20,
  },
  vocabWord: {
    fontSize: 28,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
  },
  contextLabel: {
    fontSize: 13,
    color: "#888",
    fontWeight: "500",
  },
  contextText: {
    fontSize: 16,
    color: "#444",
    fontStyle: "italic",
    lineHeight: 24,
    marginTop: -12,
  },
  questionText: {
    fontSize: 16,
    color: "#555",
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
    minHeight: 60,
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
  resultContainer: {
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
  scoreText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#22a655",
  },
  scoreTextIncorrect: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4a69bd",
  },
  tryAgainText: {
    fontSize: 15,
    color: "#888",
    fontWeight: "500",
    marginTop: 4,
  },
  acceptedAnswersContainer: {
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  acceptedAnswersLabel: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  acceptedAnswer: {
    fontSize: 16,
    color: "#222",
    fontWeight: "600",
  },
  showAnswerButton: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    marginTop: 8,
  },
  showAnswerButtonText: {
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

export default FeaturedVocab;
