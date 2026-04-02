import { View, Text, StyleSheet } from "react-native";

interface AccuracyCircleProps {
  percentage: number;
}

const AccuracyCircle: React.FC<AccuracyCircleProps> = ({ percentage }) => {
  return (
    <View style={styles.accuracyCircle}>
      <Text style={styles.accuracyPercentage}>{percentage}%</Text>
      <Text style={styles.accuracyLabel}>Accuracy</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  accuracyCircle: {
    width: 90,
    height: 90,
    borderRadius: 60,
    backgroundColor: "#2d2a40",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  accuracyPercentage: {
    color: "#4ade80",
    fontSize: 24,
    fontWeight: "700",
  },
  accuracyLabel: {
    color: "#fff",
    fontSize: 14,
    opacity: 0.8,
  },
});

export default AccuracyCircle;
