import { RootState, DataAction, DataActionTypes } from "../../types";
import { WATCH_CLIPS } from "../../data/question_clips";

const initialState: RootState = {
  currentVideo: null,
  currentChatType: null,
  videoRefreshKey: Date.now(),
  currentTab: "home",
  allChannels: [],
  allVideos: [],
  allVocabulary: [],
  userKnownVocab: [],
};

const dataReducer = (
  state: RootState = initialState,
  action: DataAction,
): RootState => {
  switch (action.type) {
    case "SET_ALL_CHANNELS":
      return {
        ...state,
        allChannels: action.payload,
      };
    case "SET_ALL_VIDEOS":
      return {
        ...state,
        allVideos: action.payload,
      };
    case "SET_ALL_VOCABULARY":
      return {
        ...state,
        allVocabulary: action.payload,
      };
    case "SET_CURRENT_VIDEO":
      return {
        ...state,
        currentVideo: action.payload
          ? { ...action.payload, focusVocab: action.payload.focusVocab ?? [] }
          : null,
        videoRefreshKey: Date.now(),
      };
    case "SET_FOCUS_VOCAB":
      if (!state.currentVideo) return state;
      return {
        ...state,
        currentVideo: {
          ...state.currentVideo,
          focusVocab: action.payload,
        },
      };
    case "SET_NEXT_SEGMENT":
      return {
        ...state,
        currentVideo: {
          ...state.currentVideo,
          currentSegment: state.currentVideo?.currentSegment + 1,
        },
        videoRefreshKey: Date.now(),
      };
    case "SET_SEGMENT_BY_TIME":
      const index = state.currentVideo?.segments.findIndex(
        (segment) =>
          action.payload >= segment.start && action.payload <= segment.end,
      );

      const currentSegment = index >= 0 ? index : 0;
      return {
        ...state,
        currentVideo: {
          ...state.currentVideo,
          currentSegment: currentSegment,
        },
      };
    case "SET_PREVIOUS_SEGMENT":
      return {
        ...state,
        currentVideo: {
          ...state.currentVideo,
          currentSegment: state.currentVideo?.currentSegment - 1,
        },
        videoRefreshKey: Date.now(),
      };
    case "SET_CURRENT_CHAT_TYPE":
      return {
        ...state,
        currentChatType: action.payload,
      };
    case "REFRESH_VIDEO_PLAYER":
      return {
        ...state,
        videoRefreshKey: Date.now(),
      };
    case "SET_CURRENT_TAB":
      return {
        ...state,
        currentTab: action.payload,
      };
    case "SET_USER_KNOWN_VOCAB":
      return {
        ...state,
        userKnownVocab: action.payload,
      };
    case "ADD_USER_KNOWN_VOCAB":
      return {
        ...state,
        userKnownVocab: [...state.userKnownVocab, ...action.payload],
      };
    default:
      return state;
  }
};

export default dataReducer;
