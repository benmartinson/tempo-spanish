import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  View,
} from "react-native";
import { KeyVocabulary, SegmentWord, Vocabulary } from "../../types";
import { useState } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const VocabList: React.FC<{
  vocab: SegmentWord[];
  time: number;
}> = ({ vocab, time }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [manualTranslations, setManualTranslations] = useState<SegmentWord[]>(
    []
  );
  // create a array of unique words segmentWord objects
  const wordSet = vocab.reduce((acc, word) => {
    if (!acc.some((w) => w.word === word.word)) {
      acc.push(word);
    }
    return acc;
  }, []);

  const toggleTranslation = (word: SegmentWord) => {
    const isAlreadyShown = manualTranslations.find(
      (translation) => translation.word === word.word
    );
    if (isAlreadyShown) {
      setManualTranslations((prev) =>
        prev.filter((translation) => translation.word !== word.word)
      );
    } else {
      setManualTranslations((prev) => [...prev, word]);
    }
  };

  const shouldHighlight = (word: SegmentWord) => {
    return Math.floor(word.start) <= time && Math.ceil(word.end) + 1 >= time;
  };

  const shouldShowTranslation = (word: SegmentWord) => {
    // Show translation if highlighted OR if manually toggled
    // const isHighlighted = shouldHighlight(word);
    const isManuallyShown = manualTranslations.find(
      (translation) => translation.word === word.word
    );
    return isManuallyShown;
  };

  return (
    <View style={styles.vocabCard}>
      <View style={styles.header}>
        <Text style={styles.vocabTitle}>Selected Vocab</Text>
        <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)}>
          <MaterialIcons
            name={isExpanded ? "expand-less" : "expand-more"}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>
      </View>
      {isExpanded && (
        <ScrollView style={styles.vocabList}>
          {wordSet.map((word, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.vocabItem,
                shouldHighlight(word) && styles.highlightedVocabItem,
              ]}
              onPress={() => toggleTranslation(word)}
              activeOpacity={0.7}
            >
              <Text style={styles.vocabWord}>{word.word}</Text>
              {shouldShowTranslation(word) && (
                <Text style={styles.vocabTranslation}>
                  {" => "}
                  {word.translation}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  vocabCard: {
    margin: 16,
    backgroundColor: "#2d2a40",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  vocabTitle: {
    color: "lightgrey",
    fontSize: 14,
    fontWeight: "700",
  },
  vocabList: {
    flexGrow: 0,
    marginTop: 12,
  },
  highlightedVocabItem: {
    backgroundColor: "#4d4a62",
  },
  vocabItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#3d3a52",
    borderRadius: 10,
    marginBottom: 8,
  },
  vocabWord: {
    color: "#a0a0b0",
    fontSize: 15,
    fontWeight: "600",
  },
  vocabTranslation: {
    color: "#a0a0b0",
    fontSize: 15,
    fontWeight: "500",
  },
});

export default VocabList;
