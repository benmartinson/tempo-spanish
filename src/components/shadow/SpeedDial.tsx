import React, { useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from "react-native";

interface SpeedDialProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
  options?: number[];
}

const DIAL_RADIUS = 90;
const OPTION_SIZE = 40;
// Arc spans from 3π/2 (bottom) to π/2 (top), i.e. left-side half-moon
const START_ANGLE = (3 * Math.PI) / 2;
const END_ANGLE = Math.PI / 2;

const SpeedDial: React.FC<SpeedDialProps> = ({
  speed,
  onSpeedChange,
  options = [0.25, 0.35, 0.45, 0.6, 0.75, 1],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hoveredIndexRef = useRef<number | null>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const positions = useMemo(
    () =>
      options.map((_, i) => {
        const angle =
          START_ANGLE + (END_ANGLE - START_ANGLE) * (i / (options.length - 1));
        return {
          x: Math.cos(angle) * DIAL_RADIUS,
          y: -Math.sin(angle) * DIAL_RADIUS,
        };
      }),
    [options],
  );

  // Pre-compute animated transforms so they don't get recreated on re-render
  const animatedTransforms = useMemo(
    () =>
      positions.map((pos) => ({
        translateX: Animated.multiply(scaleAnim, pos.x),
        translateY: Animated.multiply(scaleAnim, pos.y),
      })),
    [positions, scaleAnim],
  );

  const findClosestOption = (dx: number, dy: number): number | null => {
    let closest: number | null = null;
    let minDist = Infinity;

    positions.forEach((pos, i) => {
      const dist = Math.sqrt((dx - pos.x) ** 2 + (dy - pos.y) ** 2);
      if (dist < minDist && dist < OPTION_SIZE * 1.5) {
        minDist = dist;
        closest = i;
      }
    });
    return closest;
  };

  const openDial = useCallback(() => {
    setIsOpen(true);
    setHoveredIndex(null);
    hoveredIndexRef.current = null;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  }, [scaleAnim]);

  const closeDial = useCallback(
    (commit: boolean) => {
      const idx = hoveredIndexRef.current;
      if (commit && idx !== null) {
        onSpeedChange(options[idx]);
      }
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setIsOpen(false);
        setHoveredIndex(null);
        hoveredIndexRef.current = null;
      });
    },
    [scaleAnim, onSpeedChange, options],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        openDial();
      },
      onPanResponderMove: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        const idx = findClosestOption(gestureState.dx, gestureState.dy);
        hoveredIndexRef.current = idx;
        setHoveredIndex(idx);
      },
      onPanResponderRelease: () => {
        closeDial(true);
      },
      onPanResponderTerminate: () => {
        closeDial(false);
      },
    }),
  ).current;

  const formatSpeed = (s: number) =>
    s === 0 ? "Off" : `${String(s).replace(/^0/, "")}x`;

  return (
    <View style={styles.container}>
      {isOpen && (
        <View style={styles.optionsContainer} pointerEvents="none">
          {options.map((opt, i) => {
            const isHovered = hoveredIndex === i;
            const isSelected = opt === speed && hoveredIndex === null;
            return (
              <Animated.View
                key={opt}
                style={[
                  styles.option,
                  (isHovered || isSelected) && styles.optionActive,
                  {
                    transform: [
                      { translateX: animatedTransforms[i].translateX },
                      { translateY: animatedTransforms[i].translateY },
                      { scale: scaleAnim },
                    ],
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    (isHovered || isSelected) && styles.optionTextActive,
                  ]}
                >
                  {formatSpeed(opt)}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      )}

      <View style={styles.bubble} {...panResponder.panHandlers}>
        <Text style={styles.bubbleText}>
          {hoveredIndex !== null && isOpen
            ? formatSpeed(options[hoveredIndex])
            : formatSpeed(speed)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    width: 48,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fafafa",
    zIndex: 10,
    alignItems: "center",
  },
  bubbleText: {
    fontSize: 16,
    fontWeight: "500",
    opacity: 0.5,
    color: "black",
  },
  optionsContainer: {
    position: "absolute",
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  option: {
    position: "absolute",
    width: OPTION_SIZE,
    height: OPTION_SIZE,
    borderRadius: OPTION_SIZE / 2,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  optionActive: {
    backgroundColor: "#3d3a52",
    borderColor: "#3d3a52",
  },
  optionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555",
  },
  optionTextActive: {
    color: "#fff",
  },
});

export default SpeedDial;
