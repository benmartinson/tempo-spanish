export interface UserSettings {
  playbackSpeed: number;
  playbackSpeedDuringRecording: number;
  showWordsHints: boolean;
  showCharacters: boolean;
  showStartsOffAs: boolean;
  showPhrases: boolean;
  targetLanguage: "en" | "es" | "pt";
  translationLanguage: "en" | "es" | "pt";
  estimatedHours: number | null;
  saveMemorizeDifficulty: boolean;
  defaultMemorizeDifficulty: number;
  playVideoWhileRecording: boolean;
  autoSaveRecordings: boolean;
  showSaveRecordingsModal: boolean;
  disableReviewMode: boolean;
  reviewFrequency: number;
}

export type VoiceCommand =
  | "record"
  | "repeat"
  | "slow"
  | "translation"
  | "artificial"
  | "next"
  | "previous"
  | "hint"
  | "hear"
  | "first_phrase"
  | "second_phrase"
  | "third_phrase"
  | "watch_mode"
  | "review_mode"
  | "review_previous"
  | "shadow_mode"
  | "play"
  | "pause"
  | "submit"
  | "add_to"
  | "results"
  | "two_back"
  | "three_back"
  | "five_back"
  | null;

export const DEFAULT_USER_SETTINGS: UserSettings = {
  playbackSpeed: 1,
  playbackSpeedDuringRecording: 0.25,
  showWordsHints: true,
  showCharacters: true,
  showStartsOffAs: true,
  showPhrases: true,
  targetLanguage: "es",
  translationLanguage: "en",
  estimatedHours: null,
  saveMemorizeDifficulty: false,
  defaultMemorizeDifficulty: 0,
  playVideoWhileRecording: true,
  autoSaveRecordings: false,
  showSaveRecordingsModal: true,
  disableReviewMode: false,
  reviewFrequency: 2,
};

export interface CachedResponse {
  id?: number;
  response_text: string;
  recording: string | null;
}

export interface RootState {
  currentVideo: VideoContext | null;
  currentChatType: "general" | "video-based" | null;
  videoRefreshKey: number;
  selectedChannelId: string | null;
  allChannels: Channel[];
  allTopics: Topic[];
  channelTopics: ChannelTopic[];
  allVideos: Video[];
  userKnownVocab: number[];
  userVideoViews: VideoView[];
  currentSearchTerm: string | null;
  currentSearchResults: Segment[];
  isSearching: boolean;
  hasSearched: boolean;
  currentShadowTab: "insights" | "memorize" | "translate" | "voice" | "stream";
  memorizeDifficulty: number;
  userSettings: UserSettings;
  cachedResponses: CachedResponse[];
  userCredits: number;
  hasSeenWelcomeModals: boolean;
}

export type DataActionTypes =
  | "SET_CURRENT_VIDEO"
  | "SET_CURRENT_CHAT_TYPE"
  | "SET_NEXT_SEGMENT"
  | "REFRESH_VIDEO_PLAYER"

  | "SET_ALL_CHANNELS"
  | "SET_ALL_TOPICS"
  | "SET_CHANNEL_TOPICS"
  | "SET_ALL_VIDEOS"
  | "SET_PREVIOUS_SEGMENT"
  | "SET_SENTENCE_BY_TIME"
  | "SET_CURRENT_SENTENCE"
  | "SET_FOCUS_VOCAB"

  | "SET_USER_KNOWN_VOCAB"
  | "ADD_USER_KNOWN_VOCAB"
  | "SET_USER_VIDEO_VIEWS"
  | "SET_FOCUS_SENTENCES"
  | "ADD_FOCUS_SENTENCE"
  | "SET_CURRENT_SEARCH_TERM"
  | "SET_CURRENT_SEARCH_RESULTS"
  | "ADD_USER_VIDEO_VIEW"
  | "ADD_USER_SELECTED_VOCAB"
  | "REMOVE_FOCUS_SENTENCE"
  | "SET_USER_SETTINGS"
  | "SET_IS_SEARCHING"
  | "SET_HAS_SEARCHED"
  | "REMOVE_USER_KNOWN_VOCAB"
  | "REMOVE_USER_SELECTED_VOCAB"
  | "SET_CACHED_RESPONSES"
  | "SET_CURRENT_SHADOW_TAB"
  | "SET_MEMORIZE_DIFFICULTY"
  | "SET_SELECTED_CHANNEL_ID"
  | "SET_USER_CREDITS"
  | "UPDATE_FOCUS_VOCAB_TRANSLATION"
  | "INCREMENT_FOCUS_VOCAB_REVIEW"
  | "SET_HAS_SEEN_WELCOME_MODALS";

