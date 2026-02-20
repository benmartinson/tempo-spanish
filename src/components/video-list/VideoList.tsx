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
} from "react-native";
import {
  RootState,
  VideoContext,
  Segment,
  Video,
  VideoView,
} from "../../types";
import { splitSegmentsIntoSentences } from "../../helpers";
import { WATCH_CLIPS } from "../../data/question_clips";
import {
  addUserVideoView,
  setAllChannels,
  setAllVideos,
  setCurrentSearchResults,
  setCurrentSearchTerm,
  setCurrentTab,
  setCurrentVideo,
  setUserVideoViews,
} from "../../store/actions/dataActions";
import { useDispatch, useSelector } from "react-redux";
import { BACKEND_BASE_URL } from "../streaming_helpers";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";
import HorizontalVideoScroll from "./HorizontalVideoScroll";
import VideoSectionHeader from "./VideoSectionHeader";
import WordSearch from "./WordSearch";

const VideoList: React.FC = () => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const [loadingVideo, setLoadingVideo] = useState(false);
  const currentSearchResults = useSelector(
    (state: RootState) => state.currentSearchResults,
  );
  const allChannels = useSelector((state: RootState) => state.allChannels);
  const allVideos = useSelector((state: RootState) => state.allVideos);
  const userVideoViews = useSelector(
    (state: RootState) => state.userVideoViews,
  );
  const navigation = useNavigation();
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
    const { data: transcriptSegments, error: transcriptSegmentsError } =
      await supabase
        .from("transcript_segment")
        .select("*")
        .eq("video_id", recordId)
        .order("segment_id");

    if (transcriptSegmentsError) console.error(transcriptSegmentsError);

    const { data: videoViewData, error: videoViewError } = await supabase
      .from("video_views")
      .upsert(
        {
          video_id: recordId,
          watched_at: new Date(),
        },
        {
          onConflict: "user_id,video_id",
          ignoreDuplicates: false,
        },
      )
      .select("id, last_sentence_watched, video_id, watched_at");

    if (videoViewError) console.error(videoViewError);

    dispatch(addUserVideoView(videoViewData?.[0] as VideoView));

    const videoViewId = videoViewData?.[0]?.id ?? "";
    const restoredSentence = videoViewData?.[0]?.last_sentence_watched ?? 0;
    const sentences = splitSegmentsIntoSentences(transcriptSegments);

    let clipSentenceOverride = 0;
    if (clip) {
      clipSentenceOverride = sentences.findIndex(
        (sentence) => clip >= sentence.start && clip <= sentence.end,
      );

      if (clipSentenceOverride === -1) {
        clipSentenceOverride = 0;
      }
    }

    const video: VideoContext = {
      videoId: videoId,
      recordId: recordId,
      currentSentence: clip ? clipSentenceOverride : restoredSentence,
      sentences,
      allWords: transcriptSegments.flatMap((s: Segment) => s.words),
      videoViewId: String(videoViewId),
      focusVocab: [],
      focusSentences: [],
    };
    dispatch(setCurrentVideo(video));
    dispatch(setCurrentTab("watch"));

    // Persist video selection to user_ui_state
    if (supabase && userId) {
      const { error } = await supabase.from("user_ui_state").upsert(
        {
          user_id: userId,
          current_video: recordId,
          current_sentence: restoredSentence,
          updated_at: new Date(),
        },
        { onConflict: "user_id" },
      );
      if (error) console.error("Error persisting video selection:", error);
    }

    // navigation.navigate("Watch" as never);
    setLoadingVideo(false);
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

  return (
    <ScrollView style={styles.container}>
      <WordSearch />

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
            <View style={styles.channelHeader}>
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
            </View>

            {/* Horizontal Video List */}
            <HorizontalVideoScroll
              videos={channelVideos}
              handleWatchPress={handleWatchPress}
              loadingVideo={loadingVideo}
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
});

export default VideoList;
