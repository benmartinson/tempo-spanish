export interface Card {
  id: string;
  clip: Clip;
}

export interface RootState {
  currentVideo: Clip | null;
  currentChatType: "general" | "video-based" | null;
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

export interface Clip {
  videoId: string;
  start: number;
  end: number;
}