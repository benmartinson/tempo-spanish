import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SegmentWord } from "../../types";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import FeaturedVocab from "../watch/FeaturedVocab";

interface WordHintsProps {
  unknownWords: SegmentWord[];
  handlePlayWordSnippet: (word: SegmentWord) => void;
  isPlayingWordSnippet: boolean;
  showSwitcher?: boolean;
}

const WordHints: React.FC<WordHintsProps> = ({
  unknownWords,
  handlePlayWordSnippet,
  isPlayingWordSnippet,
  showSwitcher = true,
}) => {
  const [currentUnknownWordIndex, setCurrentUnknownWordIndex] =
    useState<number>(0);
  const currentUnknownWord = unknownWords[currentUnknownWordIndex];
  const [isShowingWordHints, setIsShowingWordHints] = useState<boolean>(false);

  const handleWordHintChange = (direction: number) => {
    if (unknownWords.length === 0) return;
    let newIndex = currentUnknownWordIndex + direction;
    if (newIndex < 0) {
      newIndex = unknownWords.length - 1;
    } else if (newIndex >= unknownWords.length) {
      newIndex = 0;
    }
    setCurrentUnknownWordIndex(newIndex);
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
      {isShowingWordHints && currentUnknownWord && (
        <FeaturedVocab
          word={currentUnknownWord}
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
