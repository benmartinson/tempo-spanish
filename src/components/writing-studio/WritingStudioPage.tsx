import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { supabase as rawSupabase } from "../../../lib/supabase";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import {
  fetchVideoContext,
  persistCurrentComposition,
  persistHasSeenWelcomeModals,
  persistVideoSelection,
  persistVideoUnselection,
} from "../../requests";
import type { UserComposition } from "../../requests";
import {
  addUserVideoView,
  setCurrentCompositionId,
  setCurrentMode,
  setHasSeenWelcomeModals,
  setCurrentVideo,
} from "../../store/actions/dataActions";
import { isWebScreenWidth } from "../../helpers/helpers";
import type { RootState, Segment } from "../../types";
import ClipMatcher from "./ClipMatcher";
import Composer from "./Composer";
import type { CompositionTemplate } from "./ChooseComposition";
import type { TranscriptPhraseMatch } from "../../requests";
import type { VideoTranscriptSearchResult } from "./VideoTranscriptImport";
import WelcomePanel from "./WelcomePanel";
import { useClipMatcher } from "./useClipMatcher";
import { useCompositionController } from "./useCompositionController";

interface WritingStudioPageProps {
  initialVideoRecordId?: string | null;
}

const findSegmentRangeForClip = (
  segments: Segment[],
  match: TranscriptPhraseMatch,
): { startIndex: number; endIndex: number } => {
  const lastIndex = Math.max(segments.length - 1, 0);
  const clipSegmentIndex = segments.findIndex(
    (segment) => segment.segment_id === match.segmentId,
  );
  const anchorSegmentIndex = segments.findIndex(
    (segment) =>
      match.anchorTime >= segment.start && match.anchorTime <= segment.end,
  );
  const startTimeSegmentIndex = segments.findIndex(
    (segment) => match.start >= segment.start && match.start <= segment.end,
  );
  const targetIndex =
    clipSegmentIndex >= 0
      ? clipSegmentIndex
      : anchorSegmentIndex >= 0
        ? anchorSegmentIndex
        : Math.max(startTimeSegmentIndex, 0);
  const rangeStart = Math.min(targetIndex, Math.max(0, segments.length - 3));
  const rangeEnd = Math.min(lastIndex, rangeStart + 2);

  return {
    startIndex: rangeStart,
    endIndex: rangeEnd,
  };
};

