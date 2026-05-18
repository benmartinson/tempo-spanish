import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useDispatch, useSelector } from "react-redux";
import { supabase as rawSupabase } from "../../../lib/supabase";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import {
  fetchAllVideos,
  persistCurrentComposition,
  persistUserSettings,
  persistVideoUnselection,
} from "../../requests";
import {
  setAllChannels,
  setAllTopics,
  setAllVideos,
  setChannelTopics,
  setCurrentCompositionId,
  setCurrentVideo,
  setSelectedChannelId,
  setUserSettings,
} from "../../store/actions/dataActions";
import { LanguageCode, RootState } from "../../types";

interface LanguageModalProps {
  visible: boolean;
  onClose: () => void;
  anchorFrame?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

const LANGUAGE_OPTIONS: Array<{
  code: LanguageCode;
  label: string;
}> = [
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
];

const languageFlagByCode: Record<LanguageCode, string> = {
  es: "🇪🇸",
  en: "🇺🇸",
  pt: "🇧🇷",
  de: "🇩🇪",
  fr: "🇫🇷",
};

const DEFAULT_EDIT_TARGET_LANGUAGE: LanguageCode = "es";
const DEFAULT_EDIT_TRANSLATION_LANGUAGE: LanguageCode = "en";
const DROPDOWN_WIDTH = 320;

const LanguageModal: React.FC<LanguageModalProps> = ({
  visible,
  onClose,
  anchorFrame = null,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const dispatch = useDispatch();
  const clerkSupabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const isRequiredSelection = !userSettings.targetLanguage;
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>(
    userSettings.targetLanguage ?? DEFAULT_EDIT_TARGET_LANGUAGE,
  );
  const [translationLanguage, setTranslationLanguage] = useState<LanguageCode>(
    userSettings.translationLanguage ?? DEFAULT_EDIT_TRANSLATION_LANGUAGE,
  );
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setTargetLanguage(
      userSettings.targetLanguage ?? DEFAULT_EDIT_TARGET_LANGUAGE,
    );
    setTranslationLanguage(
      userSettings.translationLanguage ?? DEFAULT_EDIT_TRANSLATION_LANGUAGE,
    );
  }, [visible, userSettings.targetLanguage, userSettings.translationLanguage]);

  const saveLanguage = async (nextTargetLanguage: LanguageCode) => {
    if (isSaving) return;

    const nextTranslationLanguage =
      userSettings.translationLanguage &&
      userSettings.translationLanguage !== nextTargetLanguage
        ? userSettings.translationLanguage
        : DEFAULT_EDIT_TRANSLATION_LANGUAGE;
    const targetChanged = nextTargetLanguage !== userSettings.targetLanguage;
    const translationChanged =
      nextTranslationLanguage !== userSettings.translationLanguage;
    const nextSettings = {
      ...userSettings,
      targetLanguage: nextTargetLanguage,
      translationLanguage: nextTranslationLanguage,
    };

    setTargetLanguage(nextTargetLanguage);
    setTranslationLanguage(nextTranslationLanguage);

    if (!targetChanged && !translationChanged) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      dispatch(setUserSettings(nextSettings));
      if (targetChanged) {
        dispatch(setCurrentVideo(null));
        dispatch(setCurrentCompositionId(null));
        dispatch(setSelectedChannelId(null));
      }

      const supabase = clerkSupabase ?? rawSupabase;
      const { channelData, videoData, topicData, channelTopicData } =
        await fetchAllVideos({ supabase, targetLanguage: nextTargetLanguage });
      dispatch(setAllChannels(channelData));
      dispatch(setAllVideos(videoData));
      dispatch(setAllTopics(topicData));
      dispatch(setChannelTopics(channelTopicData));

      persistUserSettings({
        supabase: clerkSupabase,
        userId,
        settings: {
          targetLanguage: nextTargetLanguage,
          translationLanguage: nextTranslationLanguage,
        },
      });

      if (targetChanged) {
        persistVideoUnselection({
          supabase: clerkSupabase,
          userId,
        });
        persistCurrentComposition({
          supabase: clerkSupabase,
          userId,
          compositionId: null,
        });
      }

      onClose();
    } catch (err) {
      console.error("Error saving language settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestClose = () => {
    if (!isRequiredSelection) onClose();
  };
  const dropdownLeft = anchorFrame
    ? Math.min(
        Math.max(12, windowWidth - DROPDOWN_WIDTH - 12),
        Math.max(12, anchorFrame.x + anchorFrame.width - DROPDOWN_WIDTH),
      )
    : Math.max(12, (windowWidth - DROPDOWN_WIDTH) / 2);
  const dropdownTop = anchorFrame
    ? Math.min(windowHeight - 24, anchorFrame.y + anchorFrame.height + 8)
    : 84;

  const renderOption = ({
    code,
    label,
    selected,
    onPress,
  }: {
    code: LanguageCode;
    label: string;
    selected: boolean;
    onPress: () => void;
  }) => {
    return (
      <TouchableOpacity
        key={code}
        style={[styles.optionRow, selected && styles.optionRowSelected]}
        onPress={onPress}
        disabled={isSaving}
        activeOpacity={0.72}
      >
        <View style={styles.optionMain}>
          <View style={styles.optionTitle}>
            <Text style={styles.optionFlag}>{languageFlagByCode[code]}</Text>
            <Text
              style={[styles.optionLabel, selected && styles.optionLabelActive]}
            >
              {label}
            </Text>
          </View>
        </View>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected && <MaterialIcons name="check" size={14} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={handleRequestClose}
      transparent
      animationType="fade"
    >
      <Pressable style={styles.backdrop} onPress={handleRequestClose}>
        <Pressable
          style={[
            styles.dropdown,
            {
              left: dropdownLeft,
              top: dropdownTop,
              width: Math.min(DROPDOWN_WIDTH, windowWidth - 24),
            },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.card}>
            {LANGUAGE_OPTIONS.map((option) =>
              renderOption({
                ...option,
                selected: targetLanguage === option.code,
                onPress: () => void saveLanguage(option.code),
              }),
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  dropdown: {
    position: "absolute",
    borderRadius: 14,
    padding: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.14)",
    shadowColor: "#1f2330",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.1)",
    overflow: "hidden",
  },
  optionRow: {
    minHeight: 42,
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
  optionTitle: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionFlag: {
    fontSize: 17,
    lineHeight: 21,
  },
  optionLabel: {
    color: "#1a1a2e",
    fontSize: 13,
    fontWeight: "800",
  },
  optionLabelActive: {
    color: "#3d3a52",
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
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
});

export default LanguageModal;
