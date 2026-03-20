import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

import { useAuth } from "@clerk/clerk-expo";
import { useSelector, useDispatch } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import SlideModal from "../common/SlideModal";
import { RootState } from "../../types";
import { setUserSettings } from "../../store/actions/dataActions";
import { persistUserSettings, persistVideoUnselection } from "../../requests";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { setCurrentVideo } from "../../store/actions/dataActions";

const LANGUAGE_OPTIONS = [
  { code: "en" as const, label: "English", flag: "🇺🇸" },
  { code: "es" as const, label: "Spanish", flag: "🇲🇽" },
  { code: "pt" as const, label: "Portuguese", flag: "🇧🇷" },
];

const LanguageModal: React.FC<{
  visible: boolean;
  onClose: () => void;
}> = ({ visible, onClose }) => {
  const [targetDropdownOpen, setTargetDropdownOpen] = useState(false);
  const [translationDropdownOpen, setTranslationDropdownOpen] = useState(false);
  const [draftTarget, setDraftTarget] = useState<"en" | "es" | "pt">("es");
  const [draftTranslation, setDraftTranslation] = useState<"en" | "es" | "pt">(
    "en",
  );
  const { userId } = useAuth();
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const userSettings = useSelector((state: RootState) => state.userSettings);

  const onOpen = () => {
    setDraftTarget(userSettings.targetLanguage);
    setDraftTranslation(userSettings.translationLanguage);
    setTargetDropdownOpen(false);
    setTranslationDropdownOpen(false);
  };

  React.useEffect(() => {
    if (visible) onOpen();
  }, [visible]);

  const handleSave = async () => {
    const targetChanged = draftTarget !== userSettings.targetLanguage;
    const newSettings = {
      ...userSettings,
      targetLanguage: draftTarget,
      translationLanguage: draftTranslation,
    };
    if (targetChanged) {
      await persistVideoUnselection({ supabase, userId: userId ?? null });
      dispatch(setCurrentVideo(null));
    }
    dispatch(setUserSettings(newSettings));
    persistUserSettings({
      supabase,
      userId: userId ?? null,
      settings: {
        targetLanguage: draftTarget,
        translationLanguage: draftTranslation,
      },
    });
    onClose();
  };

  const getLangOption = (code: "en" | "es" | "pt") =>
    LANGUAGE_OPTIONS.find((l) => l.code === code)!;

  return (
    <SlideModal
      visible={visible}
      onRequestClose={onClose}
      title="Language Settings"
    >
      <View style={styles.languageContent}>
        <Text style={styles.languageSectionTitle}>Target Language</Text>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => {
            setTargetDropdownOpen(!targetDropdownOpen);
            setTranslationDropdownOpen(false);
          }}
        >
          <Text style={styles.dropdownFlag}>
            {getLangOption(draftTarget).flag}
          </Text>
          <Text style={styles.dropdownLabel}>
            {getLangOption(draftTarget).label}
          </Text>
          <Ionicons
            name={targetDropdownOpen ? "chevron-up" : "chevron-down"}
            size={20}
            color="#888"
          />
        </TouchableOpacity>
        {targetDropdownOpen &&
          LANGUAGE_OPTIONS.map((lang) => (
            <TouchableOpacity
              key={`target-${lang.code}`}
              style={[
                styles.dropdownItem,
                draftTarget === lang.code && styles.dropdownItemSelected,
              ]}
              onPress={() => {
                setDraftTarget(lang.code);
                if (lang.code === draftTranslation) {
                  const other = LANGUAGE_OPTIONS.find(
                    (l) => l.code !== lang.code,
                  );
                  if (other) setDraftTranslation(other.code);
                }
                setTargetDropdownOpen(false);
              }}
            >
              <Text style={styles.languageOptionFlag}>{lang.flag}</Text>
              <Text style={styles.languageOptionLabel}>{lang.label}</Text>
              {draftTarget === lang.code && (
                <Ionicons name="checkmark" size={20} color="#4a90d9" />
              )}
            </TouchableOpacity>
          ))}

        <Text style={[styles.languageSectionTitle, { marginTop: 30 }]}>
          Translation Language
        </Text>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => {
            setTranslationDropdownOpen(!translationDropdownOpen);
            setTargetDropdownOpen(false);
          }}
        >
          <Text style={styles.dropdownFlag}>
            {getLangOption(draftTranslation).flag}
          </Text>
          <Text style={styles.dropdownLabel}>
            {getLangOption(draftTranslation).label}
          </Text>
          <Ionicons
            name={translationDropdownOpen ? "chevron-up" : "chevron-down"}
            size={20}
            color="#888"
          />
        </TouchableOpacity>
        {translationDropdownOpen &&
          LANGUAGE_OPTIONS.filter((lang) => lang.code !== draftTarget).map(
            (lang) => (
              <TouchableOpacity
                key={`translation-${lang.code}`}
                style={[
                  styles.dropdownItem,
                  draftTranslation === lang.code && styles.dropdownItemSelected,
                ]}
                onPress={() => {
                  setDraftTranslation(lang.code);
                  setTranslationDropdownOpen(false);
                }}
              >
                <Text style={styles.languageOptionFlag}>{lang.flag}</Text>
                <Text style={styles.languageOptionLabel}>{lang.label}</Text>
                {draftTranslation === lang.code && (
                  <Ionicons name="checkmark" size={20} color="#4a90d9" />
                )}
              </TouchableOpacity>
            ),
          )}

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SlideModal>
  );
};

const styles = StyleSheet.create({
  languageContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  languageSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#f5f5f7",
    borderWidth: 1,
    borderColor: "#d0d8f0",
  },
  dropdownFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  dropdownLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1a1a2e",
    flex: 1,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#f5f5f7",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  dropdownItemSelected: {
    backgroundColor: "#e8f0fe",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 40,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#f5f5f7",
    borderWidth: 1,
    borderColor: "#d0d8f0",
  },
  cancelButtonText: {
    color: "#1a1a2e",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#4a90d9",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  languageOptionFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageOptionLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1a1a2e",
    flex: 1,
  },
});

export default LanguageModal;