const WritingStudioPage: React.FC<WritingStudioPageProps> = ({
  initialVideoRecordId = null,
}) => {
  const { width } = useWindowDimensions();
  const isWide = isWebScreenWidth(width);
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const { isSignedIn, userId } = useAuth();
  const clerkSupabase = useSupabaseWithClerk();
  const publicSupabase = clerkSupabase ?? rawSupabase;
  const [
    isLoadingInitialVideoComposition,
    setIsLoadingInitialVideoComposition,
  ] = useState(Boolean(initialVideoRecordId));
  const [initialVideoCompositionFailed, setInitialVideoCompositionFailed] =
    useState(false);
  const [isMemorizeFullScreen, setIsMemorizeFullScreen] = useState(false);
  const [isWelcomePanelRequested, setIsWelcomePanelRequested] = useState(false);
  const allVideos = useSelector((state: RootState) => state.allVideos);
  const allChannels = useSelector((state: RootState) => state.allChannels);
  const currentCompositionId = useSelector(
    (state: RootState) => state.currentCompositionId,
  );
  const currentVideoRecordId = useSelector(
    (state: RootState) => state.currentVideo?.recordId ?? null,
  );
  const hasSeenWelcomeModals = useSelector(
    (state: RootState) => state.hasSeenWelcomeModals,
  );
  const targetLanguage = useSelector(
    (state: RootState) => state.userSettings.targetLanguage,
  );
  const targetLanguageRef = useRef(targetLanguage);
  useEffect(() => {
    targetLanguageRef.current = targetLanguage;
  }, [targetLanguage]);

  const channelTitleById = useMemo(
    () =>
      new Map(
        allChannels.map((channel) => [channel.channel_id, channel.title]),
      ),
    [allChannels],
  );
  const targetLanguageVideos = useMemo(() => {
    if (!targetLanguage) return [];

    const channelLanguageById = new Map(
      allChannels.map((channel) => [channel.channel_id, channel.language]),
    );

    return allVideos.filter(
      (video) => channelLanguageById.get(video.channel_id) === targetLanguage,
    );
  }, [allChannels, allVideos, targetLanguage]);

  const composition = useCompositionController({
    allChannels,
    allVideos,
    clerkSupabase,
    isSignedIn: Boolean(isSignedIn),
    targetLanguage,
    userId,
  });
  const [generatedVideoMatchPreview, setGeneratedVideoMatchPreview] =
    useState<TranscriptPhraseMatch | null>(null);
  const transcriptSourceVideo = useMemo(() => {
    if (!composition.transcriptSource) return null;
    return (
      allVideos.find(
        (video) =>
          String(video.id) ===
          String(composition.transcriptSource?.result.videoRecordId),
      ) ?? null
    );
  }, [allVideos, composition.transcriptSource]);
  const localTranscriptVideoKey = useMemo(() => {
    if (!composition.transcriptSource) return "none";

    const range = composition.transcriptSourceSegmentRange;
    return [
      composition.transcriptSource.result.videoRecordId,
      range?.start ?? composition.transcriptSource.startIndex,
      range?.end ?? composition.transcriptSource.endIndex,
    ].join(":");
  }, [composition.transcriptSource, composition.transcriptSourceSegmentRange]);
  const generatedVideoMatchPreviewKey = generatedVideoMatchPreview
    ? [
        generatedVideoMatchPreview.videoRecordId,
        generatedVideoMatchPreview.segmentId,
        generatedVideoMatchPreview.start,
        generatedVideoMatchPreview.end,
      ].join(":")
    : "none";
  const clipMatcherResetKey = useMemo(
    () =>
      [
        currentCompositionId ? String(currentCompositionId) : "none",
        currentVideoRecordId ? String(currentVideoRecordId) : "none",
        localTranscriptVideoKey,
        generatedVideoMatchPreviewKey,
      ].join("|"),
    [
      currentCompositionId,
      currentVideoRecordId,
      generatedVideoMatchPreviewKey,
      localTranscriptVideoKey,
    ],
  );
  const clipMatcher = useClipMatcher({
    activeSearchPhrase: composition.activeSearchPhrase,
    publicSupabase,
    targetLanguageVideos,
    transcriptSourceVideo,
    transcriptSourceSegmentRange: composition.transcriptSourceSegmentRange,
    localClipMatch:
      composition.videoModeClipMatch ?? generatedVideoMatchPreview,
    resetKey: clipMatcherResetKey,
  });
  const shouldShowInitialWelcome =
    Boolean(targetLanguage) && !hasSeenWelcomeModals;
  const showWelcomePanel =
    !generatedVideoMatchPreview &&
    (shouldShowInitialWelcome || isWelcomePanelRequested);
  const selectedMatchBelongsToCurrentVideo = Boolean(
    composition.isVideoMode &&
    clipMatcher.selectedMatch &&
    ((currentVideoRecordId &&
      String(clipMatcher.selectedMatch.videoRecordId) ===
        String(currentVideoRecordId)) ||
      (composition.transcriptSource?.result.videoRecordId &&
        String(clipMatcher.selectedMatch.videoRecordId) ===
          String(composition.transcriptSource.result.videoRecordId))),
  );
  const canStartCanvasWithSelectedPhrase =
    selectedMatchBelongsToCurrentVideo &&
    Boolean(clipMatcher.selectedMatchPhrase.trim());
  const canStartCompositionWithSelectedClip = Boolean(
    clipMatcher.selectedMatch && !selectedMatchBelongsToCurrentVideo,
  );
  const shouldRelayClipPlaybackToMemorizer = !composition.activeSearchPhrase
    .trim()
    .length;
  const secondaryOpenOptionLabel = canStartCanvasWithSelectedPhrase
    ? "Start canvas with the highlighted word/phrase"
    : canStartCompositionWithSelectedClip
      ? "Start a composition with this video segment"
      : undefined;

  useEffect(() => {
    if (!shouldShowInitialWelcome || !clipMatcher.selectedMatch) return;

    dispatch(setHasSeenWelcomeModals(true));
    void persistHasSeenWelcomeModals({
      supabase: clerkSupabase,
      userId,
      hasSeenWelcomeModals: true,
    });
  }, [
    clerkSupabase,
    clipMatcher.selectedMatch,
    dispatch,
    shouldShowInitialWelcome,
    userId,
  ]);

  const markWelcomePanelSeen = useCallback(() => {
    setIsWelcomePanelRequested(false);
    if (hasSeenWelcomeModals) return;

    dispatch(setHasSeenWelcomeModals(true));
    void persistHasSeenWelcomeModals({
      supabase: clerkSupabase,
      userId,
      hasSeenWelcomeModals: true,
    });
  }, [clerkSupabase, dispatch, hasSeenWelcomeModals, userId]);

  const handleBlankCanvas = useCallback(() => {
    markWelcomePanelSeen();
    setGeneratedVideoMatchPreview(null);
    clipMatcher.clearClipMatches();
    composition.handleBlankCanvas();
  }, [clipMatcher, composition, markWelcomePanelSeen]);
  const handleChooseTemplate = useCallback(
    (template: CompositionTemplate) => {
      setIsWelcomePanelRequested(false);
      setGeneratedVideoMatchPreview(null);
      clipMatcher.clearClipMatches();
      composition.handleChooseTemplate(template);
    },
    [clipMatcher, composition],
  );
  const handleChooseSavedComposition = useCallback(
    async (compositionRecord: UserComposition) => {
      setIsWelcomePanelRequested(false);
      setGeneratedVideoMatchPreview(null);
      clipMatcher.clearClipMatches();
      await composition.handleChooseSavedComposition(compositionRecord);
    },
    [clipMatcher, composition],
  );
  const handleQuickRefreshSavedComposition = useCallback(
    async (compositionRecord: UserComposition) => {
      setIsWelcomePanelRequested(false);
      setGeneratedVideoMatchPreview(null);
      clipMatcher.clearClipMatches();
      await composition.handleChooseSavedComposition(compositionRecord);
      composition.setMemorizeDifficultyAndReset(4);
      composition.setMode("memorize");
      setIsMemorizeFullScreen(true);
    },
    [clipMatcher, composition],
  );
  const setSelectedTranscriptVideoContext = useCallback(
    async (result: VideoTranscriptSearchResult) => {
      const requestTargetLanguage = targetLanguageRef.current;
      try {
        const { videoContext, videoView } = await fetchVideoContext({
          supabase: publicSupabase,
          videoId: result.videoId,
          recordId: result.videoRecordId,
          userId,
        });

        if (targetLanguageRef.current !== requestTargetLanguage) return;

        if (userId && videoView) {
          dispatch(addUserVideoView(videoView));
        }
        dispatch(setCurrentVideo(videoContext));
        dispatch(setCurrentMode("compose"));
        await persistVideoSelection({
          supabase: clerkSupabase,
          userId,
          recordId: result.videoRecordId,
          currentSentence: videoContext.currentSentence,
          currentMode: "compose",
        });
      } catch (error) {
        console.error("Error preloading transcript video:", error);
      }
    },
    [clerkSupabase, dispatch, publicSupabase, userId],
  );
  const handleChooseVideoTranscript = useCallback(
    (result: VideoTranscriptSearchResult, segments: Segment[]) => {
      setIsWelcomePanelRequested(false);
      setGeneratedVideoMatchPreview(null);
      clipMatcher.clearClipMatches();
      composition.handleChooseVideoTranscript(result, segments);
      void setSelectedTranscriptVideoContext(result);
    },
    [clipMatcher, composition, setSelectedTranscriptVideoContext],
  );
  const handleChooseVideoTranscriptRange = useCallback(
    (
      result: VideoTranscriptSearchResult,
      segments: Segment[],
      startIndex: number,
      endIndex: number,
    ) => {
      setIsWelcomePanelRequested(false);
      setGeneratedVideoMatchPreview(null);
      clipMatcher.clearClipMatches();
      composition.handleChooseVideoTranscriptRange(
        result,
        segments,
        startIndex,
        endIndex,
      );
      void setSelectedTranscriptVideoContext(result);
    },
    [clipMatcher, composition, setSelectedTranscriptVideoContext],
  );
  const chooseInitialVideoTranscriptRef = useRef(handleChooseVideoTranscript);
  useEffect(() => {
    chooseInitialVideoTranscriptRef.current = handleChooseVideoTranscript;
  }, [handleChooseVideoTranscript]);
  const handleNewComposition = useCallback(() => {
    setIsWelcomePanelRequested(false);
    setGeneratedVideoMatchPreview(null);
    clipMatcher.clearClipMatches();
    setIsMemorizeFullScreen(false);
    composition.handleNewComposition();
    if (initialVideoRecordId) {
      navigation.navigate({
        name: "MainApp",
        params: { compose: true },
        merge: false,
      });
    }
  }, [clipMatcher, composition, initialVideoRecordId, navigation]);
  const handlePreviewVideoMatch = useCallback(
    (match: TranscriptPhraseMatch | null) => {
      setIsWelcomePanelRequested(false);
      setGeneratedVideoMatchPreview(match);
    },
    [],
  );
  const handleStartCanvasWithSelectedPhrase = useCallback(() => {
    const phrase = clipMatcher.selectedMatchPhrase.trim();
    if (!phrase) return;

    setIsWelcomePanelRequested(false);
    setGeneratedVideoMatchPreview(null);
    clipMatcher.clearClipMatches();
    composition.handleBlankCanvas();
    composition.handleDraftChange(phrase);
    dispatch(setCurrentVideo(null));
    dispatch(setCurrentCompositionId(null));
    dispatch(setCurrentMode("compose"));
    void persistVideoUnselection({
      supabase: clerkSupabase,
      userId,
    });
    void persistCurrentComposition({
      supabase: clerkSupabase,
      userId,
      compositionId: null,
    });

    if (initialVideoRecordId) {
      navigation.navigate({
        name: "MainApp",
        params: { compose: true },
        merge: false,
      });
    }
  }, [
    clerkSupabase,
    clipMatcher,
    composition,
    dispatch,
    initialVideoRecordId,
    navigation,
    userId,
  ]);
  const handleStartCompositionWithSelectedClip = useCallback(async () => {
    const match = clipMatcher.selectedMatch;
    if (!match) return;

    try {
      const { data, error } = await publicSupabase
        .from("transcript_segment")
        .select("segment_id,start,end,text,video_id,words")
        .eq("video_id", match.videoRecordId)
        .order("segment_id");

      if (error) {
        console.error("Error loading matched clip transcript:", error);
        return;
      }

      const segments = ((data ?? []) as Segment[]).filter((segment) =>
        Boolean(segment.text?.trim()),
      );
      if (!segments.length) return;

      const range = findSegmentRangeForClip(segments, match);
      const result: VideoTranscriptSearchResult = {
        videoId: match.videoId,
        videoRecordId: match.videoRecordId,
        channelId: match.channelId,
        title: match.title,
        channelTitle: channelTitleById.get(match.channelId) ?? "Tempo channel",
        thumbnailUrl: match.thumbnailUrl,
        matchedSegmentId: match.segmentId,
      };

      setIsWelcomePanelRequested(false);
      setGeneratedVideoMatchPreview(null);
      clipMatcher.clearClipMatches();
      dispatch(setCurrentCompositionId(null));
      void persistCurrentComposition({
        supabase: clerkSupabase,
        userId,
        compositionId: null,
      });
      composition.handleChooseVideoTranscriptRange(
        result,
        segments,
        range.startIndex,
        range.endIndex,
      );
      void setSelectedTranscriptVideoContext(result);

      if (initialVideoRecordId) {
        navigation.navigate({
          name: "MainApp",
          params: { compose: true },
          merge: false,
        });
      }
    } catch (error) {
      console.error("Error starting composition from clip:", error);
    }
  }, [
    channelTitleById,
    clerkSupabase,
    clipMatcher,
    composition,
    dispatch,
    initialVideoRecordId,
    navigation,
    publicSupabase,
    setSelectedTranscriptVideoContext,
    userId,
  ]);
  const handleSecondaryOpenOption = canStartCanvasWithSelectedPhrase
    ? handleStartCanvasWithSelectedPhrase
    : canStartCompositionWithSelectedClip
      ? handleStartCompositionWithSelectedClip
      : undefined;
  const loadedInitialVideoRecordIdRef = useRef<string | null>(null);
  const lastTargetLanguageRef = useRef(targetLanguage);
  useEffect(() => {
    if (lastTargetLanguageRef.current === targetLanguage) return;

    lastTargetLanguageRef.current = targetLanguage;
    loadedInitialVideoRecordIdRef.current = null;
    setIsLoadingInitialVideoComposition(false);
    setInitialVideoCompositionFailed(false);
    setIsMemorizeFullScreen(false);
    setIsWelcomePanelRequested(false);
    clipMatcher.clearClipMatches();
  }, [clipMatcher, targetLanguage]);

  useEffect(() => {
    const normalizedInitialVideoRecordId = initialVideoRecordId
      ? String(initialVideoRecordId)
      : null;

    if (!initialVideoRecordId || !publicSupabase) {
      setIsLoadingInitialVideoComposition(false);
      return;
    }
    if (
      composition.isResolvingCurrentComposition ||
      composition.hasChosenComposition
    ) {
      setIsLoadingInitialVideoComposition(false);
      setInitialVideoCompositionFailed(false);
      return;
    }
    if (
      loadedInitialVideoRecordIdRef.current === normalizedInitialVideoRecordId
    ) {
      setIsLoadingInitialVideoComposition(false);
      return;
    }

    const video = allVideos.find(
      (item) => String(item.id) === String(initialVideoRecordId),
    );
    if (!video) {
      setIsLoadingInitialVideoComposition(!allVideos.length);
      setInitialVideoCompositionFailed(Boolean(allVideos.length));
      return;
    }

    let cancelled = false;
    const requestTargetLanguage = targetLanguageRef.current;
    setInitialVideoCompositionFailed(false);
    setIsLoadingInitialVideoComposition(true);

    const loadInitialVideoTranscript = async () => {
      try {
        const { data, error } = await publicSupabase
          .from("transcript_segment")
          .select("segment_id,start,end,text,video_id,words")
          .eq("video_id", video.id)
          .order("segment_id");

        if (error) {
          console.error("Error loading composition video transcript:", error);
          return;
        }

        const segments = ((data ?? []) as Segment[]).filter((segment) =>
          Boolean(segment.text?.trim()),
        );
        if (cancelled) return;
        if (targetLanguageRef.current !== requestTargetLanguage) return;
        if (!segments.length) {
          setInitialVideoCompositionFailed(true);
          return;
        }

        const channel = allChannels.find(
          (item) => item.channel_id === video.channel_id,
        );
        const result: VideoTranscriptSearchResult = {
          videoId: video.video_id,
          videoRecordId: String(video.id),
          channelId: video.channel_id,
          title: video.title,
          channelTitle: channel?.title ?? "Tempo channel",
          thumbnailUrl: video.thumbnail_url,
          matchedSegmentId: null,
        };

        chooseInitialVideoTranscriptRef.current(result, segments);
        loadedInitialVideoRecordIdRef.current = String(video.id);
      } catch (error) {
        console.error("Error opening video transcript composition:", error);
        if (!cancelled) setInitialVideoCompositionFailed(true);
      } finally {
        if (!cancelled) setIsLoadingInitialVideoComposition(false);
      }
    };

    loadInitialVideoTranscript();

    return () => {
      cancelled = true;
    };
  }, [
    allChannels,
    allVideos,
    composition.hasChosenComposition,
    composition.isResolvingCurrentComposition,
    initialVideoRecordId,
    publicSupabase,
  ]);
  const shouldBypassCompositionChooser = Boolean(
    initialVideoRecordId &&
    !composition.hasChosenComposition &&
    isLoadingInitialVideoComposition &&
    !initialVideoCompositionFailed,
  );
  const isChooseCompositionOpen =
    !composition.hasChosenComposition &&
    !shouldBypassCompositionChooser &&
    !isLoadingInitialVideoComposition &&
    !composition.isResolvingCurrentComposition;
  const composerComposition = useMemo(
    () => ({
      ...composition,
      handleBlankCanvas,
      handleChooseSavedComposition,
      handleChooseTemplate,
      handleChooseVideoTranscript,
      handleChooseVideoTranscriptRange,
      handleNewComposition,
    }),
    [
      composition,
      handleBlankCanvas,
      handleChooseSavedComposition,
      handleChooseTemplate,
      handleChooseVideoTranscript,
      handleChooseVideoTranscriptRange,
      handleNewComposition,
    ],
  );

  const openSelectedVideo = useCallback(async () => {
    const { selectedMatch } = clipMatcher;
    if (!selectedMatch) return;

    const requestTargetLanguage = targetLanguageRef.current;
    try {
      const { videoContext, videoView } = await fetchVideoContext({
        supabase: publicSupabase,
        videoId: selectedMatch.videoId,
        recordId: selectedMatch.videoRecordId,
        clip: selectedMatch.anchorTime,
        userId,
      });

      if (targetLanguageRef.current !== requestTargetLanguage) return;

      if (userId && videoView) {
        dispatch(addUserVideoView(videoView));
      }
      dispatch(setCurrentVideo(videoContext));
      dispatch(setCurrentMode("shadow"));
      await persistVideoSelection({
        supabase: clerkSupabase,
        userId,
        recordId: selectedMatch.videoRecordId,
        currentSentence: videoContext.currentSentence,
        currentMode: "shadow",
      });
    } catch (error) {
      console.error("Error preloading selected clip video:", error);
    }

    navigation.navigate({
      name: "MainApp",
      params: {
        videoId: selectedMatch.videoId,
      },
      merge: false,
    });
  }, [
    clerkSupabase,
    clipMatcher,
    dispatch,
    navigation,
    publicSupabase,
    userId,
  ]);
  const toggleMemorizeFullScreen = useCallback(() => {
    setIsMemorizeFullScreen((prev) => !prev);
  }, []);
  const exitMemorizeFullScreen = useCallback(() => {
    setIsMemorizeFullScreen(false);
  }, []);

  return (
    <View style={styles.page}>
      <View
        style={[
          styles.writeLayout,
          !isWide && styles.writeLayoutNarrow,
          isMemorizeFullScreen && styles.writeLayoutFullScreen,
        ]}
      >
        {!isMemorizeFullScreen && (
          <>
            {showWelcomePanel ? (
              <WelcomePanel />
            ) : (
              <ClipMatcher
                clipMatcher={clipMatcher}
                channelTitleById={channelTitleById}
                resetKey={clipMatcherResetKey}
                hideSegmentTranscript={composition.isVideoMode}
                hideClipNavigation={composition.isVideoMode}
                onOpenSelectedVideo={openSelectedVideo}
                onClearHighlightedWords={composition.clearHighlightedWords}
                onShowWelcomeHelp={
                  isChooseCompositionOpen
                    ? () => setIsWelcomePanelRequested(true)
                    : undefined
                }
                secondaryOpenOptionLabel={secondaryOpenOptionLabel}
                onSecondaryOpenOption={handleSecondaryOpenOption}
              />
            )}
          </>
        )}
        <Composer
          composition={composerComposition}
          isOpeningVideoComposition={
            shouldBypassCompositionChooser || isLoadingInitialVideoComposition
          }
          isMemorizeFullScreen={isMemorizeFullScreen}
          onToggleMemorizeFullScreen={toggleMemorizeFullScreen}
          onExitMemorizeFullScreen={exitMemorizeFullScreen}
          onQuickRefreshSavedComposition={handleQuickRefreshSavedComposition}
          onPreviewVideoMatch={handlePreviewVideoMatch}
          allChannels={allChannels}
          publicSupabase={publicSupabase}
          targetLanguage={targetLanguage}
          targetLanguageVideos={targetLanguageVideos}
          memorizePlaybackTime={
            shouldRelayClipPlaybackToMemorizer ? clipMatcher.playerTime : 0
          }
          memorizePlayerIsPlaying={
            shouldRelayClipPlaybackToMemorizer
              ? clipMatcher.playerIsPlaying
              : false
          }
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  writeLayout: {
    flex: 1,
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    flexDirection: "row",
    gap: 16,
  },
  writeLayoutNarrow: {
    flexDirection: "column-reverse",
  },
  writeLayoutFullScreen: {
    maxWidth: "100%",
  },
});

export default WritingStudioPage;
