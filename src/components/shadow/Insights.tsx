import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSelector } from "react-redux";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { RootState, SegmentWord } from "../../types";
import WordHints from "../common/WordHints";
import ToggleHeader from "../common/ToggleHeader";
import { stripPunctuation, computeSubSegments } from "../../helpers";

interface InsightsProps {
  isLoading: boolean;
  characters: string[];
  sentenceText: string;
  segmentWords: SegmentWord[];
  hintWords: SegmentWord[];
  handlePlayWordSnippet: (word: SegmentWord, isSlow?: boolean) => void;
  isPlayingWordSnippet: boolean;
  onReplaySentence?: () => void;
  onPlayClip?: (start: number, end: number) => void;
  playerIsPlaying?: boolean;
}

const Insights: React.FC<InsightsProps> = ({
  isLoading,
  characters,
  sentenceText,
  segmentWords,
  hintWords,
  handlePlayWordSnippet,
  isPlayingWordSnippet,
  onReplaySentence,
  onPlayClip,
  playerIsPlaying,
}) => {
  const { showWordsHints, showCharacters, showStartsOffAs } = useSelector(
    (state: RootState) => state.userSettings,
  );

  const [isShowingCharacters, setIsShowingCharacters] =
    useState<boolean>(showCharacters);
  const [isShowingStartsOff, setIsShowingStartsOff] =
    useState<boolean>(showStartsOffAs);
  const [revealedCommas, setRevealedCommas] = useState<number>(0);
  const [isShowingPhrases, setIsShowingPhrases] = useState<boolean>(true);

  useEffect(() => {
    setIsShowingCharacters(showCharacters);
    setIsShowingStartsOff(showStartsOffAs);
  }, [sentenceText]);

  useEffect(() => {
    setRevealedCommas(0);
  }, [sentenceText, isShowingStartsOff]);

  if (isLoading) {
    return;
  }

  const words = sentenceText.split(/\s+/).filter(Boolean);
  const firstTwo = words.slice(0, 2);
  const firstTwoCharCount = firstTwo.join("").length;
  const startsOffWords = firstTwoCharCount > 8 ? firstTwo : words.slice(0, 3);

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

  const subSegments = computeSubSegments(segmentWords);

  const commaSegments = sentenceText.split(",");
  const hasCommas = commaSegments.length > 1;
  const totalCommaReveals = commaSegments.length - 1;
  const hasMoreCommas = hasCommas && revealedCommas < totalCommaReveals;

  let startsOffText =
    startsOffWords.map((w) => stripPunctuation(w)).join(" ") + "...";
  const revealedParts: string[] = [];
  if (hasCommas && revealedCommas > 0) {
    for (let i = 1; i <= revealedCommas; i++) {
      if (commaSegments[i]) {
        const preview = getPreviewWords(commaSegments[i]);
        revealedParts.push(preview.join(" ") + "...");
      }
    }
  }

  return (
    <View style={styles.container}>
      {hintWords.length > 0 && (
        <WordHints
          hintWords={hintWords}
          handlePlayWordSnippet={handlePlayWordSnippet}
          isPlayingWordSnippet={isPlayingWordSnippet}
          showWordHints={showWordsHints}
          onReplaySentence={onReplaySentence}
          playerIsPlaying={playerIsPlaying}
        />
      )}
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
      {words.length > 0 && (
        <>
          <View style={styles.startsOffHeaderContainer}>
            <ToggleHeader
              title="Starts Off As"
              isVisible={isShowingStartsOff}
              onToggle={() => setIsShowingStartsOff(!isShowingStartsOff)}
            />
          </View>
          {isShowingStartsOff && (
            <View style={styles.charactersList}>
              <Text style={styles.charactersText}>
                {startsOffText}
                {revealedParts.map((part, i) => (
                  <Text key={i}>{" " + part}</Text>
                ))}
                {hasMoreCommas && (
                  <Text
                    onPress={() => setRevealedCommas(revealedCommas + 1)}
                    style={styles.moreButton}
                  >
                    {"  More +"}
                  </Text>
                )}
              </Text>
            </View>
          )}
        </>
      )}
      {subSegments.length > 0 && (
        <>
          <View style={styles.startsOffHeaderContainer}>
            <ToggleHeader
              title="Phrases"
              isVisible={isShowingPhrases}
              onToggle={() => setIsShowingPhrases(!isShowingPhrases)}
            />
          </View>
          {isShowingPhrases && (
            <View style={styles.phrasesList}>
              {subSegments.map((seg, i) => (
                <View key={i} style={styles.phraseRow}>
                  <TouchableOpacity
                    style={styles.phraseReplayButton}
                    onPress={() => onPlayClip?.(seg.start, seg.end)}
                  >
                    <MaterialIcons name="replay" size={18} color="#007AFF" />
                  </TouchableOpacity>
                  <Text style={styles.phraseText}>{seg.preview}</Text>
                </View>
              ))}
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
  moreButton: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#007AFF",
    opacity: 0.8,
  },
  startsOffHeaderContainer: {
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
  },
});

export default Insights;
