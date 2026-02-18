import { View, Text, StyleSheet } from "react-native";

const VideoSectionHeader: React.FC<{ title: string; isFirst?: boolean }> = ({
  title,
  isFirst,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    color: "#888",
    fontFamily: "Helvetica",
  },
});

export default VideoSectionHeader;
