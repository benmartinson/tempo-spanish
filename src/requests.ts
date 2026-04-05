import { BACKEND_BASE_URL, generateTTS } from "./helpers/streaming_helpers";
import {
  CachedResponse,
  ContextSegment,
  Segment,
  VocabEvaluation,
  VideoContext,
  VideoView,
  Vocabulary,
  UserUIState,
  UserSettings,
  DEFAULT_USER_SETTINGS,
} from "./types";
import { cachedResponses, splitSegmentsIntoSentences } from "./helpers/helpers";
import { setCachedResponses } from "./store/actions/dataActions";

export interface FetchVideoContextParams {
  supabase: any;
  videoId: string;
  recordId: string;
  initialSentence?: number;
  clip?: number;
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

  const { data: videoViewData, error: videoViewError } = await supabase
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

  const videoViewId = videoViewData?.[0]?.id ?? "";

  const { data: focusVocabData, error: focusVocabError } = await supabase
    .from("video_view_focus_vocab")
    .select("*")
    .eq("video_view_id", videoViewId);

  if (focusVocabError) {
    console.error(focusVocabError);
  }

  const focusVocab = focusVocabData?.map((v: any) => v.vocabulary_id) ?? [];

  const { data: focusSentenceData, error: focusSentenceError } = await supabase
    .from("video_view_focus_sentence")
    .select("*")
    .eq("video_view_id", videoViewId);

  if (focusSentenceError) {
    console.error(focusSentenceError);
  }

  const focusSentences = focusSentenceData ?? [];
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

export interface EvaluateVocabAnswerParams {
  question: string;
  userAnswer: string;
  contextSegments: { text: string }[];
  vocabWord: string;
  quizType?: "vocab" | "phrase" | "translate";
}

export const evaluateVocabAnswer = async ({
  question,
  userAnswer,
  contextSegments,
  vocabWord,
  quizType = "vocab",
}: EvaluateVocabAnswerParams): Promise<VocabEvaluation | null> => {
  const response = await fetch(`${BACKEND_BASE_URL}/evaluate-vocab-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      user_answer: userAnswer,
      context_segments: contextSegments,
      vocab_word: vocabWord,
      quiz_type: quizType,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error evaluating vocab answer: ${response.status}`);
  }

  const data = await response.json();
  if (data.score && data.accepted_answers) {
    return {
      score: data.score,
      acceptedAnswers: data.accepted_answers,
    };
  }
  return null;
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
  const response = await fetch(`${BACKEND_BASE_URL}/translation-insights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export const evaluateTranslation = async ({
  sentenceText,
  translation,
  translationLanguage,
  userTranslation,
}: {
  sentenceText: string;
  translation: string;
  translationLanguage: string;
  userTranslation: string;
}): Promise<{ score: number } | null> => {
  const response = await fetch(`${BACKEND_BASE_URL}/evaluate-translation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sentence_text: sentenceText,
      translation,
      translation_language: translationLanguage,
      user_translation: userTranslation,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error evaluating translation: ${response.status}`);
  }

  const data = await response.json();
  return { score: data.score };
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

export interface FetchAllVocabularyParams {
  supabase: any;
  targetLanguage: string;
  translationLanguage: string;
}

export const fetchAllVocabulary = async ({
  supabase,
  targetLanguage,
  translationLanguage,
}: FetchAllVocabularyParams): Promise<Vocabulary[]> => {
  let allVocab: Vocabulary[] = [];
  let from = 0;
  const limit = 1000;
  let fetching = true;

  while (fetching) {
    const { data, error } = await supabase
      .from("vocabulary")
      .select("id, word, translation, frequency")
      .eq("from_language", targetLanguage)
      .eq("to_language", translationLanguage)
      .range(from, from + limit - 1);

    if (error) {
      console.error(error);
      fetching = false;
    } else {
      const vocabBatch = (data as Vocabulary[]) ?? [];
      allVocab = [...allVocab, ...vocabBatch];
      if (vocabBatch.length < limit) {
        fetching = false;
      } else {
        from += limit;
      }
    }
  }

  return allVocab;
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
  currentTab: "watch" | "discuss" | "shadow" | "translate" | "speed-run" | null;
  currentShadowTab: "insights" | "memorize" | "translate" | "voice" | null;
  memorizeDifficulty: number | null;
  settings: UserSettings;
}

export const restoreUserUIState = async ({
  supabase,
  userId,
}: RestoreUserUIStateParams): Promise<RestoreUserUIStateResult> => {
  const defaultResult = {
    videoContext: null,
    currentTab: null,
    currentShadowTab: null,
    memorizeDifficulty: null,
    settings: DEFAULT_USER_SETTINGS,
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
      autoSubmit:
        uiState.auto_submit ?? DEFAULT_USER_SETTINGS.autoSubmit,
      autoResults:
        uiState.auto_results ?? DEFAULT_USER_SETTINGS.autoResults,
      saveMemorizeDifficulty:
        uiState.save_memorize_difficulty ?? DEFAULT_USER_SETTINGS.saveMemorizeDifficulty,
      defaultMemorizeDifficulty:
        uiState.default_memorize_difficulty ?? DEFAULT_USER_SETTINGS.defaultMemorizeDifficulty,
      playVideoWhileRecording:
        uiState.play_video_while_recording ?? DEFAULT_USER_SETTINGS.playVideoWhileRecording,
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
        return { ...defaultResult, settings, currentShadowTab: uiState?.current_shadow_tab ?? null, memorizeDifficulty: uiState?.memorize_difficulty ?? null };
      }

      const { videoContext } = await fetchVideoContext({
        supabase,
        videoId: videoRecord.video_id,
        recordId: uiState.current_video,
        initialSentence: uiState.current_sentence ?? 0,
      });

      return {
        videoContext,
        currentTab: uiState.current_tab ?? null,
        currentShadowTab: uiState.current_shadow_tab ?? null,
        memorizeDifficulty: uiState.memorize_difficulty ?? null,
        settings,
      };
    }

    return { videoContext: null, currentTab: uiState?.current_tab, currentShadowTab: uiState?.current_shadow_tab ?? null, memorizeDifficulty: uiState?.memorize_difficulty ?? null, settings };
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

export interface PersistUserUITabParams {
  supabase: any;
  userId: string | null;
  currentTab: "watch" | "discuss" | "shadow" | "translate" | "speed-run" | "recordings";
}

export const persistUserUITab = async ({
  supabase,
  userId,
  currentTab,
}: PersistUserUITabParams): Promise<void> => {
  if (!supabase || !userId) return;

  const { error } = await supabase
    .from("user_ui_state")
    .upsert(
      { user_id: userId, current_tab: currentTab, updated_at: new Date() },
      { onConflict: "user_id" },
    );

  if (error) console.error("Error persisting tab:", error);
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

  const { error } = await supabase
    .from("user_ui_state")
    .upsert(
      { user_id: userId, memorize_difficulty: memorizeDifficulty, updated_at: new Date() },
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
  currentShadowTab: "insights" | "memorize" | "translate" | "voice";
}): Promise<void> => {
  if (!supabase || !userId) return;

  const { error } = await supabase
    .from("user_ui_state")
    .upsert(
      { user_id: userId, current_shadow_tab: currentShadowTab, updated_at: new Date() },
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
    updateData.playback_speed_during_recording = settings.playbackSpeedDuringRecording;
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
