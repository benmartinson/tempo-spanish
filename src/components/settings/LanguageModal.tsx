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
import { supabase as rawSupabase } from "../../../lib/supabase";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import {
  fetchAllVideos,
  persistUserSettings,
  persistVideoUnselection,
} from "../../requests";
import {
  setAllChannels,
  setAllTopics,
  setAllVideos,
  setChannelTopics,
  setCurrentVideo,
  setSelectedChannelId,
  setUserSettings,
} from "../../store/actions/dataActions";
import { LanguageCode, RootState } from "../../types";
import SlideModal from "../common/SlideModal";

interface LanguageModalProps {
  visible: boolean;
  onClose: () => void;
}

const LANGUAGE_OPTIONS: Array<{
  code: LanguageCode;
  label: string;
  videos: number;
  channels: number;
}> = [
  { code: "es", label: "Spanish", videos: 84, channels: 12 },
  { code: "en", label: "English", videos: 42, channels: 7 },
  { code: "pt", label: "Portuguese", videos: 36, channels: 6 },
];

const languageLabelByCode: Record<LanguageCode, string> = {
  es: "Spanish",
  en: "English",
  pt: "Portuguese",
};

const DEFAULT_EDIT_TARGET_LANGUAGE: LanguageCode = "es";
const DEFAULT_EDIT_TRANSLATION_LANGUAGE: LanguageCode = "en";

const LanguageModal: React.FC<LanguageModalProps> = ({ visible, onClose }) => {
  const dispatch = useDispatch();
  const clerkSupabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>(
    userSettings.targetLanguage ?? DEFAULT_EDIT_TARGET_LANGUAGE,
  );
  const [translationLanguage, setTranslationLanguage] = useState<LanguageCode>(
    userSettings.translationLanguage ?? DEFAULT_EDIT_TRANSLATION_LANGUAGE,
  );
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = useMemo(
    () =>
      targetLanguage !== userSettings.targetLanguage ||
      translationLanguage !== userSettings.translationLanguage,
    [
      targetLanguage,
      translationLanguage,
      userSettings.targetLanguage,
      userSettings.translationLanguage,
    ],
  );

  React.useEffect(() => {
    if (!visible) return;
    setTargetLanguage(
      userSettings.targetLanguage ?? DEFAULT_EDIT_TARGET_LANGUAGE,
    );
    setTranslationLanguage(
      userSettings.translationLanguage ?? DEFAULT_EDIT_TRANSLATION_LANGUAGE,
    );
  }, [visible, userSettings.targetLanguage, userSettings.translationLanguage]);

  const saveLanguages = async () => {
    if (isSaving) return;

    const targetChanged = targetLanguage !== userSettings.targetLanguage;
    const nextSettings = {
      ...userSettings,
      targetLanguage,
      translationLanguage,
    };

    setIsSaving(true);
    try {
      dispatch(setUserSettings(nextSettings));
      if (targetChanged) {
        dispatch(setCurrentVideo(null));
        dispatch(setSelectedChannelId(null));
      }

      const supabase = clerkSupabase ?? rawSupabase;
      const { channelData, videoData, topicData, channelTopicData } =
        await fetchAllVideos({ supabase, targetLanguage });
      dispatch(setAllChannels(channelData));
      dispatch(setAllVideos(videoData));
      dispatch(setAllTopics(topicData));
      dispatch(setChannelTopics(channelTopicData));

      await persistUserSettings({
        supabase: clerkSupabase,
        userId,
        settings: {
          targetLanguage,
          translationLanguage,
        },
      });

      if (targetChanged) {
        await persistVideoUnselection({
          supabase: clerkSupabase,
          userId,
        });
      }

      onClose();
    } catch (err) {
      console.error("Error saving language settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const renderOption = ({
    code,
    label,
    videos,
    channels,
    selected,
    onPress,
    showCounts,
  }: {
    code: LanguageCode;
    label: string;
    videos: number;
    channels: number;
    selected: boolean;
    onPress: () => void;
    showCounts: boolean;
  }) => (
    <TouchableOpacity
      key={code}
      style={[styles.optionRow, selected && styles.optionRowSelected]}
      onPress={onPress}
      activeOpacity={0.72}
    >
      <View style={styles.optionMain}>
        <Text
          style={[styles.optionLabel, selected && styles.optionLabelActive]}
        >
          {label}
        </Text>
        {showCounts && (
          <Text style={styles.optionMeta}>
            {videos} videos, {channels} channels
          </Text>
        )}
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <MaterialIcons name="check" size={14} color="#fff" />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SlideModal visible={visible} onRequestClose={onClose} title="Language">
      <View style={styles.container}>
        <Text style={styles.sectionHeader}>Learning Language</Text>
        <View style={styles.card}>
          {LANGUAGE_OPTIONS.map((option) =>
            renderOption({
              ...option,
              selected: targetLanguage === option.code,
              onPress: () => setTargetLanguage(option.code),
              showCounts: true,
            }),
          )}
        </View>

        <Text style={styles.sectionHeader}>Native Language</Text>
        <View style={styles.card}>
          {LANGUAGE_OPTIONS.map((option) =>
            renderOption({
              ...option,
              selected: translationLanguage === option.code,
              onPress: () => setTranslationLanguage(option.code),
              showCounts: false,
            }),
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            (!hasChanges || isSaving) && styles.saveButtonDisabled,
          ]}
          onPress={saveLanguages}
          disabled={!hasChanges || isSaving}
          activeOpacity={0.75}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Change Language</Text>
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
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ebebef",
  },
  optionRowSelected: {
    backgroundColor: "#f7f9ff",
  },
  optionMain: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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

export default LanguageModal;
