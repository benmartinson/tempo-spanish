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
import { MaterialIcons } from "@expo/vector-icons";
import SmallSlideModal from "./SmallSlideModal";
import { VocabCacheEntry } from "../../types";

interface WordModalProps {
  visible: boolean;
  onClose: () => void;
  inline?: boolean;
  word?: string;
  words?: string[];
  sentenceText?: string;
  sentenceTranslation?: string | null;
  onTranslationFetched?: (translation: string) => void;
  onReplaySentence?: () => void;
  playerIsPlaying?: boolean;
  onCorrect?: () => void;
  onFinished?: () => void;
  title?: string;
  instructions?: string;
  hideTranslationAtFirst?: boolean;
  onPlaySnippet?: () => void;
  onPlaySnippetSlow?: () => void;
  vocabCache?: VocabCacheEntry[];
  onVocabCacheUpdate?: (entry: VocabCacheEntry) => void;
}

const WordModal: React.FC<WordModalProps> = ({
  visible,
  onClose,
  inline = false,
  word,
  sentenceText,
  sentenceTranslation,
  onTranslationFetched,
  title = "Vocab Review",
  hideTranslationAtFirst = false,
  onPlaySnippet,
  onPlaySnippetSlow,
  vocabCache = [],
  onVocabCacheUpdate,
}) => {
  const [translation, setTranslation] = useState<string | null>(null);
  const [alternateMeanings, setAlternateMeanings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHidingTranslation, setIsHidingTranslation] = useState(
    hideTranslationAtFirst,
  );

  useEffect(() => {
    if (!visible || !word) return;
    setIsHidingTranslation(hideTranslationAtFirst);
    setTranslation(null);
    setAlternateMeanings([]);

    const cached = vocabCache.find((e) => e.word === word);
    if (cached) {
      setTranslation(cached.translation);
      setAlternateMeanings(cached.alternateMeanings);
      return;
    }

    let cancelled = false;
    const fetchTranslation = async () => {
      setIsLoading(true);
      try {
        const result = await fetchVocabTranslation({
          vocabWord: word,
          sentenceText: sentenceText ?? "",
          sentenceTranslation,
        });

        if (!cancelled && result.translation) {
          setTranslation(result.translation);
          setAlternateMeanings(result.alternateMeanings);
          onTranslationFetched?.(result.translation);
          onVocabCacheUpdate?.({
            word,
            translation: result.translation,
            alternateMeanings: result.alternateMeanings,
          });
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

  const content = (
    <View style={[styles.content, inline && styles.inlineContent]}>
      {inline && (
        <TouchableOpacity
          style={styles.inlineCloseButton}
          onPress={handleClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="close" size={18} color="#647089" />
        </TouchableOpacity>
      )}
      <View style={styles.wordRow}>
        <Text style={styles.vocabWord}>
          {capitalize(stripPunctuation(word ?? ""))}
        </Text>
        {onPlaySnippet && (
          <TouchableOpacity onPress={onPlaySnippet} style={styles.playButton}>
            <MaterialIcons name="play-arrow" size={20} color="black" />
          </TouchableOpacity>
        )}
        {onPlaySnippetSlow && (
          <TouchableOpacity
            onPress={onPlaySnippetSlow}
            style={styles.playButton}
          >
            <MaterialIcons name="slow-motion-video" size={24} color="black" />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.translationContainer}>
          <ActivityIndicator size="small" color="#4a69bd" />
        </View>
      ) : translation ? (
        <View style={styles.translationContainer}>
          <Text style={styles.translationLabel}>Translation in context</Text>
          <Pressable
            style={styles.translationTextWrapper}
            onPress={() => isHidingTranslation && setIsHidingTranslation(false)}
          >
            <Text style={styles.translationText}>
              {capitalize(translation)}
            </Text>
            {isHidingTranslation && (
              <View style={styles.translationOverlay}>
                <Text style={styles.showTranslationText}>Show translation</Text>
              </View>
            )}
          </Pressable>
        </View>
      ) : null}
      {!isLoading && alternateMeanings.length > 0 && !isHidingTranslation && (
        <View style={styles.altMeaningsContainer}>
          <Text style={styles.altMeaningsLabel}>Other meanings</Text>
          {alternateMeanings
            .sort((a, b) => a.length - b.length)
            .map((meaning, i) => (
              <Text key={i} style={styles.altMeaningText}>
                {capitalize(meaning)}
              </Text>
            ))}
        </View>
      )}
    </View>
  );

  if (inline) {
    if (!visible) return null;
    return <View style={styles.inlinePanel}>{content}</View>;
  }

  return (
    <SmallSlideModal
      visible={visible}
      onRequestClose={handleClose}
      title={title}
    >
      {content}
    </SmallSlideModal>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 20,
  },
  inlinePanel: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "rgba(255, 255, 255, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.16)",
    borderRadius: 14,
    overflow: "hidden",
  },
  inlineContent: {
    position: "relative",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  inlineCloseButton: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 1,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(240, 244, 255, 0.86)",
  },
  wordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  vocabWord: {
    fontSize: 28,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
  },
  playButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: "#f0f0f5",
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
  altMeaningsContainer: {
    gap: 4,
    alignItems: "center",
  },
  altMeaningsLabel: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },
  altMeaningText: {
    fontSize: 15,
    color: "#555",
  },
});

export default WordModal;
