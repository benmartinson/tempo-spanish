import { generateTTS } from "./helpers/streaming_helpers";
import { backendFetch } from "./helpers/backendFetch";
import {
  CachedResponse,
  ContextSegment,
  Segment,
  VocabEvaluation,
  VideoContext,
  VideoView,
  UserUIState,
  UserSettings,
  DEFAULT_USER_SETTINGS,
  ContentTab,
} from "./types";
import { cachedResponses, splitSegmentsIntoSentences } from "./helpers/helpers";
import { setCachedResponses } from "./store/actions/dataActions";

export interface FetchVideoContextParams {
  supabase: any;
  videoId: string;
  recordId: string;
  initialSentence?: number;
  clip?: number;
  userId?: string | null;
}

export interface FetchVideoContextResult {
  videoContext: VideoContext;
  videoView: VideoView;
}

export const fetchVideoContext = async ({
  supabase,
  videoId,
  recordId,
  initialSentence,
  clip,
  userId,
}: FetchVideoContextParams): Promise<FetchVideoContextResult> => {
  const { data: transcriptSegments, error: transcriptSegmentsError } =
    await supabase
      .from("transcript_segment")
      .select("*")
      .eq("video_id", recordId)
      .order("segment_id");

  if (transcriptSegmentsError) {
    console.error(transcriptSegmentsError);
    throw new Error("Failed to fetch transcript segments");
  }

  let videoViewData: any[] | null = null;
  let videoViewId: number = 0;
  let focusVocab: any[] = [];
  let focusSentences: any[] = [];

  // Only track video views and fetch user-specific data when signed in
  if (userId) {
    const { data, error: videoViewError } = await supabase
      .from("video_views")
      .upsert(
        {
          video_id: recordId,
          watched_at: new Date(),
        },
        {
          onConflict: "user_id,video_id",
          ignoreDuplicates: false,
        },
      )
      .select("id, last_sentence_watched, video_id, watched_at");

    if (videoViewError) {
      console.error(videoViewError);
    }

    videoViewData = data;
    videoViewId = videoViewData?.[0]?.id ?? 0;

    const { data: focusVocabData, error: focusVocabError } = await supabase
      .from("video_view_focus_vocab")
      .select("*")
      .eq("video_view_id", videoViewId);

    if (focusVocabError) {
      console.error(focusVocabError);
    }

    focusVocab =
      focusVocabData?.map((v: any) => ({
        word: v.word,
        translation: v.translation ?? null,
        times_reviewed: v.times_reviewed ?? 0,
      })) ?? [];

    const { data: focusSentenceData, error: focusSentenceError } =
      await supabase
        .from("video_view_focus_sentence")
        .select("*")
        .eq("video_view_id", videoViewId);

    if (focusSentenceError) {
      console.error(focusSentenceError);
    }

    focusSentences = focusSentenceData ?? [];
  }

  const sentences = splitSegmentsIntoSentences(transcriptSegments);

  let currentSentence =
    initialSentence ?? videoViewData?.[0]?.last_sentence_watched ?? 0;

  if (clip !== undefined) {
    const clipSentenceIndex = sentences.findIndex(
      (sentence) => clip >= sentence.start && clip <= sentence.end,
    );
    if (clipSentenceIndex !== -1) {
      currentSentence = clipSentenceIndex;
    }
  }

  const videoContext: VideoContext = {
    videoId,
    recordId,
    currentSentence,
    sentences,
    allWords: transcriptSegments.flatMap((s: Segment) => s.words),
    videoViewId,
    focusVocab,
    focusSentences,
  };

  const videoView: VideoView = videoViewData?.[0] as VideoView;

  return { videoContext, videoView };
};

