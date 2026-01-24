import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Entypo from '@expo/vector-icons/Entypo';

const TopNavBar: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.appName}>Tempo Spanish</Text>
        <Entypo name="sound" size={24} color="yellow" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: 50, // Account for status bar
    paddingHorizontal: 20,
    paddingBottom: 15,
    height: 95, // Fixed height: 50 (top) + 30 (content) + 15 (bottom)
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'yellow',
  },
});

export default TopNavBar;
