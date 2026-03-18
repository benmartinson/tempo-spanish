import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSelector } from "react-redux";
import { RootState } from "../../types";
import { SubSegment, stripPunctuation } from "../../helpers";
import ToggleHeader from "../common/ToggleHeader";

interface PhrasesProps {
  subSegments: SubSegment[];
  sentenceText: string;
  onPlayClip?: (start: number, end: number) => void;
  phraseRecordings?: Record<number, string>;
  recordingPhraseIndex?: number | null;
  allPhrasesRecorded?: boolean;
  onStartPhraseRecording?: (index: number) => void;
  onStopPhraseRecording?: () => void;
  onSubmitPhrases?: () => void;
  playbackTime?: number;
  playerIsPlaying?: boolean;
}

const Phrases: React.FC<PhrasesProps> = ({
  subSegments,
  sentenceText,
  onPlayClip,
  phraseRecordings,
  recordingPhraseIndex,
  allPhrasesRecorded,
  onStartPhraseRecording,
  onStopPhraseRecording,
  onSubmitPhrases,
  playbackTime,
  playerIsPlaying,
}) => {
  const { showPhrases } = useSelector(
    (state: RootState) => state.userSettings,
  );
  const [isShowingPhrases, setIsShowingPhrases] =
    useState<boolean>(showPhrases);

  useEffect(() => {
    setIsShowingPhrases(showPhrases);
  }, [sentenceText]);

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
              const isRecordingThis = recordingPhraseIndex === i;
              const hasRecording = !!phraseRecordings?.[i];
              const anotherIsRecording =
                recordingPhraseIndex !== null && !isRecordingThis;
              const isActive =
                playerIsPlaying &&
                playbackTime !== undefined &&
                playbackTime >= seg.start &&
                playbackTime <= seg.end;

              return (
                <View key={i} style={styles.phraseRow}>
                  <TouchableOpacity
                    style={styles.phraseReplayButton}
                    onPress={() => onPlayClip?.(seg.start, seg.end)}
                  >
                    <MaterialIcons name="replay" size={22} color="#007AFF" />
                  </TouchableOpacity>

                  {isRecordingThis ? (
                    <>
                      <Text style={styles.recordingText}>Recording...</Text>
                      <TouchableOpacity
                        style={styles.phraseStopButton}
                        onPress={() => onStopPhraseRecording?.()}
                      >
                        <MaterialIcons name="stop" size={20} color="#e53935" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.phraseText, isActive && styles.phraseTextActive]}>{seg.preview}</Text>
                      <TouchableOpacity
                        style={[
                          styles.phraseMicButton,
                          anotherIsRecording && { opacity: 0.3 },
                        ]}
                        onPress={() => onStartPhraseRecording?.(i)}
                        disabled={anotherIsRecording}
                      >
                        <MaterialIcons
                          name="mic"
                          size={22}
                          color={hasRecording ? "#007AFF" : "#999"}
                        />
                      </TouchableOpacity>
                      {hasRecording && (
                        <MaterialIcons
                          name="check-circle"
                          size={22}
                          color="#4CAF50"
                        />
                      )}
                    </>
                  )}
                </View>
              );
            })
          ) : (
            <Text style={styles.phraseText}>
              {getPreviewWords(sentenceText).join(" ") + "..."}
            </Text>
          )}
          {allPhrasesRecorded && hasSubSegments && (
            <TouchableOpacity
              style={styles.phraseSubmitButton}
              onPress={() => onSubmitPhrases?.()}
            >
              <Text style={styles.phraseSubmitText}>Submit</Text>
            </TouchableOpacity>
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
  recordingText: {
    fontSize: 15,
    color: "#e53935",
    fontWeight: "600" as const,
    flex: 1,
  },
  phraseStopButton: {
    padding: 4,
  },
  phraseMicButton: {
    padding: 4,
  },
  phraseSubmitButton: {
    backgroundColor: "#3d3a52",
    width: 120,
    alignSelf: "flex-end",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center" as const,
    marginTop: 8,
  },
  phraseSubmitText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600" as const,
  },
});

export default Phrases;
