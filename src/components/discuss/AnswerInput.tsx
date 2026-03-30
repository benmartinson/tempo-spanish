import React from "react";
import { StyleSheet, View, TextInput, TouchableOpacity } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import FontAwesome from "@expo/vector-icons/FontAwesome";

interface AnswerInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  isKeyboardVisible: boolean;
  showRecordButton?: boolean;
  isRecording?: boolean;
  onRecordStart?: () => void;
  onRecordStop?: () => void;
}

const AnswerInput: React.FC<AnswerInputProps> = ({
  value,
  onChangeText,
  onSubmit,
  onClear,
  isKeyboardVisible,
  showRecordButton,
  isRecording,
  onRecordStart,
  onRecordStop,
}) => {
  const trimmedValue = value.trim();

  return (
    <View
      style={[styles.inputArea, { paddingBottom: isKeyboardVisible ? 10 : 40 }]}
    >
      <TextInput
        style={styles.textInput}
        placeholder="Type your answer..."
        placeholderTextColor="#999"
        value={value}
        onChangeText={onChangeText}
        autoComplete="off"
        autoCorrect={false}
        autoCapitalize="none"
        multiline
        maxLength={500}
        editable={!isRecording}
      />
      <TouchableOpacity
        style={[
          styles.trashButton,
          {
            backgroundColor:
              isKeyboardVisible || isRecording ? "white" : "#f0f0f0",
          },
        ]}
        onPress={onClear}
      >
        <FontAwesome
          name="trash-o"
          size={22}
          color={isKeyboardVisible || isRecording ? "red" : "#aaa"}
        />
      </TouchableOpacity>
      {showRecordButton && (
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.recordButtonActive,
          ]}
          onPress={isRecording ? onRecordStop : onRecordStart}
        >
          <MaterialIcons
            name={isRecording ? "stop" : "mic"}
            size={22}
            color="#fff"
          />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[
          styles.sendButton,
          !isRecording && !trimmedValue && styles.sendButtonDisabled,
        ]}
        onPress={isRecording ? onRecordStop : onSubmit}
        disabled={!isRecording && !trimmedValue}
      >
        <MaterialIcons
          name="send"
          size={22}
          color={trimmedValue || isRecording ? "white" : "#aaa"}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fafafa",
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: "#222",
    borderWidth: 1,
    borderColor: "#ddd",
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#4a69bd",
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#e0e0e0",
  },
  trashButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  recordButton: {
    backgroundColor: "#4a69bd",
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  recordButtonActive: {
    backgroundColor: "#ef4444",
  },
});

export default AnswerInput;
