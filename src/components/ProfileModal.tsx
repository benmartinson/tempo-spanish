import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Modal,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useClerk, useUser } from "@clerk/clerk-expo";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import SlideModal from "./common/SlideModal";
import CreditStore from "./CreditStore";
import TermsOfUseModal from "./TermsOfUseModal";
import PrivacyPolicyModal from "./PrivacyPolicyModal";
import HelpAndFeedbackModal from "./HelpAndFeedbackModal";
import LanguageModal from "./settings/LanguageModal";
import {
  setUserCredits,
  setProfileModalOpen,
} from "../store/actions/dataActions";
import { useSupabaseWithClerk } from "../../utils/supabase";
import { fetchUserCredits } from "../requests";
import { backendFetch } from "../helpers/backendFetch";
import { getInitials } from "../helpers/helpers";

const APP_STORE_URL =
  "https://apps.apple.com/us/app/tempo-spanish/id6763132237";
const SHOW_LANGUAGE_SETTINGS = false;
const SHOW_CREATOR_SIGNUP = false;

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
    paddingVertical: 12,
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
  const { userId, sessionId } = useAuth();
  const navigation = useNavigation<any>();
  const supabase = useSupabaseWithClerk();
  const userCredits = useSelector((state: any) => state.userCredits);
  const [creditStoreVisible, setCreditStoreVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [languageVisible, setLanguageVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

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
    await signOut({ sessionId: sessionId ?? undefined });
    // Clerk's OAuth flow on iOS depends on session cookies in the shared
    // WebKit cookie store, which signOut() doesn't reach. Without clearing
    // them here, the next Google sign-in attempt sends stale Clerk session
    // cookies and fails with "signed_out" 401.
    //
    // @react-native-cookies/cookies is a native module that doesn't exist in
    // Expo Go — dynamic require so this no-ops gracefully when running there.
    try {
      const CookieManager =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("@react-native-cookies/cookies").default;
      // useWebKit=true targets WKWebsiteDataStore, which is what
      // ASWebAuthenticationSession (the iOS API powering Clerk's OAuth
      // browser flow) reads from. The default NSHTTPCookieStorage is a
      // separate store that doesn't affect the OAuth flow.
      await CookieManager.clearAll(true);
      // Belt and suspenders: clear NSHTTPCookieStorage too.
      await CookieManager.clearAll(false);
    } catch (err) {
      console.warn("Cookie clear skipped (Expo Go or unavailable):", err);
    }
    try {
      await SecureStore.deleteItemAsync("__clerk_client_jwt");
    } catch (err) {
      console.error("Token cache clear after signOut failed:", err);
    }
  };

  const deleteAccount = async () => {
    try {
      const response = await backendFetch("/api/delete-account", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${await response.text()}`);
      }
      setDeleteConfirmVisible(false);
      onClose();
      await signOut({ sessionId: sessionId ?? undefined });
    } catch (err) {
      console.error("Delete account error:", err);
      if (Platform.OS === "web") {
        setDeleteConfirmVisible(false);
        window.alert("Could not delete your account. Please try again.");
      } else {
        Alert.alert(
          "Something went wrong",
          "Could not delete your account. Please try again.",
        );
      }
    }
  };

  const handleCloseAccount = () => {
    if (Platform.OS === "web") {
      setDeleteConfirmed(false);
      setDeleteConfirmVisible(true);
      return;
    }

    Alert.alert(
      "Delete account?",
      "This permanently deletes your account, recordings progress, vocab, and remaining credits. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: deleteAccount,
        },
      ],
    );
  };

  const handleCreatorSignUpPress = () => {
    onClose();
    navigation.navigate({
      name: "MainApp",
      params: { creatorSignUp: true },
      merge: false,
    });
  };

  const initials = getInitials(user);

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
          <TouchableOpacity
            style={styles.headerSignOutButton}
            onPress={handleSignOut}
          >
            <MaterialIcons name="logout" size={15} color="#ff4d4d" />
            <Text style={styles.headerSignOutText}>Sign Out</Text>
          </TouchableOpacity>
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
          {SHOW_LANGUAGE_SETTINGS && (
            <MenuRow
              label="Language"
              onPress={() => setLanguageVisible(true)}
            />
          )}
          <MenuRow
            label="Close account"
            onPress={handleCloseAccount}
            isLast={!SHOW_CREATOR_SIGNUP}
          />
          {SHOW_CREATOR_SIGNUP && (
            <MenuRow
              label="Become a Creator"
              onPress={handleCreatorSignUpPress}
              isLast
            />
          )}
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

        <Text style={styles.sectionHeader}>Apps</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={menuStyles.row}
            onPress={() => Linking.openURL(APP_STORE_URL)}
            activeOpacity={0.6}
          >
            <View style={styles.tryMobileLabel}>
              <Text style={menuStyles.label}>Try Mobile</Text>
              <MaterialIcons name="phone-iphone" size={18} color="#5a5680" />
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#c0c0c4" />
          </TouchableOpacity>
        </View>
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

      {SHOW_LANGUAGE_SETTINGS && (
        <LanguageModal
          visible={languageVisible}
          onClose={() => setLanguageVisible(false)}
        />
      )}

      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setDeleteConfirmVisible(false);
          setDeleteConfirmed(false);
        }}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete account?</Text>
            <Text style={styles.confirmBody}>
              This permanently deletes your account, recordings progress, vocab,
              and <b>remaining credits</b>. This cannot be undone.
            </Text>
            <TouchableOpacity
              style={styles.confirmCheckboxRow}
              onPress={() => setDeleteConfirmed((confirmed) => !confirmed)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.confirmCheckbox,
                  deleteConfirmed && styles.confirmCheckboxChecked,
                ]}
              >
                {deleteConfirmed && (
                  <MaterialIcons name="check" size={14} color="#ffffff" />
                )}
              </View>
              <Text style={styles.confirmCheckboxText}>
                I understand the consequences.
              </Text>
            </TouchableOpacity>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => {
                  setDeleteConfirmVisible(false);
                  setDeleteConfirmed(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  styles.deleteButton,
                  !deleteConfirmed && styles.deleteButtonDisabled,
                ]}
                onPress={deleteAccount}
                disabled={!deleteConfirmed}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ebebef",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3d3a52",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  email: {
    fontSize: 13,
    color: "#8e8e93",
    fontWeight: "500",
  },
  headerSignOutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#fff1f1",
  },
  headerSignOutText: {
    color: "#ff4d4d",
    fontSize: 13,
    fontWeight: "700",
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
  tryMobileLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  confirmCard: {
    width: "min(92vw, 380px)" as any,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  confirmTitle: {
    color: "#1a1a2e",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  confirmBody: {
    color: "#5f6472",
    fontSize: 15,
    lineHeight: 22,
  },
  confirmCheckboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
  },
  confirmCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#c8c8d0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  confirmCheckboxChecked: {
    backgroundColor: "#3d3a52",
    borderColor: "#3d3a52",
  },
  confirmCheckboxText: {
    color: "#3d3a52",
    fontSize: 15,
    fontWeight: "600",
  },
  confirmActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 22,
  },
  confirmButton: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  cancelButton: {
    backgroundColor: "#f0f0f2",
  },
  cancelButtonText: {
    color: "#3d3a52",
    fontSize: 15,
    fontWeight: "700",
  },
  deleteButton: {
    backgroundColor: "#ff4d4d",
  },
  deleteButtonDisabled: {
    opacity: 0.45,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
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
