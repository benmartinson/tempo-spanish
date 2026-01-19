import React from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import YouTubePlayer from './YouTubePlayer';
import { Clip } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
export const CARD_WIDTH = SCREEN_WIDTH;
export const CARD_HEIGHT = SCREEN_HEIGHT;

interface SwipeCardProps {
  clip: Clip;
  isActive: boolean;
  style?: any;
}

const SwipeCard: React.FC<SwipeCardProps> = ({ clip, isActive, style }) => {
  return (
    <Animated.View style={[styles.card, style]}>
      <View style={styles.videoContainer}>
        <YouTubePlayer clip={clip} autoplay={isActive} />
      </View>
      <View style={styles.contentContainer}>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#ffffff',
  },
  videoContainer: {
    height: 220,
    backgroundColor: '#000',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
});

export default SwipeCard;
