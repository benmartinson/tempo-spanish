import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import SlideModal from "./common/SlideModal";

interface HelpAndFeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

const HelpAndFeedbackModal: React.FC<HelpAndFeedbackModalProps> = ({
  visible,
  onClose,
}) => {
  return (
    <SlideModal
      visible={visible}
      onRequestClose={onClose}
      title="Help & Feedback"
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeading}>How Tempo Language Works</Text>
        <Text style={styles.body}>
          Tempo Language helps you learn Spanish by shadowing native speakers in
          YouTube videos. Watch a clip, listen carefully, then record yourself
          repeating what you heard. The app transcribes your recording and gives
          you accuracy feedback so you can track your progress.
        </Text>

        <Text style={styles.sectionHeading}>Getting Started</Text>
        <View style={styles.step}>
          <Text style={styles.stepNumber}>1</Text>
          <Text style={styles.stepText}>
            Choose a video from the library. Videos are organized by difficulty.
          </Text>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepNumber}>2</Text>
          <Text style={styles.stepText}>
            Listen to each sentence, then tap the record button and repeat what
            you heard.
          </Text>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepNumber}>3</Text>
          <Text style={styles.stepText}>
            Review your accuracy results. Tap any word in the transcript to see
            its translation.
          </Text>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepNumber}>4</Text>
          <Text style={styles.stepText}>
            Use the memorize tab to practice recalling sentences from memory
            with adjustable difficulty.
          </Text>
        </View>

        <Text style={styles.sectionHeading}>Credits</Text>
        <Text style={styles.body}>
          Each recording submission uses one credit. You can purchase additional
          credits from your profile page.
        </Text>

        <Text style={styles.sectionHeading}>Contact Us</Text>
        <Text style={styles.body}>
          Have a question, found a bug, or want to suggest a feature? We'd love
          to hear from you.
        </Text>

        <TouchableOpacity
          style={styles.emailButton}
          onPress={() =>
            Linking.openURL(
              "mailto:tempo.spanish@gmail.com?subject=Tempo Language Feedback",
            )
          }
        >
          <MaterialIcons name="email" size={20} color="#fff" />
          <Text style={styles.emailButtonText}>tempo.spanish@gmail.com</Text>
        </TouchableOpacity>
      </ScrollView>
    </SlideModal>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    marginTop: 20,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#3d3a52",
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#5a5680",
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 26,
    overflow: "hidden",
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: "#3d3a52",
  },
  emailButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#5a5680",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  emailButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default HelpAndFeedbackModal;
