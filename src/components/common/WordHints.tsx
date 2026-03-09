import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SegmentWord } from "../../types";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import FeaturedVocab from "../watch/FeaturedVocab";

interface WordHintsProps {
  hintWords: SegmentWord[];
  handlePlayWordSnippet: (word: SegmentWord, isSlow?: boolean) => void;
  isPlayingWordSnippet: boolean;
  showSwitcher?: boolean;
  showWordHints: boolean;
}

const WordHints: React.FC<WordHintsProps> = ({
  hintWords,
  handlePlayWordSnippet,
  isPlayingWordSnippet,
  showSwitcher = true,
  showWordHints,
}) => {
  const [currentHintIndex, setCurrentHintIndex] =
    useState<number>(0);
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

  return (
    <View style={styles.featuredVocabContainer}>
      <View style={styles.featuredVocabTitleContainer}>
        <TouchableOpacity
          onPress={() => setIsShowingWordHints(!isShowingWordHints)}
        >
          <View style={styles.featuredVocabTitleLeft}>
            <Text style={styles.featuredVocabTitle}>Word Hints</Text>
            <MaterialIcons
              name="visibility"
              size={20}
              color={isShowingWordHints ? "black" : "gray"}
            />
          </View>
        </TouchableOpacity>
        {isShowingWordHints && showSwitcher && (
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
      {isShowingWordHints && currentHintWord && (
        <FeaturedVocab
          word={currentHintWord}
          playSnippet={handlePlayWordSnippet}
          isPlayingWordSnippet={isPlayingWordSnippet}
          handleWordHintChange={handleWordHintChange}
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
  featuredVocabTitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "left",
    paddingHorizontal: 4,
  },
  featuredVocabTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  featuredVocabTitleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featuredVocabTitleButtons: {
    flexDirection: "row",
    gap: 8,
  },
  featuredVocabTitleButton: {
    paddingHorizontal: 8,
    borderRadius: 24,
  },
});

export default WordHints;
