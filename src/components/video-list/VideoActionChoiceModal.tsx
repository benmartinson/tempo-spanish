import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

interface VideoActionChoiceModalProps {
  visible: boolean;
  videoTitle?: string;
  onClose: () => void;
  onChooseComposition: () => void;
  onChooseShadowing: () => void;
}

const VideoActionChoiceModal: React.FC<VideoActionChoiceModalProps> = ({
  visible,
  videoTitle,
  onClose,
  onChooseComposition,
  onChooseShadowing,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Ionicons name="play-circle-outline" size={22} color="#26705d" />
          </View>
          <View style={styles.headerTextGroup}>
            <Text style={styles.title}>Choose Mode</Text>
            {videoTitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {videoTitle}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onChooseComposition}
            activeOpacity={0.78}
          >
            <Ionicons name="create-outline" size={18} color="#3d3a52" />
            <Text style={styles.actionTitle}>Memorization</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryActionButton]}
            onPress={onChooseShadowing}
            activeOpacity={0.78}
          >
            <Ionicons name="mic-outline" size={18} color="#ffffff" />
            <Text style={[styles.actionTitle, styles.primaryActionTitle]}>
              Shadowing
            </Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(16, 21, 34, 0.45)",
  },
  card: {
    width: "100%",
    maxWidth: 430,
    gap: 18,
    padding: 18,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf4f2",
  },
  headerTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#2f3140",
    fontSize: 18,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 2,
    color: "#697187",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.18)",
    backgroundColor: "#ffffff",
  },
  primaryActionButton: {
    borderColor: "#3d3a52",
    backgroundColor: "#3d3a52",
  },
  actionTitle: {
    color: "#3d3a52",
    fontSize: 13,
    fontWeight: "900",
  },
  primaryActionTitle: {
    color: "#ffffff",
  },
});

export default VideoActionChoiceModal;
