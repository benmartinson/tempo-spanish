import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const WelcomePanel: React.FC = () => (
  <View style={styles.panelColumn}>
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
            Tempo Language gives you a hands-on approach to learning a language,
            with a strong focus on speaking. You can use the features however
            you like, but here's the method we recommend.
          </Text>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>1. Shadow first</Text>
          <Text style={styles.body}>
            Start with a video clip you can understand fully. We'll help you
            find one.
          </Text>
          <Text style={styles.body}>
            Listen carefully to how the native speaker says each line. Then
            shadow it by recording yourself speaking the same words. Review your
            pronunciation and accuracy feedback, then try again.
          </Text>
          <Text style={styles.body}>
            Once the pronunciation feels comfortable, memorize the full segment.
            This is the most important step if you want to feel comfortable
            speaking. Practice reciting it until it feels natural.
          </Text>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>2. Then compose</Text>
          <Text style={styles.body}>
            After practicing with native examples, write your own short passage
            using what you've learned.
          </Text>
          <Text style={styles.body}>
            Get feedback on grammar and spelling, highlight words or phrases to
            hear them used in native clips, then memorize and recite your
            passage later to reinforce it.
          </Text>
          <Text style={styles.body}>
            The goal is simple: first absorb how native speakers say things,
            then use those patterns to express your own ideas with more
            confidence. You may be surprised how quickly it starts to come
            together!
          </Text>
        </View>
      </ScrollView>
    </View>
  </View>
);

const styles = StyleSheet.create({
  panelColumn: {
    flex: 1,
    gap: 16,
  },
  card: {
    flex: 1,
    minHeight: 460,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#f8f9fb",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.14)",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 22,
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
    borderColor: "#e6e9ef",
    backgroundColor: "#ffffff",
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
});

export default WelcomePanel;
