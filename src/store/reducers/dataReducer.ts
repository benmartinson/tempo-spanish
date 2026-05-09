import {
  RootState,
  DataAction,
  DataActionTypes,
  DEFAULT_USER_SETTINGS,
} from "../../types";

const initialState: RootState = {
  currentVideo: null,
  currentChatType: null,
  videoRefreshKey: Date.now(),
  selectedChannelId: null,
  allChannels: [],
  allTopics: [],
  channelTopics: [],
  allVideos: [],
  userKnownVocab: [],
  userVideoViews: [],
  currentSearchTerm: null,
  currentSearchResults: [],
  isSearching: false,
  hasSearched: false,
  currentShadowTab: "memorize",
  memorizeDifficulty: 0,
  userSettings: DEFAULT_USER_SETTINGS,
  cachedResponses: [],
  userCredits: 0,
  profileModalOpen: false,
  signInScreenOpen: false,
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
          focusVocab: [
            ...state.currentVideo.focusVocab,
            ...action.payload.map((w: string) => ({
              word: w,
              translation: null,
              times_reviewed: 0,
            })),
          ],
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
    case "SET_SELECTED_CHANNEL_ID":
      return {
        ...state,
        selectedChannelId: action.payload,
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
    case "REMOVE_USER_KNOWN_VOCAB": {
      const removeSet = new Set(action.payload);
      return {
        ...state,
        userKnownVocab: state.userKnownVocab.filter(
          (id: number) => !removeSet.has(id),
        ),
      };
    }
    case "REMOVE_USER_SELECTED_VOCAB": {
      if (!state.currentVideo) return state;
      const removeSet = new Set(action.payload);
      return {
        ...state,
        currentVideo: {
          ...state.currentVideo,
          focusVocab: state.currentVideo.focusVocab.filter(
            (v) => !removeSet.has(v.word),
          ),
        },
      };
    }
    case "SET_USER_SETTINGS":
      return {
        ...state,
        userSettings: {
          ...state.userSettings,
          ...action.payload,
        },
      };
    case "SET_CACHED_RESPONSES":
      return {
        ...state,
        cachedResponses: action.payload,
      };
    case "SET_CURRENT_SHADOW_TAB":
      return {
        ...state,
        currentShadowTab: action.payload,
      };
    case "SET_MEMORIZE_DIFFICULTY":
      return {
        ...state,
        memorizeDifficulty: action.payload,
      };
    case "SET_USER_CREDITS":
      return {
        ...state,
        userCredits: action.payload,
      };
    case "UPDATE_FOCUS_VOCAB_TRANSLATION":
      if (!state.currentVideo) return state;
      return {
        ...state,
        currentVideo: {
          ...state.currentVideo,
          focusVocab: state.currentVideo.focusVocab.map((v) =>
            v.word === action.payload.word
              ? { ...v, translation: action.payload.translation }
              : v,
          ),
        },
      };
    case "INCREMENT_FOCUS_VOCAB_REVIEW":
      if (!state.currentVideo) return state;
      return {
        ...state,
        currentVideo: {
          ...state.currentVideo,
          focusVocab: state.currentVideo.focusVocab.map((v) =>
            v.word === action.payload
              ? { ...v, times_reviewed: v.times_reviewed + 1 }
              : v,
          ),
        },
      };
    case "SET_PROFILE_MODAL_OPEN":
      return {
        ...state,
        profileModalOpen: action.payload,
      };
    case "SET_SIGN_IN_SCREEN_OPEN":
      return {
        ...state,
        signInScreenOpen: action.payload,
      };
    default:
      return state;
  }
};

export default dataReducer;
