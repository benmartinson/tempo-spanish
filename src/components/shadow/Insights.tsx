import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SegmentWord } from "../../types";
import {
  addEllipsis,
  removeSpecialPunctuation,
  SubSegment,
} from "../../helpers/helpers";
import WordHints from "../common/WordHints";
import ToggleHeader from "../common/ToggleHeader";
import Phrases from "./Phrases";

interface InsightsProps {
  isLoading: boolean;
  characters: string[];
  sentenceText: string;
  subSegments: SubSegment[];
  hintWords: SegmentWord[];
  handlePlayWordSnippet: (word: SegmentWord, isSlow?: boolean) => void;
  isPlayingWordSnippet: boolean;
  onReplaySentence?: () => void;
  onPlayClip?: (start: number, end: number, phraseIndex?: number) => void;
  playerIsPlaying?: boolean;
  replayingPhraseIndex?: number | null;
  showWordsHints: boolean;
  showCharacters: boolean;
  showPhrases: boolean;
  phraseRecordings?: Record<number, string>;
  recordingPhraseIndex?: number | null;
  allPhrasesRecorded?: boolean;
  onStartPhraseRecording?: (index: number) => void;
  onStopPhraseRecording?: () => void;
  onSubmitPhrases?: () => void;
  playbackTime?: number;
  isRecordingMode?: boolean;
}

const Insights: React.FC<InsightsProps> = ({
  isLoading,
  characters,
  sentenceText,
  subSegments,
  hintWords,
  handlePlayWordSnippet,
  isPlayingWordSnippet,
  onReplaySentence,
  onPlayClip,
  playerIsPlaying,
  replayingPhraseIndex,
  showWordsHints,
  showCharacters,
  showPhrases,
  phraseRecordings,
  recordingPhraseIndex,
  allPhrasesRecorded,
  onStartPhraseRecording,
  onStopPhraseRecording,
  onSubmitPhrases,
  playbackTime,
  isRecordingMode,
}) => {
  const [isShowingCharacters, setIsShowingCharacters] =
    useState<boolean>(showCharacters);
  const [isShowingNotes, setIsShowingNotes] = useState<boolean>(true);
  const [isShowingTranscript, setIsShowingTranscript] =
    useState<boolean>(false);

  useEffect(() => {
    setIsShowingCharacters(showCharacters);
  }, [showCharacters]);

  if (isLoading) {
    return;
  }

  return (
    <View style={styles.container}>
      <Phrases
        subSegments={subSegments}
        sentenceText={sentenceText}
        onPlayClip={onPlayClip}
        phraseRecordings={phraseRecordings}
        recordingPhraseIndex={recordingPhraseIndex}
        allPhrasesRecorded={allPhrasesRecorded}
        onStartPhraseRecording={onStartPhraseRecording}
        onStopPhraseRecording={onStopPhraseRecording}
        onSubmitPhrases={onSubmitPhrases}
        playbackTime={playbackTime}
        playerIsPlaying={playerIsPlaying}
        replayingPhraseIndex={replayingPhraseIndex}
        showPhrases={showPhrases}
        isRecordingMode={isRecordingMode}
      />
      <View style={styles.headerContainer}>
        <ToggleHeader
          title="Transcript"
          isVisible={isShowingTranscript}
          onToggle={() => setIsShowingTranscript(!isShowingTranscript)}
        />
      </View>
      {isShowingTranscript && (
        <View style={styles.notesList}>
          <Text style={styles.transcriptText}>
            {addEllipsis(removeSpecialPunctuation(sentenceText))}
          </Text>
        </View>
      )}
      <WordHints
        hintWords={hintWords}
        handlePlayWordSnippet={handlePlayWordSnippet}
        isPlayingWordSnippet={isPlayingWordSnippet}
        showWordHints={showWordsHints}
        onReplaySentence={onReplaySentence}
        playerIsPlaying={playerIsPlaying}
      />
      <>
        {characters.length > 0 && (
          <View style={styles.headerContainer}>
            <ToggleHeader
              title="Proper Nouns"
              isVisible={isShowingCharacters}
              onToggle={() => setIsShowingCharacters(!isShowingCharacters)}
            />
          </View>
        )}
        {isShowingCharacters && characters.length > 0 && (
          <View style={styles.charactersList}>
            <Text style={styles.charactersText}>
              {characters.length === 0
                ? "None"
                : characters.map((name, index) => {
                    const seen = characters.slice(0, index).includes(name);
                    if (seen) {
                      return null;
                    }
                    return (
                      <Text key={index}>
                        {index > 0 ? ", " : ""}
                        {name}
                        {seen && <Text style={styles.againText}> (again)</Text>}
                      </Text>
                    );
                  })}
            </Text>
          </View>
        )}
      </>
      {sentenceText.trimEnd().endsWith(",.") && (
        <>
          <View style={styles.headerContainer}>
            <ToggleHeader
              title="Notes"
              isVisible={isShowingNotes}
              onToggle={() => setIsShowingNotes(!isShowingNotes)}
            />
          </View>
          {isShowingNotes && (
            <View style={styles.notesList}>
              <Text style={styles.notesText}>
                This segment is part of a longer sentence.
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingTop: 8,
    paddingBottom: 20,
  },
  loadingText: {
    fontSize: 14,
    color: "#999",
    textAlign: "left",
    paddingHorizontal: 20,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingHorizontal: 16,
  },
  charactersList: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  charactersText: {
    fontSize: 15,
    color: "#222222",
    opacity: 0.8,
  },
  againText: {
    fontSize: 13,
    color: "#999",
  },
  notesHeader: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222222",
  },
  notesList: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  notesText: {
    fontSize: 15,
    color: "#222222",
    opacity: 0.5,
  },
  transcriptText: {
    fontSize: 15,
    color: "#222222",
    opacity: 0.8,
  },
});

export default Insights;
