import React, { useMemo } from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { RootState } from "../../types";
import { useSelector } from "react-redux";
import { removeSpecialPunctuation, addEllipsis } from "../../helpers/helpers";
import { useInterpolatedTime } from "../../hooks/useInterpolatedTime";

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish",
  en: "English",
  pt: "Portuguese",
};

const CHUNK_SIZE = 4;

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
}) => {
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const localTime = useInterpolatedTime(
    time,
    playerIsPlaying,
    playKey,
    playerSpeed,
  );

  const displayText = translationText
    ? addEllipsis(removeSpecialPunctuation(translationText), sentenceText)
    : "";

  const words = useMemo(
    () => displayText.split(/\s+/).filter(Boolean),
    [displayText],
  );

  const chunks = useMemo(() => {
    if (!words.length) return [];
    const result: [number, number][] = [];
    let i = 0;
    while (i < words.length) {
      const remaining = words.length - i;
      let size: number;
      if (remaining <= CHUNK_SIZE) {
        size = remaining;
      } else if (remaining === 5) {
        size = 3; // 3 + 2
      } else if (remaining === 6) {
        size = 3; // 3 + 3
      } else if (remaining === 7) {
        size = 4; // 4 + 3
      } else {
        size = CHUNK_SIZE;
      }
      result.push([i, i + size - 1]);
      i += size;
    }
    return result;
  }, [words]);

  const activeChunkIndex = useMemo(() => {
    if (!playerIsPlaying || !chunks.length) return -1;
    const duration = segmentEnd - segmentStart;
    if (duration <= 0) return -1;
    const elapsed = localTime - segmentStart;
    const timePerChunk = duration / chunks.length;
    const idx = Math.floor(elapsed / timePerChunk);
    return Math.min(Math.max(idx, 0), chunks.length - 1);
  }, [localTime, playerIsPlaying, segmentStart, segmentEnd, chunks]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#4a69bd" />
        <Text style={styles.loadingText}>Loading translation...</Text>
      </View>
    );
  }

  if (!translationText) return null;

  return (
    <View style={styles.container}>
      <View style={styles.questionBubble}>
        {/* <Text style={styles.questionLabel}>{label}</Text> */}
        <Text style={styles.questionText}>
          {words.map((word, index) => {
            const isActive =
              activeChunkIndex >= 0 &&
              chunks[activeChunkIndex] &&
              index >= chunks[activeChunkIndex][0] &&
              index <= chunks[activeChunkIndex][1];
            return (
              <Text
                key={index}
                style={isActive ? styles.activeWord : undefined}
              >
                {index > 0 ? " " : ""}
                {word}
              </Text>
            );
          })}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  questionBubble: {
    backgroundColor: "#f0f4ff",
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 16,
    marginBottom: 12,
    alignSelf: "flex-start" as const,
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
  activeWord: {
    color: "#4CAF50",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
  },
});

export default TranslateContent;
