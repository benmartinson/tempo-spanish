import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
} from 'react-native';
import YouTubePlayer from './YouTubePlayer';
import { VideoContext } from '../../types';

interface VideoProps {
  video: VideoContext;
  refreshKey: number;
  onBackButton: () => void;
  // onNextButton: () => void;
}
const Video: React.FC<VideoProps> = ({ video, refreshKey, onBackButton }) => {
  const clip = video.segments[video.currentSegment];
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.button} onPress={onBackButton}>
          <Text style={styles.buttonText}>See All Videos</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.videoContainer}>
        <YouTubePlayer clip={{...clip, videoId: video.videoId}} autoplay={true} refreshKey={refreshKey} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  button: {
    backgroundColor: '#3d3a52',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5a5680',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  videoContainer: {
    height: 230,
    backgroundColor: '#000',
  },
});

export default Video;
