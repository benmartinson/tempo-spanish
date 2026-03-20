import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import SlideModal from "../common/SlideModal";
import { Vocabulary } from "../../types";
import { normalizeWord } from "../../helpers";

interface VocabTestModalProps {
  visible: boolean;
  onClose: () => void;
  vocab: Vocabulary[];
}

const VocabTestModal: React.FC<VocabTestModalProps> = ({
  visible,
  onClose,
  vocab,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [isCorrect, setIsCorrect] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      resetTest();
    }
  }, [visible]);

  useEffect(() => {
    if (currentIndex) {
      // focus input
      inputRef.current?.focus();
    }
  }, [currentIndex]);

  const resetTest = () => {
    setCurrentIndex(0);
    setUserInput("");
    setIsCorrect(false);
    setShowAnswer(false);
  };

  const currentWord = vocab[currentIndex];

  const handleInputChange = (text: string) => {
    setUserInput(text);
    if (!currentWord) return;

    // Simple normalization for comparison
    const normalizedInput = text.trim().toLowerCase();
    const normalizedTranslation = currentWord.translation.trim().toLowerCase();

    if (normalizedInput === normalizedTranslation) {
      setIsCorrect(true);
      setTimeout(() => {
        nextWord();
      }, 2000);
    }
  };

  const nextWord = () => {
    if (currentIndex < vocab.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserInput("");
      setIsCorrect(false);
      setShowAnswer(false);
    } else {
      onClose();
    }
  };

  const handleSkip = () => {
    nextWord();
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
  };

  if (!currentWord) return null;

  return (
    <SlideModal visible={visible} onRequestClose={onClose} title="Vocab Test">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.content}>
          <Text style={styles.progress}>
            {currentIndex + 1} / {vocab.length}
          </Text>

          <Text style={styles.word}>{normalizeWord(currentWord.word)}</Text>
          {showAnswer && (
            <Text style={styles.answerText}>
              {normalizeWord(currentWord.translation)}
            </Text>
          )}

          <View
            style={[
              styles.inputContainer,
              isCorrect && styles.inputContainerCorrect,
            ]}
          >
            <TextInput
              style={[styles.input, isCorrect && styles.inputCorrect]}
              value={userInput}
              onChangeText={handleInputChange}
              placeholder="Type translation..."
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isCorrect}
              autoFocus
              ref={inputRef}
            />
          </View>

          {isCorrect && <Text style={styles.feedbackText}>Correct!</Text>}

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.showAnswerButton}
              onPress={handleShowAnswer}
            >
              <Text style={styles.showAnswerButtonText}>Show Answer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SlideModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  progress: {
    color: "#888",
    fontSize: 14,
    position: "absolute",
    top: 0,
    right: 0,
  },
  word: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  inputContainer: {
    width: "100%",
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 4,
    borderWidth: 2,
    borderColor: "transparent",
  },
  inputContainerCorrect: {
    borderColor: "#4ade80",
    backgroundColor: "rgba(74, 222, 128, 0.1)",
  },
  input: {
    color: "#fff",
    fontSize: 18,
    padding: 16,
    textAlign: "center",
  },
  inputCorrect: {
    color: "#4ade80",
  },
  feedbackText: {
    color: "#4ade80",
    fontSize: 18,
    fontWeight: "600",
  },
  buttonContainer: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    alignItems: "center",
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  skipButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  showAnswerButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    backgroundColor: "#2a2a4a",
  },
  showAnswerButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  answerText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default VocabTestModal;
