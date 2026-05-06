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
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Feather from "@expo/vector-icons/Feather";

type Mode = "shadow" | "stream" | "voice";
type OptionKey = Mode | "help";

interface ModeSwitcherProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onHelpSelect?: () => void;
}

const OPTIONS: { key: OptionKey; label: string }[] = [
  { key: "shadow", label: "Shadow" },
  { key: "stream", label: "Stream" },
  { key: "voice", label: "Voice" },
  { key: "help", label: "Help" },
];

const DIAL_RADIUS = 116;
const OPTION_SIZE = 48;
const START_ANGLE = Math.PI;
const END_ANGLE = Math.PI / 2;

const ModeSwitcher: React.FC<ModeSwitcherProps> = ({
  mode,
  onModeChange,
  onHelpSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hoveredIndexRef = useRef<number | null>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const positions = useMemo(
    () =>
      OPTIONS.map((_, i) => {
        const angle =
          START_ANGLE + (END_ANGLE - START_ANGLE) * (i / (OPTIONS.length - 1));
        return {
          x: Math.cos(angle) * DIAL_RADIUS,
          y: -Math.sin(angle) * DIAL_RADIUS,
        };
      }),
    [],
  );

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
        const key = OPTIONS[idx].key;
        if (key === "help") {
          onHelpSelect?.();
        } else {
          onModeChange(key);
        }
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
    [scaleAnim, onModeChange],
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

  const renderIcon = (key: OptionKey, color: string, size = 18) => {
    if (key === "shadow") {
      return (
        <MaterialIcons name="record-voice-over" size={size} color={color} />
      );
    }
    if (key === "help") {
      return <Feather name="help-circle" size={size} color={color} />;
    }
    if (key === "voice") {
      return <Feather name="mic" size={size} color={color} />;
    }
    return (
      <MaterialCommunityIcons name="play-speed" size={size} color={color} />
    );
  };

  return (
    <View style={styles.container}>
      {isOpen && (
        <View style={styles.optionsContainer} pointerEvents="none">
          {OPTIONS.map((opt, i) => {
            const isHovered = hoveredIndex === i;
            const isSelected = opt.key === mode && hoveredIndex === null;
            return (
              <Animated.View
                key={opt.key}
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
                {renderIcon(
                  opt.key,
                  isHovered || isSelected ? "#fff" : "#555",
                  16,
                )}
                <Text
                  style={[
                    styles.optionText,
                    (isHovered || isSelected) && styles.optionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      )}

      <View style={styles.bubble} {...panResponder.panHandlers}>
        {renderIcon(
          hoveredIndex !== null && isOpen ? OPTIONS[hoveredIndex].key : mode,
          hoveredIndex !== null && isOpen ? "#3d3a52" : "#888",
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fafafa",
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
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
    gap: 2,
  },
  optionActive: {
    backgroundColor: "#3d3a52",
    borderColor: "#3d3a52",
  },
  optionText: {
    fontSize: 8,
    fontWeight: "600",
    color: "#555",
  },
  optionTextActive: {
    color: "#fff",
  },
});

export default ModeSwitcher;
