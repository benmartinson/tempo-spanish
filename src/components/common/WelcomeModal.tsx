import React from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { setHasSeenWelcomeModals } from "../../store/actions/dataActions";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface WelcomeModalProps {
  visible: boolean;
  onClose: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ visible, onClose }) => {
  const dispatch = useDispatch();

  const handleClose = async () => {
    dispatch(setHasSeenWelcomeModals(true));
    await AsyncStorage.setItem("has_seen_welcome_modals", "true");
    console.log("closing");
    onClose();
  };

  return (
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
              <Text style={styles.title}>Welcome to Tempo Spanish</Text>
              <Text style={styles.message}>
                If you're looking for a way to improve your spanish speaking
                skills, you've come to the right place!
              </Text>
              <Text style={styles.message}>
                Tempo offers a way to incorporate speaking practice into a
                'comprehensible input' approach to language learning.
              </Text>
              <Text style={styles.message}>
                To get started, search among our wide selection of native
                spanish-speaking Youtube channels, and choose a video that
                interests you.
              </Text>
              <TouchableOpacity style={styles.button} onPress={handleClose}>
                <Text style={styles.buttonText}>Get Started</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
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
    width: "85%",
    gap: 16,
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
  button: {
    backgroundColor: "#4a69bd",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default WelcomeModal;
