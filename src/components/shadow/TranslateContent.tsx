import React, { useMemo } from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { RootState } from "../../types";
import { useSelector } from "react-redux";
import { removeSpecialPunctuation, addEllipsis } from "../../helpers/helpers";
import { useInterpolatedTime } from "../../hooks/useInterpolatedTime";
import { useStableChunkIdx } from "../../hooks/useStableChunkIdx";

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish",
  en: "English",
  pt: "Portuguese",
};

interface TranslateContentProps {
  translationText: string | null;
  sentenceText?: string;
  isLoading: boolean;
  time?: number;
  playerIsPlaying?: boolean;
  segmentStart?: number;
  segmentEnd?: number;
  playKey?: number;
  playerSpeed?: number;
  isRecording?: boolean;
  variant?: "default" | "webPanel";
}

const TranslateContent: React.FC<TranslateContentProps> = ({
  translationText,
  sentenceText,
  isLoading,
  time = 0,
  playerIsPlaying = false,
  segmentStart = 0,
  segmentEnd = 0,
  playKey,
  playerSpeed = 1,
  isRecording = false,
  variant = "default",
}) => {
  const userSettings = useSelector((state: RootState) => state.userSettings);
  // const localTime = useInterpolatedTime(
  //   time,
  //   playerIsPlaying,
  //   playKey,
  //   playerSpeed,
  // );
  const localTime = time;

  const displayText = translationText
    ? addEllipsis(removeSpecialPunctuation(translationText), sentenceText)
    : "";

  const words = useMemo(
    () => displayText.split(/\s+/).filter(Boolean),
    [displayText],
  );

  const rawWordIdx = useMemo(() => {
    if (!playerIsPlaying || !words.length || !isRecording) return -1;
    const duration = segmentEnd - segmentStart;
    if (duration <= 0) return -1;
    const elapsed = localTime - segmentStart;
    const timePerWord = duration / words.length;
    const idx = Math.floor(elapsed / timePerWord);
    return Math.min(Math.max(idx, 0), words.length - 1);
  }, [localTime, playerIsPlaying, segmentStart, segmentEnd, words.length]);

  const { activeChunkStart, activeChunkEnd } = useStableChunkIdx({
    wordCount: words.length,
    rawWordIdx,
    isReplay: localTime <= segmentStart + 0.5,
    resetKey: `${segmentStart}-${segmentEnd}-${words.length}`,
  });

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          variant === "webPanel" && styles.webPanelLoadingContainer,
        ]}
      >
        <ActivityIndicator size="small" color="#4a69bd" />
        <Text style={styles.loadingText}>Loading translation...</Text>
      </View>
    );
  }

  if (!translationText) return null;

  return (
    <View
      style={[
        styles.questionBubble,
        variant === "webPanel" && styles.webPanelQuestionBubble,
      ]}
    >
      {/* <Text style={styles.questionLabel}>{label}</Text> */}
      <Text
        style={[
          styles.questionText,
          variant === "webPanel" && styles.webPanelQuestionText,
        ]}
      >
        {words.map((word, index) => {
          const isActive =
            activeChunkStart >= 0 &&
            index >= activeChunkStart &&
            index <= activeChunkEnd;
          return (
            <Text key={index} style={isActive ? styles.activeWord : undefined}>
              {index > 0 ? " " : ""}
              {word}
            </Text>
          );
        })}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  questionBubble: {
    backgroundColor: "#f0f4ff",
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 16,
    marginBottom: 12,
    alignSelf: "flex-start" as const,
  },
  webPanelQuestionBubble: {
    width: "auto",
    alignSelf: "stretch" as const,
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopWidth: 1,
    borderTopColor: "rgba(74, 105, 189, 0.14)",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  questionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4a69bd",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  questionText: {
    fontSize: 17,
    lineHeight: 24,
    color: "#222",
  },
  webPanelQuestionText: {
    textAlign: "center",
  },
  activeWord: {
    color: "#4CAF50",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  webPanelLoadingContainer: {
    minHeight: 58,
    flexDirection: "row",
    marginHorizontal: 0,
    borderTopWidth: 1,
    borderTopColor: "rgba(74, 105, 189, 0.14)",
    backgroundColor: "#f0f4ff",
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
  },
});

export default TranslateContent;
