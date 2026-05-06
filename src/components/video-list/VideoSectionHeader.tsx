import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { isWebScreenWidth } from "../../helpers/helpers";

const VideoSectionHeader: React.FC<{
  title: string;
  isFirst?: boolean;
  removeBorderTop?: boolean;
  children?: React.ReactNode;
}> = ({ title, isFirst, removeBorderTop, children }) => {
  const { width } = useWindowDimensions();
  const isWebScreen = isWebScreenWidth(width);

  return (
    <View
      style={[
        styles.container,
        removeBorderTop && styles.noBorderTop,
        isWebScreen && styles.webContainer,
      ]}
    >
      <View style={styles.titleRow}>
        {isWebScreen && <View style={styles.webTitleAccent} />}
        <Text style={[styles.title, isWebScreen && styles.webTitle]}>
          {title}
        </Text>
      </View>
      {children ? (
        <View style={isWebScreen && styles.webActions}>{children}</View>
      ) : null}
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
    borderBottomColor: "#d0d8f0",
    borderTopWidth: 1,
    borderTopColor: "#d0d8f0",
    marginBottom: 16,
  },
  noBorderTop: {
    borderTopWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    color: "#5a5680",
    fontFamily: "Helvetica",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  webContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 18,
    paddingHorizontal: 4,
    paddingVertical: 10,
    borderTopWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(74, 105, 189, 0.16)",
    backgroundColor: "transparent",
  },
  webTitleAccent: {
    width: 4,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#4a69bd",
    marginRight: 10,
  },
  webTitle: {
    color: "#252b3a",
    fontSize: 24,
    fontWeight: "800",
  },
  webActions: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default VideoSectionHeader;
