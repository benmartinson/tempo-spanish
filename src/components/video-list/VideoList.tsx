import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
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
import GuidedPractice from "../guided-practice/GuidedPractice";

const VideoList: React.FC = () => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [activeTab, setActiveTab] = useState<"videos" | "guided">("videos");
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
  const targetLanguage = useSelector(
    (state: RootState) => state.userSettings.targetLanguage,
  );

  const targetChannelIds = new Set(
    (allChannels || [])
      .filter((channel) => channel.language === targetLanguage)
      .map((channel) => channel.channel_id),
  );

  const videosForLanguage = allVideos.filter((video) =>
    targetChannelIds.has(video.channel_id),
  );

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

  const recentlyWatchedVideos = videosForLanguage
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
    const channelVideos = allVideos
      .filter((video) => video.channel_id === selectedChannel.channel_id)
      .sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime(),
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
    <View style={styles.outerContainer}>
      {/* <View style={styles.tabBar}>
        {(["videos", "guided"] as const).map((tab, index) => (
          <Pressable
            key={tab}
            style={({ pressed }) => [
              styles.tab,
              index > 0 && styles.tabWithBorder,
              activeTab === tab && styles.tabSelected,
              pressed && { opacity: 0.6 },
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={
                activeTab === tab ? styles.tabTextSelected : styles.tabText
              }
            >
              {tab === "videos" ? "Browse Videos" : "Guided Practice"}
            </Text>
          </Pressable>
        ))}
      </View> */}
      {activeTab === "guided" ? (
        <GuidedPractice />
      ) : (
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
            videos={videosForLanguage}
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
                  const aViews = (userVideoViews || []).filter((v) =>
                    filteredVideos.some(
                      (fv) =>
                        fv.id === v.video_id && fv.channel_id === a.channel_id,
                    ),
                  );
                  const bViews = (userVideoViews || []).filter((v) =>
                    filteredVideos.some(
                      (fv) =>
                        fv.id === v.video_id && fv.channel_id === b.channel_id,
                    ),
                  );
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
                  return bLatest - aLatest;
                });
              return (
                <>
                  <VideoSectionHeader title="All Channels">
                    {filterButton}
                  </VideoSectionHeader>
                  {activeFilterBar}
                  {filteredChannels.map((channel) => {
                    const channelVideos = filteredVideos
                      .filter(
                        (video) => video.channel_id === channel.channel_id,
                      )
                      .sort(
                        (a, b) =>
                          new Date(b.created_at ?? 0).getTime() -
                          new Date(a.created_at ?? 0).getTime(),
                      );
                    return (
                      <View key={channel.id} style={styles.channelContainer}>
                        <TouchableOpacity
                          style={styles.channelHeader}
                          onPress={() => setSelectedChannel(channel)}
                        >
                          <Image
                            source={{ uri: channel.thumbnail_url }}
                            style={styles.channelThumbnail}
                          />
                          <View style={styles.channelInfo}>
                            <Text style={styles.channelTitle}>
                              {channel.title}
                            </Text>
                            <View style={styles.channelBadges}>
                              {(() => {
                                const topicIds = channelTopics
                                  .filter((ct) => ct.channel_id === channel.id)
                                  .map((ct) => ct.topic_id);
                                const topicNames = allTopics
                                  .filter((t) => topicIds.includes(t.id))
                                  .map((t) => t.description);
                                return topicNames.length > 0 ? (
                                  <Text>{topicNames.join(", ")}</Text>
                                ) : null;
                              })()}
                              <Text>
                                {channelVideos.length} videos available
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>

                        <HorizontalVideoScroll
                          videos={channelVideos}
                          handleWatchPress={handleWatchPress}
                          loadingVideo={loadingVideo}
                          onViewAll={() => setSelectedChannel(channel)}
                        />
                      </View>
                    );
                  })}
                </>
              );
            }}
          </FilterVideos>
        </ScrollView>
      )}
    </View>
  );
};

const { width: screenWidth } = Dimensions.get("window");

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "white",
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
    borderBottomWidth: 1,
    borderBottomColor: "#d0d8f0",
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
    marginTop: 6,
    gap: 4,
    opacity: 0.65,
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
