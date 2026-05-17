import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useRef, useEffect, useState } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const MAX_DIFFICULTY = 5;

interface DifficultySliderProps {
  difficulty: number;
  onDifficultyChange: (d: number) => void;
  variant?: "default" | "compact";
  style?: StyleProp<ViewStyle>;
}

const DifficultySlider: React.FC<DifficultySliderProps> = ({
  difficulty,
  onDifficultyChange,
  variant = "default",
  style,
}) => {
  const safeDifficulty = Number.isFinite(difficulty) ? difficulty : 0;
  const ticks = Array.from({ length: MAX_DIFFICULTY + 1 }, (_, i) => i);
  const animatedValue = useRef(new Animated.Value(safeDifficulty)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: safeDifficulty,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [safeDifficulty]);

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

  if (variant === "compact") {
    return (
      <View style={[styles.compactContainer, style]}>
        <Text style={styles.compactLabel}>Hints</Text>
        <TouchableOpacity
          style={[
            styles.compactStepButton,
            difficulty === 0 && styles.compactStepButtonDisabled,
          ]}
          onPress={() => onDifficultyChange(Math.max(0, difficulty - 1))}
          disabled={difficulty === 0}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        >
          <MaterialIcons
            name="remove"
            size={14}
            color={difficulty === 0 ? "#9aa4ba" : "#32405f"}
          />
        </TouchableOpacity>
        <View style={styles.compactTrack}>
          {ticks.map((i) => {
            const isActive = i === safeDifficulty;
            return (
              <TouchableOpacity
                key={i}
                style={styles.compactTickHitArea}
                onPress={() => onDifficultyChange(i)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <View
                  style={[
                    styles.compactTick,
                    i < safeDifficulty && styles.compactTickFilled,
                    isActive && styles.compactTickActive,
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          style={[
            styles.compactStepButton,
            difficulty === MAX_DIFFICULTY && styles.compactStepButtonDisabled,
          ]}
          onPress={() =>
            onDifficultyChange(Math.min(MAX_DIFFICULTY, difficulty + 1))
          }
          disabled={difficulty === MAX_DIFFICULTY}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        >
          <MaterialIcons
            name="add"
            size={14}
            color={difficulty === MAX_DIFFICULTY ? "#9aa4ba" : "#32405f"}
          />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
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
  compactContainer: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(74,105,189,0.2)",
  },
  compactLabel: {
    color: "#32405f",
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 0,
  },
  compactStepButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(74,105,189,0.18)",
  },
  compactStepButtonDisabled: {
    opacity: 0.45,
  },
  compactTrack: {
    flex: 1,
    minWidth: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  compactTickHitArea: {
    flex: 1,
    paddingVertical: 7,
  },
  compactTick: {
    height: 4,
    borderRadius: 4,
    backgroundColor: "rgba(50,64,95,0.18)",
  },
  compactTickFilled: {
    backgroundColor: "rgba(74,105,189,0.38)",
  },
  compactTickActive: {
    height: 8,
    backgroundColor: "#4a69bd",
  },
});

export default DifficultySlider;
