import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
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
  fetchLanguageContentCounts,
  LanguageContentCounts,
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
import SlideModal from "../common/SlideModal";

interface LanguageModalProps {
  visible: boolean;
  onClose: () => void;
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

const LanguageModal: React.FC<LanguageModalProps> = ({ visible, onClose }) => {
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
  const [contentCounts, setContentCounts] = useState<
    Partial<LanguageContentCounts>
  >({});
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [nativeDropdownOpen, setNativeDropdownOpen] = useState(false);
  const [nativeDropdownFrame, setNativeDropdownFrame] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const nativeDropdownButtonRef = React.useRef<View>(null);
  const [isSaving, setIsSaving] = useState(false);

  const nativeLanguageOptions = useMemo(
    () => LANGUAGE_OPTIONS.filter((option) => option.code !== targetLanguage),
    [targetLanguage],
  );

  const selectedNativeLanguage =
    nativeLanguageOptions.find(
      (option) => option.code === translationLanguage,
    ) ?? nativeLanguageOptions[0];

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
    setNativeDropdownOpen(false);
  }, [visible, userSettings.targetLanguage, userSettings.translationLanguage]);

  React.useEffect(() => {
    if (!visible) setNativeDropdownOpen(false);
  }, [visible]);

  React.useEffect(() => {
    if (
      translationLanguage === targetLanguage ||
      !nativeLanguageOptions.some(
        (option) => option.code === translationLanguage,
      )
    ) {
      setTranslationLanguage(nativeLanguageOptions[0]?.code ?? "en");
    }
  }, [nativeLanguageOptions, targetLanguage, translationLanguage]);

  React.useEffect(() => {
    if (!visible) return;

    let isCancelled = false;
    const loadCounts = async () => {
      setIsLoadingCounts(true);
      try {
        const supabase = clerkSupabase ?? rawSupabase;
        const counts = await fetchLanguageContentCounts({ supabase });
        if (!isCancelled) setContentCounts(counts);
      } catch (err) {
        console.error("Error fetching language content counts:", err);
      } finally {
        if (!isCancelled) setIsLoadingCounts(false);
      }
    };

    loadCounts();

    return () => {
      isCancelled = true;
    };
  }, [visible, clerkSupabase]);

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
        dispatch(setCurrentCompositionId(null));
        dispatch(setSelectedChannelId(null));
      }

      const supabase = clerkSupabase ?? rawSupabase;
      const { channelData, videoData, topicData, channelTopicData } =
        await fetchAllVideos({ supabase, targetLanguage });
      dispatch(setAllChannels(channelData));
      dispatch(setAllVideos(videoData));
      dispatch(setAllTopics(topicData));
      dispatch(setChannelTopics(channelTopicData));

      persistUserSettings({
        supabase: clerkSupabase,
        userId,
        settings: {
          targetLanguage,
          translationLanguage,
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

  const openNativeDropdown = () => {
    if (nativeDropdownOpen) {
      setNativeDropdownOpen(false);
      return;
    }

    nativeDropdownButtonRef.current?.measureInWindow((x, y, width, height) => {
      setNativeDropdownFrame({ x, y, width, height });
      setNativeDropdownOpen(true);
    });
  };

  const renderOption = ({
    code,
    label,
    selected,
    onPress,
    showCounts,
  }: {
    code: LanguageCode;
    label: string;
    selected: boolean;
    onPress: () => void;
    showCounts: boolean;
  }) => {
    const counts = contentCounts[code];
    const countText = isLoadingCounts
      ? "Loading counts..."
      : `${counts?.videos ?? 0} videos, ${counts?.channels ?? 0} channels`;

    return (
      <TouchableOpacity
        key={code}
        style={[styles.optionRow, selected && styles.optionRowSelected]}
        onPress={onPress}
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
          {showCounts && <Text style={styles.optionMeta}>{countText}</Text>}
        </View>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected && <MaterialIcons name="check" size={14} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SlideModal
      visible={visible}
      onRequestClose={handleRequestClose}
      title="What language are you learning?"
      showCloseButton={!isRequiredSelection}
    >
      <View style={styles.container}>
        <Text style={styles.sectionHeader}></Text>
        <View style={styles.card}>
          {LANGUAGE_OPTIONS.map((option) =>
            renderOption({
              ...option,
              selected: targetLanguage === option.code,
              onPress: () => setTargetLanguage(option.code),
              showCounts: false,
            }),
          )}
        </View>

        <Modal
          visible={nativeDropdownOpen && !!nativeDropdownFrame}
          transparent
          animationType="fade"
          onRequestClose={() => setNativeDropdownOpen(false)}
        >
          <Pressable
            style={styles.dropdownBackdrop}
            onPress={() => setNativeDropdownOpen(false)}
          >
            {nativeDropdownFrame && (
              <View
                style={[
                  styles.dropdownMenuPortal,
                  {
                    top: nativeDropdownFrame.y + nativeDropdownFrame.height + 4,
                    left: nativeDropdownFrame.x,
                    width: nativeDropdownFrame.width,
                  },
                ]}
              >
                {nativeLanguageOptions.map((option) => (
                  <TouchableOpacity
                    key={option.code}
                    style={[
                      styles.dropdownOption,
                      translationLanguage === option.code &&
                        styles.dropdownOptionSelected,
                    ]}
                    onPress={() => {
                      setTranslationLanguage(option.code);
                      setNativeDropdownOpen(false);
                    }}
                    activeOpacity={0.72}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        translationLanguage === option.code &&
                          styles.optionLabelActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {translationLanguage === option.code && (
                      <MaterialIcons name="check" size={16} color="#3d3a52" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Pressable>
        </Modal>

        {(hasChanges || isSaving) && (
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!hasChanges || isSaving) && styles.saveButtonDisabled,
            ]}
            onPress={saveLanguages}
            disabled={isSaving}
            activeOpacity={0.75}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        )}
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
  dropdownCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
  },
  dropdownButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  dropdownBackdrop: {
    flex: 1,
  },
  dropdownMenuPortal: {
    position: "absolute",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d8d8df",
    overflow: "hidden",
    zIndex: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
  dropdownOption: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderTopWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ebebef",
    borderBottomColor: "#ebebef",
  },
  dropdownOptionSelected: {
    backgroundColor: "#f7f9ff",
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
  optionTitle: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionFlag: {
    fontSize: 18,
    lineHeight: 22,
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
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3d3a52",
    marginTop: 22,
    width: 80,
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
