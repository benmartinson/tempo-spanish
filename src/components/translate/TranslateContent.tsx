import React from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { RootState } from "../../types";
import { useSelector } from "react-redux";
import { removeSpecialPunctuation, addEllipsis } from "../../helpers/helpers";
import QuestionBubble from "../discuss/QuestionBubble";

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish",
  en: "English",
  pt: "Portuguese",
};

interface TranslateContentProps {
  translationText: string | null;
  isLoading: boolean;
}

const TranslateContent: React.FC<TranslateContentProps> = ({
  translationText,
  isLoading,
}) => {
  const userSettings = useSelector((state: RootState) => state.userSettings);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#4a69bd" />
        <Text style={styles.loadingText}>Loading translation...</Text>
      </View>
    );
  }

  if (!translationText) return null;

  return (
    <View style={styles.container}>
      <QuestionBubble
        question={addEllipsis(removeSpecialPunctuation(translationText))}
        label={`Translate into ${LANGUAGE_NAMES[userSettings.targetLanguage] || userSettings.targetLanguage}`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
  },
});

export default TranslateContent;
