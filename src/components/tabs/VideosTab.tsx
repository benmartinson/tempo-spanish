import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import VideoList from '../watch/VideoList';

const VideosTab: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* <Text style={styles.title}>Videos</Text> */}
      <VideoList />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
});

export default VideosTab;
