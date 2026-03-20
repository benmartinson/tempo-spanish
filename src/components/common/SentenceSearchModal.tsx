import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { Sentence } from "../../types";

interface SentenceSearchModalProps {
  visible: boolean;
  onClose: () => void;
  sentences: Sentence[];
  onPlayClip: (start: number) => void;
  videoId: string;
}

const SentenceSearchModal: React.FC<SentenceSearchModalProps> = ({
  visible,
  onClose,
  sentences,
  onPlayClip,
}) => {
  const [query, setQuery] = useState("");

  const handleSubmit = () => {
    if (!query.trim()) return;

    const sentenceNum = parseInt(query, 10);
    if (
      !isNaN(sentenceNum) &&
      sentenceNum >= 1 &&
      sentenceNum <= sentences.length
    ) {
      const sentence = sentences[sentenceNum - 1];
      onPlayClip(sentence.start);
      handleClose();
    }
  };

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modal}>
              <Text style={styles.title}>Go to Segment</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter Segment Number..."
                placeholderTextColor="#888"
                value={query}
                onChangeText={setQuery}
                keyboardType="numeric"
                onSubmitEditing={handleSubmit}
                returnKeyType="go"
                autoCorrect={false}
                autoComplete="off"
                autoFocus
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={handleClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSubmit}>
                  <Text style={styles.goText}>Go</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    width: 280,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
    textAlign: "center",
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "gray",
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "black",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingHorizontal: 8,
  },
  cancelText: {
    fontSize: 15,
    color: "#999",
    fontWeight: "500",
  },
  goText: {
    fontSize: 15,
    color: "#007AFF",
    fontWeight: "600",
  },
});

export default SentenceSearchModal;
