import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Modal,
} from "react-native";
import Entypo from "@expo/vector-icons/Entypo";

interface ActionsModalProps {
  visible: boolean;
  onClose: () => void;
  onStartVocabTest: () => void;
  onShadow: () => void;
  onDiscuss: () => void;
}

const ActionsModal: React.FC<ActionsModalProps> = ({
  visible,
  onClose,
  onStartVocabTest,
  onShadow,
  onDiscuss,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Entypo name="cross" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Actions</Text>
          <View style={styles.closeButton} />
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onStartVocabTest}
          >
            <Text style={styles.actionButtonText}>Start Vocab Test</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={onShadow}>
            <Text style={styles.actionButtonText}>Shadow Video Segment</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={onDiscuss}>
            <Text style={styles.actionButtonText}>Discuss Video Content</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4a",
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  actionButton: {
    backgroundColor: "#2a2a4a",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3d3a52",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ActionsModal;
