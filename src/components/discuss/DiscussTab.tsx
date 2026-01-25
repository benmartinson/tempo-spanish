import React from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import ChatSelection from './ChatSelection';
import { useSelector } from 'react-redux';
import { RootState } from '../../types';
import Chat from '../protected/Chat';

    interface DiscussTabProps {
    }

const DiscussTab: React.FC<DiscussTabProps> = () => {
  const currentChatType = useSelector((state: RootState) => state.currentChatType);

  return (
    <View style={styles.container}>
      {currentChatType === null ? <ChatSelection /> : <Chat />}
    </View>
  )
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },

});

export default DiscussTab;
