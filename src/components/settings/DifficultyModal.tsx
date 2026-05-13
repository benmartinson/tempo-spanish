import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useDispatch, useSelector } from "react-redux";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { persistUserSettings } from "../../requests";
import {
  setCurrentVideo,
  setSelectedChannelId,
  setUserSettings,
} from "../../store/actions/dataActions";
import { ChannelDifficulty, RootState } from "../../types";
import {
  isBeginnerLowerIntermediate,
  normalizeChannelDifficulty,
} from "../../helpers/channelDifficulty";
import SlideModal from "../common/SlideModal";

interface DifficultyModalProps {
  visible: boolean;
  onClose: () => void;
  required?: boolean;
}

const DIFFICULTY_OPTIONS: Array<{
  value: ChannelDifficulty;
  label: string;
  description: string;
}> = [
  {
    value: "beginner",
    label: "Beginner / Lower Intermediate",
    description: "Slower, clearer speech for getting comfortable.",
  },
  {
    value: "upper intermediate",
    label: "Upper Intermediate",
    description: "Richer conversations with a little more pace.",
  },
  {
    value: "advanced",
    label: "Advanced",
    description: "Native-speed channels with denser vocabulary.",
  },
];

export const difficultyLabelByValue: Record<ChannelDifficulty, string> = {
  beginner: "Beginner / Lower Intermediate",
  "lower intermediate": "Beginner / Lower Intermediate",
  "upper intermediate": "Upper Intermediate",
  advanced: "Advanced",
};

const DifficultyModal: React.FC<DifficultyModalProps> = ({
  visible,
  onClose,
  required = false,
}) => {
  const dispatch = useDispatch();
  const clerkSupabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const savedDifficulty = normalizeChannelDifficulty(
    userSettings.currentDifficulty,
  );
  const [currentDifficulty, setCurrentDifficulty] =
    useState<ChannelDifficulty | null>(savedDifficulty);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = useMemo(
    () => currentDifficulty !== savedDifficulty,
    [currentDifficulty, savedDifficulty],
  );
  const isWaitingForUserStateClient = !!userId && !clerkSupabase;

  React.useEffect(() => {
    if (!visible) return;
    setCurrentDifficulty(savedDifficulty);
  }, [visible, savedDifficulty]);

  const saveDifficulty = async () => {
    if (isSaving || currentDifficulty == null) return;

    const nextSettings = {
      ...userSettings,
      currentDifficulty,
    };

    setIsSaving(true);
    try {
      if (userId) {
        if (!clerkSupabase) return;

        const didPersist = await persistUserSettings({
          supabase: clerkSupabase,
          userId,
          settings: {
            currentDifficulty,
          },
        });

        if (!didPersist) return;
      }

      dispatch(setUserSettings(nextSettings));
      dispatch(setCurrentVideo(null));
      dispatch(setSelectedChannelId(null));
      onClose();
    } catch (err) {
      console.error("Error saving difficulty settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const canSave =
    currentDifficulty != null &&
    (required || hasChanges) &&
    !isSaving &&
    !isWaitingForUserStateClient;

  return (
    <SlideModal
      visible={visible}
      onRequestClose={required ? () => {} : onClose}
      title="Difficulty"
      showCloseButton={!required}
    >
      <View style={styles.container}>
        <Text style={styles.sectionHeader}>Channel Difficulty</Text>
        <View style={styles.card}>
          {DIFFICULTY_OPTIONS.map((option) => {
            const selected =
              option.value === "beginner"
                ? isBeginnerLowerIntermediate(currentDifficulty)
                : normalizeChannelDifficulty(currentDifficulty) ===
                  option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionRow, selected && styles.optionRowSelected]}
                onPress={() => setCurrentDifficulty(option.value)}
                activeOpacity={0.72}
              >
                <View style={styles.optionMain}>
                  <Text
                    style={[
                      styles.optionLabel,
                      selected && styles.optionLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.optionMeta}>{option.description}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && (
                    <MaterialIcons name="check" size={14} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={saveDifficulty}
          disabled={!canSave}
          activeOpacity={0.75}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Set Difficulty</Text>
          )}
        </TouchableOpacity>
      </View>
    </SlideModal>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f5f5f7",
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionHeader: {
    color: "#8e8e93",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginTop: 18,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
  },
  optionRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ebebef",
  },
  optionRowSelected: {
    backgroundColor: "#f7f9ff",
  },
  optionMain: {
    minWidth: 0,
    flex: 1,
    gap: 4,
  },
  optionLabel: {
    color: "#1a1a2e",
    fontSize: 15,
    fontWeight: "700",
  },
  optionLabelActive: {
    color: "#3d3a52",
  },
  optionMeta: {
    color: "#8e8e93",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c8c8d0",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  radioSelected: {
    backgroundColor: "#3d3a52",
    borderColor: "#3d3a52",
  },
  saveButton: {
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3d3a52",
    marginTop: 22,
    width: 200,
    alignSelf: "flex-end",
  },
  saveButtonDisabled: {
    opacity: 0.48,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});

export default DifficultyModal;
