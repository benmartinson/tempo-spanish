import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { VideoContext } from '../../types';
import { WATCH_CLIPS } from '../../data/question_clips';
import { setCurrentVideo } from '../../store/actions/dataActions';
import { useDispatch } from 'react-redux';
import { BACKEND_BASE_URL } from '../streaming_helpers';

const VideoList: React.FC = () => {
  const dispatch = useDispatch();
  const [loadingVideo, setLoadingVideo] = useState(false);

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
    setLoadingVideo(false);
  }; 
  
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => handleWatchPress(WATCH_CLIPS[0].videoId)}
        style={styles.button}
      >
        <Text>Inglorious Basterds</Text>
        {loadingVideo && <Text>Loading...</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  button: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default VideoList;