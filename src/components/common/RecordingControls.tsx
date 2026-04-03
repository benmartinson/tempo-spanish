import { View, TouchableOpacity, StyleSheet } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import FontAwesome from "@expo/vector-icons/FontAwesome";

interface RecordingControlsProps {
  isRecording: boolean;
  hasRecordings: boolean;
  onTrash: () => void;
  onMic: () => void;
  onSubmit: () => void;
  disabled?: boolean;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({
  isRecording,
  hasRecordings,
  onTrash,
  onMic,
  onSubmit,
  disabled = false,
}) => {
  const isActive = isRecording || hasRecordings;

  return (
    <View style={styles.inputArea}>
      <TouchableOpacity
        style={[
          styles.trashButton,
          { backgroundColor: isActive ? "white" : "#f0f0f0" },
        ]}
        onPress={onTrash}
        disabled={!isActive}
      >
        <FontAwesome
          name="trash-o"
          size={22}
          color={isActive ? "red" : "#aaa"}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.micButton, disabled && styles.micButtonDisabled]}
        onPress={onMic}
        disabled={disabled}
      >
        <MaterialIcons
          name={isRecording ? "pause" : hasRecordings ? "add" : "mic"}
          size={22}
          color={disabled ? "#ccc" : isRecording ? "#555" : hasRecordings ? "#4a69bd" : "red"}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.sendButton,
          !hasRecordings && !isRecording && styles.sendButtonDisabled,
        ]}
        onPress={onSubmit}
        disabled={!hasRecordings && !isRecording}
      >
        <MaterialIcons
          name="send"
          size={22}
          color={hasRecordings || isRecording ? "#fff" : "#aaa"}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fafafa",
    gap: 24,
  },
  trashButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  micButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
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
  micButtonDisabled: {
    borderColor: "#eee",
    backgroundColor: "#f8f8f8",
  },
});

export default RecordingControls;
