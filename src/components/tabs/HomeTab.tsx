import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  setCurrentChatType,
  setCurrentTab,
} from "../../store/actions/dataActions";
import { useDispatch } from "react-redux";

const HomeTab: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const handleChatPress = () => {
    // Navigate to Discuss tab
    dispatch(setCurrentChatType("general"));
    dispatch(setCurrentTab("discuss"));
    // navigation.navigate('Discuss' as never);
  };

  const handleWatchPress = () => {
    // Navigate to Watch tab
    dispatch(setCurrentChatType("video-based"));
    dispatch(setCurrentTab("watch"));
    // navigation.navigate('Watch' as never);
  };

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <TouchableOpacity style={styles.chatButton} onPress={handleWatchPress}>
          <Text style={styles.chatButtonIcon}>🎥</Text>
          <Text style={styles.chatButtonText}>Watch and Discuss</Text>
          <Text style={styles.chatButtonSubtext}>
            Watch YouTube Videos and Discuss Content
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chatButton} onPress={handleChatPress}>
          <Text style={styles.chatButtonIcon}>💬</Text>
          <Text style={styles.chatButtonText}>General Chat</Text>
          <Text style={styles.chatButtonSubtext}>
            Make Conversation in Topics You Choose
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chatButton} onPress={handleChatPress}>
          <Text style={styles.chatButtonIcon}>🔁</Text>
          <Text style={styles.chatButtonText}>Repeat Phrases</Text>
          <Text style={styles.chatButtonSubtext}>
            Practice Pronunciation, Speed, and Accuracy
          </Text>
        </TouchableOpacity>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    marginBottom: 40,
  },
  chatButton: {
    backgroundColor: "#252542",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#3d3a52",
    marginBottom: 20,
  },
  chatButtonIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  chatButtonText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  chatButtonSubtext: {
    fontSize: 14,
    color: "#888",
  },
});

export default HomeTab;
