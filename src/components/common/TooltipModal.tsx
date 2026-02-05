import {
  Modal,
  Pressable,
  View,
  ViewStyle,
  StyleSheet,
  Text,
  ScrollView,
} from "react-native";
import { SegmentWord } from "../../types";

interface TooltipModalProps {
  isVisible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
}

const TooltipModal: React.FC<TooltipModalProps> = ({
  isVisible,
  onRequestClose,
  children,
}) => {
  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <Pressable style={styles.tooltipOverlay} onPress={onRequestClose}>
        <ScrollView
          contentContainerStyle={styles.tooltipContent}
          style={styles.tooltipContainer}
        >
          {children}
        </ScrollView>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  tooltipOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  tooltipContainer: {
    flexGrow: 0,
    backgroundColor: "#3d3a50",
    maxHeight: "80%",
    borderRadius: 12,
    marginHorizontal: 24,
    padding: 24,
    minWidth: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  tooltipContent: {
    alignItems: "center",
  },
});
export default TooltipModal;
