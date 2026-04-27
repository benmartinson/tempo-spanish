import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import CookieManager from "@react-native-cookies/cookies";
import { useClerk, useUser } from "@clerk/clerk-expo";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-expo";
import SlideModal from "./common/SlideModal";
import CreditStore from "./CreditStore";
import TermsOfUseModal from "./TermsOfUseModal";
import PrivacyPolicyModal from "./PrivacyPolicyModal";
import HelpAndFeedbackModal from "./HelpAndFeedbackModal";
import {
  setUserCredits,
  setProfileModalOpen,
} from "../store/actions/dataActions";
import { useSupabaseWithClerk } from "../../utils/supabase";
import { fetchUserCredits } from "../requests";
import { backendFetch } from "../helpers/backendFetch";

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
  const dispatch = useDispatch();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { userId } = useAuth();
  const supabase = useSupabaseWithClerk();
  const userCredits = useSelector((state: any) => state.userCredits);
  const [creditStoreVisible, setCreditStoreVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);

  useEffect(() => {
    dispatch(setProfileModalOpen(visible));
  }, [visible, dispatch]);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const credits = await fetchUserCredits({ supabase, userId });
      if (credits != null) dispatch(setUserCredits(credits));
    })();
  }, [visible, supabase, userId, dispatch]);

  const handleSignOut = async () => {
    onClose();
    await signOut();
    // Clerk's OAuth flow on iOS depends on session cookies in the shared
    // WebKit cookie store, which signOut() doesn't reach. Without clearing
    // them here, the next Google sign-in attempt sends stale Clerk session
    // cookies and fails with "signed_out" 401.
    try {
      await CookieManager.clearAll();
    } catch (err) {
      console.error("Cookie clear after signOut failed:", err);
    }
    try {
      await SecureStore.deleteItemAsync("__clerk_client_jwt");
    } catch (err) {
      console.error("Token cache clear after signOut failed:", err);
    }
  };

  const handleCloseAccount = () => {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account, recordings progress, vocab, and remaining credits. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await backendFetch("/api/delete-account", {
                method: "POST",
              });
              if (!response.ok) {
                throw new Error(`${response.status} ${await response.text()}`);
              }
              onClose();
              await signOut();
            } catch (err) {
              console.error("Delete account error:", err);
              Alert.alert(
                "Something went wrong",
                "Could not delete your account. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  const firstName = user?.firstName ?? "";
  const lastName = user?.lastName ?? "";
  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";

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

        <Text style={styles.sectionHeader}>Account Settings</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[menuStyles.row, menuStyles.border]}
            onPress={() => setCreditStoreVisible(true)}
            activeOpacity={0.6}
          >
            <View style={styles.creditsLeft}>
              <Text style={menuStyles.label}>Credits</Text>
              <View style={styles.creditsBadge}>
                <Text style={styles.creditsBadgeText}>{userCredits}</Text>
              </View>
            </View>
            <View style={styles.buyMoreButton}>
              <Text style={styles.buyMoreText}>Buy More</Text>
            </View>
          </TouchableOpacity>
          <MenuRow label="Close account" onPress={handleCloseAccount} isLast />
        </View>

        <Text style={styles.sectionHeader}>Support</Text>
        <View style={styles.card}>
          <MenuRow label="Terms of Use" onPress={() => setTermsVisible(true)} />
          <MenuRow
            label="Privacy Policy"
            onPress={() => setPrivacyVisible(true)}
          />
          <MenuRow
            label="Help & Feedback"
            onPress={() => setHelpVisible(true)}
            isLast
          />
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

      <PrivacyPolicyModal
        visible={privacyVisible}
        onClose={() => setPrivacyVisible(false)}
      />

      <HelpAndFeedbackModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
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
  creditsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  creditsBadge: {
    backgroundColor: "#f0f0f5",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  creditsBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5a5680",
  },
  buyMoreButton: {
    backgroundColor: "#4a69bd",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  buyMoreText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default ProfileModal;
