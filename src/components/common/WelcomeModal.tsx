import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface WelcomeModalProps {
  visible: boolean;
  onComplete: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ visible, onComplete }) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onComplete}
  >
    <View style={styles.overlay}>
      <View style={styles.card}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
        >
          <View style={styles.header}>
            <View style={styles.accentLine} />
            <Text style={styles.title}>
              A practical way to start speaking faster
            </Text>
          </View>

          <View style={styles.introBand}>
            <Text style={styles.body}>
              Tempo Language gives you a hands-on approach to learning a
              language, with a strong focus on speaking. You can use the
              features however you like, but here's the method we recommend.
            </Text>
          </View>

          <View style={[styles.sectionBlock, styles.shadowSection]}>
            <Text style={styles.sectionTitle}>1. Shadow first</Text>
            <Text style={styles.body}>
              Start with a video clip you can understand fully. We'll help you
              find one.
            </Text>
            <Text style={styles.body}>
              Listen carefully to how the native speaker says each line. Then
              shadow it by recording yourself speaking the same words. Review
              your pronunciation and accuracy feedback, then try again.
            </Text>
            <Text style={styles.body}>
              Once the pronunciation feels comfortable, memorize the full
              segment. This is the most important step if you want to feel
              comfortable speaking. Practice reciting it until it feels natural.
            </Text>
          </View>

          <View style={[styles.sectionBlock, styles.composeSection]}>
            <Text style={styles.sectionTitle}>2. Then compose</Text>
            <Text style={styles.body}>
              After practicing with native examples, write your own short
              passage using what you've learned.
            </Text>
            <Text style={styles.body}>
              Get feedback on grammar and spelling, highlight words or phrases
              to hear them used in native clips, then memorize and recite your
              passage later to reinforce it.
            </Text>
            <Text style={styles.body}>
              The goal is simple: first absorb how native speakers say things,
              then use those patterns to express your own ideas with more
              confidence. You may be surprised how quickly it starts to come
              together!
            </Text>
          </View>

          <View style={[styles.sectionBlock, styles.composeSection]}>
            <Text style={styles.sectionTitle}>3. Repeat once per day</Text>
            <Text style={styles.body}>
              Build up a set of memorized passages that you can reference and be
              able to recite throughout the day. Use the 'Quick Refresher'
              feature to see the starting words in each sentence of the passage.
              Being able to speak a language with confidence requires memorizing
              many useful phrases, so you can recall them naturally and adapt
              them when expressing your own ideas.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onComplete}
            activeOpacity={0.78}
          >
            <Text style={styles.primaryButtonText}>Get started</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(18,22,32,0.42)",
  },
  card: {
    width: "92%",
    maxWidth: 620,
    maxHeight: "86%",
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#f8f9fb",
    borderWidth: 1,
    borderColor: "#eef0f4",
    shadowColor: "#12172f",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 12,
  },
  header: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 4,
  },
  accentLine: {
    width: 48,
    height: 3,
    borderRadius: 999,
    backgroundColor: "#cfd5df",
  },
  title: {
    color: "#242838",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  introBand: {
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e6e9ef",
  },
  sectionBlock: {
    gap: 9,
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  shadowSection: {
    backgroundColor: "#ffffff",
    borderColor: "#e6e9ef",
  },
  composeSection: {
    backgroundColor: "#ffffff",
    borderColor: "#e6e9ef",
  },
  sectionTitle: {
    color: "#2d3142",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  body: {
    color: "#606775",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e4e7ed",
    backgroundColor: "#f8f9fb",
  },
  primaryButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#2f3444",
    borderWidth: 1,
    borderColor: "#2f3444",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
});

export default WelcomeModal;
