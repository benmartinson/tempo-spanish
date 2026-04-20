import { View, TouchableOpacity, StyleSheet } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import FontAwesome from "@expo/vector-icons/FontAwesome";

interface RecordingControlsProps {
  isRecording: boolean;
  onTrash: () => void;
  onMic: () => void;
  disabled?: boolean;
  showContainer?: boolean;
  hideTrash?: boolean;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({
  isRecording,
  onTrash,
  onMic,
  disabled = false,
  showContainer = true,
  hideTrash = false,
}) => {
  return (
    <View style={showContainer ? styles.inputArea : styles.buttonsOnly}>
      {!hideTrash && (
        <TouchableOpacity
          style={[
            styles.trashButton,
            { backgroundColor: isRecording ? "white" : "#f0f0f0" },
          ]}
          onPress={onTrash}
          disabled={!isRecording}
        >
          <FontAwesome
            name="trash-o"
            size={22}
            color={isRecording ? "red" : "#aaa"}
          />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[
          styles.micButton,
          disabled && styles.micButtonDisabled,
          isRecording && styles.sendButton,
        ]}
        onPress={onMic}
        disabled={disabled}
        hitSlop={{ top: 20, bottom: 16, left: 16, right: 30 }}
      >
        <MaterialIcons
          name={isRecording ? "send" : "mic"}
          size={22}
          color={disabled ? "#ccc" : isRecording ? "#fff" : "red"}
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
    borderColor: "#4a69bd",
  },
  micButtonDisabled: {
    borderColor: "#eee",
    backgroundColor: "#f8f8f8",
  },
  buttonsOnly: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
});

export default RecordingControls;
