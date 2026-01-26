import React from 'react';
import {
  StyleSheet,
  View,
  Button,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../types';
import { WATCH_CLIPS } from '../../data/question_clips';
import Video from './Video';
import VideoList from './VideoList';
import { setCurrentVideo } from '../../store/actions/dataActions';

const WatchTab: React.FC = () => {
  const dispatch = useDispatch();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const videoRefreshKey = useSelector((state: RootState) => state.videoRefreshKey);

  // const handleNextVideo = () => {
  //   const currentIndex = WATCH_CLIPS.findIndex(clip => clip.videoId === currentVideo?.videoId);
  //   const nextIndex = (currentIndex + 1) % WATCH_CLIPS.length;
  //   dispatch(setCurrentVideo(WATCH_CLIPS[nextIndex]));
  // };

  return (
    <View style={styles.container}>
      {currentVideo ? (
        <Video
          video={currentVideo}
          refreshKey={videoRefreshKey}
          onBackButton={() => dispatch(setCurrentVideo(null))}
          // onNextButton={handleNextVideo}
        />
      ) : (
        <VideoList/>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
});

  export default WatchTab;
