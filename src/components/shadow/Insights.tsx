import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSelector } from "react-redux";
import { RootState, SegmentWord } from "../../types";
import WordHints from "../common/WordHints";
import { stripPunctuation } from "../../helpers";

interface InsightsProps {
  isLoading: boolean;
  characters: string[];
  sentenceText: string;
  hintWords: SegmentWord[];
  handlePlayWordSnippet: (word: SegmentWord, isSlow?: boolean) => void;
  isPlayingWordSnippet: boolean;
}

const Insights: React.FC<InsightsProps> = ({
  isLoading,
  characters,
  sentenceText,
  hintWords,
  handlePlayWordSnippet,
  isPlayingWordSnippet,
}) => {
  const { showWordsHints, showCharacters, showStartsOffAs } = useSelector(
    (state: RootState) => state.userSettings,
  );

  const [isShowingCharacters, setIsShowingCharacters] =
    useState<boolean>(showCharacters);
  const [isShowingStartsOff, setIsShowingStartsOff] =
    useState<boolean>(showStartsOffAs);
  const [revealedCommas, setRevealedCommas] = useState<number>(0);

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
        />
      )}
      <>
        {characters.length > 0 && (
          <View style={styles.headerContainer}>
            <TouchableOpacity
              onPress={() => setIsShowingCharacters(!isShowingCharacters)}
            >
              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle}>Proper Nouns</Text>
                <MaterialIcons
                  name="visibility"
                  size={20}
                  color={isShowingCharacters ? "black" : "gray"}
                />
              </View>
            </TouchableOpacity>
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
            <TouchableOpacity
              onPress={() => setIsShowingStartsOff(!isShowingStartsOff)}
            >
              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle}>Starts Off As</Text>
                <MaterialIcons
                  name="visibility"
                  size={20}
                  color={isShowingStartsOff ? "black" : "gray"}
                />
              </View>
            </TouchableOpacity>
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "left",
    paddingHorizontal: 4,
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
});

export default Insights;
