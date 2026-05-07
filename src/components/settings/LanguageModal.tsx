import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "@clerk/clerk-expo";
import { useSelector, useDispatch } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import SlideModal from "../common/SlideModal";
import { AppLanguage, RootState } from "../../types";
import {
  setAllChannels,
  setAllTopics,
  setAllVideos,
  setChannelTopics,
  setCurrentVideo,
  setSelectedChannelId,
  setTargetLanguage,
  setTranslationLanguage,
  setUserSettings,
} from "../../store/actions/dataActions";
import {
  fetchAllVideos,
  persistUserSettings,
  persistVideoUnselection,
} from "../../requests";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { supabase as rawSupabase } from "../../../lib/supabase";

type LanguageStats = Record<AppLanguage, { channels: number; videos: number }>;

const LANGUAGE_OPTIONS: {
  code: AppLanguage;
  label: string;
  nativeLabel: string;
  flag: string;
}[] = [
  { code: "es", label: "Spanish", nativeLabel: "Espanol", flag: "🇲🇽" },
  { code: "en", label: "English", nativeLabel: "English", flag: "🇺🇸" },
  { code: "pt", label: "Portuguese", nativeLabel: "Portugues", flag: "🇧🇷" },
];

const FALLBACK_LANGUAGE_STATS: LanguageStats = {
  es: { channels: 18, videos: 420 },
  en: { channels: 8, videos: 160 },
  pt: { channels: 6, videos: 120 },
};

const LanguageModal: React.FC<{
  visible: boolean;
  onClose: () => void;
}> = ({ visible, onClose }) => {
  const [draftTarget, setDraftTarget] = useState<AppLanguage>("es");
  const [draftTranslation, setDraftTranslation] =
    useState<AppLanguage>("en");
  const [languageStats, setLanguageStats] = useState<LanguageStats>(
    FALLBACK_LANGUAGE_STATS,
  );
  const [isSaving, setIsSaving] = useState(false);
  const { userId } = useAuth();
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const contentSupabase = supabase ?? rawSupabase;
  const userSettings = useSelector((state: RootState) => state.userSettings);

  useEffect(() => {
    if (!visible) return;
    setDraftTarget(userSettings.targetLanguage);
    setDraftTranslation(userSettings.translationLanguage);
  }, [visible, userSettings.targetLanguage, userSettings.translationLanguage]);

  useEffect(() => {
    if (!visible || !contentSupabase) return;

    let cancelled = false;
    const loadCounts = async () => {
      const { data: channels, error: channelError } = await contentSupabase
        .from("channel")
        .select("channel_id, language");
      const { data: videos, error: videoError } = await contentSupabase
        .from("video")
        .select("channel_id");

      if (cancelled || channelError || videoError) return;

      const nextStats: LanguageStats = {
        en: { channels: 0, videos: 0 },
        es: { channels: 0, videos: 0 },
        pt: { channels: 0, videos: 0 },
      };
      const channelLanguage = new Map<string, AppLanguage>();

      (channels ?? []).forEach(
        (channel: { channel_id: string; language: AppLanguage | null }) => {
          if (!channel.language || !(channel.language in nextStats)) return;
          nextStats[channel.language].channels += 1;
          channelLanguage.set(channel.channel_id, channel.language);
        },
      );

      (videos ?? []).forEach((video: { channel_id: string }) => {
        const language = channelLanguage.get(video.channel_id);
        if (language) nextStats[language].videos += 1;
      });

      setLanguageStats(nextStats);
    };

    loadCounts();
    return () => {
      cancelled = true;
    };
  }, [visible, contentSupabase]);

  const hasChanges = useMemo(
    () =>
      draftTarget !== userSettings.targetLanguage ||
      draftTranslation !== userSettings.translationLanguage,
    [draftTarget, draftTranslation, userSettings],
  );

  const handleSave = async () => {
    if (isSaving) return;

    const targetChanged = draftTarget !== userSettings.targetLanguage;
    const newSettings = {
      ...userSettings,
      targetLanguage: draftTarget,
      translationLanguage: draftTranslation,
    };

    setIsSaving(true);
    try {
      if (targetChanged) {
        await persistVideoUnselection({ supabase, userId: userId ?? null });
        dispatch(setCurrentVideo(null));
        dispatch(setSelectedChannelId(null));
      }

      dispatch(setUserSettings(newSettings));
      dispatch(setTargetLanguage(draftTarget));
      dispatch(setTranslationLanguage(draftTranslation));

      await persistUserSettings({
        supabase,
        userId: userId ?? null,
        settings: {
          targetLanguage: draftTarget,
          translationLanguage: draftTranslation,
        },
      });

      const { channelData, videoData, topicData, channelTopicData } =
        await fetchAllVideos({
          supabase: contentSupabase,
          targetLanguage: draftTarget,
        });
      dispatch(setAllChannels(channelData));
      dispatch(setAllVideos(videoData));
      dispatch(setAllTopics(topicData));
      dispatch(setChannelTopics(channelTopicData));

      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const renderLanguageOption = (
    language: (typeof LANGUAGE_OPTIONS)[number],
    selected: boolean,
    onPress: () => void,
    showStats: boolean,
  ) => {
    const stats = languageStats[language.code];

    return (
      <TouchableOpacity
        key={language.code}
        style={[styles.optionCard, selected && styles.optionCardSelected]}
        onPress={onPress}
        activeOpacity={0.78}
      >
        <View style={styles.optionFlagWrap}>
          <Text style={styles.optionFlag}>{language.flag}</Text>
        </View>
        <View style={styles.optionText}>
          <Text
            style={styles.optionLabel}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {language.label}
            {showStats && (
              <Text style={styles.optionStats}>
                {" "}
                · {stats.videos.toLocaleString()} videos ·{" "}
                {stats.channels.toLocaleString()} channels
              </Text>
            )}
          </Text>
        </View>
        <View style={[styles.checkCircle, selected && styles.checkSelected]}>
          {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SlideModal
      visible={visible}
      onRequestClose={onClose}
      title="Language Settings"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.languageContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Practice Language</Text>
        <View style={styles.optionGroup}>
          {LANGUAGE_OPTIONS.map((language) =>
            renderLanguageOption(
              language,
              draftTarget === language.code,
              () => setDraftTarget(language.code),
              true,
            ),
          )}
        </View>

        <Text style={styles.sectionTitle}>Translation Language</Text>
        <View style={styles.optionGroup}>
          {LANGUAGE_OPTIONS.map((language) =>
            renderLanguageOption(
              language,
              draftTranslation === language.code,
              () => setDraftTranslation(language.code),
              false,
            ),
          )}
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={isSaving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!hasChanges || isSaving) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SlideModal>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#f6f7fb",
  },
  languageContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6f7485",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
    paddingHorizontal: 2,
  },
  optionGroup: {
    gap: 7,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e2e6ef",
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  optionCardSelected: {
    borderColor: "#4a69bd",
    backgroundColor: "#eef3ff",
  },
  optionFlagWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f3f4f8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  optionFlag: {
    fontSize: 20,
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  optionStats: {
    fontSize: 12,
    color: "#8c93a3",
    fontWeight: "600",
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd3e1",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  checkSelected: {
    backgroundColor: "#4a69bd",
    borderColor: "#4a69bd",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#e9ecf3",
  },
  cancelButtonText: {
    color: "#4e5567",
    fontSize: 16,
    fontWeight: "700",
  },
  saveButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#4a69bd",
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default LanguageModal;
