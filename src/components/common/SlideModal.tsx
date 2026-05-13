import React from "react";
import {
  StyleSheet,
  Modal,
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";

const SlideModal: React.FC<{
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  title: string;
  noBorderRadius?: boolean;
  showCloseButton?: boolean;
}> = ({
  visible,
  onRequestClose,
  children,
  title,
  noBorderRadius = false,
  showCloseButton = true,
}) => {
  if (Platform.OS === "web") {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onRequestClose}
      >
        <View style={styles.webOverlay}>
          <View style={[styles.webCard, noBorderRadius && styles.noRadius]}>
            <View style={styles.webHeader}>
              <Text style={styles.webTitle}>{title}</Text>
              {showCloseButton && (
                <TouchableOpacity
                  style={styles.webCloseButton}
                  onPress={onRequestClose}
                >
                  <Feather name="x" size={18} color="#666" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.webContent}>{children}</View>
          </View>
        </View>
      </Modal>
    );
  }

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
  webOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  webCard: {
    width: "min(92vw, 640px)" as any,
    maxHeight: "86vh" as any,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  noRadius: {
    borderRadius: 0,
  },
  webHeader: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e4",
    paddingHorizontal: 56,
  },
  webTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a2e",
    textAlign: "center",
    opacity: 0.75,
  },
  webCloseButton: {
    position: "absolute",
    top: 11,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f2",
    justifyContent: "center",
    alignItems: "center",
  },
  webContent: {
    maxHeight: "calc(86vh - 54px)" as any,
  },
});

export default SlideModal;