export interface DataAction extends Record<string, any> {
  type: DataActionTypes;
  payload?: any;
}
export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

interface SubSegment {
  preview: string;
  start: number;
  end: number;
}

export interface FocusSentence {
  id?: number;
  text: string;
  segment_index: number;
  sentence_index: number;
}

export interface FocusVocabEntry {
  word: string;
  translation: string | null;
  times_reviewed: number;
}

export interface VideoContext {
  videoId: string;
  recordId: string;
  currentSentence: number;
  sentences: Sentence[];
  allWords: SegmentWord[];
  videoViewId: number;
  focusVocab: FocusVocabEntry[];
  focusSentences: FocusSentence[];
}

export interface Channel {
  id: string;
  channel_id: string;
  title: string;
  thumbnail_url: string;
  difficulty: string;
  language: "en" | "es" | "pt";
}

export interface Topic {
  id: number;
  description: string;
}

export interface ChannelTopic {
  channel_id: string;
  topic_id: number;
}

export interface Video {
  clips?: number[];
  video_id: string;
  id: string;
  topic: string;
  difficulty: string;
  title: string;
  channel_id: string;
  thumbnail_url: string;
  duration?: number;
  created_at?: string;
}

export interface Segment {
  segment_id: number;
  start: number;
  end: number;
  text: string;
  video_id: string;
  words: SegmentWord[];
}

export interface Sentence {
  index: number;
  start: number;
  end: number;
  text: string;
  words: SegmentWord[];
}

export type QuizType = "Vocab" | "Phrases";

export interface AutoReviewDetails {
  reviewSegmentId: number;
  quizType: QuizType;
  backToSegmentId: number;
  isVoiceMode?: boolean;
}

export interface AutoShadowDetails {
  backToSegmentId: number;
  isVoiceMode?: boolean;
}

export interface SegmentWord {
  word: string;
  start: number;
  end: number;
  frequency: number;
  isKnown?: boolean;
  contextTranslation?: string;
  vocabularyId?: number;
}


export interface Answer {
  answer: string;
  correct: boolean;
}

export interface VideoView {
  id: number;
  video_id: string;
  watched_at: Date;
}

export interface ContextSegment {
  segment_id: number;
  start: number;
  end: number;
  text: string;
  score: number;
}

export interface VocabQuestion {
  word: string;
  translation: string;
  question: string;
  contextSegments: ContextSegment[];
}

export type VocabEvaluationScore = "correct" | "incorrect";

export interface VocabEvaluation {
  score: VocabEvaluationScore;
  acceptedAnswers: string[];
}

export interface TranscriptionResponse {
  transcript: string;
  confidence: number;
  words: { word: string; confidence: number }[];
}

/**
 * Accuracy calculation result
 */
export interface AccuracyDetail {
  targetWord: string;
  spokenWord?: string;
  matched: boolean;
  isProperNoun: boolean;
  _matchScore?: number;
  _spokenIndex?: number;
}
export interface AccuracyResult {
  percentage: number;
  matchedWords: number;
  totalWords: number;
  details: {
    targetWord: string;
    matched: boolean;
    spokenWord?: string;
    isProperNoun?: boolean;
    _spokenIndex?: number;
    _matchScore?: number;
  }[];
  targetSentence?: string;
}


export interface UserUIState {
  current_video: string | null;
  current_sentence: number;
  current_tab: string | null;
  playback_speed: number | null;
  playback_speed_during_recording: number | null;
  show_word_hints: boolean | null;
  show_characters: boolean | null;
  show_starts_off_as: boolean | null;
  show_phrases: boolean | null;
  target_language: "en" | "es" | "pt" | null;
  translation_language: "en" | "es" | "pt" | null;
  estimated_hours: number | null;
  current_shadow_tab: "insights" | "memorize" | "translate" | "voice" | null;
  memorize_difficulty: number | null;
  save_memorize_difficulty: boolean | null;
  default_memorize_difficulty: number | null;
  play_video_while_recording: boolean | null;
  disable_review_mode: boolean | null;
  review_frequency: number | null;
  has_seen_welcome_modals: boolean | null;
}

export type ContentTab =
  | "insights"
  | "memorize"
  | "translate"
  | "voice"
  | "stream";
