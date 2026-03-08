import { RootState, DataAction, DataActionTypes, DEFAULT_USER_SETTINGS } from "../../types";

const initialState: RootState = {
  currentVideo: null,
  currentChatType: null,
  videoRefreshKey: Date.now(),
  currentTab: "discuss",
  allChannels: [],
  allTopics: [],
  channelTopics: [],
  allVideos: [],
  allVocabulary: {},
  userKnownVocab: [],
  userVideoViews: [],
  currentSearchTerm: null,
  currentSearchResults: [],
  isSearching: false,
  hasSearched: false,
  userSettings: DEFAULT_USER_SETTINGS,
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
    case "SET_ALL_TOPICS":
      return {
        ...state,
        allTopics: action.payload,
      };
    case "SET_CHANNEL_TOPICS":
      return {
        ...state,
        channelTopics: action.payload,
      };
    case "SET_CURRENT_SEARCH_TERM":
      return {
        ...state,
        currentSearchTerm: action.payload,
      };
    case "SET_CURRENT_SEARCH_RESULTS":
      return {
        ...state,
        currentSearchResults: action.payload,
      };
    case "SET_IS_SEARCHING":
      return {
        ...state,
        isSearching: action.payload,
      };
    case "SET_HAS_SEARCHED":
      return {
        ...state,
        hasSearched: action.payload,
      };
    case "SET_USER_VIDEO_VIEWS":
      return {
        ...state,
        userVideoViews: action.payload,
      };
    case "ADD_USER_VIDEO_VIEW":
      return {
        ...state,
        userVideoViews: [...state.userVideoViews, action.payload],
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
          ? {
              ...action.payload,
              currentSentence: action.payload.currentSentence ?? 0,
              focusVocab: action.payload.focusVocab ?? [],
              focusSentences: action.payload.focusSentences ?? [],
            }
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

    case "ADD_USER_SELECTED_VOCAB":
      return {
        ...state,
        currentVideo: {
          ...state.currentVideo,
          focusVocab: [...state.currentVideo.focusVocab, ...action.payload],
        },
      };
    case "SET_FOCUS_SENTENCES":
      if (!state.currentVideo) return state;
      return {
        ...state,
        currentVideo: {
          ...state.currentVideo,
          focusSentences: action.payload,
        },
      };
    case "ADD_FOCUS_SENTENCE":
      if (!state.currentVideo) return state;
      return {
        ...state,
        currentVideo: {
          ...state.currentVideo,
          focusSentences: [
            ...state.currentVideo.focusSentences,
            action.payload,
          ],
        },
      };
    case "REMOVE_FOCUS_SENTENCE":
      if (!state.currentVideo) return state;
      return {
        ...state,
        currentVideo: {
          ...state.currentVideo,
          focusSentences: state.currentVideo.focusSentences.filter(
            (sentence) => sentence.id !== action.payload,
          ),
        },
      };
    case "SET_CURRENT_SENTENCE":
      if (!state.currentVideo) return state;
      const nextSentence =
        typeof action.payload === "function"
          ? action.payload(state.currentVideo.currentSentence)
          : action.payload;
      return {
        ...state,
        currentVideo: {
          ...state.currentVideo,
          currentSentence: nextSentence,
        },
      };
    case "SET_SENTENCE_BY_TIME":
      if (!state.currentVideo) return state;
      let sentenceIndex = state.currentVideo.sentences.findIndex(
        (sentence) =>
          action.payload >= sentence.start && action.payload < sentence.end,
      );

      if (sentenceIndex === -1 && action.payload < 5) {
        sentenceIndex = 0;
      }

      return {
        ...state,
        currentVideo: {
          ...state.currentVideo,
          currentSentence:
            sentenceIndex >= 0
              ? sentenceIndex
              : state.currentVideo.currentSentence,
        },
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
    case "SET_USER_SETTINGS":
      return {
        ...state,
        userSettings: action.payload,
      };
    default:
      return state;
  }
};

export default dataReducer;
