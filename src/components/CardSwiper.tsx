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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;
const ROTATION_ANGLE = 15;

// Sample data - all cards use the same YouTube video for now
const CARDS_DATA = [
  { id: '1', videoUrl: 'https://www.youtube.com/embed/4hGfVk0VAGA?start=210&end=214&controls=0&autoplay=1&mute=1&si=zfeP3T8PfAYJBUk6' },
  { id: '2', videoUrl: 'https://www.youtube.com/embed/4hGfVk0VAGA?start=210&end=214&controls=0&autoplay=1&mute=1&si=zfeP3T8PfAYJBUk6' },
  { id: '3', videoUrl: 'https://www.youtube.com/embed/4hGfVk0VAGA?start=210&end=214&controls=0&autoplay=1&mute=1&si=zfeP3T8PfAYJBUk6' },
  { id: '4', videoUrl: 'https://www.youtube.com/embed/4hGfVk0VAGA?start=210&end=214&controls=0&autoplay=1&mute=1&si=zfeP3T8PfAYJBUk6' },
  { id: '5', videoUrl: 'https://www.youtube.com/embed/4hGfVk0VAGA?start=210&end=214&controls=0&autoplay=1&mute=1&si=zfeP3T8PfAYJBUk6' },
];

const CardSwiper: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const handleSwipeComplete = useCallback((direction: 'left' | 'right') => {
    console.log(`Swiped ${direction}`);
    setCurrentIndex((prev) => prev + 1);
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
      ],
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

  // Get visible cards (current and next two)
  const visibleCards = CARDS_DATA.slice(currentIndex, currentIndex + 3);

  if (visibleCards.length === 0) {
    return (
      <View style={styles.container}>
        <Animated.Text style={styles.emptyText}>No more cards!</Animated.Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cardContainer}>
        {/* Render cards in reverse order so the top card is rendered last (on top) */}
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
              videoUrl={card.videoUrl}
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
    backgroundColor: '#121212',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 24,
    color: '#fff',
    textAlign: 'center',
  },
});

export default CardSwiper;
