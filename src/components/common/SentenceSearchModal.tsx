import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Sentence, ContextSegment } from "../../types";
import { BACKEND_BASE_URL } from "../streaming_helpers";
import { capitalize, formatTimestamp } from "../../helpers";
import BubbleSelector from "../watch/BubbleSelector";
import Modal from "./Modal";

type SearchMode = "number" | "meaning";

interface SentenceSearchModalProps {
  visible: boolean;
  onClose: () => void;
  sentences: Sentence[];
  onPlayClip: (start: number) => void;
  videoId: string;
}

const SEARCH_OPTIONS = [
  { key: "meaning", label: "Content" },
  { key: "number", label: "Sentence Number" },
];

const SentenceSearchModal: React.FC<SentenceSearchModalProps> = ({
  visible,
  onClose,
  sentences,
  onPlayClip,
  videoId,
}) => {
  const [searchMode, setSearchMode] = useState<SearchMode>("meaning");
  const [query, setQuery] = useState("");
  const [meaningResults, setMeaningResults] = useState<ContextSegment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleModeChange = (mode: string) => {
    setSearchMode(mode as SearchMode);
    setQuery("");
    setMeaningResults([]);
  };

  const getPlaceholder = () => {
    switch (searchMode) {
      case "number":
        return "Enter sentence number...";
      case "meaning":
        return "Search by word, phrase, meaning or concept...";
    }
  };

  const handleSubmit = async () => {
    if (!query.trim()) return;

    if (searchMode === "number") {
      const sentenceNum = parseInt(query, 10);
      if (
        !isNaN(sentenceNum) &&
        sentenceNum >= 1 &&
        sentenceNum <= sentences.length
      ) {
        const sentence = sentences[sentenceNum - 1];
        onPlayClip(sentence.start);
        handleClose();
      }
      return;
    }

    if (searchMode === "meaning") {
      setIsLoading(true);
      try {
        const response = await fetch(`${BACKEND_BASE_URL}/review-context`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            search_query: query,
            video_id: videoId,
            min_score: 0,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.segments) {
            setMeaningResults(data.segments.slice(0, 4));
          }
        }
      } catch (err) {
        console.error("Error fetching meaning search results:", err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleResultPress = (start: number) => {
    onPlayClip(start);
    handleClose();
  };

  const handleClose = () => {
    setQuery("");
    setMeaningResults([]);
    setSearchMode("number");
    onClose();
  };

  const truncateText = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const renderResults = () => {
    if (searchMode === "number") {
      return null;
    }

    if (searchMode === "meaning") {
      if (isLoading) {
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="black" />
          </View>
        );
      }
      if (meaningResults.length === 0) {
        return null;
      }
      return (
        <ScrollView style={styles.resultsList}>
          {meaningResults.map((segment, index) => (
            <TouchableOpacity
              key={`${segment.segment_id}-${index}`}
              style={styles.resultItem}
              onPress={() => handleResultPress(segment.start)}
            >
              <Text style={styles.resultTimestamp}>
                {formatTimestamp(segment.start)}
              </Text>
              <Text style={styles.resultText}>
                {capitalize(truncateText(segment.text))}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      );
    }

    return null;
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={handleClose}
      title="Search Video Content"
    >
      <View style={styles.container}>
        <BubbleSelector
          options={SEARCH_OPTIONS}
          selectedKey={searchMode}
          onSelect={handleModeChange}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={getPlaceholder()}
            placeholderTextColor="#888"
            value={query}
            onChangeText={setQuery}
            keyboardType={searchMode === "number" ? "numeric" : "default"}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
          />
        </View>

        {renderResults()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    marginTop: 16,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "gray",
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "black",
  },
  submitButton: {
    backgroundColor: "#5a5680",
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
    alignItems: "center",
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  resultsList: {
    marginTop: 16,
    flex: 1,
  },
  resultItem: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "gray",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  resultTimestamp: {
    color: "#5a5680",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  resultText: {
    color: "black",
    fontSize: 14,
    lineHeight: 20,
  },
  noResults: {
    marginTop: 24,
    alignItems: "center",
  },
  noResultsText: {
    color: "#888",
    fontSize: 16,
  },
  loadingContainer: {
    marginTop: 24,
    alignItems: "center",
  },
});

export default SentenceSearchModal;
