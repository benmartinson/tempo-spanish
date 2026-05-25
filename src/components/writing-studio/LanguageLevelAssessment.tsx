import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  persistLanguageLevelAssessment,
  type LanguageLevelAssessmentResponse,
  type LanguageLevelAssessmentSignal,
} from "../../requests";
import type { LanguageCode } from "../../types";

type PassageResponse = "comfortable" | "gaps" | "too-hard";

interface AssessmentPassage {
  id: string;
  title: string;
  meta: string;
  difficulty: string;
  cefr: string;
  excerpt: string;
}

interface LanguageLevelAssessmentProps {
  publicSupabase: any;
  targetLanguage: LanguageCode | null;
  userId?: string | null;
  onBack: () => void;
}

const PASSAGES: AssessmentPassage[] = [
  {
    id: "first-routine",
    title: "Una rutina sencilla",
    meta: "Everyday present tense",
    difficulty: "beginner",
    cefr: "A1",
    excerpt:
      "Me levanto temprano, preparo cafe y camino a la escuela. En la tarde estudio un poco y hablo con mis amigos por telefono.",
  },
  {
    id: "lost-keys",
    title: "Las llaves perdidas",
    meta: "Past events and details",
    difficulty: "lower intermediate",
    cefr: "A2",
    excerpt:
      "Ayer llegue tarde porque no encontraba mis llaves. Busque en la cocina, en mi mochila y debajo del sofa. Al final estaban dentro de mi chaqueta.",
  },
  {
    id: "changed-plan",
    title: "Un cambio de planes",
    meta: "Opinion with contrast",
    difficulty: "upper intermediate",
    cefr: "B1",
    excerpt:
      "Aunque al principio queria viajar solo, acepte la invitacion de mis primos. Resulto ser una buena decision, porque compartimos gastos y descubri lugares que no habria visitado.",
  },
  {
    id: "city-habits",
    title: "La vida en la ciudad",
    meta: "Abstract argument",
    difficulty: "advanced",
    cefr: "B2",
    excerpt:
      "En muchas ciudades, la prisa se ha convertido en una costumbre invisible. Nadie la elige de manera consciente, pero casi todos organizan su dia como si llegar antes fuera siempre vivir mejor.",
  },
  {
    id: "memory-essay",
    title: "Memoria y lenguaje",
    meta: "Dense reflection",
    difficulty: "advanced stretch",
    cefr: "C1",
    excerpt:
      "Si bien aprender vocabulario parece una tarea mecanica, cada palabra nueva modifica la forma en que recordamos una experiencia. Nombrar algo con precision tambien cambia nuestra relacion con ello.",
  },
];

const RESPONSE_OPTIONS: {
  value: PassageResponse;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "comfortable", label: "Comfortable", icon: "checkmark-circle" },
  { value: "gaps", label: "Some gaps", icon: "ellipse-outline" },
  { value: "too-hard", label: "Too hard", icon: "remove-circle-outline" },
];

const titleCase = (value: string): string =>
  value
    .split(/\s+/)
    .map((word) =>
      word.length ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word,
    )
    .join(" ");

const getConfidence = (
  answeredCount: number,
): LanguageLevelAssessmentSignal["confidence"] => {
  if (answeredCount >= 5) return "good";
  if (answeredCount >= 3) return "moderate";
  return "early";
};

const getEstimate = (
  responses: Record<string, PassageResponse>,
): Omit<LanguageLevelAssessmentSignal, "language" | "responses"> | null => {
  const answered = PASSAGES.filter((passage) => responses[passage.id]);
  if (answered.length < 3) return null;

  const comfortableIndexes = answered
    .map((passage) =>
      responses[passage.id] === "comfortable"
        ? PASSAGES.findIndex((item) => item.id === passage.id)
        : -1,
    )
    .filter((index) => index >= 0);
  const gapsIndexes = answered
    .map((passage) =>
      responses[passage.id] === "gaps"
        ? PASSAGES.findIndex((item) => item.id === passage.id)
        : -1,
    )
    .filter((index) => index >= 0);

  const comfortableScore =
    comfortableIndexes.length > 0 ? Math.max(...comfortableIndexes) + 0.8 : 0;
  const gapsScore =
    gapsIndexes.length > 0 ? Math.max(...gapsIndexes) + 0.35 : 0;
  const score = Math.max(comfortableScore, gapsScore);

  if (score >= 3.7) {
    return {
      estimatedLevel: "Advanced",
      estimatedCefr: "B2/C1",
      difficultyBand: "advanced",
      confidence: getConfidence(answered.length),
    };
  }
  if (score >= 2.7) {
    return {
      estimatedLevel: "Upper Intermediate",
      estimatedCefr: "B1/B2",
      difficultyBand: "upper intermediate",
      confidence: getConfidence(answered.length),
    };
  }
  if (score >= 1.45) {
    return {
      estimatedLevel: "Lower Intermediate",
      estimatedCefr: "A2/B1",
      difficultyBand: "lower intermediate",
      confidence: getConfidence(answered.length),
    };
  }

  return {
    estimatedLevel: "Beginner",
    estimatedCefr: "A1/A2",
    difficultyBand: "beginner",
    confidence: getConfidence(answered.length),
  };
};

