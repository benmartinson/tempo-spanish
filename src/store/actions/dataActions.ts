import {
  CachedResponse,
  Channel,
  ChannelTopic,
  ContentTab,
  DataAction,
  FocusSentence,
  Segment,
  SegmentWord,
  Topic,
  UserSettings,
  AppMode,
  Video,
  VideoContext,
  VideoView,
} from "../../types";

export const removeFocusSentence = (id: number): DataAction => ({
  type: "REMOVE_FOCUS_SENTENCE",
  payload: id,
});

export const setCurrentVideo = (video: VideoContext | null): DataAction => ({
  type: "SET_CURRENT_VIDEO",
  payload: video,
});

export const setCurrentMode = (mode: AppMode): DataAction => ({
  type: "SET_CURRENT_MODE",
  payload: mode,
});

export const setCurrentCompositionId = (
  compositionId: string | number | null,
): DataAction => ({
  type: "SET_CURRENT_COMPOSITION_ID",
  payload: compositionId,
});

export const setSentenceByTime = (time: number): DataAction => ({
  type: "SET_SENTENCE_BY_TIME",
  payload: time,
});

export const setCurrentSentence = (
  sentenceIndex: number | ((prev: number) => number),
): DataAction => ({
  type: "SET_CURRENT_SENTENCE",
  payload: sentenceIndex,
});

export const setCurrentChatType = (
  chatType: "general" | "video-based",
): DataAction => ({
  type: "SET_CURRENT_CHAT_TYPE",
  payload: chatType,
});

export const refreshVideoPlayer = (): DataAction => ({
  type: "REFRESH_VIDEO_PLAYER",
  payload: null,
});

export const setSelectedChannelId = (channelId: string | null): DataAction => ({
  type: "SET_SELECTED_CHANNEL_ID",
  payload: channelId,
});

export const setAllChannels = (channels: Channel[]): DataAction => ({
  type: "SET_ALL_CHANNELS",
  payload: channels,
});

export const setAllTopics = (topics: Topic[]): DataAction => ({
  type: "SET_ALL_TOPICS",
  payload: topics,
});

export const setChannelTopics = (
  channelTopics: ChannelTopic[],
): DataAction => ({
  type: "SET_CHANNEL_TOPICS",
  payload: channelTopics,
});

export const setAllVideos = (videos: Video[]): DataAction => ({
  type: "SET_ALL_VIDEOS",
  payload: videos,
});

export const setFocusVocab = (vocab: SegmentWord[]): DataAction => ({
  type: "SET_FOCUS_VOCAB",
  payload: vocab,
});

export const addUserSelectedVocab = (words: string[]): DataAction => ({
  type: "ADD_USER_SELECTED_VOCAB",
  payload: words,
});

export const updateFocusVocabTranslation = (
  word: string,
  translation: string,
): DataAction => ({
  type: "UPDATE_FOCUS_VOCAB_TRANSLATION",
  payload: { word, translation },
});

export const incrementFocusVocabReview = (word: string): DataAction => ({
  type: "INCREMENT_FOCUS_VOCAB_REVIEW",
  payload: word,
});

export const setCurrentSearchTerm = (term: string): DataAction => ({
  type: "SET_CURRENT_SEARCH_TERM",
  payload: term,
});

export const setCurrentSearchResults = (results: Segment[]): DataAction => ({
  type: "SET_CURRENT_SEARCH_RESULTS",
  payload: results,
});

export const setIsSearching = (isSearching: boolean): DataAction => ({
  type: "SET_IS_SEARCHING",
  payload: isSearching,
});

export const setHasSearched = (hasSearched: boolean): DataAction => ({
  type: "SET_HAS_SEARCHED",
  payload: hasSearched,
});

export const setUserKnownVocab = (vocabIds: number[]): DataAction => ({
  type: "SET_USER_KNOWN_VOCAB",
  payload: vocabIds,
});

export const addUserKnownVocab = (vocabIds: number[]): DataAction => ({
  type: "ADD_USER_KNOWN_VOCAB",
  payload: vocabIds,
});

export const removeUserKnownVocab = (vocabIds: number[]): DataAction => ({
  type: "REMOVE_USER_KNOWN_VOCAB",
  payload: vocabIds,
});

export const removeUserSelectedVocab = (vocabIds: number[]): DataAction => ({
  type: "REMOVE_USER_SELECTED_VOCAB",
  payload: vocabIds,
});

export const setUserVideoViews = (videoViews: VideoView[]): DataAction => ({
  type: "SET_USER_VIDEO_VIEWS",
  payload: videoViews,
});

export const setFocusSentences = (sentences: FocusSentence[]): DataAction => ({
  type: "SET_FOCUS_SENTENCES",
  payload: sentences,
});

export const addUserVideoView = (videoView: VideoView): DataAction => ({
  type: "ADD_USER_VIDEO_VIEW",
  payload: videoView,
});

export const addFocusSentence = (sentence: FocusSentence): DataAction => ({
  type: "ADD_FOCUS_SENTENCE",
  payload: sentence,
});

export const setUserSettings = (settings: UserSettings): DataAction => ({
  type: "SET_USER_SETTINGS",
  payload: settings,
});

export const setCachedResponses = (
  responses: CachedResponse[],
): DataAction => ({
  type: "SET_CACHED_RESPONSES",
  payload: responses,
});

export const setCurrentShadowTab = (tab: ContentTab): DataAction => ({
  type: "SET_CURRENT_SHADOW_TAB",
  payload: tab,
});

export const setMemorizeDifficulty = (difficulty: number): DataAction => ({
  type: "SET_MEMORIZE_DIFFICULTY",
  payload: difficulty,
});

export const setUserCredits = (credits: number): DataAction => ({
  type: "SET_USER_CREDITS",
  payload: credits,
});

export const setProfileModalOpen = (open: boolean): DataAction => ({
  type: "SET_PROFILE_MODAL_OPEN",
  payload: open,
});

export const setSignInScreenOpen = (open: boolean): DataAction => ({
  type: "SET_SIGN_IN_SCREEN_OPEN",
  payload: open,
});
