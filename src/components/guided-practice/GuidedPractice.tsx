import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-expo";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { RootState, Vocabulary } from "../../types";
import { setUserSettings, addUserKnownVocab } from "../../store/actions/dataActions";
import { persistUserSettings } from "../../requests";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { selectGuidedVocab } from "../../helpers";

const EMPTY_ARRAY: number[] = [];

const HOURS_OPTIONS = [
  { label: "< 200", value: 100 },
  { label: "200 - 400", value: 300 },
  { label: "400 - 750", value: 600 },
  { label: "750 - 1200", value: 1000 },
  { label: "> 1200", value: 1500 },
];

const GuidedPractice: React.FC = () => {
  const dispatch = useDispatch();
  const { userId } = useAuth();
  const supabase = useSupabaseWithClerk();
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const userKnownVocab = useSelector(
    (state: RootState) => state.userKnownVocab,
  );
  const focusVocabIds =
    useSelector((state: RootState) => state.currentVideo?.focusVocab) ??
    EMPTY_ARRAY;

  const [words, setWords] = useState<Vocabulary[]>([]);
  const [skippedIds, setSkippedIds] = useState<number[]>([]);
  const [modalWord, setModalWord] = useState<Vocabulary | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Compute initial words - only when estimatedHours changes or first load
  useMemo(() => {
    if (!Object.keys(allVocabulary).length) return;
    const selected = selectGuidedVocab(
      allVocabulary,
      userKnownVocab,
      focusVocabIds,
      userSettings.estimatedHours,
    );
    setWords(selected);
    setSkippedIds([]);
    setInitialized(true);
  }, [userSettings.estimatedHours, initialized ? null : allVocabulary]);

  const selectedOption = HOURS_OPTIONS.find(
    (o) => o.value === userSettings.estimatedHours,
  );

  const handleSelect = (value: number) => {
    setIsDropdownOpen(false);
    const newSettings = { ...userSettings, estimatedHours: value };
    dispatch(setUserSettings(newSettings));
    persistUserSettings({
      supabase,
      userId: userId ?? null,
      settings: { estimatedHours: value },
    });
  };

  const replaceWord = useCallback(
    (removedId: number, newSkippedIds: number[]) => {
      setWords((prev) => {
        const remaining = prev.filter((w) => w.id !== removedId);
        const excludeIds = [...remaining.map((w) => w.id), ...newSkippedIds];
        const replacement = selectGuidedVocab(
          allVocabulary,
          userKnownVocab,
          focusVocabIds,
          userSettings.estimatedHours,
          1,
          excludeIds,
        );
        return [...remaining, ...replacement];
      });
    },
    [allVocabulary, userKnownVocab, focusVocabIds, userSettings.estimatedHours],
  );

  const handleKnown = async () => {
    if (!modalWord) return;
    const vocabId = modalWord.id;
    setModalWord(null);

    if (supabase && userId) {
      supabase
        .from("user_known_vocab")
        .upsert(
          { vocabulary_id: vocabId, user_id: userId },
          { onConflict: "vocabulary_id,user_id" },
        );
    }
    dispatch(addUserKnownVocab([vocabId]));
    const newSkipped = [...skippedIds, vocabId];
    setSkippedIds(newSkipped);
    replaceWord(vocabId, newSkipped);
  };

  const handleSkip = () => {
    if (!modalWord) return;
    const vocabId = modalWord.id;
    setModalWord(null);
    const newSkipped = [...skippedIds, vocabId];
    setSkippedIds(newSkipped);
    replaceWord(vocabId, newSkipped);
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.promptRow}>
        <Text style={styles.promptText}>Hours of Listening Practice?</Text>
        <View style={styles.dropdownContainer}>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <Text style={styles.dropdownButtonText}>
              {selectedOption ? selectedOption.label : "Select..."}
            </Text>
          </TouchableOpacity>
          {isDropdownOpen && (
            <View style={styles.dropdownList}>
              {HOURS_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.dropdownItem,
                    option.value === userSettings.estimatedHours &&
                      styles.dropdownItemSelected,
                  ]}
                  onPress={() => handleSelect(option.value)}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      option.value === userSettings.estimatedHours &&
                        styles.dropdownItemTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
      {words.length > 0 && (
        <View style={styles.wordsList}>
          {words.map((v) => (
            <View key={v.id} style={styles.wordRow}>
              <Text style={styles.wordText}>{capitalize(v.word)}</Text>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => setModalWord(v)}
              >
                <MaterialIcons name="close" size={18} color="#999" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <Modal
        visible={modalWord !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalWord(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalWord(null)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {modalWord ? capitalize(modalWord.word) : ""}
            </Text>
            <TouchableOpacity style={styles.modalButton} onPress={handleKnown}>
              <Text style={styles.modalButtonText}>
                I Already Know This Word
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={handleSkip}
            >
              <Text style={styles.modalButtonTextSecondary}>Skip for Now</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  content: {
    padding: 24,
  },
  promptRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
  },
  promptText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#222",
    lineHeight: 26,
    marginRight: 6,
  },
  dropdownContainer: {
    zIndex: 10,
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: "#f8f8f8",
  },
  dropdownButtonText: {
    fontSize: 16,
    color: "#222",
  },
  dropdownList: {
    position: "absolute",
    top: 50,
    right: 0,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    backgroundColor: "white",
    width: 130,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownItemSelected: {
    backgroundColor: "#3d3a52",
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#222",
  },
  dropdownItemTextSelected: {
    color: "#fff",
  },
  wordsList: {
    marginTop: 24,
    gap: 4,
  },
  wordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  wordText: {
    fontSize: 17,
    color: "#222",
    fontWeight: "500",
  },
  removeButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    width: "80%",
    alignItems: "center",
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#222",
    marginBottom: 8,
  },
  modalButton: {
    backgroundColor: "#3d3a52",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: "100%",
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalButtonSecondary: {
    backgroundColor: "#f0f0f0",
  },
  modalButtonTextSecondary: {
    color: "#222",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default GuidedPractice;
