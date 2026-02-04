export interface RootState {
  currentVideo: VideoContext | null;
  currentChatType: "general" | "video-based" | null;
  videoRefreshKey: number;
  currentTab: "home" | "videos" | "watch" | "discuss" | "shadow";
  allChannels: Channel[];
  allVideos: Video[];
  allVocabulary: Vocabulary[];
  userKnownVocab: number[];
  userVideoViews: VideoView[];
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
  | "SET_SEGMENT_BY_TIME"
  | "SET_FOCUS_VOCAB"
  | "SET_ALL_VOCABULARY"
  | "SET_USER_KNOWN_VOCAB"
  | "ADD_USER_KNOWN_VOCAB"
  | "SET_USER_VIDEO_VIEWS";

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
}

export interface VideoContext {
  videoId: string;
  currentSegment: number;
  segments: Segment[];
  allWords: SegmentWord[];
  videoViewId: string;
  focusVocab: Vocabulary[];
}

export interface Channel {
  channel_id: string;
  title: string;
  thumbnail_url: string;
  topic: string;
  difficulty: string;
}

export interface Video {
  video_id: string;
  id: string;
  topic: string;
  difficulty: string;
  title: string;
  channel_id: string;
  thumbnail_url: string;
}

export interface Segment {
  start: number;
  end: number;
  text: string;
  cefr_level: string;
  key_vocabulary: KeyVocabulary[];
  full_text_translation: string;
  words: SegmentWord[];
}

export interface SegmentWord {
  word: string;
  start: number;
  end: number;
  translation: string;
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
