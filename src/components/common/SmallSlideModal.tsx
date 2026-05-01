import React, { useRef, useEffect } from "react";
import {
  StyleSheet,
  Modal,
  View,
  Text,
  Animated,
  PanResponder,
  Dimensions,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Platform,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.5;
const DISMISS_THRESHOLD = 80;

const SmallSlideModal: React.FC<{
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  title: string;
}> = ({ visible, onRequestClose, children, title }) => {
  const translateY = useRef(new Animated.Value(MODAL_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      translateY.setValue(MODAL_HEIGHT);
    }
  }, [visible]);

  const slideOut = () => {
    Animated.timing(translateY, {
      toValue: MODAL_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onRequestClose());
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > DISMISS_THRESHOLD) {
          slideOut();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
    }),
  ).current;

  if (Platform.OS === "web") {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onRequestClose}
      >
        <View style={styles.webOverlay}>
          <View style={styles.webCard}>
            <View style={styles.webHeader}>
              <Text style={styles.webTitle}>{title}</Text>
              <TouchableOpacity
                style={styles.webCloseButton}
                onPress={onRequestClose}
              >
                <Feather name="x" size={18} color="#666" />
              </TouchableOpacity>
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
      transparent
      animationType="none"
      onRequestClose={slideOut}
    >
      <View style={styles.backdrop}>
        <TouchableWithoutFeedback onPress={slideOut}>
          <View style={styles.topSpace} />
        </TouchableWithoutFeedback>
        <Animated.View
          style={[styles.container, { transform: [{ translateY }] }]}
        >
          <View style={styles.header} {...panResponder.panHandlers}>
            <View style={styles.dragIndicator} />
            <Text style={styles.title}>{title}</Text>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  topSpace: {
    flex: 1,
  },
  container: {
    height: MODAL_HEIGHT,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e4",
    paddingTop: 4,
  },
  dragIndicator: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#d0d0d4",
    marginTop: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1a1a2e",
    paddingBottom: 12,
  },
  webOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  webCard: {
    width: "min(92vw, 460px)" as any,
    maxHeight: "82vh" as any,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  webHeader: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e4",
    paddingHorizontal: 54,
  },
  webTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a2e",
    textAlign: "center",
  },
  webCloseButton: {
    position: "absolute",
    top: 10,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f2",
    justifyContent: "center",
    alignItems: "center",
  },
  webContent: {
    maxHeight: "calc(82vh - 52px)" as any,
  },
});

export default SmallSlideModal;
