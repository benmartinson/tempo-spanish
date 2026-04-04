import React from "react";
import {
  StyleSheet,
  Modal,
  SafeAreaView,
  View,
  TouchableOpacity,
  Text,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";

const SlideModal: React.FC<{
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  title: string;
}> = ({ visible, onRequestClose, children, title }) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onRequestClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <View style={styles.dragIndicator} />
          <View style={styles.headerRow}>
            <Text style={styles.modalTitle}>{title}</Text>
          </View>
        </View>
        {children}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e4",
  },
  dragIndicator: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#d0d0d4",
    marginTop: 8,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0f0f2",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1a1a2e",
  },
});

export default SlideModal;
