import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Channel, RootState, Video } from "../../types";
import {
  addUserVideoView,
  setCurrentTab,
  setCurrentVideo,
} from "../../store/actions/dataActions";
import { useDispatch, useSelector } from "react-redux";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useAuth } from "@clerk/clerk-expo";
import HorizontalVideoScroll from "./HorizontalVideoScroll";
import VideoSectionHeader from "./VideoSectionHeader";
import VideoCard from "./VideoCard";
import WordSearch from "./WordSearch";
import { fetchVideoContext, fetchUserVideoViews } from "../../requests";
import { setUserVideoViews } from "../../store/actions/dataActions";
import ChannelVideoList from "./ChannelVideoList";
import FilterVideos from "./FilterVideos";

const VideoList: React.FC = () => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const currentSearchResults = useSelector(
    (state: RootState) => state.currentSearchResults,
  );
  const isSearching = useSelector((state: RootState) => state.isSearching);
  const hasSearched = useSelector((state: RootState) => state.hasSearched);
  const allChannels = useSelector((state: RootState) => state.allChannels);
  const allTopics = useSelector((state: RootState) => state.allTopics);
  const channelTopics = useSelector((state: RootState) => state.channelTopics);
  const allVideos = useSelector((state: RootState) => state.allVideos);
  const userVideoViews = useSelector(
    (state: RootState) => state.userVideoViews,
  );
  const currentVideo = useSelector((state: RootState) => state.currentVideo);

  useEffect(() => {
    fetchUserVideoViews({ supabase }).then((videoViews) => {
      dispatch(setUserVideoViews(videoViews));
    });
  }, [currentVideo]);
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
    setLoadingVideo(true);
    try {
      const { videoContext, videoView } = await fetchVideoContext({
        supabase,
        videoId,
        recordId,
        clip,
      });

      dispatch(addUserVideoView(videoView));
      dispatch(setCurrentVideo(videoContext));
      dispatch(setCurrentTab("shadow"));

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

  const recentlyWatchedVideos = allVideos
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
    );

  if (selectedChannel) {
    const channelVideos = allVideos.filter(
      (video) => video.channel_id === selectedChannel.channel_id,
    );
    return (
      <ChannelVideoList
        channel={selectedChannel}
        videos={channelVideos}
        handleWatchPress={handleWatchPress}
        loadingVideo={loadingVideo}
        onBack={() => setSelectedChannel(null)}
      />
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* <WordSearch /> */}

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
          />
        </>
      )}
      {/* <VideoSectionHeader title="Recommended" /> */}
      <FilterVideos
        videos={allVideos}
        mode="topics"
        topics={allTopics}
        channelTopics={channelTopics}
        channels={allChannels}
      >
        {({ filteredVideos, filterButton, activeFilterBar }) => {
          return (
            <>
              <VideoSectionHeader title="All Channels">
                {filterButton}
              </VideoSectionHeader>
              {activeFilterBar}
              <View style={styles.allVideosList}>
                {filteredVideos.map((video) => {
                  const channel = allChannels?.find(
                    (c) => c.channel_id === video.channel_id,
                  );
                  return (
                    <VideoCard
                      key={video.id}
                      video={video}
                      channel={channel}
                      onPress={() => handleWatchPress(video.video_id, video.id)}
                      onChannelPress={
                        channel
                          ? () => setSelectedChannel(channel)
                          : undefined
                      }
                      disabled={loadingVideo}
                      fullWidth
                    />
                  );
                })}
              </View>
            </>
          );
        }}
      </FilterVideos>
    </ScrollView>
  );
};

const { width: screenWidth } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    paddingHorizontal: 0,
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
