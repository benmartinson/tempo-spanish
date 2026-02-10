import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from "react-native";
import { RootState, VideoContext, Segment } from "../../types";
import { WATCH_CLIPS } from "../../data/question_clips";
import {
  setAllChannels,
  setAllVideos,
  setCurrentTab,
  setCurrentVideo,
} from "../../store/actions/dataActions";
import { useDispatch, useSelector } from "react-redux";
import { BACKEND_BASE_URL } from "../streaming_helpers";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "@clerk/clerk-expo";
import HorizontalVideoScroll from "./HorizontalVideoScroll";
import VideoSectionHeader from "./VideoSectionHeader";

const VideoList: React.FC = () => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const [loadingVideo, setLoadingVideo] = useState(false);

  const allChannels = useSelector((state: RootState) => state.allChannels);
  const allVideos = useSelector((state: RootState) => state.allVideos);
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const userVideoViews = useSelector(
    (state: RootState) => state.userVideoViews,
  );
  const navigation = useNavigation();

  useEffect(() => {
    if (!supabase) return;
    fetchAllVideos().then(({ channelData, videoData }) => {
      dispatch(setAllChannels(channelData));
      dispatch(setAllVideos(videoData));
    });
  }, [supabase]);

  const fetchAllVideos = async () => {
    const { data: channelData, error: channelError } = await supabase
      .from("channel")
      .select("*");
    if (channelError) console.error(channelError);
    const { data: videoData, error: videoError } = await supabase
      .from("video")
      .select("*");
    if (videoError) console.error(videoError);

    return { channelData, videoData };
  };

  const handleWatchPress = async (videoId: string, recordId) => {
    setLoadingVideo(true);
    const response = await fetch(
      `${BACKEND_BASE_URL}/video-segments/${videoId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    if (!response.ok) {
      throw new Error("Failed to get initial message");
    }
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
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
      .select("id");

    if (videoViewError) console.error(videoViewError);

    const videoViewId = videoViewData?.[0]?.id ?? "";
    const { data: focusVocabData, error: focusVocabError } = await supabase
      .from("video_view_focus_vocab")
      .select(
        `
        vocabulary (
          id,
          word,
          translation
        )
      `,
      )
      .eq("video_view_id", videoViewId);

    const focusVocab = (
      focusVocabData?.map((item: any) => item.vocabulary) || []
    ).filter(Boolean);

    const { data: focusSentenceData, error: focusSentenceError } =
      await supabase
        .from("video_view_focus_sentence")
        .select("id, text, translation, segment_index, sentence_index")
        .eq("video_view_id", videoViewId);

    if (focusSentenceError) console.error(focusSentenceError);

    const focusSentences = focusSentenceData ?? [];

    const video: VideoContext = {
      videoId: data.video_id,
      currentSegment: 0,
      segments: data.segments,
      allWords: data.segments.flatMap((s: Segment) => s.words),
      videoViewId: String(videoViewId),
      focusVocab: focusVocab,
      focusSentences: focusSentences,
    };

    dispatch(setCurrentVideo(video));
    dispatch(setCurrentTab("watch"));
    // navigation.navigate("Watch" as never);
    setLoadingVideo(false);
  };

  const recentlyWatchedVideos =
    allVideos?.filter((video) =>
      userVideoViews?.some((videoView) => videoView.video_id === video.id),
    ) ?? [];

  return (
    <ScrollView style={styles.container}>
      {recentlyWatchedVideos.length > 0 && (
        <>
          <VideoSectionHeader title="Recently Watched" isFirst={true} />
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
