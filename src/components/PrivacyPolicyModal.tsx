import React from "react";
import { ScrollView, Text, StyleSheet } from "react-native";
import SlideModal from "./common/SlideModal";

interface PrivacyPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  visible,
  onClose,
}) => {
  return (
    <SlideModal
      visible={visible}
      onRequestClose={onClose}
      title="Privacy Policy"
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.updated}>Last Updated: April 14, 2026</Text>

        <Text style={styles.body}>
          Tempo Spanish ("we," "us," or "our") operates the Tempo Spanish mobile
          application ("App"). This Privacy Policy explains how we collect, use,
          store, and share your information when you use the App. By using the
          App, you agree to the practices described in this policy.
        </Text>

        <Text style={styles.heading}>1. Information We Collect</Text>
        <Text style={styles.body}>
          <Text style={styles.subheading}>Account Information{"\n"}</Text>
          When you create an account, we collect your name and email address
          through our authentication provider, Clerk.{"\n\n"}
          <Text style={styles.subheading}>Audio Recordings{"\n"}</Text>
          When you use the shadowing feature, you record yourself speaking
          Spanish. These recordings are sent to a third-party speech-to-text
          service (Soniox) for transcription and are not stored on our servers.
          {"\n\n"}
          <Text style={styles.subheading}>Usage Data{"\n"}</Text>
          We collect information about how you interact with the App, including
          videos watched, sentences practiced, shadowing results, vocabulary
          selections, and credit usage. This data is stored in our database to
          provide personalized learning features and track your progress.
          {"\n\n"}
          <Text style={styles.subheading}>Purchase Information{"\n"}</Text>
          If you make in-app purchases, transactions are processed by Apple. We
          receive confirmation of your purchase but do not collect or store
          payment details such as credit card numbers.
        </Text>

        <Text style={styles.heading}>2. How We Use Your Information</Text>
        <Text style={styles.body}>
          We use the information we collect to:{"\n\n"}
          {"\u2022"} Provide and improve the App's language learning features
          {"\n"}
          {"\u2022"} Process your audio recordings for speech-to-text
          transcription and accuracy feedback{"\n"}
          {"\u2022"} Track your learning progress and vocabulary{"\n"}
          {"\u2022"} Manage your account and credit balance{"\n"}
          {"\u2022"} Communicate with you about your account or the App
        </Text>

        <Text style={styles.heading}>3. Third-Party Services</Text>
        <Text style={styles.body}>
          We use the following third-party services to operate the App. Each
          service receives only the data necessary to perform its function:
          {"\n\n"}
          <Text style={styles.subheading}>Clerk</Text> — Authentication and
          account management. Processes your name, email, and sign-in
          credentials. See: https://clerk.com/legal/privacy
          {"\n\n"}
          <Text style={styles.subheading}>Supabase</Text> — Database hosting.
          Stores your account data, learning progress, vocabulary, and usage
          history.
          {"\n\n"}
          <Text style={styles.subheading}>Soniox</Text> — Speech-to-text
          transcription. Receives your audio recordings for processing. Audio is
          not stored by Soniox after transcription.
          {"\n\n"}
          <Text style={styles.subheading}>OpenAI</Text> — Language translation
          and insights. Receives Spanish text (words and sentences) to generate
          translations. No personal data is sent to OpenAI.
          {"\n\n"}
          <Text style={styles.subheading}>ElevenLabs</Text> — Text-to-speech
          generation. Receives text to produce audio pronunciations. No personal
          data is sent to ElevenLabs.
          {"\n\n"}
          <Text style={styles.subheading}>YouTube</Text> — Video content is
          streamed from YouTube via the YouTube IFrame API. Your use of YouTube
          content within the App is subject to the Google Privacy Policy
          (https://policies.google.com/privacy) and the YouTube Terms of Service
          (https://www.youtube.com/t/terms).
          {"\n\n"}
          <Text style={styles.subheading}>Apple</Text> — Processes in-app
          purchases and manages App Store distribution.
        </Text>

        <Text style={styles.heading}>4. Data Sharing and Sales</Text>
        <Text style={styles.body}>
          We do not sell your personal information. We share data with
          third-party services only as described in Section 3, solely to operate
          and improve the App.
        </Text>

        <Text style={styles.heading}>5. Data Storage and Security</Text>
        <Text style={styles.body}>
          Your data is stored securely using Supabase. We use reasonable and
          appropriate industry-standard security measures to protect your
          information, including encryption and secure authentication methods.
          {"\n\n"}
          Audio recordings are transmitted securely for transcription and are
          stored temporarily on your device, not on our servers. Transcription
          results (text only) are stored to provide your learning history.
        </Text>

        <Text style={styles.heading}>6. Data Retention</Text>
        <Text style={styles.body}>
          We retain your account information and learning data for as long as
          your account is active. If you close your account, we will delete your
          personal data within 30 days, except where we are required by law to
          retain it.
        </Text>

        <Text style={styles.heading}>7. Your Rights</Text>
        <Text style={styles.body}>
          Depending on your location, you may have the right to:{"\n\n"}
          {"\u2022"} Access the personal data we hold about you{"\n"}
          {"\u2022"} Request correction of inaccurate data{"\n"}
          {"\u2022"} Request deletion of your data{"\n"}
          {"\u2022"} Object to or restrict certain processing{"\n"}
          {"\u2022"} Request a copy of your data in a portable format{"\n\n"}
          To exercise any of these rights, contact us at
          tempo.spanish@gmail.com.
        </Text>

        <Text style={styles.heading}>8. Children's Privacy</Text>
        <Text style={styles.body}>
          The App is not intended for children under 13. We do not knowingly
          collect personal information from children under 13. If we discover
          that we have collected information from a child under 13, we will
          promptly delete it. If you are between 13 and 18, you must have
          parental or guardian consent to use the App.
        </Text>

        <Text style={styles.heading}>9. Changes to This Policy</Text>
        <Text style={styles.body}>
          We may update this Privacy Policy from time to time. We will make
          reasonable efforts to notify you of material changes. Continued use of
          the App after changes are posted constitutes acceptance of the updated
          policy.
        </Text>

        <Text style={styles.heading}>10. Contact</Text>
        <Text style={styles.body}>
          If you have questions about this Privacy Policy or how your data is
          handled, please contact us at:{"\n\n"}
          tempo.spanish@gmail.com
        </Text>
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
  updated: {
    fontSize: 13,
    color: "#8e8e93",
    marginBottom: 16,
  },
  heading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    marginTop: 20,
    marginBottom: 8,
  },
  subheading: {
    fontWeight: "700",
    color: "#1a1a2e",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#3d3a52",
  },
});

export default PrivacyPolicyModal;
