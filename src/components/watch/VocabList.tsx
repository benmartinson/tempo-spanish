import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  View,
} from "react-native";
import { KeyVocabulary } from "../../types";
import { useState } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const VocabList: React.FC<{
  vocab: KeyVocabulary[];
  time: number;
}> = ({ vocab, time }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [manualTranslations, setManualTranslations] = useState<KeyVocabulary[]>(
    [],
  );

  const toggleTranslation = (word: KeyVocabulary) => {
    const isAlreadyShown = manualTranslations.find(
      (translation) => translation.value === word.value,
    );
    if (isAlreadyShown) {
      setManualTranslations((prev) =>
        prev.filter((translation) => translation.value !== word.value),
      );
    } else {
      setManualTranslations((prev) => [...prev, word]);
    }
  };

  const shouldHighlight = (word: KeyVocabulary) => {
    return Math.floor(word.start) <= time && Math.ceil(word.end) + 1 >= time;
  };

  const shouldShowTranslation = (word: KeyVocabulary) => {
    // Show translation if highlighted OR if manually toggled
    // const isHighlighted = shouldHighlight(word);
    const isManuallyShown = manualTranslations.find(
      (translation) => translation.value === word.value,
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
          {vocab.map((word, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.vocabItem,
                shouldHighlight(word) && styles.highlightedVocabItem,
              ]}
              onPress={() => toggleTranslation(word)}
              activeOpacity={0.7}
            >
              <Text style={styles.vocabWord}>{word.value}</Text>
              {shouldShowTranslation(word) && (
                <Text style={styles.vocabTranslation}>
                  {" => "}
                  {word.translations[word.correct_translation]}
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
    color: "#fff",
    fontSize: 16,
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
