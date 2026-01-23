import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const HomeTab: React.FC = () => {
  const navigation = useNavigation();

  const handleGeneralChatPress = () => {
    // Navigate to Discuss tab
    navigation.navigate('Discuss' as never);
  };

  const handleWatchPress = () => {
    // Navigate to Watch tab
    navigation.navigate('Watch' as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity
            style={styles.chatButton}
            onPress={handleWatchPress}
          >
            <Text style={styles.chatButtonIcon}>🎥</Text>
            <Text style={styles.chatButtonText}>Watch and Discuss</Text>
            <Text style={styles.chatButtonSubtext}>Watch YouTube videos and discuss content</Text>
        </TouchableOpacity> 
        <TouchableOpacity
          style={styles.chatButton}
          onPress={handleGeneralChatPress}
        >
          <Text style={styles.chatButtonIcon}>💬</Text>
          <Text style={styles.chatButtonText}>General Chat</Text>
          <Text style={styles.chatButtonSubtext}>Practice conversation in topics you choose</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={handleGeneralChatPress}
        >
          <Text style={styles.chatButtonIcon}>🔁</Text>
          <Text style={styles.chatButtonText}>Repeat Phrases</Text>
          <Text style={styles.chatButtonSubtext}>Practice pronunciation of challenging phrases</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 40,
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

export default HomeTab;
