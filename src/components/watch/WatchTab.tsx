import React from "react";
import { StyleSheet, View } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../types";
import Video from "./Video";
import {
  setCurrentTab,
  setCurrentVideo,
} from "../../store/actions/dataActions";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import { useNavigation } from "@react-navigation/native";
import SelectedVideoBanner from "../common/SelectedVideoBanner";

const WatchTab: React.FC = () => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const videoRefreshKey = useSelector(
    (state: RootState) => state.videoRefreshKey,
  );

  return (
    <>
      <SelectedVideoBanner />
      <View style={styles.container}>
        {currentVideo ? (
          <Video
            video={currentVideo}
            refreshKey={videoRefreshKey}
            isClip={false}
          />
        ) : (
          <SelectVideoPrompt />
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#dfe2ea",
  },
});

export default WatchTab;
