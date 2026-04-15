import React from "react";
import { Text, StyleSheet, TouchableOpacity, View } from "react-native";
import { RootState } from "../../types";
import { useSelector } from "react-redux";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

interface SelectedVideoBannerProps {
  title?: string;
  onPress?: () => void;
  onBack?: () => void;
}

const SelectedVideoBanner: React.FC<SelectedVideoBannerProps> = ({
  title,
  onPress,
  onBack,
}) => {
  const allVideos = useSelector((state: RootState) => state.allVideos);
  const currentVideo = useSelector((state: RootState) => state.currentVideo);

  const video = currentVideo
    ? (allVideos || []).find((v) => v.video_id === currentVideo.videoId)
    : null;

  const displayTitle = title || video?.title;

  if (!displayTitle) return null;

  const handlePress = onPress ?? (() => {});

  return (
    <View style={styles.container}>
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <MaterialIcons name="arrow-back" size={20} color="gray" />
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.titleRow} onPress={handlePress}>
        <Text style={styles.title} numberOfLines={1}>
          {displayTitle}
        </Text>
        <MaterialIcons name="open-in-new" size={14} color="gray" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "gray",
  },
  backButton: {
    marginRight: 8,
    padding: 4,
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "gray",
  },
});

export default SelectedVideoBanner;