const toPersistedResponses = (
  responses: Record<string, PassageResponse>,
): LanguageLevelAssessmentResponse[] =>
  PASSAGES.filter((passage) => responses[passage.id]).map((passage) => ({
    passageId: passage.id,
    difficulty: passage.difficulty,
    cefr: passage.cefr,
    response: responses[passage.id],
  }));

const LanguageLevelAssessment: React.FC<LanguageLevelAssessmentProps> = ({
  publicSupabase,
  targetLanguage,
  userId,
  onBack,
}) => {
  const [responses, setResponses] = useState<Record<string, PassageResponse>>(
    {},
  );
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "local"
  >("idle");
  const lastSavedSignalRef = useRef<string | null>(null);
  const isSpanishTarget = targetLanguage === "es";
  const answeredCount = Object.keys(responses).length;
  const estimate = useMemo(() => getEstimate(responses), [responses]);
  const persistedResponses = useMemo(
    () => toPersistedResponses(responses),
    [responses],
  );

  useEffect(() => {
    if (!estimate || !isSpanishTarget) {
      setSaveStatus("idle");
      return;
    }

    if (!userId) {
      setSaveStatus("local");
      return;
    }

    const signal: LanguageLevelAssessmentSignal = {
      language: "es",
      ...estimate,
      responses: persistedResponses,
    };
    const serializedSignal = JSON.stringify(signal);
    if (lastSavedSignalRef.current === serializedSignal) return;

    let cancelled = false;
    setSaveStatus("saving");

    const saveSignal = async () => {
      const didSave = await persistLanguageLevelAssessment({
        supabase: publicSupabase,
        userId,
        signal,
      });
      if (cancelled) return;
      lastSavedSignalRef.current = serializedSignal;
      setSaveStatus(didSave ? "saved" : "local");
    };

    void saveSignal();

    return () => {
      cancelled = true;
    };
  }, [estimate, isSpanishTarget, persistedResponses, publicSupabase, userId]);

  const resetAssessment = () => {
    setResponses({});
    setSaveStatus("idle");
    lastSavedSignalRef.current = null;
  };

  const setPassageResponse = (passageId: string, response: PassageResponse) => {
    setResponses((currentResponses) => ({
      ...currentResponses,
      [passageId]: response,
    }));
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator
    >
      <Pressable style={styles.backButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={16} color="#3d3a52" />
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Spanish Level Check</Text>
        <Text style={styles.headerSubtitle}>
          Read each passage and mark how much you understand.
        </Text>
      </View>

      {!isSpanishTarget ? (
        <View style={styles.noticePanel}>
          <Ionicons name="language-outline" size={18} color="#5a5680" />
          <Text style={styles.noticeText}>
            This check is available for Spanish learners right now.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {answeredCount}/{PASSAGES.length} passages answered
            </Text>
            <Pressable style={styles.resetButton} onPress={resetAssessment}>
              <Ionicons name="refresh-outline" size={14} color="#3d3a52" />
              <Text style={styles.resetButtonText}>Reset</Text>
            </Pressable>
          </View>

          <View style={styles.passageList}>
            {PASSAGES.map((passage) => {
              const selectedResponse = responses[passage.id] ?? null;

              return (
                <View key={passage.id} style={styles.passageCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleGroup}>
                      <Text style={styles.cardTitle}>{passage.title}</Text>
                      <Text style={styles.cardMeta}>
                        {passage.meta} - {passage.cefr}
                      </Text>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {titleCase(passage.difficulty)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.excerptText}>{passage.excerpt}</Text>

                  <View style={styles.responseRow}>
                    {RESPONSE_OPTIONS.map((option) => {
                      const isSelected = selectedResponse === option.value;

                      return (
                        <Pressable
                          key={option.value}
                          style={[
                            styles.responseButton,
                            isSelected && styles.responseButtonSelected,
                          ]}
                          onPress={() =>
                            setPassageResponse(passage.id, option.value)
                          }
                        >
                          <Ionicons
                            name={option.icon}
                            size={15}
                            color={isSelected ? "#26705d" : "#697187"}
                          />
                          <Text
                            style={[
                              styles.responseButtonText,
                              isSelected && styles.responseButtonTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.resultPanel}>
            <View style={styles.resultHeader}>
              <Ionicons name="compass-outline" size={18} color="#26705d" />
              <Text style={styles.resultTitle}>Starting Point</Text>
            </View>
            {estimate ? (
              <>
                <Text style={styles.estimateText}>
                  {estimate.estimatedLevel} - {estimate.estimatedCefr}
                </Text>
                <Text style={styles.resultBody}>
                  Start with {estimate.difficultyBand} passages, then use easier
                  cards for review and harder cards as stretch material.
                </Text>
                <View style={styles.statusRow}>
                  {saveStatus === "saving" && (
                    <>
                      <ActivityIndicator size="small" color="#5a5680" />
                      <Text style={styles.statusText}>Saving signal...</Text>
                    </>
                  )}
                  {saveStatus === "saved" && (
                    <>
                      <Ionicons
                        name="checkmark-circle"
                        size={15}
                        color="#26705d"
                      />
                      <Text style={styles.statusText}>Saved for Spanish.</Text>
                    </>
                  )}
                  {saveStatus === "local" && (
                    <>
                      <Ionicons
                        name="cloud-offline-outline"
                        size={15}
                        color="#697187"
                      />
                      <Text style={styles.statusText}>
                        Kept locally for this session.
                      </Text>
                    </>
                  )}
                </View>
              </>
            ) : (
              <Text style={styles.resultBody}>
                Answer at least three passages to estimate a starting level.
              </Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 18,
    gap: 12,
  },
  backButton: {
    minHeight: 34,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 10,
    cursor: "pointer" as any,
  },
  backButtonText: {
    color: "#3d3a52",
    fontSize: 13,
    fontWeight: "900",
  },
  header: {
    gap: 4,
  },
  headerTitle: {
    color: "#2f3140",
    fontSize: 16,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "#697187",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  noticePanel: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.12)",
    backgroundColor: "#f7f8fb",
  },
  noticeText: {
    flex: 1,
    color: "#3d3a52",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  progressRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  progressText: {
    color: "#697187",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  resetButton: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.12)",
    backgroundColor: "#f6f7fa",
    cursor: "pointer" as any,
  },
  resetButtonText: {
    color: "#3d3a52",
    fontSize: 11,
    fontWeight: "900",
  },
  passageList: {
    gap: 12,
  },
  passageCard: {
    gap: 11,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(74, 105, 189, 0.12)",
  },
  cardHeader: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitleGroup: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  cardTitle: {
    color: "#2f3140",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },
  cardMeta: {
    color: "#697187",
    fontSize: 11,
    fontWeight: "800",
  },
  badge: {
    minHeight: 20,
    justifyContent: "center",
    paddingHorizontal: 7,
    borderRadius: 8,
    backgroundColor: "#f4f0df",
  },
  badgeText: {
    color: "#6a5a16",
    fontSize: 10,
    fontWeight: "900",
  },
  excerptText: {
    color: "#2f3140",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  responseRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
  },
  responseButton: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.12)",
    backgroundColor: "#f3f5f8",
    cursor: "pointer" as any,
  },
  responseButtonSelected: {
    backgroundColor: "#edf4f2",
    borderColor: "#26705d",
  },
  responseButtonText: {
    color: "#3d3a52",
    fontSize: 11,
    fontWeight: "900",
  },
  responseButtonTextSelected: {
    color: "#26705d",
  },
  resultPanel: {
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(38, 112, 93, 0.18)",
    backgroundColor: "#f5fbf8",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultTitle: {
    color: "#26705d",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  estimateText: {
    color: "#2f3140",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
  },
  resultBody: {
    color: "#3d3a52",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  statusRow: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  statusText: {
    color: "#697187",
    fontSize: 11,
    fontWeight: "800",
  },
});

export default LanguageLevelAssessment;
