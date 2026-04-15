import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-expo";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Ionicons } from "@expo/vector-icons";
import { RootState, Vocabulary } from "../../types";
import { addUserKnownVocab } from "../../store/actions/dataActions";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { selectGuidedVocab } from "../../helpers/helpers";
import VocabClips from "./VocabClips";
import SelectVocabFilterModal from "./SelectVocabFilterModal";

interface SelectVocabPageProps {
  wordListId?: number;
  onBack?: () => void;
  onSaved?: () => void;
}

const SelectVocabPage: React.FC<SelectVocabPageProps> = ({
  wordListId,
  onBack,
  onSaved,
}) => {
  const dispatch = useDispatch();
  const { userId } = useAuth();
  const supabase = useSupabaseWithClerk();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [percentileRange, setPercentileRange] = useState<[number, number]>([
    1, 3,
  ]);
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const userKnownVocab = useSelector(
    (state: RootState) => state.userKnownVocab,
  );
  const focusVocabIds =
    useSelector((state: RootState) =>
      state.currentVideo?.focusVocab.map((v) => v.vocabulary_id),
    ) ?? [];

  const [words, setWords] = useState<Vocabulary[]>([]);
  const [skippedIds, setSkippedIds] = useState<number[]>([]);
  const [modalWord, setModalWord] = useState<Vocabulary | null>(null);
  const [showVocabClips, setShowVocabClips] = useState(false);
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const isExistingList = !!wordListId;

  // Load words from existing word list if wordListId provided
  useMemo(() => {
    if (wordListId && supabase && Object.keys(allVocabulary).length) {
      (async () => {
        const { data, error } = await supabase
          .from("word_list_vocab")
          .select("vocabulary_id")
          .eq("word_list_id", wordListId);
        if (error) {
          console.error("Error fetching word list vocab:", error);
          return;
        }
        const vocabIds = data.map((r: any) => r.vocabulary_id);
        const allWords = Object.values(allVocabulary);
        const loaded = vocabIds
          .map((id: number) => allWords.find((v) => v.id === id))
          .filter((v: Vocabulary | undefined): v is Vocabulary => !!v);
        setWords(loaded);
        setInitialized(true);
      })();
    }
  }, [wordListId, allVocabulary]);

  // Generate fresh words if no wordListId
  useMemo(() => {
    if (wordListId) return;
    if (initialized || !Object.keys(allVocabulary).length) return;
    const selected = selectGuidedVocab(
      allVocabulary,
      userKnownVocab,
      focusVocabIds,
      percentileRange,
    );
    setWords(selected);
    setSkippedIds([]);
    setInitialized(true);
  }, [percentileRange, initialized ? null : allVocabulary]);

  const handleFilterSelect = (minP: number, maxP: number) => {
    setPercentileRange([minP, maxP]);
    setIsFilterOpen(false);
    setInitialized(false);
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
          percentileRange,
          1,
          excludeIds,
        );
        return [...remaining, ...replacement];
      });
    },
    [allVocabulary, userKnownVocab, focusVocabIds, percentileRange],
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

  const handleContinue = async () => {
    if (isExistingList) {
      setShowDifficultyModal(true);
      return;
    }

    if (supabase && userId) {
      // Create a new word list
      const { data: listData, error: listError } = await supabase
        .from("user_word_list")
        .insert({ user_id: userId })
        .select("id")
        .single();

      if (listError || !listData) {
        console.error("Error creating word list:", listError);
        return;
      }

      // Save vocab entries
      const vocabRows = words.map((v) => ({
        word_list_id: listData.id,
        vocabulary_id: v.id,
      }));
      const { error: vocabError } = await supabase
        .from("word_list_vocab")
        .insert(vocabRows);

      if (vocabError) {
        console.error("Error saving word list vocab:", vocabError);
      }
    }
    setShowVocabClips(true);
  };

  const handleDifficultyChoice = (harder: boolean) => {
    setShowDifficultyModal(false);
    setShowVocabClips(true);
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const shuffledWords = useMemo(
    () => (showVocabClips ? [...words].sort(() => Math.random() - 0.5) : []),
    [showVocabClips],
  );

  if (showVocabClips) {
    return <VocabClips vocabList={shuffledWords} onBack={onBack} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.headerButton} onPress={onBack}>
          <MaterialIcons name="arrow-back" size={22} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isExistingList ? "Review List" : "Select Words"}
        </Text>
        {isExistingList ? (
          <View style={styles.headerButton} />
        ) : (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setIsFilterOpen(true)}
          >
            <Ionicons name="options-outline" size={22} color="#4a69bd" />
          </TouchableOpacity>
        )}
      </View>
      <SelectVocabFilterModal
        visible={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        selectedRange={percentileRange}
        onSelect={handleFilterSelect}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.instructions}>
          {isExistingList
            ? "Review your previously created list."
            : "Choose 8 words to focus on. Click the X to deselect and generate another one. Use the filter if needed to control word difficulty."}
        </Text>
        {!initialized && (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "white",
              marginTop: 40,
            }}
          >
            <ActivityIndicator size="large" color="#5a5680" />
            <Text style={{ marginTop: 16, color: "#666" }}>
              Fetching words...
            </Text>
          </View>
        )}
        {words.length > 0 && (
          <View style={styles.wordsList}>
            {words.map((v) => (
              <View key={v.id} style={styles.wordRow}>
                <Text style={styles.wordText}>{capitalize(v.word)}</Text>
                {!isExistingList && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => setModalWord(v)}
                  >
                    <MaterialIcons name="close" size={18} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinue}
            >
              <Text style={styles.continueButtonText}>
                {isExistingList ? "Continue" : "Select and Continue"}
              </Text>
            </TouchableOpacity>
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
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleKnown}
              >
                <Text style={styles.modalButtonText}>
                  I Already Know This Word
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={handleSkip}
              >
                <Text style={styles.modalButtonTextSecondary}>
                  Skip for Now
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
        <Modal
          visible={showDifficultyModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDifficultyModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowDifficultyModal(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Have you reviewed this list before, and want a harder challenge?
              </Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => handleDifficultyChoice(true)}
              >
                <Text style={styles.modalButtonText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => handleDifficultyChoice(false)}
              >
                <Text style={styles.modalButtonTextSecondary}>
                  No, show me word hints
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
    </View>
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
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
  },
  headerButton: {
    padding: 8,
  },
  instructions: {
    fontSize: 13,
    color: "#999",
    marginBottom: 16,
    lineHeight: 18,
  },
  wordsList: {
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
  continueButton: {
    backgroundColor: "#3d3a52",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: "flex-end",
    marginTop: 12,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default SelectVocabPage;
