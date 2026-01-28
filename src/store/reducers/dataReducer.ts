import { RootState, DataAction, DataActionTypes } from '../../types';
import { WATCH_CLIPS } from '../../data/question_clips';

const initialState: RootState = {
  currentVideo: null,
  currentChatType: null,
  videoRefreshKey: Date.now(),
  currentTab: 'home',
  allChannels: [],
  allVideos: [],
}

const dataReducer = (state: RootState = initialState, action: DataAction): RootState => {
  switch(action.type) {
    case 'SET_ALL_CHANNELS':
      return {
        ...state,
        allChannels: action.payload,
      };
    case 'SET_ALL_VIDEOS':
      return {
        ...state,
        allVideos: action.payload,
      };
    case 'SET_CURRENT_VIDEO':
      return {
        ...state,
        currentVideo: action.payload,
        videoRefreshKey: Date.now(),
      };
    case 'SET_NEXT_SEGMENT':
      return {
        ...state,
        currentVideo: {
          ...state.currentVideo,
          currentSegment: state.currentVideo?.currentSegment + 1,
        },
        videoRefreshKey: Date.now(),
      };
    case 'SET_CURRENT_CHAT_TYPE':
      return {
        ...state,
        currentChatType: action.payload,
      };
    case 'REFRESH_VIDEO_PLAYER':
      return {
        ...state,
        videoRefreshKey: Date.now(),
      };
    case 'SET_CURRENT_TAB':
      return {
        ...state,
        currentTab: action.payload,
      };
    default:
      return state;
  }
}

export default dataReducer;