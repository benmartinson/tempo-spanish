import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import CreditStore from "../CreditStore";

interface NoCreditsModalProps {
  visible: boolean;
  onClose: () => void;
}

const NoCreditsModal: React.FC<NoCreditsModalProps> = ({
  visible,
  onClose,
}) => {
  const [creditStoreVisible, setCreditStoreVisible] = useState(false);

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.card}>
                <MaterialIcons name="token" size={40} color="#5a5680" />
                <Text style={styles.title}>Out of Credits</Text>
                <Text style={styles.message}>
                  You need credits to record. Purchase more credits to continue
                  practicing.
                </Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.purchaseButton}
                    onPress={() => {
                      onClose();
                      setCreditStoreVisible(true);
                    }}
                  >
                    <Text style={styles.purchaseButtonText}>Purchase</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <CreditStore
        visible={creditStoreVisible}
        onClose={() => setCreditStoreVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    width: "80%",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  message: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  closeButton: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  closeButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
  },
  purchaseButton: {
    backgroundColor: "#4a69bd",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  purchaseButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default NoCreditsModal;
