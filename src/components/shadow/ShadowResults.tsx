import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { AccuracyResult } from "../../types";
import { MaterialIcons } from "@expo/vector-icons";
import {
  normalizeWord,
  removeSpecialPunctuation,
  stripPhraseComma,
} from "../../helpers/helpers";
import AccuracyCircle from "../common/AccuracyCircle";

interface ShadowResultsProps {
  accuracyResult: AccuracyResult;
  handleNextSentence: () => void;
  handleRetry: () => void;
  properNouns?: string[];
  onBackToShadow?: () => void;
  spokenLabel?: string;
  targetLabel?: string;
  hideRetry?: boolean;
  alwaysShowNext?: boolean;
  nextButtonLabel?: string;
  variant?: "default" | "webPanel";
}

const ShadowResults: React.FC<ShadowResultsProps> = ({
  accuracyResult,
  handleNextSentence,
  handleRetry,
  properNouns = [],
  spokenLabel = "Spoken: ",
  targetLabel = "Target: ",
  hideRetry = false,
  nextButtonLabel = "Next Segment",
  variant = "default",
}) => {
  const handleNextPress = () => {
    handleNextSentence();
  };

  const missedWords = accuracyResult.details
    .filter((detail) => !detail.matched)
    .map((detail) => normalizeWord(detail.targetWord));

  const isAccuracyGood = accuracyResult.percentage >= 80;

  const renderSpokenWord = (
    detail: AccuracyResult["details"][0],
    index: number,
  ) => {
    const isProperNoun = properNouns.some(
      (noun) => normalizeWord(noun) === normalizeWord(detail.targetWord),
    );
    const hasSpellingErrors =
      !isProperNoun &&
      detail.matched &&
      detail.spokenWord &&
      normalizeWord(detail.spokenWord) !== normalizeWord(detail.targetWord);
    const isLooseMatch = detail._matchScore === 0;
    const notMatched = !detail.matched || isLooseMatch;
    const greenMatched = !notMatched && !hasSpellingErrors;
    const wordStyle = notMatched
      ? styles.wordRed
      : hasSpellingErrors
        ? styles.wordYellow
        : styles.wordGreen;
    const isLast = index === accuracyResult.details.length - 1;
    const cleanTargetWord = removeSpecialPunctuation(detail.targetWord);
    let spokenText = cleanTargetWord;
    if (!greenMatched) {
      spokenText =
        !notMatched && detail.spokenWord
          ? removeSpecialPunctuation(detail.spokenWord)
          : "_";
    }
    if (
      index === 0 &&
      spokenText[0] &&
      spokenText[0] !== spokenText[0].toUpperCase()
    ) {
      spokenText = "..." + spokenText;
    }
    if (isLast && spokenText.endsWith(",")) {
      spokenText = spokenText.slice(0, -1) + "...";
    }
    return (
      <Text key={index} style={wordStyle}>
        {spokenText}
        {!isLast ? " " : ""}
      </Text>
    );
  };

  const renderTargetWord = (
    detail: AccuracyResult["details"][0],
    index: number,
  ) => {
    const isLast = index === accuracyResult.details.length - 1;
    const nextTargetWord = accuracyResult.details[index + 1]?.targetWord;
    let targetText = stripPhraseComma(
      removeSpecialPunctuation(detail.targetWord),
      nextTargetWord,
    );
    if (
      index === 0 &&
      targetText[0] &&
      targetText[0] !== targetText[0].toUpperCase()
    ) {
      targetText = "..." + targetText;
    }
    if (isLast && targetText.endsWith(",")) {
      targetText = targetText.slice(0, -1) + "...";
    }
    return (
      <Text
        key={index}
        style={
          !detail.matched || detail._matchScore === 0
            ? styles.wordRed
            : undefined
        }
      >
        {targetText}
        {!isLast ? " " : ""}
      </Text>
    );
  };

  return (
    <View
      style={[
        styles.resultsContainer,
        variant === "webPanel" && styles.webPanelResultsContainer,
      ]}
    >
      <AccuracyCircle percentage={accuracyResult.percentage} />
      <View style={styles.spokenSentenceContainer}>
        <Text style={styles.spokenSentenceText}>
          <Text style={styles.labelBold}>{spokenLabel}</Text>
          {accuracyResult.details.map(renderSpokenWord)}
        </Text>
      </View>
      <View style={styles.targetSentenceContainer}>
        <Text style={styles.targetSentenceText}>
          <Text style={styles.labelBold}>{targetLabel}</Text>
          {accuracyResult.details.map(renderTargetWord)}
        </Text>
      </View>

      <View style={styles.actionButtons}>
        {!hideRetry && (
          <TouchableOpacity
            style={[styles.actionButton, styles.tryAgainButton]}
            onPress={handleRetry}
          >
            <MaterialIcons name="replay" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Re-Try</Text>
          </TouchableOpacity>
        )}

        {
          <TouchableOpacity
            style={[styles.actionButton, styles.nextButton]}
            onPress={handleNextPress}
          >
            <Text style={styles.actionButtonText}>{nextButtonLabel}</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        }
      </View>
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
  reviewButton: {
    backgroundColor: "#4a69bd",
    marginTop: 12,
  },
  backToShadowButton: {
    backgroundColor: "#4a69bd",
    marginTop: 12,
  },
  playAgainButton: {
    backgroundColor: "white",
    marginVertical: 16,
    borderWidth: 1,
    borderColor: "#3d3a52",
  },
  infoIcon: {
    alignSelf: "center",
  },
  accuracyDetails: {
    color: "#666",
    fontSize: 14,
    alignSelf: "center",
    textAlign: "center",
  },
  resultsContainer: {
    alignItems: "center",
    marginTop: Dimensions.get("window").width > 600 ? 48 : 16,
    paddingHorizontal: 16,
  },
  webPanelResultsContainer: {
    width: "100%",
    marginTop: 8,
    paddingHorizontal: 0,
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
  saveModalContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    alignItems: "center",
    gap: 12,
  },
  saveModalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  saveModalMessage: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1a1a2e",
    textAlign: "center",
  },
  saveModalSubmessage: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    marginBottom: 8,
  },
  saveButton: {
    backgroundColor: "#4ade80",
    flex: 1,
    justifyContent: "center",
  },
  skipButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#ddd",
    flex: 1,
    justifyContent: "center",
  },
  skipButtonText: {
    color: "#888",
    fontSize: 14,
    fontWeight: "600",
  },
  alwaysSaveButton: {
    backgroundColor: "transparent",
    flex: 1,
    justifyContent: "center",
  },
  alwaysSaveButtonText: {
    color: "#4ade80",
    fontSize: 12,
    fontWeight: "600",
  },
  dontAskButton: {
    backgroundColor: "transparent",
    flex: 1,
    justifyContent: "center",
  },
  dontAskButtonText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
  },
});

export default ShadowResults;
