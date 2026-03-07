import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  TextInput,
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
import WordSearch from "./WordSearch";
import { fetchVideoContext, fetchUserVideoViews } from "../../requests";
import { setUserVideoViews } from "../../store/actions/dataActions";
import ChannelVideoList from "./ChannelVideoList";

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
      <WordSearch />

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
          <VideoSectionHeader title="Recently Watched" />
          <HorizontalVideoScroll
            videos={recentlyWatchedVideos}
            handleWatchPress={handleWatchPress}
            loadingVideo={loadingVideo}
          />
        </>
      )}
      {/* <VideoSectionHeader title="Recommended" /> */}
      <VideoSectionHeader title="All Channels" />
      {(allChannels || []).map((channel) => {
        const channelVideos = allVideos.filter(
          (video) => video.channel_id === channel.channel_id,
        );
        return (
          <View key={channel.channel_id} style={styles.channelContainer}>
            {/* Channel Header */}
            <TouchableOpacity
              style={styles.channelHeader}
              onPress={() => setSelectedChannel(channel)}
            >
              <Image
                source={{ uri: channel.thumbnail_url }}
                style={styles.channelThumbnail}
              />
              <View style={styles.channelInfo}>
                <Text style={styles.channelTitle}>{channel.title}</Text>
                <View style={styles.channelBadges}>
                  {channel.topic && <Text>{channel.topic}</Text>}
                  <Text>{channelVideos.length} videos available</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Horizontal Video List */}
            <HorizontalVideoScroll
              videos={channelVideos}
              handleWatchPress={handleWatchPress}
              loadingVideo={loadingVideo}
              onViewAll={() => setSelectedChannel(channel)}
            />
          </View>
        );
      })}
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
  channelContainer: {
    marginBottom: 2,
  },
  channelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  channelThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 100,
    marginRight: 10,
  },
  channelTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "black",
    flexShrink: 1,
  },
  channelBadges: {
    alignItems: "flex-start",
    marginTop: 4,
    gap: 2,
  },
  channelInfo: {
    flex: 1,
    paddingRight: 8,
    paddingTop: 8,
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
