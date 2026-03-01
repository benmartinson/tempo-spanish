import {
  Channel,
  DataAction,
  FocusSentence,
  Segment,
  SegmentWord,
  Video,
  VideoContext,
  VideoView,
  Vocabulary,
} from "../../types";

export const removeFocusSentence = (id: number): DataAction => ({
  type: "REMOVE_FOCUS_SENTENCE",
  payload: id,
});

export const setCurrentVideo = (video: VideoContext | null): DataAction => ({
  type: "SET_CURRENT_VIDEO",
  payload: video,
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

export const setCurrentTab = (
  tab: "home" | "videos" | "watch" | "discuss" | "shadow",
): DataAction => ({
  type: "SET_CURRENT_TAB",
  payload: tab,
});

export const setAllChannels = (channels: Channel[]): DataAction => ({
  type: "SET_ALL_CHANNELS",
  payload: channels,
});

export const setAllVideos = (videos: Video[]): DataAction => ({
  type: "SET_ALL_VIDEOS",
  payload: videos,
});

export const setFocusVocab = (vocab: SegmentWord[]): DataAction => ({
  type: "SET_FOCUS_VOCAB",
  payload: vocab,
});

export const addUserSelectedVocab = (vocabIds: number[]): DataAction => ({
  type: "ADD_USER_SELECTED_VOCAB",
  payload: vocabIds,
});

export const setCurrentSearchTerm = (term: string): DataAction => ({
  type: "SET_CURRENT_SEARCH_TERM",
  payload: term,
});

export const setCurrentSearchResults = (results: Segment[]): DataAction => ({
  type: "SET_CURRENT_SEARCH_RESULTS",
  payload: results,
});

export const setAllVocabulary = (
  vocab: Record<string, Vocabulary>,
): DataAction => ({
  type: "SET_ALL_VOCABULARY",
  payload: vocab,
});

export const setUserKnownVocab = (vocabIds: number[]): DataAction => ({
  type: "SET_USER_KNOWN_VOCAB",
  payload: vocabIds,
});

export const addUserKnownVocab = (vocabIds: number[]): DataAction => ({
  type: "ADD_USER_KNOWN_VOCAB",
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
