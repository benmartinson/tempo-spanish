import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
} from "react-native";
import { useRef, useEffect, useState } from "react";

const MAX_DIFFICULTY = 4;

interface DifficultySliderProps {
  difficulty: number;
  onDifficultyChange: (d: number) => void;
}

const DifficultySlider: React.FC<DifficultySliderProps> = ({
  difficulty,
  onDifficultyChange,
}) => {
  const ticks = Array.from({ length: MAX_DIFFICULTY + 1 }, (_, i) => i);
  const animatedValue = useRef(new Animated.Value(difficulty)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: difficulty,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [difficulty]);

  const handleTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const indicatorLeft =
    trackWidth > 0
      ? animatedValue.interpolate({
          inputRange: [0, MAX_DIFFICULTY],
          outputRange: [4, trackWidth - 8],
        })
      : animatedValue.interpolate({
          inputRange: [0, MAX_DIFFICULTY],
          outputRange: ["0%", "100%"],
        });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => onDifficultyChange(Math.max(0, difficulty - 1))}
        disabled={difficulty === 0}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      >
        <Text style={[styles.label, difficulty === 0 && styles.labelDisabled]}>
          More hints
        </Text>
      </TouchableOpacity>
      <View style={styles.trackContainer} onLayout={handleTrackLayout}>
        <View style={styles.line} />
        <View style={styles.ticksRow}>
          {ticks.map((i) => (
            <TouchableOpacity
              key={i}
              style={styles.tickHitArea}
              onPress={() => onDifficultyChange(i)}
              hitSlop={{ top: 16, bottom: 16, left: 10, right: 10 }}
            >
              <View style={styles.tick} />
            </TouchableOpacity>
          ))}
        </View>
        {trackWidth > 0 && (
          <Animated.View style={[styles.indicator, { left: indicatorLeft }]} />
        )}
      </View>
      <TouchableOpacity
        onPress={() =>
          onDifficultyChange(Math.min(MAX_DIFFICULTY, difficulty + 1))
        }
        disabled={difficulty === MAX_DIFFICULTY}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      >
        <Text
          style={[
            styles.label,
            difficulty === MAX_DIFFICULTY && styles.labelDisabled,
          ]}
        >
          Less hints
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 20,
    gap: 10,
  },
  label: {
    fontSize: 11,
    color: "#3d3a52",
    fontWeight: "600",
  },
  labelDisabled: {
    opacity: 0.3,
  },
  trackContainer: {
    flex: 1,
    height: 24,
    justifyContent: "center",
  },
  line: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#ccc",
  },
  ticksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tickHitArea: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: "center",
  },
  tick: {
    width: 2,
    height: 16,
    backgroundColor: "#ccc",
    borderRadius: 1,
  },
  indicator: {
    position: "absolute",
    width: 4,
    height: 20,
    backgroundColor: "#3d3a52",
    borderRadius: 2,
    top: 2,
  },
});

export default DifficultySlider;
