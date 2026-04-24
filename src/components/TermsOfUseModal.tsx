import React from "react";
import { ScrollView, Text, StyleSheet } from "react-native";
import SlideModal from "./common/SlideModal";

interface TermsOfUseModalProps {
  visible: boolean;
  onClose: () => void;
}

const TermsOfUseModal: React.FC<TermsOfUseModalProps> = ({
  visible,
  onClose,
}) => {
  return (
    <SlideModal visible={visible} onRequestClose={onClose} title="Terms of Use">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.updated}>Last Updated: April 14, 2026</Text>

        <Text style={styles.body}>
          Welcome to Tempo Spanish. By downloading, accessing, or using the
          Tempo Spanish mobile application ("App"), you agree to be bound by
          these Terms of Use ("Terms"). If you do not agree, do not use the App.
        </Text>

        <Text style={styles.heading}>1. Description of Service</Text>
        <Text style={styles.body}>
          Tempo Spanish is a language learning application that helps users
          practice Spanish through video shadowing, speech recognition, and
          interactive exercises. The App allows users to listen to native
          speaker video content, record their own speech, and receive feedback
          on pronunciation and fluency.
        </Text>

        <Text style={styles.heading}>2. Eligibility</Text>
        <Text style={styles.body}>
          You must be at least 13 years old to use the App. By using the App,
          you represent that you meet this age requirement. If you are under 18,
          you must have parental or guardian consent.
        </Text>

        <Text style={styles.heading}>3. Account Registration</Text>
        <Text style={styles.body}>
          You must create an account to access certain features of the App. You
          are responsible for maintaining the confidentiality of your account
          credentials and for all activity that occurs under your account. You
          agree to provide accurate and complete information during
          registration.
        </Text>

        <Text style={styles.heading}>4. License</Text>
        <Text style={styles.body}>
          We grant you a limited, non-exclusive, non-transferable, revocable
          license to use the App for your personal, non-commercial use, subject
          to these Terms.
        </Text>

        <Text style={styles.heading}>5. Credits and Purchases</Text>
        <Text style={styles.body}>
          The App uses a credit-based system. New users may receive an initial
          allocation of free credits. Each recording submission consumes one
          credit. Additional credits may be purchased through in-app purchases
          via the Apple App Store.{"\n\n"}
          All purchases are processed by Apple and are subject to Apple’s terms
          and refund policies. Credits are non-transferable, have no cash value,
          and do not expire.{"\n\n"}
          We reserve the right to modify credit pricing and package offerings at
          any time.
        </Text>

        <Text style={styles.heading}>6. Acceptable Use</Text>
        <Text style={styles.body}>
          You agree not to:{"\n\n"}
          {"\u2022"} Use the App for any unlawful purpose{"\n"}
          {"\u2022"} Attempt to reverse engineer, decompile, or disassemble the
          App
          {"\n"}
          {"\u2022"} Interfere with or disrupt the App's servers or networks
          {"\n"}
          {"\u2022"} Upload harmful, offensive, or inappropriate content{"\n"}
          {"\u2022"} Share your account credentials with others{"\n"}
          {"\u2022"} Use automated tools, bots, or scripts to interact with the
          App
        </Text>

        <Text style={styles.heading}>7. Intellectual Property</Text>
        <Text style={styles.body}>
          All features, and functionality of the App — including but not limited
          to text, logos, and software — are owned by Tempo Spanish or its
          licensors and are protected by copyright, trademark, and other
          intellectual property laws.{"\n\n"}
          Video content displayed within the App is streamed from YouTube via
          the YouTube IFrame API and remains the property of its respective
          creators. By using these features, you agree to be bound by the
          YouTube Terms of Service (https://www.youtube.com/t/terms).
        </Text>

        <Text style={styles.heading}>8. User Recordings</Text>
        <Text style={styles.body}>
          Audio recordings you create within the App are processed for the
          purpose of providing language learning feedback. We do not claim
          ownership of your recordings. Your use of the App is also governed by
          our Privacy Policy, which describes how recordings and other data are
          collected, used, and stored.
        </Text>

        <Text style={styles.heading}>9. Privacy Policy</Text>
        <Text style={styles.body}>
          Your use of the App is also governed by our Privacy Policy
          (https://tempospanish.app/privacy), which is incorporated into
          these Terms by reference.
        </Text>

        <Text style={styles.heading}>10. Disclaimer of Warranties</Text>
        <Text style={styles.body}>
          The App is provided "as is" and "as available" without warranties of
          any kind, either express or implied. We do not guarantee that the App
          will be uninterrupted, error-free, or free of harmful components.
          Language learning results may vary.
        </Text>

        <Text style={styles.heading}>11. Limitation of Liability</Text>
        <Text style={styles.body}>
          To the maximum extent permitted by law, Tempo Spanish and its owners,
          employees, and affiliates shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages arising from
          your use of the App, including but not limited to loss of data,
          profits, or credits.
        </Text>

        <Text style={styles.heading}>12. Account Termination</Text>
        <Text style={styles.body}>
          We may suspend or terminate your account for violation of these Terms
          or for other legitimate business reasons. You may close your account
          at any time through the App's profile settings. Upon termination, any
          remaining credits may be forfeited to the extent permitted by law.
        </Text>

        <Text style={styles.heading}>13. Modifications to the App</Text>
        <Text style={styles.body}>
          We reserve the right to modify, suspend, or discontinue the App or any
          part of it at any time. Where reasonable, we will attempt to provide
          notice of material changes. In the event the App is discontinued, we
          may provide refunds or other compensation for unused paid credits
          where appropriate or required by law.
        </Text>

        <Text style={styles.heading}>14. Changes to Terms</Text>
        <Text style={styles.body}>
          We may update these Terms from time to time. Continued use of the App
          after changes are posted constitutes acceptance of the revised Terms.
          We will make reasonable efforts to notify you of material changes.
        </Text>

        <Text style={styles.heading}>15. Dispute Resolution</Text>
        <Text style={styles.body}>
          Any disputes arising out of or relating to these Terms or the App will
          be resolved through binding arbitration on an individual basis, and
          you waive any right to participate in a class action lawsuit or
          class-wide arbitration, to the extent permitted by law.
        </Text>

        <Text style={styles.heading}>16. Governing Law</Text>
        <Text style={styles.body}>
          These Terms shall be governed by and construed in accordance with the
          laws of the State of California, without regard to its conflict of law
          principles.
        </Text>

        <Text style={styles.heading}>17. Contact</Text>
        <Text style={styles.body}>
          If you have questions about these Terms, please contact us at:{"\n\n"}
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
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#3d3a52",
  },
});

export default TermsOfUseModal;
