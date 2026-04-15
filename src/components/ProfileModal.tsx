import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useClerk, useUser } from "@clerk/clerk-expo";
import { useSelector } from "react-redux";
import SlideModal from "./common/SlideModal";
import CreditStore from "./CreditStore";
import TermsOfUseModal from "./TermsOfUseModal";
import { RootState } from "../types";

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

const MenuRow: React.FC<{
  label: string;
  onPress: () => void;
  isLast?: boolean;
}> = ({ label, onPress, isLast = false }) => (
  <TouchableOpacity
    style={[menuStyles.row, !isLast && menuStyles.border]}
    onPress={onPress}
    activeOpacity={0.6}
  >
    <Text style={menuStyles.label}>{label}</Text>
    <MaterialIcons name="chevron-right" size={22} color="#c0c0c4" />
  </TouchableOpacity>
);

const menuStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ebebef",
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1a1a2e",
  },
});

const ProfileModal: React.FC<ProfileModalProps> = ({ visible, onClose }) => {
  const { signOut } = useClerk();
  const { user } = useUser();
  const userCredits = useSelector((state: RootState) => state.userCredits);
  const [creditStoreVisible, setCreditStoreVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);

  const handleSignOut = async () => {
    onClose();
    await signOut();
  };

  const firstName = user?.firstName ?? "";
  const lastName = user?.lastName ?? "";
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";

  return (
    <SlideModal visible={visible} onRequestClose={onClose} title="Profile">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          {user?.primaryEmailAddress && (
            <View style={styles.emailRow}>
              <MaterialIcons name="email" size={18} color="#8e8e93" />
              <Text style={styles.email}>
                {user.primaryEmailAddress.emailAddress}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.creditsRow}>
          <View style={styles.creditsInfo}>
            <MaterialIcons name="token" size={20} color="#5a5680" />
            <Text style={styles.creditsLabel}>Credits</Text>
            <Text style={styles.creditsValue}>{userCredits}</Text>
          </View>
          <TouchableOpacity
            style={styles.buyButton}
            onPress={() => setCreditStoreVisible(true)}
          >
            <Text style={styles.buyButtonText}>Buy More</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>Account Settings</Text>
        <View style={styles.card}>
          <MenuRow label="Subscription" onPress={() => {}} />
          <MenuRow label="Close account" onPress={() => {}} isLast />
        </View>

        <Text style={styles.sectionHeader}>Support</Text>
        <View style={styles.card}>
          <MenuRow label="Terms of Use" onPress={() => setTermsVisible(true)} />
          <MenuRow label="Privacy Policy" onPress={() => {}} />
          <MenuRow label="Help & Feedback" onPress={() => {}} isLast />
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <MaterialIcons name="logout" size={18} color="#ff4d4d" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <CreditStore
        visible={creditStoreVisible}
        onClose={() => setCreditStoreVisible(false)}
      />

      <TermsOfUseModal
        visible={termsVisible}
        onClose={() => setTermsVisible(false)}
      />
    </SlideModal>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 28,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ebebef",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#3d3a52",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  email: {
    fontSize: 15,
    color: "#8e8e93",
    fontWeight: "500",
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8e8e93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 14,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  signOutText: {
    color: "#ff4d4d",
    fontSize: 16,
    fontWeight: "600",
  },
  creditsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  creditsInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  creditsLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1a1a2e",
  },
  creditsValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#5a5680",
  },
  buyButton: {
    backgroundColor: "#4a69bd",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  buyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default ProfileModal;
