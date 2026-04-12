import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import Entypo from "@expo/vector-icons/Entypo";
import SlideModal from "../common/SlideModal";
import ShadowResults from "./ShadowResults";
import { calculateAccuracy } from "../../helpers/calculate_accuracy";
import { AccuracyResult, SegmentWord } from "../../types";
import { capitalize } from "../../helpers/helpers";

interface TranslationReviewModalProps {
  visible: boolean;
  englishTranslation: string;
  targetText: string;
  targetWords: SegmentWord[];
  onComplete: () => void;
  onClose: () => void;
}

const TranslationReviewModal: React.FC<TranslationReviewModalProps> = ({
  visible,
  englishTranslation,
  targetText,
  targetWords,
  onComplete,
  onClose,
}) => {
  const [userAnswer, setUserAnswer] = useState("");
  const [accuracyResult, setAccuracyResult] = useState<AccuracyResult | null>(
    null,
  );
  const [isEvaluating, setIsEvaluating] = useState(false);

  const handleReset = () => {
    setUserAnswer("");
    setAccuracyResult(null);
    setIsEvaluating(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleComplete = () => {
    handleReset();
    onComplete();
  };

  const handleSubmit = () => {
    if (!userAnswer.trim()) return;
    Keyboard.dismiss();
    setIsEvaluating(true);

    const typedWords = userAnswer.trim().split(/\s+/);
    const target = targetWords.map((w) => w.word);
    const result = calculateAccuracy(typedWords, target, []);

    setAccuracyResult({
      ...result,
      targetSentence: capitalize(targetText),
    });
    setIsEvaluating(false);
  };

  return (
    <SlideModal
      visible={visible}
      onRequestClose={handleClose}
      title="Translate this sentence"
    >
      <View style={styles.content}>
        <Text style={styles.englishText}>{englishTranslation}</Text>

        {!accuracyResult && (
          <>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Type your translation..."
                placeholderTextColor="#999"
                value={userAnswer}
                onChangeText={setUserAnswer}
                multiline
                autoCorrect={false}
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
                onSubmitEditing={() => {
                  if (userAnswer.trim()) handleSubmit();
                }}
              />
              {userAnswer.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => setUserAnswer("")}
                >
                  <Entypo name="cross" size={16} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            {isEvaluating ? (
              <ActivityIndicator size="small" color="#4a69bd" />
            ) : (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  !userAnswer.trim() && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!userAnswer.trim()}
              >
                <Text style={styles.submitButtonText}>Check</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {accuracyResult && (
          <ShadowResults
            accuracyResult={accuracyResult}
            handleNextSentence={handleComplete}
            handleRetry={handleReset}
            spokenLabel="Your answer: "
            targetLabel="Target: "
            hideRetry={false}
            alwaysShowNext
            nextButtonLabel="Continue"
          />
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
  promptLabel: {
    fontSize: 16,
    color: "#555",
    fontWeight: "500",
  },
  englishText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
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
    opacity: 0.5,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default TranslationReviewModal;
