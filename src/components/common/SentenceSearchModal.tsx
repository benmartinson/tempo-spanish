import React, { useState } from "react";
import { View, StyleSheet, TextInput } from "react-native";
import { Sentence } from "../../types";
import Modal from "./Modal";

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
      onRequestClose={handleClose}
      title="Go to Sentence"
    >
      <View style={styles.container}>
        <View style={styles.inputContainer}>
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
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    marginTop: 16,
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
});

export default SentenceSearchModal;
