import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { RootState } from "../../types";
import { useDispatch, useSelector } from "react-redux";
import { getVideoTitle } from "../../data/question_clips";
import { useNavigation } from "@react-navigation/native";
import { setCurrentTab } from "../../store/actions/dataActions";

const SelectedVideoBanner: React.FC = () => {
  const navigation = useNavigation();
  const allVideos = useSelector((state: RootState) => state.allVideos);
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const dispatch = useDispatch();

  if (!currentVideo) {
    return null;
  }
  const video = (allVideos || []).find(
    (video) => video.video_id === currentVideo.videoId
  );
  if (!video) {
    return null;
  }
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => {
        dispatch(setCurrentTab("watch"));
        navigation.navigate("Watch" as never);
      }}
    >
      <Text style={styles.title}>{video.title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    width: "100%",
    height: 40,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "gray",
  },
  title: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    fontSize: 16,
    fontWeight: "bold",
    color: "gray",
  },
});

export default SelectedVideoBanner;
