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
} from "react-native";

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
});

export default SmallSlideModal;
