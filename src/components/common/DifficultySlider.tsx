import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

const MAX_DIFFICULTY = 5;

interface DifficultySliderProps {
  difficulty: number;
  onDifficultyChange: (d: number) => void;
}

const DifficultySlider: React.FC<DifficultySliderProps> = ({
  difficulty,
  onDifficultyChange,
}) => {
  const ticks = Array.from({ length: MAX_DIFFICULTY + 1 }, (_, i) => i);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => onDifficultyChange(Math.max(0, difficulty - 1))}
        disabled={difficulty === 0}
      >
        <Text
          style={[styles.label, difficulty === 0 && styles.labelDisabled]}
        >
          More hints
        </Text>
      </TouchableOpacity>
      <View style={styles.trackContainer}>
        <View style={styles.line} />
        <View style={styles.ticksRow}>
          {ticks.map((i) => (
            <TouchableOpacity
              key={i}
              style={styles.tickHitArea}
              onPress={() => onDifficultyChange(i)}
            >
              <View
                style={[styles.tick, i === difficulty && styles.tickActive]}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TouchableOpacity
        onPress={() =>
          onDifficultyChange(Math.min(MAX_DIFFICULTY, difficulty + 1))
        }
        disabled={difficulty === MAX_DIFFICULTY}
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
  tickActive: {
    width: 4,
    height: 20,
    backgroundColor: "#3d3a52",
    borderRadius: 2,
  },
});

export default DifficultySlider;
