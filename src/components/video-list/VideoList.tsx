import React, { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from "react-native";
import { RootState, Video } from "../../types";
import {
  addUserVideoView,
  setCurrentVideo,
  setSelectedChannelId,
} from "../../store/actions/dataActions";
import { useDispatch, useSelector } from "react-redux";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { supabase as rawSupabase } from "../../../lib/supabase";
import { useAuth } from "@clerk/clerk-expo";
import HorizontalVideoScroll from "./HorizontalVideoScroll";
import VideoSectionHeader from "./VideoSectionHeader";
import { fetchVideoContext, fetchUserVideoViews } from "../../requests";
import { setUserVideoViews } from "../../store/actions/dataActions";
import ChannelVideoList from "./ChannelVideoList";
import ChannelHeader from "./ChannelHeader";
import FilterVideos from "./FilterVideos";
import WelcomeModal from "../common/WelcomeModal";
import { isWebScreenWidth } from "../../helpers/helpers";

interface VideoListProps {
  routeChannelId?: string | null;
  onNavigateHome?: () => void;
  onNavigateChannel?: (channelId: string) => void;
  onNavigateVideo?: (videoId: string) => void;
}

const VideoList: React.FC<VideoListProps> = ({
  routeChannelId = null,
  onNavigateHome,
  onNavigateChannel,
  onNavigateVideo,
}) => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isWebScreen = isWebScreenWidth(width);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const selectedChannelId = useSelector(
    (state: RootState) => state.selectedChannelId,
  );
  const currentSearchResults = useSelector(
    (state: RootState) => state.currentSearchResults,
  );
  const isSearching = useSelector((state: RootState) => state.isSearching);
  const hasSearched = useSelector((state: RootState) => state.hasSearched);
  const allChannels = useSelector((state: RootState) => state.allChannels);
  const effectiveChannelId = isWeb ? routeChannelId : selectedChannelId;
  const selectedChannel =
    allChannels.find((c) => c.channel_id === effectiveChannelId) ?? null;
  const allTopics = useSelector((state: RootState) => state.allTopics);
  const channelTopics = useSelector((state: RootState) => state.channelTopics);
  const allVideos = useSelector((state: RootState) => state.allVideos);
  const targetLanguage = useSelector(
    (state: RootState) => state.userSettings.targetLanguage,
  );
  const userVideoViews = useSelector(
    (state: RootState) => state.userVideoViews,
  );
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const hasSeenWelcomeModals = useSelector(
    (state: RootState) => state.hasSeenWelcomeModals,
  );
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);

  const targetLanguageChannelIds = new Set(
    targetLanguage
      ? (allChannels || [])
          .filter((channel) => channel.language === targetLanguage)
          .map((channel) => channel.channel_id)
      : [],
  );

  const targetLanguageVideos = allVideos.filter((video) =>
    targetLanguageChannelIds.has(video.channel_id),
  );

  useEffect(() => {
    setIsWelcomeModalOpen(!hasSeenWelcomeModals);
  }, [hasSeenWelcomeModals]);

  useEffect(() => {
    if (!supabase) return;
    fetchUserVideoViews({ supabase, userId: userId ?? null }).then(
      (videoViews) => {
        dispatch(setUserVideoViews(videoViews));
      },
    );
  }, [supabase, userId, currentVideo]);
  const videoResults = currentSearchResults.reduce(
    (acc, result) => {
      const video = allVideos.find((video) => video.id === result.video_id);
      if (!video) return acc;
      if (video.id in acc) {
        acc[video.id].clips.push(result.start);
      } else {
        acc[video.id] = {
          ...video,
          clips: [result.start],
        };
      }
      return acc;
    },
    {} as Record<string, Video>,
  );
  const videoResultsArray = Object.values(videoResults);

  const handleWatchPress = async (
    videoId: string,
    recordId: string,
    clip?: number,
  ) => {
    if (isWeb && onNavigateVideo) {
      const selectedVideo = allVideos.find(
        (video) => video.id === recordId || video.video_id === videoId,
      );
      if (selectedVideo) {
        onNavigateVideo(selectedVideo.video_id);
      }
      return;
    }

    setLoadingVideo(true);
    try {
      const { videoContext, videoView } = await fetchVideoContext({
        supabase: rawSupabase,
        videoId,
        recordId,
        clip,
        userId,
      });

      if (userId && videoView) {
        dispatch(addUserVideoView(videoView));
      }
      dispatch(setCurrentVideo(videoContext));
      dispatch(setSelectedChannelId(null));

      // Persist video selection to user_ui_state
      if (supabase && userId) {
        const { error } = await supabase.from("user_ui_state").upsert(
          {
            user_id: userId,
            current_video: recordId,
            current_sentence: videoContext.currentSentence,
            updated_at: new Date(),
          },
          { onConflict: "user_id" },
        );
        if (error) console.error("Error persisting video selection:", error);
      }
    } catch (error) {
      console.error("Error loading video:", error);
    } finally {
      setLoadingVideo(false);
    }
  };

  const handleDismissWelcome = () => {
    setIsWelcomeModalOpen(false);
  };

  const handleChannelPress = (channelId: string) => {
    if (isWeb && onNavigateChannel) {
      onNavigateChannel(channelId);
      return;
    }

    dispatch(setSelectedChannelId(channelId));
  };

  const recentlyWatchedVideos = userId
    ? targetLanguageVideos
        ?.filter((video) =>
          userVideoViews?.some((videoView) => videoView.video_id === video.id),
        )
        .map((video) => {
          const videoView = userVideoViews?.find(
            (videoView) => videoView.video_id === video.id,
          );
          return {
            ...video,
            watched_at: videoView?.watched_at,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime(),
        )
    : [];
  const channelSortIndexById = useMemo(
    () =>
      new Map(
        (allChannels || []).map((channel) => [
          channel.channel_id,
          channel.sort_index ?? Number.MAX_SAFE_INTEGER,
        ]),
      ),
    [allChannels],
  );
  const newReleaseVideos = useMemo(
    () =>
      [...targetLanguageVideos]
        .sort((a, b) => {
          const releaseDiff =
            new Date(b.release_date ?? 0).getTime() -
            new Date(a.release_date ?? 0).getTime();
          if (releaseDiff !== 0) return releaseDiff;
          return (
            (channelSortIndexById.get(a.channel_id) ??
              Number.MAX_SAFE_INTEGER) -
            (channelSortIndexById.get(b.channel_id) ?? Number.MAX_SAFE_INTEGER)
          );
        })
        .slice(0, 8),
    [channelSortIndexById, targetLanguageVideos],
  );

  if (selectedChannel) {
    const channelVideos = allVideos
      .filter((video) => video.channel_id === selectedChannel.channel_id)
      .sort(
        (a, b) =>
          new Date(b.release_date ?? b.created_at ?? 0).getTime() -
          new Date(a.release_date ?? a.created_at ?? 0).getTime(),
      );
    return (
      <ChannelVideoList
        channel={selectedChannel}
        videos={channelVideos}
        handleWatchPress={handleWatchPress}
        loadingVideo={loadingVideo}
        onBack={() => {
          if (isWeb) {
            onNavigateHome?.();
          } else {
            dispatch(setSelectedChannelId(null));
          }
        }}
      />
    );
  }

  if (!targetLanguageVideos?.length) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "white",
        }}
      >
        <ActivityIndicator size="large" color="#5a5680" />
      </View>
    );
  }
  return (
    <View
      style={[styles.outerContainer, isWebScreen && styles.webOuterContainer]}
    >
      <ScrollView
        style={[styles.container, isWebScreen && styles.webContainer]}
        contentContainerStyle={isWebScreen && styles.webContentContainer}
      >
        {isSearching && (
          <View style={styles.searchStatus}>
            <ActivityIndicator size="small" color="#999" />
          </View>
        )}
        {!isSearching && hasSearched && currentSearchResults.length === 0 && (
          <View style={styles.searchStatus}>
            <Text style={styles.emptySearchText}>
              No Clips Found for the Word or Phrase
            </Text>
          </View>
        )}
        {currentSearchResults.length > 0 && (
          <>
            <VideoSectionHeader title="Search Results" />
            <HorizontalVideoScroll
              videos={videoResultsArray}
              handleWatchPress={handleWatchPress}
              loadingVideo={loadingVideo}
              showClips={true}
            />
          </>
        )}
        {recentlyWatchedVideos.length > 0 && (
          <>
            <VideoSectionHeader title="Recently Watched" removeBorderTop />
            <HorizontalVideoScroll
              videos={recentlyWatchedVideos}
              handleWatchPress={handleWatchPress}
              loadingVideo={loadingVideo}
              isChannel={false}
            />
          </>
        )}
        {newReleaseVideos.length > 0 && (
          <>
            <VideoSectionHeader
              title="New Releases"
              removeBorderTop={recentlyWatchedVideos.length === 0}
            />
            <HorizontalVideoScroll
              videos={newReleaseVideos}
              handleWatchPress={handleWatchPress}
              loadingVideo={loadingVideo}
              isChannel={false}
            />
          </>
        )}
        {/* <VideoSectionHeader title="Recommended" /> */}
        <FilterVideos
          videos={targetLanguageVideos}
          mode="topics"
          topics={allTopics}
          channelTopics={channelTopics}
          channels={allChannels}
        >
          {({ filteredVideos, filterButton, activeFilterBar }) => {
            const filteredChannels = (allChannels || [])
              .filter((channel) =>
                filteredVideos.some(
                  (video) => video.channel_id === channel.channel_id,
                ),
              )
              .sort((a, b) => {
                const aViews = userId
                  ? (userVideoViews || []).filter((v) =>
                      filteredVideos.some(
                        (fv) =>
                          fv.id === v.video_id &&
                          fv.channel_id === a.channel_id,
                      ),
                    )
                  : [];
                const bViews = userId
                  ? (userVideoViews || []).filter((v) =>
                      filteredVideos.some(
                        (fv) =>
                          fv.id === v.video_id &&
                          fv.channel_id === b.channel_id,
                      ),
                    )
                  : [];
                const aLatest = aViews.length
                  ? Math.max(
                      ...aViews.map((v) => new Date(v.watched_at).getTime()),
                    )
                  : 0;
                const bLatest = bViews.length
                  ? Math.max(
                      ...bViews.map((v) => new Date(v.watched_at).getTime()),
                    )
                  : 0;
                if (aLatest !== bLatest) return bLatest - aLatest;
                // Tiebreaker: channels with explicit sort_index first (ascending),
                // then anything without sort_index.
                const aSort = (a as any).sort_index ?? Number.MAX_SAFE_INTEGER;
                const bSort = (b as any).sort_index ?? Number.MAX_SAFE_INTEGER;
                return aSort - bSort;
              });
            return (
              <>
                <VideoSectionHeader
                  title="All Channels"
                  removeBorderTop={
                    !recentlyWatchedVideos.length && !newReleaseVideos.length
                  }
                >
                  {filterButton}
                </VideoSectionHeader>
                {activeFilterBar}
                {filteredChannels.map((channel) => {
                  const channelVideos = filteredVideos
                    .filter((video) => video.channel_id === channel.channel_id)
                    .sort(
                      (a, b) =>
                        new Date(
                          b.release_date ?? b.created_at ?? 0,
                        ).getTime() -
                        new Date(a.release_date ?? a.created_at ?? 0).getTime(),
                    );
                  return (
                    <View key={channel.id} style={styles.channelContainer}>
                      <ChannelHeader
                        channel={channel}
                        videoCount={channelVideos.length}
                        onPress={() => handleChannelPress(channel.channel_id)}
                      />

                      <HorizontalVideoScroll
                        videos={channelVideos}
                        handleWatchPress={handleWatchPress}
                        loadingVideo={loadingVideo}
                        onViewAll={() => handleChannelPress(channel.channel_id)}
                      />
                    </View>
                  );
                })}
              </>
            );
          }}
        </FilterVideos>
      </ScrollView>
      <WelcomeModal
        visible={isWelcomeModalOpen}
        onClose={handleDismissWelcome}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  webOuterContainer: {
    backgroundColor: "#f6f8fc",
  },
  tabBar: {
    flexDirection: "row",
    height: 30,
    borderBottomWidth: 1,
    borderBottomColor: "gray",
    backgroundColor: "white",
  },
  tab: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  tabWithBorder: {
    borderLeftWidth: 1,
    borderLeftColor: "gray",
  },
  tabSelected: {
    backgroundColor: "#f0f0f0",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "gray",
  },
  tabTextSelected: {
    fontSize: 14,
    fontWeight: "bold",
    color: "black",
  },
  container: {
    flex: 1,
    backgroundColor: "white",
    paddingHorizontal: 0,
  },
  webContainer: {
    backgroundColor: "#f6f8fc",
  },
  webContentContainer: {
    width: "100%",
    maxWidth: 1320,
    alignSelf: "center",
    paddingTop: 8,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
  },
  allVideosList: {
    gap: 24,
    paddingBottom: 24,
  },
  channelContainer: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#d0d8f0",
  },
  searchStatus: {
    paddingVertical: 12,
    marginBottom: 12,
    alignItems: "center" as const,
  },
  emptySearchText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center" as const,
    paddingHorizontal: 16,
  },
});

export default VideoList;
