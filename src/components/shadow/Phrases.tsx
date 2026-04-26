import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  SubSegment,
  stripPunctuation,
  cleanPhraseCommas,
} from "../../helpers/helpers";
import ToggleHeader from "../common/ToggleHeader";

interface PhrasesProps {
  subSegments: SubSegment[];
  sentenceText: string;
  onPlayClip?: (start: number, end: number, phraseIndex?: number) => void;
  replayingPhraseIndex?: number | null;
  playbackTime?: number;
  playerIsPlaying?: boolean;
  showPhrases: boolean;
  isRecordingMode?: boolean;
}

const Phrases: React.FC<PhrasesProps> = ({
  subSegments,
  sentenceText,
  onPlayClip,
  replayingPhraseIndex,
  playbackTime,
  playerIsPlaying,
  showPhrases,
  isRecordingMode,
}) => {
  const [isShowingPhrases, setIsShowingPhrases] =
    useState<boolean>(showPhrases);

  useEffect(() => {
    setIsShowingPhrases(showPhrases);
  }, [showPhrases]);

  const getPreviewWords = (text: string) => {
    const w = text
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => stripPunctuation(word));
    const first2 = w.slice(0, 2);
    const first2CharCount = first2.join("").length;
    return first2CharCount > 8 ? first2 : w.slice(0, 3);
  };

  const hasSubSegments = subSegments.length > 0;

  return (
    <>
      <View style={styles.headerContainer}>
        <ToggleHeader
          title="Phrases"
          isVisible={isShowingPhrases}
          onToggle={() => setIsShowingPhrases(!isShowingPhrases)}
        />
      </View>
      {isShowingPhrases && (
        <View style={styles.phrasesList}>
          {hasSubSegments ? (
            subSegments.map((seg, i) => {
              const isActive =
                playerIsPlaying &&
                playbackTime !== undefined &&
                (i === 0 || playbackTime >= seg.start) &&
                playbackTime <= seg.end;

              return (
                <View key={i} style={styles.phraseRow}>
                  {!isRecordingMode && (
                    <TouchableOpacity
                      style={styles.phraseReplayButton}
                      onPress={() => onPlayClip?.(seg.start, seg.end, i)}
                      disabled={replayingPhraseIndex === i}
                    >
                      <MaterialIcons
                        name={
                          replayingPhraseIndex === i ? "play-arrow" : "replay"
                        }
                        size={24}
                        color={
                          replayingPhraseIndex === i ? "#4CAF50" : "#007AFF"
                        }
                      />
                    </TouchableOpacity>
                  )}

                  <Text
                    style={[
                      styles.phraseText,
                      isActive && styles.phraseTextActive,
                    ]}
                  >
                    {cleanPhraseCommas(seg.preview)}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.phraseText}>
              {getPreviewWords(sentenceText).join(" ") + "..."}
            </Text>
          )}
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 12,
  },
  phrasesList: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 8,
  },
  phraseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  phraseReplayButton: {
    padding: 4,
  },
  phraseText: {
    fontSize: 15,
    color: "#222222",
    opacity: 0.8,
    flex: 1,
  },
  phraseTextActive: {
    color: "#4CAF50",
    opacity: 1,
  },
});

export default Phrases;
