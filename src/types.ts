export interface RootState {
  currentVideo: VideoContext | null;
  currentChatType: "general" | "video-based" | null;
  videoRefreshKey: number;
  currentTab: 'home' | 'videos' | 'watch' | 'discuss';
  allChannels: Channel[];
  allVideos: Video[];
}

export type DataActionTypes = 'SET_CURRENT_VIDEO' | 'SET_CURRENT_CHAT_TYPE' | 'SET_NEXT_SEGMENT' | 'REFRESH_VIDEO_PLAYER' | 'SET_CURRENT_TAB' | 'SET_ALL_CHANNELS' | 'SET_ALL_VIDEOS';

export interface DataAction extends Record<string, any> {
  type: DataActionTypes;
  payload?: any;
}
export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

export interface VideoContext {
  videoId: string;
  currentSegment: number;
  segments: Segment[];
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
}

export interface KeyVocabulary {
  value: string;
  translation: string;
}

export interface Answer {
  answer: string;
  correct: boolean;
}