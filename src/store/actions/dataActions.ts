import { DataAction, Clip } from '../../types';

export const setCurrentVideo = (video: Clip | null): DataAction => ({
  type: 'SET_CURRENT_VIDEO',
  payload: video,
});

export const setCurrentChatType = (chatType: "general" | "video-based"): DataAction => ({
  type: 'SET_CURRENT_CHAT_TYPE',
  payload: chatType,
});
