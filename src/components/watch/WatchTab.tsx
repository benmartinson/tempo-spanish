import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Button,
} from 'react-native';
import TopNavBar from '../TopNavBar';
import CardSwiper from '../CardSwiper';
import YouTubePlayer from './YouTubePlayer';
import { Clip } from '../../types';
import { WATCH_CLIPS } from '../../data/question_clips';
import Video from './Video';
import VideoList from './VideoList';

const WatchTab: React.FC = () => {
  const [selectedClip, setSelectedClip] = useState<Clip | null>(WATCH_CLIPS[0]);

  const handleNextVideo = () => {
    const currentIndex = WATCH_CLIPS.findIndex(clip => clip.videoId === selectedClip?.videoId);
    const nextIndex = (currentIndex + 1) % WATCH_CLIPS.length;
    setSelectedClip(WATCH_CLIPS[nextIndex]);
  };

  return (
    <View style={styles.container}>
      {selectedClip ? (
        <Video
          clip={selectedClip}
          onBackButton={() => setSelectedClip(null)}
          onNextButton={handleNextVideo}
        />
      ) : (
        <VideoList/>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
});

  export default WatchTab;
