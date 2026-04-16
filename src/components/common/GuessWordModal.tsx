import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { capitalize, stripPunctuation } from "../../helpers/helpers";
import { fetchVocabTranslation } from "../../requests";
import SmallSlideModal from "./SmallSlideModal";

interface GuessWordModalProps {
  visible: boolean;
  onClose: () => void;
  word?: string;
  words?: string[];
  sentenceText?: string;
  sentenceTranslation?: string | null;
  existingTranslation?: string | null;
  onTranslationFetched?: (translation: string) => void;
  onReplaySentence?: () => void;
  playerIsPlaying?: boolean;
  onCorrect?: () => void;
  onFinished?: () => void;
  title?: string;
  instructions?: string;
  hideTranslationAtFirst?: boolean;
}

const GuessWordModal: React.FC<GuessWordModalProps> = ({
  visible,
  onClose,
  word,
  sentenceText,
  sentenceTranslation,
  existingTranslation,
  onTranslationFetched,
  title = "Vocab Review",
  hideTranslationAtFirst = false,
}) => {
  const [translation, setTranslation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHidingTranslation, setIsHidingTranslation] = useState(
    hideTranslationAtFirst,
  );

  useEffect(() => {
    if (!visible || !word) return;
    setIsHidingTranslation(hideTranslationAtFirst);

    if (existingTranslation) {
      setTranslation(existingTranslation);
      return;
    }

    let cancelled = false;
    const fetchTranslation = async () => {
      setIsLoading(true);
      try {
        const fetched = await fetchVocabTranslation({
          vocabWord: word,
          sentenceText: sentenceText ?? "",
          sentenceTranslation,
        });

        if (!cancelled && fetched) {
          setTranslation(fetched);
          onTranslationFetched?.(fetched);
        }
      } catch (err) {
        console.error("Error fetching vocab translation:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchTranslation();
    return () => {
      cancelled = true;
    };
  }, [visible, word]);

  const handleClose = () => {
    setTranslation(null);
    setIsLoading(false);
    onClose();
  };

  return (
    <SmallSlideModal
      visible={visible}
      onRequestClose={handleClose}
      title={title}
    >
      <View style={styles.content}>
        <Text style={styles.vocabWord}>
          {capitalize(stripPunctuation(word ?? ""))}
        </Text>

        {isLoading ? (
          <View style={styles.translationContainer}>
            <ActivityIndicator size="small" color="#4a69bd" />
          </View>
        ) : translation ? (
          <View style={styles.translationContainer}>
            <Text style={styles.translationLabel}>Translation in context</Text>
            <Pressable
              style={styles.translationTextWrapper}
              onPress={() =>
                isHidingTranslation && setIsHidingTranslation(false)
              }
            >
              <Text style={styles.translationText}>{translation}</Text>
              {isHidingTranslation && (
                <View style={styles.translationOverlay}>
                  <Text style={styles.showTranslationText}>
                    Show translation
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>
    </SmallSlideModal>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 20,
  },
  vocabWord: {
    fontSize: 28,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
  },
  contextText: {
    fontSize: 15,
    color: "#888",
    textAlign: "center" as const,
  },
  contextWord: {
    fontWeight: "700" as const,
    color: "#222",
  },
  translationContainer: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: "#f0f4ff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d6e0f5",
  },
  translationTextWrapper: {
    position: "relative" as const,
  },
  translationOverlay: {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#c0c6d6",
    borderRadius: 8,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  showTranslationText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#555",
  },
  translationLabel: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  translationText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#222",
  },
  closeButton: {
    backgroundColor: "#4a69bd",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
    width: 150,
    alignSelf: "flex-end",
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default GuessWordModal;
