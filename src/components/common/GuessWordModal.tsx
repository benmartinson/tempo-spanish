import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import Entypo from "@expo/vector-icons/Entypo";
import { MaterialIcons } from "@expo/vector-icons";
import { capitalize } from "../../helpers/helpers";
import { evaluateVocabAnswer } from "../../requests";
import SlideModal from "./SlideModal";

interface GuessWordModalProps {
  visible: boolean;
  onClose: () => void;
  /** Single word mode (used by FeaturedVocab) */
  word?: string;
  /** Multi-word mode (used by GuidedPractice) */
  words?: string[];
  sentenceText?: string;
  onReplaySentence?: () => void;
  playerIsPlaying?: boolean;
  onCorrect?: () => void;
  onFinished?: () => void;
  title?: string;
}

interface WordState {
  userAnswer: string;
  evalResult: {
    score: "correct" | "incorrect";
    acceptedAnswers: string[];
  } | null;
}

const GuessWordModal: React.FC<GuessWordModalProps> = ({
  visible,
  onClose,
  word,
  words,
  sentenceText,
  onReplaySentence,
  playerIsPlaying = false,
  onCorrect,
  onFinished,
  title = "Guess the Meaning",
}) => {
  const wordList = words ?? (word ? [word] : []);
  const isMultiWord = (words?.length ?? 0) > 1;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [wordStates, setWordStates] = useState<WordState[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Reset state when modal opens or word list changes
  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      setWordStates(wordList.map(() => ({ userAnswer: "", evalResult: null })));
      setIsEvaluating(false);
    }
  }, [visible]);

  const currentWord = wordList[currentIndex] ?? "";
  const currentState = wordStates[currentIndex] ?? {
    userAnswer: "",
    evalResult: null,
  };
  const hasGuessed = currentState.evalResult !== null;

  const updateCurrentState = (updates: Partial<WordState>) => {
    setWordStates((prev) => {
      const next = [...prev];
      next[currentIndex] = { ...next[currentIndex], ...updates };
      return next;
    });
  };

  const handleSubmitVocabAnswer = async () => {
    Keyboard.dismiss();
    setIsEvaluating(true);

    try {
      const result = await evaluateVocabAnswer({
        question: `What does "${currentWord}" mean in the context of this sentence: "${sentenceText}"?`,
        userAnswer: currentState.userAnswer.trim(),
        contextSegments: sentenceText ? [{ text: sentenceText }] : [],
        vocabWord: currentWord,
        quizType: "vocab",
      });

      if (result) {
        updateCurrentState({ evalResult: result });
        if (result.score === "correct") {
          onCorrect?.();
        }
      }
    } catch (err) {
      console.error("Error evaluating vocab answer:", err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSubmitAgain = () => {
    updateCurrentState({ evalResult: null });
    handleSubmitVocabAnswer();
  };

  const handleClose = () => {
    setWordStates([]);
    setCurrentIndex(0);
    setIsEvaluating(false);
    onClose();
  };

  const handleBack = () => {
    if (currentIndex === 0) {
      handleClose();
    } else {
      // Reset the previous word's state so they can re-guess
      setWordStates((prev) => {
        const next = [...prev];
        next[currentIndex - 1] = { userAnswer: "", evalResult: null };
        return next;
      });
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleContinue = () => {
    if (currentIndex === wordList.length - 1) {
      onFinished?.();
      handleClose();
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const isLastWord = currentIndex === wordList.length - 1;

  return (
    <SlideModal visible={visible} onRequestClose={handleClose} title={title}>
      <View style={styles.content}>
        {isMultiWord && (
          <View style={styles.topRow}>
            <TouchableOpacity onPress={handleBack} style={styles.backArrow}>
              <MaterialIcons name="arrow-back" size={22} color="#222" />
            </TouchableOpacity>
            <Text style={styles.progressText}>
              {currentIndex + 1} of {wordList.length}
            </Text>
          </View>
        )}
        <Text style={styles.vocabWord}>{capitalize(currentWord)}</Text>

        <Text style={styles.questionText}>
          Before seeing the translation, what do you think this word means?
        </Text>

        {onReplaySentence && (
          <TouchableOpacity
            style={[
              styles.replayButton,
              playerIsPlaying && styles.replayButtonDisabled,
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
                styles.replayButtonText,
                playerIsPlaying && { color: "#aaa" },
              ]}
            >
              Replay
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type your guess..."
            placeholderTextColor="#999"
            value={currentState.userAnswer}
            onChangeText={(text) => updateCurrentState({ userAnswer: text })}
            multiline
            autoCorrect={false}
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => {
              if (currentState.userAnswer.trim()) {
                if (currentState.evalResult) {
                  handleSubmitAgain();
                } else {
                  handleSubmitVocabAnswer();
                }
              }
            }}
          />
          {currentState.userAnswer.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => updateCurrentState({ userAnswer: "" })}
            >
              <Entypo name="cross" size={16} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {isEvaluating ? (
          <View style={styles.resultContainer}>
            <ActivityIndicator size="small" color="#4a69bd" />
          </View>
        ) : currentState.evalResult?.score === "correct" ? (
          <View style={styles.resultContainer}>
            <View style={[styles.scoreCard, styles.scoreCardSuccess]}>
              <Text style={styles.scoreText}>Correct!</Text>
            </View>
            <View style={styles.acceptedAnswersContainer}>
              <Text style={styles.acceptedAnswersLabel}>Accepted answers:</Text>
              {currentState.evalResult.acceptedAnswers.map((answer, i) => (
                <Text key={i} style={styles.acceptedAnswer}>
                  {answer}
                </Text>
              ))}
            </View>
            {isMultiWord ? (
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonPrimary]}
                onPress={handleContinue}
              >
                <Text style={styles.navButtonPrimaryText}>
                  {isLastWord ? "Finish" : "Continue"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          currentState.evalResult?.score === "incorrect" && (
            <View style={styles.resultContainer}>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreTextIncorrect}>Incorrect</Text>
              </View>
              <View style={styles.acceptedAnswersContainer}>
                <Text style={styles.acceptedAnswersLabel}>
                  Accepted answers:
                </Text>
                {currentState.evalResult.acceptedAnswers.map((answer, i) => (
                  <Text key={i} style={styles.acceptedAnswer}>
                    {answer}
                  </Text>
                ))}
              </View>
              {isMultiWord ? (
                <View style={styles.navRow}>
                  <TouchableOpacity
                    style={[styles.navButton, styles.navButtonPrimary]}
                    onPress={handleContinue}
                  >
                    <Text style={styles.navButtonPrimaryText}>
                      {isLastWord ? "Finish" : "Continue"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleClose}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        )}
      </View>
    </SlideModal>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 20,
  },
  topRow: {
    justifyContent: "space-between",
    flexDirection: "row",
    alignItems: "center",
  },
  backArrow: {
    padding: 4,
    marginRight: 8,
  },
  progressText: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  vocabWord: {
    fontSize: 28,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
  },
  questionText: {
    fontSize: 16,
    color: "#555",
  },
  replayButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
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
    fontWeight: "600",
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
  navRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 8,
    width: "100%",
  },
  navButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  navButtonText: {
    color: "#222",
    fontSize: 16,
    fontWeight: "600",
  },
  navButtonPrimary: {
    backgroundColor: "#4a69bd",
  },
  navButtonPrimaryText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default GuessWordModal;
