import { View, Text, StyleSheet } from "react-native";

const VideoSectionHeader: React.FC<{
  title: string;
  isFirst?: boolean;
  removeBorderTop?: boolean;
  children?: React.ReactNode;
}> = ({ title, isFirst, removeBorderTop, children }) => {
  return (
    <View style={[styles.container, removeBorderTop && styles.noBorderTop]}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    marginBottom: 16,
  },
  noBorderTop: {
    borderTopWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    color: "#888",
    fontFamily: "Helvetica",
  },
});

export default VideoSectionHeader;
