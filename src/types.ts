export interface RootState {
  currentVideo: VideoContext | null;
  currentChatType: "general" | "video-based" | null;
  videoRefreshKey: number;
}

export type DataActionTypes = 'SET_CURRENT_VIDEO' | 'SET_CURRENT_CHAT_TYPE';

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

export interface Segment {
  start: number;
  end: number;
  text: string;
}