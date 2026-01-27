import { DataAction, Segment, VideoContext } from '../../types';

export const setCurrentVideo = (video: VideoContext | null): DataAction => ({
  type: 'SET_CURRENT_VIDEO',
  payload: video,
});

export const setNextSegment = (): DataAction => ({
  type: 'SET_NEXT_SEGMENT',
  payload: null,
});

export const setCurrentChatType = (chatType: "general" | "video-based"): DataAction => ({
  type: 'SET_CURRENT_CHAT_TYPE',
  payload: chatType,
});

export const refreshVideoPlayer = (): DataAction => ({
  type: 'REFRESH_VIDEO_PLAYER',
  payload: null,
});

export const setCurrentTab = (tab: 'home' | 'videos' | 'watch' | 'discuss'): DataAction => ({
  type: 'SET_CURRENT_TAB',
  payload: tab,
});