export const fetchVocabTranslation = async ({
  vocabWord,
  sentenceText,
  sentenceTranslation,
}: {
  vocabWord: string;
  sentenceText: string;
  sentenceTranslation?: string | null;
}): Promise<string | null> => {
  const response = await backendFetch("/fetch-vocab-translation", {
    method: "POST",
    body: JSON.stringify({
      vocab_word: vocabWord,
      sentence_text: sentenceText,
      sentence_translation: sentenceTranslation ?? undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error fetching vocab translation: ${response.status}`);
  }

  const data = await response.json();
  return data.translation ?? null;
};

export interface FetchTranslationInsightsParams {
  text: string;
  language: string;
}

export interface TranslationInsightsResult {
  properNouns: string[];
  translation: string | null;
}

export const fetchTranslationInsights = async ({
  text,
  language,
}: FetchTranslationInsightsParams): Promise<TranslationInsightsResult | null> => {
  const response = await backendFetch("/translation-insights", {
    method: "POST",
    body: JSON.stringify({ text, language }),
  });

  if (!response.ok) {
    throw new Error(`Error fetching translation insights: ${response.status}`);
  }

  const data = await response.json();
  return {
    properNouns: data.proper_nouns,
    translation: data.translation,
  };
};

export interface LoadSentenceInsightsParams {
  supabase: any;
  sentenceText: string;
  videoRecordId: string;
  sentenceIndex: number;
  translationLanguage: string;
}

export interface SentenceInsightsResult {
  properNouns: string[];
  translation: string | null;
}

export const loadSentenceInsights = async ({
  supabase,
  sentenceText,
  videoRecordId,
  sentenceIndex,
  translationLanguage,
}: LoadSentenceInsightsParams): Promise<SentenceInsightsResult> => {
  const translationColumn = `translation_${translationLanguage}`;

  // Check Supabase cache first
  const { data: cached, error: cacheError } = (await supabase
    .from("sentence_insights")
    .select(`proper_nouns, ${translationColumn}`)
    .eq("video_id", parseInt(videoRecordId))
    .eq("sentence_index", sentenceIndex)
    .maybeSingle()) as { data: any; error: any };

  if (
    !cacheError &&
    cached &&
    cached.proper_nouns &&
    cached[translationColumn]
  ) {
    return {
      properNouns: cached.proper_nouns,
      translation: cached[translationColumn],
    };
  }
  // Fetch from backend
  const result = await fetchTranslationInsights({
    text: sentenceText,
    language: translationLanguage,
  });

  if (result) {
    // Save to Supabase for future lookups
    await supabase.from("sentence_insights").upsert(
      {
        video_id: parseInt(videoRecordId),
        sentence_index: sentenceIndex,
        proper_nouns: result.properNouns,
        [translationColumn]: result.translation,
      },
      { onConflict: "video_id,sentence_index" },
    );

    return {
      properNouns: result.properNouns ?? [],
      translation: result.translation,
    };
  }

  // Return partial cached data if available
  return {
    properNouns: cached?.proper_nouns ?? [],
    translation: cached?.[translationColumn] ?? null,
  };
};
export interface FetchAllVideosParams {
  supabase: any;
}

export interface FetchAllVideosResult {
  channelData: any[];
  videoData: any[];
  topicData: any[];
  channelTopicData: any[];
}

export const fetchAllVideos = async ({
  supabase,
}: FetchAllVideosParams): Promise<FetchAllVideosResult> => {
  const { data: channelData, error: channelError } = await supabase
    .from("channel")
    .select("*");
  if (channelError) console.error(channelError);

  const { data: videoData, error: videoError } = await supabase
    .from("video")
    .select("*");
  if (videoError) console.error(videoError);

  const { data: topicData, error: topicError } = await supabase
    .from("topic")
    .select("*");
  if (topicError) console.error(topicError);

  const { data: channelTopicData, error: channelTopicError } = await supabase
    .from("channel_topic")
    .select("*");
  if (channelTopicError) console.error(channelTopicError);

  return {
    channelData: channelData ?? [],
    videoData: videoData ?? [],
    topicData: topicData ?? [],
    channelTopicData: channelTopicData ?? [],
  };
};

export interface FetchUserKnownVocabParams {
  supabase: any;
}

export const fetchUserKnownVocab = async ({
  supabase,
}: FetchUserKnownVocabParams): Promise<number[]> => {
  const { data, error } = await supabase
    .from("user_known_vocab")
    .select("vocabulary_id");

  if (error) console.error(error);

  const vocabIds = (data ?? []).map(
    (row: { vocabulary_id: number }) => row.vocabulary_id,
  );
  return vocabIds;
};

export interface FetchUserVideoViewsParams {
  supabase: any;
}

export const fetchUserVideoViews = async ({
  supabase,
}: FetchUserVideoViewsParams): Promise<VideoView[]> => {
  const { data, error } = await supabase
    .from("video_views")
    .select("id, video_id, watched_at");

  if (error) console.error(error);

  const videoViews = (data as VideoView[]) ?? [];
  return videoViews;
};

export interface RestoreUserUIStateParams {
  supabase: any;
  userId: string | null;
}

export interface RestoreUserUIStateResult {
  videoContext: VideoContext | null;
  currentShadowTab: ContentTab;
  memorizeDifficulty: number | null;
  settings: UserSettings;
  hasSeenWelcomeModals: boolean;
}

export const restoreUserUIState = async ({
  supabase,
  userId,
}: RestoreUserUIStateParams): Promise<RestoreUserUIStateResult> => {
  const defaultResult = {
    videoContext: null,
    currentShadowTab: null,
    memorizeDifficulty: null,
    settings: DEFAULT_USER_SETTINGS,
    hasSeenWelcomeModals: false,
  };

  if (!userId) {
    return defaultResult;
  }

  try {
    const { data: uiState, error } = (await supabase
      .from("user_ui_state")
      .select("*")
      .eq("user_id", userId)
      .single()) as { data: UserUIState; error: any };

    if (error) {
      // No existing state is fine, just skip restoration
      if (error.code !== "PGRST116") {
        console.error("Error fetching user UI state:", error);
      }
      return defaultResult;
    }

    const settings: UserSettings = {
      playbackSpeed:
        uiState.playback_speed ?? DEFAULT_USER_SETTINGS.playbackSpeed,
      playbackSpeedDuringRecording:
        uiState.playback_speed_during_recording ??
        DEFAULT_USER_SETTINGS.playbackSpeedDuringRecording,
      showWordsHints:
        uiState.show_word_hints ?? DEFAULT_USER_SETTINGS.showWordsHints,
      showCharacters:
        uiState.show_characters ?? DEFAULT_USER_SETTINGS.showCharacters,
      showStartsOffAs:
        uiState.show_starts_off_as ?? DEFAULT_USER_SETTINGS.showStartsOffAs,
      showPhrases: uiState.show_phrases ?? DEFAULT_USER_SETTINGS.showPhrases,
      targetLanguage:
        uiState.target_language ?? DEFAULT_USER_SETTINGS.targetLanguage,
      translationLanguage:
        uiState.translation_language ??
        DEFAULT_USER_SETTINGS.translationLanguage,
      estimatedHours:
        uiState.estimated_hours ?? DEFAULT_USER_SETTINGS.estimatedHours,
      saveMemorizeDifficulty:
        uiState.save_memorize_difficulty ??
        DEFAULT_USER_SETTINGS.saveMemorizeDifficulty,
      defaultMemorizeDifficulty:
        uiState.default_memorize_difficulty ??
        DEFAULT_USER_SETTINGS.defaultMemorizeDifficulty,
      playVideoWhileRecording:
        uiState.play_video_while_recording ??
        DEFAULT_USER_SETTINGS.playVideoWhileRecording,
      disableReviewMode:
        uiState.disable_review_mode ?? DEFAULT_USER_SETTINGS.disableReviewMode,
      reviewFrequency:
        uiState.review_frequency ?? DEFAULT_USER_SETTINGS.reviewFrequency,
    };

    if (uiState?.current_video) {
      // Fetch the video record to get the video_id string
      const { data: videoRecord, error: videoError } = await supabase
        .from("video")
        .select("video_id")
        .eq("id", uiState.current_video)
        .single();

      if (videoError || !videoRecord) {
        console.error("Error fetching video record:", videoError);
        return {
          ...defaultResult,
          settings,
          currentShadowTab: uiState?.current_shadow_tab ?? null,
          memorizeDifficulty: uiState?.memorize_difficulty ?? null,
          hasSeenWelcomeModals: uiState?.has_seen_welcome_modals ?? false,
        };
      }

      const { videoContext } = await fetchVideoContext({
        supabase,
        videoId: videoRecord.video_id,
        recordId: uiState.current_video,
        initialSentence: uiState.current_sentence ?? 0,
        userId,
      });

      return {
        videoContext,
        currentShadowTab: uiState.current_shadow_tab ?? null,
        memorizeDifficulty: uiState.memorize_difficulty ?? null,
        settings,
        hasSeenWelcomeModals: uiState.has_seen_welcome_modals ?? false,
      };
    }

    return {
      videoContext: null,
      currentShadowTab: uiState?.current_shadow_tab ?? null,
      memorizeDifficulty: uiState?.memorize_difficulty ?? null,
      settings,
      hasSeenWelcomeModals: uiState?.has_seen_welcome_modals ?? false,
    };
  } catch (err) {
    console.error("Error restoring user UI state:", err);
    return defaultResult;
  }
};

export const saveLastSentenceWatched = async ({
  supabase,
  videoViewId,
  currentSentence,
}: {
  supabase: any;
  videoViewId: number;
  currentSentence: number;
}): Promise<void> => {
  if (!supabase || !videoViewId) return;

  const { error } = await supabase
    .from("video_views")
    .update({ last_sentence_watched: currentSentence })
    .eq("id", videoViewId);

  if (error) console.error("Error saving last_sentence_watched:", error);
};

export const persistVideoUnselection = async ({
  supabase,
  userId,
}: {
  supabase: any;
  userId: string | null;
}): Promise<void> => {
  if (!supabase || !userId) return;

  const { error } = await supabase.from("user_ui_state").upsert(
    {
      user_id: userId,
      current_video: null,
      updated_at: new Date(),
    },
    { onConflict: "user_id" },
  );

  if (error) console.error("Error persisting video unselection:", error);
};

export const persistMemorizeDifficulty = async ({
  supabase,
  userId,
  memorizeDifficulty,
}: {
  supabase: any;
  userId: string | null;
  memorizeDifficulty: number;
}): Promise<void> => {
  if (!supabase || !userId) return;

  const { error } = await supabase.from("user_ui_state").upsert(
    {
      user_id: userId,
      memorize_difficulty: memorizeDifficulty,
      updated_at: new Date(),
    },
    { onConflict: "user_id" },
  );

  if (error) console.error("Error persisting memorize difficulty:", error);
};

export const persistCurrentShadowTab = async ({
  supabase,
  userId,
  currentShadowTab,
}: {
  supabase: any;
  userId: string | null;
  currentShadowTab: ContentTab;
}): Promise<void> => {
  if (!supabase || !userId) return;

  const { error } = await supabase.from("user_ui_state").upsert(
    {
      user_id: userId,
      current_shadow_tab: currentShadowTab,
      updated_at: new Date(),
    },
    { onConflict: "user_id" },
  );

  if (error) console.error("Error persisting shadow tab:", error);
};

export const persistUserSettings = async ({
  supabase,
  userId,
  settings,
}: {
  supabase: any;
  userId: string | null;
  settings: Partial<UserSettings>;
}): Promise<void> => {
  if (!supabase || !userId) return;

  const updateData: Record<string, any> = {
    user_id: userId,
    updated_at: new Date(),
  };
  if (settings.playbackSpeed !== undefined)
    updateData.playback_speed = settings.playbackSpeed;
  if (settings.playbackSpeedDuringRecording !== undefined)
    updateData.playback_speed_during_recording =
      settings.playbackSpeedDuringRecording;
  if (settings.showWordsHints !== undefined)
    updateData.show_word_hints = settings.showWordsHints;
  if (settings.showCharacters !== undefined)
    updateData.show_characters = settings.showCharacters;
  if (settings.showStartsOffAs !== undefined)
    updateData.show_starts_off_as = settings.showStartsOffAs;
  if (settings.showPhrases !== undefined)
    updateData.show_phrases = settings.showPhrases;
  if (settings.targetLanguage !== undefined)
    updateData.target_language = settings.targetLanguage;
  if (settings.translationLanguage !== undefined)
    updateData.translation_language = settings.translationLanguage;
  if (settings.estimatedHours !== undefined)
    updateData.estimated_hours = settings.estimatedHours;
  if (settings.saveMemorizeDifficulty !== undefined)
    updateData.save_memorize_difficulty = settings.saveMemorizeDifficulty;
  if (settings.defaultMemorizeDifficulty !== undefined)
    updateData.default_memorize_difficulty = settings.defaultMemorizeDifficulty;
  if (settings.playVideoWhileRecording !== undefined)
    updateData.play_video_while_recording = settings.playVideoWhileRecording;
  if (settings.disableReviewMode !== undefined)
    updateData.disable_review_mode = settings.disableReviewMode;
  if (settings.reviewFrequency !== undefined)
    updateData.review_frequency = settings.reviewFrequency;

  const { error } = await supabase
    .from("user_ui_state")
    .upsert(updateData, { onConflict: "user_id" });

  if (error) console.error("Error persisting settings:", error);
};

export const loadAndCacheTTSResponses = async ({
  supabase,
  dispatch,
}: {
  supabase: any;
  dispatch: any;
}) => {
  const { data: existing, error } = await supabase
    .from("cached_response")
    .select("*");

  if (error) {
    console.error("Error fetching cached responses:", error);
    return;
  }

  const existingMap = new Map<string, CachedResponse>(
    (existing || []).map((r: CachedResponse) => [r.response_text, r]),
  );

  const results: CachedResponse[] = [...(existing || [])];

  for (const responseText of cachedResponses) {
    const record = existingMap.get(responseText);
    if (!record || !record.recording) {
      try {
        const base64 = await generateTTS(responseText);
        const { data, error: upsertError } = await supabase
          .from("cached_response")
          .upsert(
            {
              ...(record?.id ? { id: record.id } : {}),
              response_text: responseText,
              recording: base64,
            },
            { onConflict: "id" },
          )
          .select()
          .single();

        if (upsertError) {
          console.error(
            `Error saving cached response for "${responseText}":`,
            upsertError,
          );
          continue;
        }

        const idx = results.findIndex((r) => r.response_text === responseText);
        if (idx >= 0) results[idx] = data;
        else results.push(data);
      } catch (err) {
        console.error(`Error generating TTS for "${responseText}":`, err);
      }
    }
  }

  dispatch(setCachedResponses(results));
};

export const fetchFocusVocabWithReviewCount = async ({
  supabase,
  videoViewId,
}: {
  supabase: any;
  videoViewId: number;
}): Promise<{ word: string; times_reviewed: number }[]> => {
  const { data, error } = await supabase
    .from("video_view_focus_vocab")
    .select("word, times_reviewed")
    .eq("video_view_id", videoViewId);

  if (error) {
    console.error("Error fetching focus vocab review data:", error);
    return [];
  }

  return (data ?? []).map((v: any) => ({
    word: v.word,
    times_reviewed: v.times_reviewed ?? 0,
  }));
};

export const saveFocusVocabTranslation = async ({
  supabase,
  videoViewId,
  word,
  translation,
}: {
  supabase: any;
  videoViewId: number;
  word: string;
  translation: string;
}) => {
  const { error } = await supabase
    .from("video_view_focus_vocab")
    .update({ translation })
    .eq("video_view_id", videoViewId)
    .eq("word", word);

  if (error) {
    console.error("Error saving focus vocab translation:", error);
  }
};

export const incrementFocusVocabReviewCount = async ({
  supabase,
  videoViewId,
  word,
}: {
  supabase: any;
  videoViewId: number;
  word: string;
}) => {
  const { data: current, error: fetchError } = await supabase
    .from("video_view_focus_vocab")
    .select("times_reviewed")
    .eq("video_view_id", videoViewId)
    .eq("word", word)
    .single();

  if (fetchError) {
    console.error("Error fetching current review count:", fetchError);
    return;
  }

  const { error } = await supabase
    .from("video_view_focus_vocab")
    .update({ times_reviewed: (current?.times_reviewed ?? 0) + 1 })
    .eq("video_view_id", videoViewId)
    .eq("word", word);

  if (error) {
    console.error("Error incrementing focus vocab review count:", error);
  }
};

// ── Credits ──────────────────────────────────────────────────────────

export const fetchUserCredits = async ({
  supabase,
  userId,
}: {
  supabase: any;
  userId: string | null | undefined;
}): Promise<number | null> => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user credits:", error);
    return null;
  }

  if (!data) return null;

  return data.credits;
};

export const initializeUserCredits = async ({
  supabase,
  userId,
  defaultCredits = 100,
}: {
  supabase: any;
  userId: string;
  defaultCredits?: number;
}): Promise<number> => {
  const { data: existing } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing.credits;

  const { data, error } = await supabase
    .from("user_credits")
    .insert({ user_id: userId, credits: defaultCredits })
    .select("credits")
    .single();

  if (error) {
    console.error("Error initializing user credits:", error);
    return 0;
  }

  return data?.credits ?? defaultCredits;
};


