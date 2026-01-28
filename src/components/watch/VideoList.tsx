import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { RootState, VideoContext } from '../../types';
import { WATCH_CLIPS } from '../../data/question_clips';
import { setAllChannels, setAllVideos, setCurrentTab, setCurrentVideo } from '../../store/actions/dataActions';
import { useDispatch, useSelector } from 'react-redux';
import { BACKEND_BASE_URL } from '../streaming_helpers';
import { supabase } from '../../../utils/supabase'
import { useNavigation } from '@react-navigation/native';

const VideoList: React.FC = () => {
  const dispatch = useDispatch();
  const [loadingVideo, setLoadingVideo] = useState(false);

  const allChannels = useSelector((state: RootState) => state.allChannels);
  const allVideos = useSelector((state: RootState) => state.allVideos);
  const navigation = useNavigation();
  
  useEffect(() => {
    fetchAllVideos().then(({ channelData, videoData }) => {
      dispatch(setAllChannels(channelData));
      dispatch(setAllVideos(videoData));
    })
  }, [])

  const fetchAllVideos = async () => {
    const { data: channelData, error: channelError } = await supabase.from('channel').select('*')
    if (channelError) console.error(channelError)
    const { data: videoData, error: videoError } = await supabase.from('video').select('*')
    if (videoError) console.error(videoError)
    return { channelData, videoData }
  }
  
  const handleWatchPress = async (videoId: string) => {
    setLoadingVideo(true);
    const response = await fetch(`${BACKEND_BASE_URL}/video-segments/${videoId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error('Failed to get initial message');
    }
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    const video: VideoContext = {
      videoId: data.video_id,
      currentSegment: 0,
      segments: data.segments,
    };
    dispatch(setCurrentVideo(video));
    dispatch(setCurrentTab('watch'));
    navigation.navigate('Watch' as never);
    setLoadingVideo(false);
  }; 

  return (
    <ScrollView style={styles.container}>
      {allChannels.map((channel) => {
        const channelVideos = allVideos.filter((video) => video.channel_id === channel.channel_id);
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
                  <Text >{channel.difficulty}</Text>
                  <Text >{channel.topic}</Text>
                  <Text >{channelVideos.length} videos available</Text>
                </View>
              </View>
            </View>

            {/* Horizontal Video List */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.videoScrollContent}
            >
              {channelVideos.map((video) => (
                <TouchableOpacity
                  key={video.video_id}
                  style={styles.videoItem}
                  onPress={() => handleWatchPress(video.video_id)}
                  disabled={loadingVideo}
                >
                  <Image
                    source={{ uri: video.thumbnail_url }}
                    style={styles.videoThumbnail}
                  />
                  <Text style={styles.videoTitle} numberOfLines={2}>
                    {video.title}
                  </Text>
                </TouchableOpacity>
                
              ))}
              
            </ScrollView>
          </View>
        );
      })}
    </ScrollView>
  );
};

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  channelContainer: {
    marginBottom: 2,
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  channelThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 100,
    marginRight: 10,
  },
  channelTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'black',
    flexShrink: 1
  },
  channelBadges: {
    alignItems: 'flex-start',
    marginTop: 4,
    gap: 2,
  },
  channelInfo: {
    flex: 1,
    paddingRight: 8,
  },
  videoScrollContent: {
    paddingRight: 16,
  },
  videoItem: {
    width: 320,
    height: 260,
    marginRight: 12,
  },
  videoThumbnail: {
    width: 320,
    height: 180,
    borderRadius: 8,
    marginBottom: 4,
  },
  videoTitle: {
    fontSize: 14,
    color: 'black',
    textAlign: 'left',
    lineHeight: 16,
  },
});

export default VideoList;