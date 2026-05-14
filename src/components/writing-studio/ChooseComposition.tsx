import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { UserComposition } from "../../requests";

export interface CompositionTemplate {
  id: string;
  title: string;
  topic: string;
  text: string;
}

const COMPOSITION_TEMPLATES: CompositionTemplate[] = [
  {
    id: "daily-moment",
    title: "A Moment From Today",
    topic: "Personal story",
    text: "Hoy paso algo pequeno que me hizo pensar. Al principio no parecia importante, pero despues entendi que tenia algo que aprender.",
  },
  {
    id: "strong-opinion",
    title: "A Clear Opinion",
    topic: "Opinion",
    text: "Creo que una buena conversacion empieza cuando las personas escuchan de verdad. Para mi, escuchar bien es tan importante como hablar con confianza.",
  },
  {
    id: "future-plans",
    title: "Future Plans",
    topic: "Goals",
    text: "En el futuro quiero sentirme mas comodo hablando en otro idioma. No necesito sonar perfecto, pero si quiero expresar mis ideas con calma.",
  },
  {
    id: "travel-memory",
    title: "Travel Memory",
    topic: "Experience",
    text: "La primera vez que visite un lugar nuevo, me sorprendio la energia de la gente. Recuerdo un detalle pequeno que todavia me hace sonreir.",
  },
  {
    id: "small-challenge",
    title: "A Small Challenge",
    topic: "Reflection",
    text: "Hace poco tuve que resolver un problema que parecia simple, pero me costo mas de lo esperado. Esa experiencia me enseno a tener mas paciencia.",
  },
  {
    id: "give-advice",
    title: "Giving Advice",
    topic: "Advice",
    text: "Si pudiera darle un consejo a alguien que esta empezando, le diria que avance poco a poco. La constancia ayuda mas que la motivacion de un solo dia.",
  },
];

interface ChooseCompositionProps {
  savedCompositions: UserComposition[];
  isLoadingSavedCompositions: boolean;
  savedCompositionError: string | null;
  isSignedIn: boolean;
  onBlankCanvas: () => void;
  onChooseTemplate: (template: CompositionTemplate) => void;
  onChooseSavedComposition: (composition: UserComposition) => void;
}

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const ChooseComposition: React.FC<ChooseCompositionProps> = ({
  savedCompositions,
  isLoadingSavedCompositions,
  savedCompositionError,
  isSignedIn,
  onBlankCanvas,
  onChooseTemplate,
  onChooseSavedComposition,
}) => {
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const savedEmptyLabel = isSignedIn
    ? "No saved compositions yet."
    : "Sign in to save and reopen compositions.";

  if (templatesOpen) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <Pressable
          style={styles.backButton}
          onPress={() => setTemplatesOpen(false)}
        >
          <Ionicons name="arrow-back" size={16} color="#3d3a52" />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <View style={styles.list}>
          {COMPOSITION_TEMPLATES.map((template) => (
            <Pressable
              key={template.id}
              style={styles.row}
              onPress={() => onChooseTemplate(template)}
            >
              <View style={styles.rowTextGroup}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {template.title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {template.topic}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={17} color="#3d3a52" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator
    >
      <View style={styles.list}>
        <Pressable style={styles.row} onPress={onBlankCanvas}>
          <View style={styles.rowIcon}>
            <Ionicons name="document-text-outline" size={18} color="#26705d" />
          </View>
          <Text style={styles.rowTitle}>Blank Canvas</Text>
          <Ionicons name="arrow-forward" size={17} color="#3d3a52" />
        </Pressable>

        <Pressable style={styles.row} onPress={() => setTemplatesOpen(true)}>
          <View style={styles.rowIcon}>
            <Ionicons name="albums-outline" size={18} color="#26705d" />
          </View>
          <Text style={styles.rowTitle}>Template</Text>
          <Ionicons name="arrow-forward" size={17} color="#3d3a52" />
        </Pressable>
      </View>

      <View style={styles.savedHeader}>
        <Text style={styles.savedHeaderText}>Saved</Text>
        {isLoadingSavedCompositions && (
          <ActivityIndicator size="small" color="#5a5680" />
        )}
      </View>

      {savedCompositionError ? (
        <Text style={styles.emptyText}>{savedCompositionError}</Text>
      ) : savedCompositions.length ? (
        <View style={styles.list}>
          {savedCompositions.map((composition) => (
            <Pressable
              key={String(composition.id)}
              style={styles.row}
              onPress={() => onChooseSavedComposition(composition)}
            >
              <View style={styles.rowTextGroup}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {composition.title || "Untitled composition"}
                </Text>
                <Text style={styles.rowMeta}>
                  {formatDate(composition.updated_at)}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={17} color="#3d3a52" />
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>{savedEmptyLabel}</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 10,
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: "rgba(74, 105, 189, 0.12)",
  },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(74, 105, 189, 0.12)",
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf4f2",
  },
  rowTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    flex: 1,
    color: "#2f3140",
    fontSize: 14,
    fontWeight: "900",
  },
  rowMeta: {
    marginTop: 2,
    color: "#697187",
    fontSize: 11,
    fontWeight: "700",
  },
  savedHeader: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  savedHeaderText: {
    color: "#697187",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  emptyText: {
    color: "#697187",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  backButton: {
    minHeight: 34,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 10,
  },
  backButtonText: {
    color: "#3d3a52",
    fontSize: 13,
    fontWeight: "900",
  },
});

export default ChooseComposition;
