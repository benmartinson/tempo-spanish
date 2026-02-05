import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { AccuracyResult, normalize } from "../streaming_helpers";
import { MaterialIcons } from "@expo/vector-icons";
import TooltipModal from "../common/TooltipModal";
import { useState } from "react";
import { normalizeWord } from "../../helpers";

interface ShadowResultsProps {
  accuracyResult: AccuracyResult;
  handleEnterRecordingMode: () => void;
  handleNextSentence: () => void;
  handlePlaySnippetAgain: () => void;
}

const ShadowResults: React.FC<ShadowResultsProps> = ({
  accuracyResult,
  handleEnterRecordingMode,
  handleNextSentence,
  handlePlaySnippetAgain,
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const missedWords = accuracyResult.details
    .filter((detail) => !detail.matched)
    .map((detail) => normalizeWord(detail.targetWord));

  return (
    <View style={styles.resultsContainer}>
      <View style={styles.accuracyCircle}>
        <Text style={styles.accuracyPercentage}>
          {accuracyResult.percentage}%
        </Text>
        <Text style={styles.accuracyLabel}>Accuracy</Text>
      </View>
      <View style={styles.accuracyDetailsContainer}>
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
      </View>

      {/* Action buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.tryAgainButton]}
          onPress={handleEnterRecordingMode}
        >
          <MaterialIcons name="replay" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Re-Try Recording</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.nextButton]}
          onPress={handleNextSentence}
        >
          <Text style={styles.actionButtonText}>Next Sentence</Text>
          <MaterialIcons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.playAgainButton]}
          onPress={handlePlaySnippetAgain}
        >
          <Text style={styles.playAgainButtonText}>Re-Play Sentence</Text>
          <MaterialIcons name="play-arrow" size={20} color="black" />
        </TouchableOpacity>
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
    width: 120,
    height: 120,
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
    fontSize: 32,
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
