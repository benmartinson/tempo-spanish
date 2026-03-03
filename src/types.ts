export interface RootState {
  currentVideo: VideoContext | null;
  currentChatType: "general" | "video-based" | null;
  videoRefreshKey: number;
  currentTab: "home" | "videos" | "watch" | "discuss" | "shadow";
  allChannels: Channel[];
  allVideos: Video[];
  allVocabulary: Record<string, Vocabulary>;
  userKnownVocab: number[];
  userVideoViews: VideoView[];
  currentSearchTerm: string | null;
  currentSearchResults: Segment[];
}

export type DataActionTypes =
  | "SET_CURRENT_VIDEO"
  | "SET_CURRENT_CHAT_TYPE"
  | "SET_NEXT_SEGMENT"
  | "REFRESH_VIDEO_PLAYER"
  | "SET_CURRENT_TAB"
  | "SET_ALL_CHANNELS"
  | "SET_ALL_VIDEOS"
  | "SET_PREVIOUS_SEGMENT"
  | "SET_SENTENCE_BY_TIME"
  | "SET_CURRENT_SENTENCE"
  | "SET_FOCUS_VOCAB"
  | "SET_ALL_VOCABULARY"
  | "SET_USER_KNOWN_VOCAB"
  | "ADD_USER_KNOWN_VOCAB"
  | "SET_USER_VIDEO_VIEWS"
  | "SET_FOCUS_SENTENCES"
  | "ADD_FOCUS_SENTENCE"
  | "SET_CURRENT_SEARCH_TERM"
  | "SET_CURRENT_SEARCH_RESULTS"
  | "ADD_USER_VIDEO_VIEW"
  | "ADD_USER_SELECTED_VOCAB"
  | "REMOVE_FOCUS_SENTENCE";

export interface DataAction extends Record<string, any> {
  type: DataActionTypes;
  payload?: any;
}
export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

export interface Vocabulary {
  id: number;
  word: string;
  translation: string;
  frequency: number;
  percentile: number;
}

export interface FocusSentence {
  id?: number;
  text: string;
  translation: string;
  segment_index: number;
  sentence_index: number;
}

export interface VideoContext {
  videoId: string;
  recordId: string;
  currentSentence: number;
  sentences: Sentence[];
  allWords: SegmentWord[];
  videoViewId: number;
  focusVocab: number[];
  focusSentences: FocusSentence[];
}

export interface Channel {
  channel_id: string;
  title: string;
  thumbnail_url: string;
  topic: string;
  difficulty: string;
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
}

export interface Segment {
  segment_id: number;
  start: number;
  end: number;
  text: string;
  video_id: string;
  full_translation: string;
  words: SegmentWord[];
}

export interface Sentence {
  index: number;
  start: number;
  end: number;
  text: string;
  full_translation: string;
  words: SegmentWord[];
}

export type QuizType = "Comprehension" | "Vocab" | "Uncommon" | "Phrases";

export interface SegmentWord {
  word: string;
  start: number;
  end: number;
  frequency: number;
}

export interface KeyVocabulary {
  value: string;
  translations: string[];
  correct_translation: number;
  start: number;
  end: number;
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

export interface VideoQuestion {
  id: number;
  video_id: number;
  cefr_level: string;
  question: string;
  answer: string;
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

export type EvaluationScore = "correct" | "partial" | "incorrect";

export interface Evaluation {
  feedback: string;
  score: EvaluationScore;
}

export type VocabEvaluationScore = "correct" | "incorrect";

export interface VocabEvaluation {
  score: VocabEvaluationScore;
  acceptedAnswers: string[];
}

export interface TranscriptionResponse {
  transcript: string;
  confidence: number;
  words: TranscriptWord[];
}

/**
 * Accuracy calculation result
 */
export interface AccuracyResult {
  percentage: number;
  matchedWords: number;
  totalWords: number;
  details: {
    targetWord: string;
    matched: boolean;
    spokenWord?: string;
    isProperNoun?: boolean;
  }[];
  spokenSentence: string;
  targetSentence: string;
}

export interface TranscriptWord {
  word: string;
  confidence: number;
}

export interface BackendMessage {
  type: "ready" | "connected" | "transcript" | "metadata" | "error";
  message?: string;
  transcript?: string;
  confidence?: number;
  is_final?: boolean;
  words?: TranscriptWord[];
}

export interface TranscriptCallbacks {
  onReady?: (message: string) => void;
  onConnected?: () => void;
  onTranscript?: (
    transcript: string,
    isFinal: boolean,
    words?: TranscriptWord[],
  ) => void;
  onError?: (message: string) => void;
  onMetadata?: () => void;
}

export interface UserUIState {
  current_video: string | null;
  current_sentence: number;
  current_tab: "watch" | "discuss" | "shadow";
}
