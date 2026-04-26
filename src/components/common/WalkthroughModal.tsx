import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import Feather from "@expo/vector-icons/Feather";

const slides = [
  {
    title: "Shadowing",
    body: "You will watch the video in segments, listen to how the words are said, and when ready, press record to start your turn repeating the words aloud.\n\nAfter submitting your attempt, your speech will be processed and you will be given an accuracy score.",
  },
  {
    title: "Recording Speed",
    body: "Each shadow attempt will play the video while you record, but at a slower speed, which can be adjusted for increased difficulty.\n\nThe words in the transcript will highlight when they are said in the video so that you can follow along.\n\nThe recording will stop shortly after the video segment ends.",
  },
  {
    title: "Adjusting Difficulty",
    body: "You will see tabs below the video with different content, these allow for different ways of approaching the shadowing task, and allow you to control how difficult it is.\n\nFor example, like hiding every other word in the transcript so that you need to recall what was said in the segment in order to repeat the words aloud.",
  },
  {
    title: "Best Approach?",
    body: "You can decide on whatever approach works for you.\n\nWhether you most enjoy moving at a high pace through the segments at the easiest difficulty, or repeating each segment until you have it memorized, the most important thing in language learning is consistency and the amount of input and output you consume and perform.",
  },
  {
    title: "Credit System",
    body: "You will recieve 100 credits to start out.\n\nEach credit allows for 1 shadowing attempt.\n\nTo see credit-package pricing and buy more credits visit the profile section by pressing the top-right icon.",
  },
];

interface WalkthroughModalProps {
  visible: boolean;
  onComplete: () => void;
  closeable?: boolean;
}

const WalkthroughModal: React.FC<WalkthroughModalProps> = ({
  visible,
  onComplete,
  closeable = false,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (visible) setCurrentSlide(0);
  }, [visible]);
  const isFirst = currentSlide === 0;
  const isLast = currentSlide === slides.length - 1;
  const slide = slides[currentSlide];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {closeable && (
            <TouchableOpacity style={styles.closeButton} onPress={onComplete}>
              <Feather name="x" size={20} color="#666" />
            </TouchableOpacity>
          )}
          <View style={styles.progressRow}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i === currentSlide && styles.progressDotActive,
                ]}
              />
            ))}
          </View>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.body}>{slide.body}</Text>
          <View style={styles.buttonRow}>
            {!isFirst && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setCurrentSlide((s) => s - 1)}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.nextButton}
              onPress={() => {
                if (isLast) {
                  onComplete();
                } else {
                  setCurrentSlide((s) => s + 1);
                }
              }}
            >
              <Text style={styles.nextButtonText}>
                {isLast ? "Get Started" : "Next"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    width: "85%",
    gap: 16,
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f2",
    justifyContent: "center",
    alignItems: "center",
  },
  progressRow: {
    flexDirection: "row",
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#d0d0d4",
  },
  progressDotActive: {
    backgroundColor: "#4a69bd",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  body: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4a69bd",
  },
  backButtonText: {
    color: "#4a69bd",
    fontSize: 16,
    fontWeight: "600",
  },
  nextButton: {
    backgroundColor: "#4a69bd",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default WalkthroughModal;
