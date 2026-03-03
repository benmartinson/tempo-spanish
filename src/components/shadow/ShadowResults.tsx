import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { AccuracyResult } from "../../types";
import { MaterialIcons } from "@expo/vector-icons";
import TooltipModal from "../common/TooltipModal";
import { useState } from "react";
import { normalizeWord } from "../../helpers";

interface ShadowResultsProps {
  accuracyResult: AccuracyResult;
  handleNextSentence: () => void;
  handleRetry: () => void;
}

const ShadowResults: React.FC<ShadowResultsProps> = ({
  accuracyResult,
  handleNextSentence,
  handleRetry,
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const missedWords = accuracyResult.details
    .filter((detail) => !detail.matched)
    .map((detail) => normalizeWord(detail.targetWord));

  const isAccuracyGood = accuracyResult.percentage >= 80;

  const cleanUpSetence = (sentence: string) => {
    const specialCases = [',.', '.,', '!,', '?,'];
    return sentence
      .split(' ')
      .map((word) => specialCases.some((c) => word.endsWith(c)) ? word.slice(0, -1) : word)
      .join(' ');
  }

  return (
    <View style={styles.resultsContainer}>
      <View style={styles.accuracyCircle}>
        <Text style={styles.accuracyPercentage}>
          {accuracyResult.percentage}%
        </Text>
        <Text style={styles.accuracyLabel}>Accuracy</Text>
      </View>
      {/* <View style={styles.accuracyDetailsContainer}>
        <Text style={styles.accuracyDetails}>
          {accuracyResult.matchedWords} of {accuracyResult.totalWords} words
          matched
        </Text>
        {accuracyResult.percentage < 100 && (
          <TouchableOpacity style={styles.infoIcon}>
            <MaterialIcons
              name="info"
              size={26}
              color="gray"
              onPress={() => setIsTooltipVisible(true)}
            />
          </TouchableOpacity>
        )}
      </View> */}
      <View style={styles.spokenSentenceContainer}>
        <Text style={styles.spokenSentenceText}>
          <Text style={styles.labelBold}>You said: </Text>
          {accuracyResult.details.map((detail, index) => {
            const hasSpellingErrors =
              detail.matched &&
              detail.spokenWord &&
              normalizeWord(detail.spokenWord) !==
                normalizeWord(detail.targetWord);
            const wordStyle = detail.matched
              ? hasSpellingErrors
                ? styles.wordYellow
                : styles.wordGreen
              : styles.wordRed;
            return (
              <Text key={index} style={wordStyle}>
                {detail.spokenWord || "_"}
                {index < accuracyResult.details.length - 1 ? " " : ""}
              </Text>
            );
          })}
        </Text>
      </View>
      <View style={styles.targetSentenceContainer}>
        <Text style={styles.targetSentenceText}>
          <Text style={styles.labelBold}>Target sentence: </Text>
          {cleanUpSetence(accuracyResult.targetSentence)}
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.tryAgainButton]}
          onPress={handleRetry}
        >
          <MaterialIcons name="replay" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Re-Try</Text>
        </TouchableOpacity>

        {isAccuracyGood && (
          <TouchableOpacity
            style={[styles.actionButton, styles.nextButton]}
            onPress={handleNextSentence}
          >
            <Text style={styles.actionButtonText}>Next Sentence</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
      <TooltipModal
        isVisible={isTooltipVisible}
        onRequestClose={() => setIsTooltipVisible(false)}
      >
        <Text style={styles.tooltipTitle}>Missed Words</Text>
        <Text style={styles.tooltipWordsList}>{missedWords.join(", ")}</Text>
      </TooltipModal>
    </View>
  );
};

export const styles = StyleSheet.create({
  accuracyDetailsContainer: {
    flexDirection: "row",
    alignItems: "center",
    textAlign: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 12,
  },
  spokenSentenceContainer: {
    marginBottom: 12,
  },
  spokenSentenceText: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
    flexWrap: "wrap",
  },
  labelBold: {
    fontWeight: "700",
    color: "#666",
  },
  wordGreen: {
    color: "#22c55e",
  },
  wordYellow: {
    color: "#eab308",
  },
  wordRed: {
    color: "#ef4444",
  },
  targetSentenceContainer: {
    marginBottom: 12,
  },
  targetSentenceText: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
  },
  tooltipSpokenSentence: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  nextButton: {
    backgroundColor: "#4ade80",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  playAgainButtonText: {
    color: "black",
    fontSize: 14,
    fontWeight: "600",
  },
  tryAgainButton: {
    backgroundColor: "#3d3a52",
  },
  playAgainButton: {
    backgroundColor: "white",
    marginVertical: 16,
    borderWidth: 1,
    borderColor: "#3d3a52",
  },
  accuracyCircle: {
    width: 90,
    height: 90,
    borderRadius: 60,
    backgroundColor: "#2d2a40",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  infoIcon: {
    alignSelf: "center",
  },
  accuracyPercentage: {
    color: "#4ade80",
    fontSize: 24,
    fontWeight: "700",
  },
  accuracyLabel: {
    color: "#fff",
    fontSize: 14,
    opacity: 0.8,
  },
  accuracyDetails: {
    color: "#666",
    fontSize: 14,
    alignSelf: "center",
    textAlign: "center",
  },
  resultsContainer: {
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 16,
  },
  tooltipTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  tooltipWordsList: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
  },
  tooltipWord: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4ade80",
    marginBottom: 8,
  },
});

export default ShadowResults;
