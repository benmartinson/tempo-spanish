import React, { useEffect, useRef } from "react";
import { StyleSheet, TouchableOpacity, Animated } from "react-native";

interface GuidedPracticeBannerProps {
  onPress: () => void;
}

const COLORS = [
  ["#6C63FF", "#FF6584"],
  ["#FF6584", "#FFC75F"],
  ["#FFC75F", "#43E97B"],
  ["#43E97B", "#38F9D7"],
  ["#38F9D7", "#6C63FF"],
];

const GuidedPracticeBanner: React.FC<GuidedPracticeBannerProps> = ({
  onPress,
}) => {
  const colorIndex = useRef(0);
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      animValue.setValue(0);
      Animated.timing(animValue, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      }).start(() => {
        colorIndex.current = (colorIndex.current + 1) % COLORS.length;
        animate();
      });
    };
    animate();
  }, []);

  const color = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: COLORS[colorIndex.current],
  });

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      <Animated.View style={[styles.container]}>
        <Animated.Text style={[styles.text, { color }]}>
          Guided Vocab In Context
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "black",
  },
  text: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default GuidedPracticeBanner;
