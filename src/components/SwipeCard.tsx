import React from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import Animated, { AnimatedStyle } from 'react-native-reanimated';
import YouTubePlayer from './YouTubePlayer';
import { Clip } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
export const CARD_WIDTH = SCREEN_WIDTH * 0.9;
export const CARD_HEIGHT = SCREEN_HEIGHT * 0.65;

interface SwipeCardProps {
  clip: Clip;
  isActive: boolean;
  style?: any;
}

const SwipeCard: React.FC<SwipeCardProps> = ({ clip, isActive, style }) => {
  return (
    <Animated.View style={[styles.card, style]}>
      <YouTubePlayer clip={clip} autoplay={isActive} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
});

export default SwipeCard;
