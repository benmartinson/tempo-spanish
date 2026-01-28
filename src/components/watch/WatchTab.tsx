import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../types';
import Video from './Video';
import { setCurrentTab, setCurrentVideo } from '../../store/actions/dataActions';
import SelectVideoPrompt from '../common/SelectVideoPrompt';
import { useNavigation } from '@react-navigation/native';

const WatchTab: React.FC = () => {
  const dispatch = useDispatch();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const videoRefreshKey = useSelector((state: RootState) => state.videoRefreshKey);
  const navigation = useNavigation();
  
  const handleBackButton = () => {
    dispatch(setCurrentTab('videos'));
    dispatch(setCurrentVideo(null));
    navigation.navigate('Videos' as never);
  };
  return (
    <View style={styles.container}>
      {currentVideo ? (
        <Video
          video={currentVideo}
          refreshKey={videoRefreshKey}
          onBackButton={handleBackButton}
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
    backgroundColor: '#dfe2ea',
  },
});

export default WatchTab;
