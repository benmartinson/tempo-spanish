import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import SwipeCard, { CARD_WIDTH, CARD_HEIGHT } from './SwipeCard';
import { Card } from '../types';
import { QUESTION_CLIPS } from '../data/question_clips';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;
const ROTATION_ANGLE = 15;

const CARDS_DATA: Card[] = QUESTION_CLIPS.map((clip) => ({
  id: clip.videoId,
  clip,
}));

const CardSwiper: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const handleSwipeComplete = useCallback((direction: 'left' | 'right') => {
    setCurrentIndex((prev) => (prev + 1) % CARDS_DATA.length);
    translateX.value = 0;
    translateY.value = 0;
  }, []);

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      if (Math.abs(translateX.value) > SWIPE_THRESHOLD) {
        // Swipe off screen
        const direction = translateX.value > 0 ? 'right' : 'left';
        const targetX = direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
        
        translateX.value = withTiming(targetX, { duration: 300 }, () => {
          runOnJS(handleSwipeComplete)(direction);
        });
        translateY.value = withTiming(event.translationY * 2, { duration: 300 });
      } else {
        // Spring back to center
        translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    });

  const topCardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-ROTATION_ANGLE, 0, ROTATION_ANGLE],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ] as any,
    };
  });

  const nextCardStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [0.95, 1],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [0.7, 1],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const thirdCardStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [0.9, 0.95],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [0.5, 0.7],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const getVisibleCards = () => {
    const cards = [];
    for (let i = 0; i < 3; i++) {
      const index = (currentIndex + i) % CARDS_DATA.length;
      cards.push(CARDS_DATA[index]);
    }
    return cards;
  };

  const visibleCards = getVisibleCards();

  return (
    <View style={styles.container}>
      <View style={styles.cardContainer}>
        {visibleCards.slice().reverse().map((card, reversedIndex) => {
          const actualIndex = visibleCards.length - 1 - reversedIndex;
          const isTopCard = actualIndex === 0;
          const isSecondCard = actualIndex === 1;
          const isThirdCard = actualIndex === 2;

          let cardStyle;
          if (isTopCard) {
            cardStyle = topCardStyle;
          } else if (isSecondCard) {
            cardStyle = nextCardStyle;
          } else if (isThirdCard) {
            cardStyle = thirdCardStyle;
          }

          const cardContent = (
            <SwipeCard
              key={card.id}
              clip={card.clip}
              isActive={isTopCard}
              style={[
                cardStyle,
                { zIndex: visibleCards.length - actualIndex },
              ]}
            />
          );

          if (isTopCard) {
            return (
              <GestureDetector key={card.id} gesture={gesture}>
                {cardContent}
              </GestureDetector>
            );
          }

          return cardContent;
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e', // Match app's dark theme
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center', // Center cards vertically
    paddingVertical: 16,
  },
});

export default CardSwiper;
