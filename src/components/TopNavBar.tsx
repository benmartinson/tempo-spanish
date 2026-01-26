import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
} from 'react-native';
import Entypo from '@expo/vector-icons/Entypo';
import { useClerk, useUser } from '@clerk/clerk-expo';

const TopNavBar: React.FC = () => {
  const [profileVisible, setProfileVisible] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();

  const handleSignOut = async () => {
    setProfileVisible(false);
    await signOut();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.leftSpacer} />
        <View style={styles.titleContainer}>
          <Text style={styles.appName}>Tempo Spanish</Text>
          <Entypo name="sound" size={24} color="yellow" />
        </View>
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => setProfileVisible(true)}
        >
          <Text style={styles.avatarText}>👤</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={profileVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setProfileVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setProfileVisible(false)}
            >
              <Entypo name="cross" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Profile</Text>
            <View style={styles.closeButton} />
          </View>

          <View style={styles.profileContent}>
            <View style={styles.profileSection}>
              <View style={styles.avatar}>
                <Text style={styles.profileAvatarText}>👤</Text>
              </View>
              {user?.primaryEmailAddress && (
                <Text style={styles.email}>{user.primaryEmailAddress.emailAddress}</Text>
              )}
            </View>

            <View style={styles.menuSection}>
              <TouchableOpacity
                style={styles.signOutButton}
                onPress={handleSignOut}
              >
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
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
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    height: 95,
  },
  leftSpacer: {
    width: 40,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'yellow',
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3d3a52',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#5a5680',
  },
  avatarText: {
    fontSize: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3d3a52',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#5a5680',
  },
  profileAvatarText: {
    fontSize: 36,
  },
  email: {
    fontSize: 16,
    color: '#888',
  },
  menuSection: {
    marginTop: 20,
  },
  signOutButton: {
    backgroundColor: '#3d3a52',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  signOutText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TopNavBar;
