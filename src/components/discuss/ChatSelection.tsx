import React from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { getVideoTitle } from '../../data/question_clips';
import { RootState } from '../../types';
import { useDispatch, useSelector } from 'react-redux';
import { setCurrentChatType } from '../../store/actions/dataActions';

interface ChatSelectionProps {
}

const ChatSelection: React.FC<ChatSelectionProps> = () => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const dispatch = useDispatch();

  const handleVideoChatSelect = () => {
    dispatch(setCurrentChatType('video-based'));
  };

  const handleChatSelect = () => {
    dispatch(setCurrentChatType('general'));
  };

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <TouchableOpacity
          style={styles.chatButton}
          onPress={handleVideoChatSelect}
        >
          <Text style={styles.chatButtonIcon}>🎥</Text>
          <Text style={styles.chatButtonText}>
            {currentVideo ? `Discuss ${getVideoTitle(currentVideo.videoId)}` : 'Select a video to discuss'}
          </Text>
          <Text style={styles.chatButtonSubtext}>
            {currentVideo ? 'Watch and discuss the selected video content' : 'Choose a video from the Watch tab first'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={handleChatSelect}
        >
          <Text style={styles.chatButtonIcon}>💬</Text>
          <Text style={styles.chatButtonText}>General Chat</Text>
          <Text style={styles.chatButtonSubtext}>Make conversation in topics you choose</Text>
        </TouchableOpacity>
      </Animated.ScrollView>
    </View>
  )
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  chatButton: {
    backgroundColor: '#252542',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3d3a52',
    marginBottom: 20,
  },
  chatButtonIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  chatButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  chatButtonSubtext: {
    fontSize: 14,
    color: '#888',
  },
 
});

export default ChatSelection;
