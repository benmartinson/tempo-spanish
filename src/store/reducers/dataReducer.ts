import { RootState, DataAction, DataActionTypes } from '../../types';
import { WATCH_CLIPS } from '../../data/question_clips';

const initialState: RootState = {
  currentVideo: null,
  currentChatType: null,
  videoRefreshKey: Date.now(),
}

const dataReducer = (state: RootState = initialState, action: DataAction): RootState => {
  switch(action.type) {
    case 'SET_CURRENT_VIDEO':
      return {
        ...state,
        currentVideo: action.payload,
        videoRefreshKey: Date.now(),
      };
    case 'SET_CURRENT_CHAT_TYPE':
      return {
        ...state,
        currentChatType: action.payload,
      };
    default:
      return state;
  }
}

export default dataReducer;