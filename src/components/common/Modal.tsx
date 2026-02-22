import React from "react";
import {
  StyleSheet,
  Modal,
  SafeAreaView,
  View,
  TouchableOpacity,
  Text,
} from "react-native";
import Entypo from "@expo/vector-icons/Entypo";

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
          <TouchableOpacity style={styles.closeButton} onPress={onRequestClose}>
            <Entypo name="cross" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={styles.closeButton} />
        </View>
        {children}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "white",
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
    color: "black",
  },
});

export default SlideModal;
