import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../types';
import Video from './Video';
import { setCurrentVideo } from '../../store/actions/dataActions';
import SelectVideoPrompt from '../common/SelectVideoPrompt';

const WatchTab: React.FC = () => {
  const dispatch = useDispatch();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const videoRefreshKey = useSelector((state: RootState) => state.videoRefreshKey);

  return (
    <View style={styles.container}>
      {currentVideo ? (
        <Video
          video={currentVideo}
          refreshKey={videoRefreshKey}
          onBackButton={() => dispatch(setCurrentVideo(null))}
        />
      ) : (
        <SelectVideoPrompt />
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
