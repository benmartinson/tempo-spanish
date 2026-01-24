import React from 'react';
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

const VideoList: React.FC = () => {
  return (
    <View style={styles.container}>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default VideoList;