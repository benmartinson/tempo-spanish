import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../types';
import Chat from './Chat';
import SelectVideoPrompt from '../common/SelectVideoPrompt';

const DiscussTab: React.FC = () => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);

  return (
    <View style={styles.container}>
      {currentVideo ? (
        <Chat />
      ) : (
        <SelectVideoPrompt
          title="No Video Selected"
          subtitle="Select a video first to start discussing"
        />
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

export default DiscussTab;
