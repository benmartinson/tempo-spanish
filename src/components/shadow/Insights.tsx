import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSelector } from "react-redux";
import { RootState, SegmentWord } from "../../types";
import WordHints from "../common/WordHints";

interface InsightsProps {
  isLoading: boolean;
  characters: string[];
  sentenceText: string;
  unknownWords: SegmentWord[];
  handlePlayWordSnippet: (word: SegmentWord) => void;
  isPlayingWordSnippet: boolean;
}

const Insights: React.FC<InsightsProps> = ({
  isLoading,
  characters,
  sentenceText,
  unknownWords,
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

  useEffect(() => {
    setIsShowingCharacters(showCharacters);
    setIsShowingStartsOff(showStartsOffAs);
  }, [sentenceText]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading Insights...</Text>
      </View>
    );
  }

  const words = sentenceText.split(/\s+/).filter(Boolean);
  const firstTwo = words.slice(0, 2);
  const firstTwoCharCount = firstTwo.join("").length;
  const startsOffWords = firstTwoCharCount > 8 ? firstTwo : words.slice(0, 3);
  const startsOffText = startsOffWords.join(" ") + "...";

  return (
    <View style={styles.container}>
      {unknownWords.length > 0 && (
        <WordHints
          unknownWords={unknownWords}
          handlePlayWordSnippet={handlePlayWordSnippet}
          isPlayingWordSnippet={isPlayingWordSnippet}
          showWordHints={showWordsHints}
        />
      )}
      <>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            onPress={() => setIsShowingCharacters(!isShowingCharacters)}
          >
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Characters</Text>
              <MaterialIcons
                name="visibility"
                size={20}
                color={isShowingCharacters ? "black" : "gray"}
              />
            </View>
          </TouchableOpacity>
        </View>
        {isShowingCharacters && (
          <View style={styles.charactersList}>
            <Text style={styles.charactersText}>
              {characters.length === 0
                ? "None"
                : characters.map((name, index) => {
                    const seen = characters.slice(0, index).includes(name);
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
              <Text style={styles.charactersText}>{startsOffText}</Text>
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
    paddingHorizontal: 16,
    marginTop: 12,
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
  startsOffHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 12,
  },
});

export default Insights;
