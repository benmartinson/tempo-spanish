import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SegmentWord } from "../../types";
import FeaturedVocab from "../watch/FeaturedVocab";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import ToggleHeader from "./ToggleHeader";

interface WordHintsProps {
  hintWords: SegmentWord[];
  handlePlayWordSnippet: (word: SegmentWord, isSlow?: boolean) => void;
  isPlayingWordSnippet: boolean;
  showSwitcher?: boolean;
  showWordHints: boolean;
  showSlowPlay?: boolean;
  onReplaySentence?: () => void;
  playerIsPlaying?: boolean;
}

const WordHints: React.FC<WordHintsProps> = ({
  hintWords,
  handlePlayWordSnippet,
  isPlayingWordSnippet,
  showSwitcher = true,
  showWordHints,
  showSlowPlay = true,
  onReplaySentence,
  playerIsPlaying,
}) => {
  const [currentHintIndex, setCurrentHintIndex] = useState<number>(0);
  const currentHintWord = hintWords[currentHintIndex];
  const [isShowingWordHints, setIsShowingWordHints] =
    useState<boolean>(showWordHints);

  const handleWordHintChange = (direction: number) => {
    if (hintWords.length === 0) return;
    let newIndex = currentHintIndex + direction;
    if (newIndex < 0) {
      newIndex = hintWords.length - 1;
    } else if (newIndex >= hintWords.length) {
      newIndex = 0;
    }
    setCurrentHintIndex(newIndex);
  };

  const hasWords = Boolean(hintWords.length);

  return (
    <View style={styles.featuredVocabContainer}>
      <View style={styles.featuredVocabTitleContainer}>
        <ToggleHeader
          title="Word Hints"
          isVisible={isShowingWordHints}
          onToggle={() => setIsShowingWordHints(!isShowingWordHints)}
        />
        {hasWords && isShowingWordHints && showSwitcher && (
          <View style={styles.featuredVocabTitleButtons}>
            <TouchableOpacity
              onPress={() => handleWordHintChange(-1)}
              style={styles.featuredVocabTitleButton}
            >
              <MaterialIcons name="arrow-back" size={24} color="#5a5680" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleWordHintChange(1)}
              style={styles.featuredVocabTitleButton}
            >
              <MaterialIcons name="arrow-forward" size={24} color="#5a5680" />
            </TouchableOpacity>
          </View>
        )}
      </View>
      {!hasWords && isShowingWordHints && (
        <View style={styles.fetchingContainer}>
          <Text style={styles.fetchingText}>Fetching Insights...</Text>
        </View>
      )}
      {hasWords && isShowingWordHints && currentHintWord && (
        <FeaturedVocab
          word={currentHintWord}
          playSnippet={handlePlayWordSnippet}
          isPlayingWordSnippet={isPlayingWordSnippet}
          handleWordHintChange={handleWordHintChange}
          showSlowPlay={showSlowPlay}
          onReplaySentence={onReplaySentence}
          playerIsPlaying={playerIsPlaying}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  featuredVocabContainer: {
    marginTop: 0,
    width: "100%",
  },
  featuredVocabTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 12,
  },
  featuredVocabTitleButtons: {
    flexDirection: "row",
    gap: 8,
  },
  featuredVocabTitleButton: {
    paddingHorizontal: 8,
    borderRadius: 24,
  },
  fetchingContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  fetchingText: {
    color: "black",
    opacity: 0.5,
  },
});

export default WordHints;
