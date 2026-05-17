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
import { fetchVideoContext, persistVideoSelection } from "../../requests";
import type { UserComposition } from "../../requests";
import {
  addUserVideoView,
  setCurrentMode,
  setCurrentVideo,
} from "../../store/actions/dataActions";
import { isWebScreenWidth } from "../../helpers/helpers";
import type { RootState, Segment } from "../../types";
import ClipMatcher from "./ClipMatcher";
import Composer from "./Composer";
import type { CompositionTemplate } from "./ChooseComposition";
import type { VideoTranscriptSearchResult } from "./VideoTranscriptImport";
import { useClipMatcher } from "./useClipMatcher";
import { useCompositionController } from "./useCompositionController";

interface WritingStudioPageProps {
  initialVideoRecordId?: string | null;
}

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
  const allVideos = useSelector((state: RootState) => state.allVideos);
  const allChannels = useSelector((state: RootState) => state.allChannels);
  const currentCompositionId = useSelector(
    (state: RootState) => state.currentCompositionId,
  );
  const currentVideoRecordId = useSelector(
    (state: RootState) => state.currentVideo?.recordId ?? null,
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
  const clipMatcherResetKey = useMemo(
    () =>
      [
        currentCompositionId ? String(currentCompositionId) : "none",
        currentVideoRecordId ? String(currentVideoRecordId) : "none",
        localTranscriptVideoKey,
      ].join("|"),
    [currentCompositionId, currentVideoRecordId, localTranscriptVideoKey],
  );
  const clipMatcher = useClipMatcher({
    activeSearchPhrase: composition.activeSearchPhrase,
    publicSupabase,
    targetLanguageVideos,
    transcriptSourceVideo,
    transcriptSourceSegmentRange: composition.transcriptSourceSegmentRange,
    localClipMatch: composition.videoModeClipMatch,
    resetKey: clipMatcherResetKey,
  });

  const handleBlankCanvas = useCallback(() => {
    clipMatcher.clearClipMatches();
    composition.handleBlankCanvas();
  }, [clipMatcher, composition]);
  const handleChooseTemplate = useCallback(
    (template: CompositionTemplate) => {
      clipMatcher.clearClipMatches();
      composition.handleChooseTemplate(template);
    },
    [clipMatcher, composition],
  );
  const handleChooseSavedComposition = useCallback(
    async (compositionRecord: UserComposition) => {
      clipMatcher.clearClipMatches();
      await composition.handleChooseSavedComposition(compositionRecord);
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
      clipMatcher.clearClipMatches();
      composition.handleChooseVideoTranscript(result, segments);
      void setSelectedTranscriptVideoContext(result);
    },
    [clipMatcher, composition, setSelectedTranscriptVideoContext],
  );
  const chooseInitialVideoTranscriptRef = useRef(handleChooseVideoTranscript);
  useEffect(() => {
    chooseInitialVideoTranscriptRef.current = handleChooseVideoTranscript;
  }, [handleChooseVideoTranscript]);
  const handleNewComposition = useCallback(() => {
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
  const loadedInitialVideoRecordIdRef = useRef<string | null>(null);
  const lastTargetLanguageRef = useRef(targetLanguage);
  useEffect(() => {
    if (lastTargetLanguageRef.current === targetLanguage) return;

    lastTargetLanguageRef.current = targetLanguage;
    loadedInitialVideoRecordIdRef.current = null;
    setIsLoadingInitialVideoComposition(false);
    setInitialVideoCompositionFailed(false);
    setIsMemorizeFullScreen(false);
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
  }, [allChannels, allVideos, initialVideoRecordId, publicSupabase]);
  const shouldBypassCompositionChooser = Boolean(
    initialVideoRecordId &&
    !composition.hasChosenComposition &&
    isLoadingInitialVideoComposition &&
    !initialVideoCompositionFailed,
  );
  const composerComposition = useMemo(
    () => ({
      ...composition,
      handleBlankCanvas,
      handleChooseSavedComposition,
      handleChooseTemplate,
      handleChooseVideoTranscript,
      handleNewComposition,
    }),
    [
      composition,
      handleBlankCanvas,
      handleChooseSavedComposition,
      handleChooseTemplate,
      handleChooseVideoTranscript,
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
          <ClipMatcher
            clipMatcher={clipMatcher}
            channelTitleById={channelTitleById}
            resetKey={clipMatcherResetKey}
            hideSegmentTranscript={composition.isVideoMode}
            hideClipNavigation={composition.isVideoMode}
            onOpenSelectedVideo={openSelectedVideo}
            onClearHighlightedWords={composition.clearHighlightedWords}
          />
        )}
        <Composer
          composition={composerComposition}
          isOpeningVideoComposition={
            shouldBypassCompositionChooser || isLoadingInitialVideoComposition
          }
          isMemorizeFullScreen={isMemorizeFullScreen}
          onToggleMemorizeFullScreen={toggleMemorizeFullScreen}
          onExitMemorizeFullScreen={exitMemorizeFullScreen}
          allChannels={allChannels}
          publicSupabase={publicSupabase}
          targetLanguage={targetLanguage}
          targetLanguageVideos={targetLanguageVideos}
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
