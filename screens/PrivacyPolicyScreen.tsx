import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, LuxuryColors, ScreenGradients } from "@/constants/theme";

export default function PrivacyPolicyScreen() {
  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <ThemedText type="h2" style={styles.mainTitle}>
          Privacy Policy
        </ThemedText>
        <ThemedText type="small" style={styles.effectiveDate}>
          Effective Date: December 7, 2025
        </ThemedText>
        <ThemedText type="small" style={styles.lastUpdated}>
          Last Updated: December 7, 2025
        </ThemedText>

        <View style={styles.welcomeSection}>
          <ThemedText type="body" style={styles.welcomeText}>
            Your trust means everything to us. We know that sharing personal information requires confidence in how it will be handled, and we take that responsibility seriously.
          </ThemedText>
          <ThemedText type="body" style={styles.welcomeText}>
            This policy explains, in plain language, what information we collect, why we collect it, and how we keep it safe. If you ever have questions, our support team is always here to help.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="body" style={styles.paragraph}>
            Welcome to Dripn. Your privacy is important to us. This Privacy Policy explains how Dripn ("we," "us," or "our") collects, uses, discloses, and protects your personal information when you use our mobile application and related services (collectively, the "Service").
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            By using Dripn, you agree to the collection and use of information in accordance with this policy. If you do not agree with this policy, please do not use our Service.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            1. Information We Collect
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            1.1 Information You Provide
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            When you create an account, use our Service, or contact us, you may provide:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>
              Account information: name, email address, password, gender, and country.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Profile information: profile photo, style preferences, body measurements, and fashion interests.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Content: photos, videos, outfit posts, comments, and voice recordings you share.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Communications: messages, feedback, and support requests.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Payment information: billing details processed securely through Stripe.
            </ThemedText>
          </View>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            1.2 Information Collected Automatically
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            When you use our Service, we automatically collect:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>
              Device information: device type, operating system, and unique device identifiers.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Usage data: features used, interactions, time spent, and preferences.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Location data: approximate location based on IP address or precise location if you grant permission.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Camera and photo library access: only when you choose to upload content.
            </ThemedText>
          </View>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            1.3 Information from Third Parties
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            We may receive information from third-party services you connect, such as social media platforms for login or sharing purposes.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            2. How We Use Your Information
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            We use the information we collect to:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>
              Provide, maintain, and improve the Dripn Service.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Personalize your experience with AI-powered fashion recommendations.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Process subscriptions and payments securely.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Display regionally and gender-appropriate fashion content.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Send notifications about your account, posts, and community activity.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Respond to your inquiries and provide customer support.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Detect, prevent, and address fraud, abuse, and security issues.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Comply with legal obligations and enforce our Terms of Service.
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            3. AI and Automated Processing
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            Dripn uses artificial intelligence to provide personalized fashion advice. When you request AI recommendations:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>
              Your outfit photos may be analysed to provide styling suggestions.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Your style preferences and history inform personalised recommendations.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              We do not use your photos to train AI models without explicit consent.
            </ThemedText>
          </View>
          <ThemedText type="body" style={styles.paragraph}>
            You can disable AI suggestions in your Settings at any time.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            4. Information Sharing and Disclosure
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            We do not sell your personal information. We may share information:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>
              With service providers: Payment processors (Stripe), email services (SendGrid), analytics, and cloud hosting providers who assist in operating our Service.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              With the community: Content you post publicly is visible to other users.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              For legal reasons: When required by law, court order, or to protect rights and safety.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Business transfers: In connection with a merger, acquisition, or sale of assets.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              With your consent: When you authorise us to share information.
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            5. Data Retention
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            We retain your personal information for as long as your account is active or as needed to provide the Service. After account deletion:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>
              Most data is deleted within 30 days.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Some data may be retained for legal, security, or fraud prevention purposes.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Anonymised data may be retained for analytics.
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            6. Your Rights and Choices
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            Depending on your location, you may have the right to:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>
              Access: Request a copy of your personal data.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Correction: Update or correct inaccurate information.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Deletion: Request deletion of your account and data.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Portability: Receive your data in a portable format.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Opt-out: Disable marketing communications and AI suggestions.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Restriction: Limit how we process your data.
            </ThemedText>
          </View>
          <ThemedText type="body" style={styles.paragraph}>
            To exercise these rights, contact us at privacy@dripn.app or use the in-app Settings.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            7. Data Security
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            We implement industry-standard security measures to protect your information, including:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>
              Encryption of data in transit and at rest.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Secure authentication and access controls.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Regular security assessments and monitoring.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              PCI-compliant payment processing through Stripe.
            </ThemedText>
          </View>
          <ThemedText type="body" style={styles.paragraph}>
            While we strive to protect your data, no method of transmission or storage is completely secure.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            8. International Data Transfers
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers in compliance with applicable data protection laws.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            9. Children's Privacy
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            Dripn is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected such information, please contact us immediately, and we will delete it.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            10. Third-Party Links and Services
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            Our Service may contain links to third-party websites, affiliate shopping links, or services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any personal information.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            11. Updates to This Policy
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy in the app and updating the "Last Updated" date. Your continued use of the Service after changes constitutes acceptance of the updated policy.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            12. Contact Us
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            If you have questions about this Privacy Policy or our data practices, please contact us:
          </ThemedText>
          <View style={styles.contactInfo}>
            <ThemedText type="body" style={styles.contactItem}>
              Email: privacy@dripn.app
            </ThemedText>
            <ThemedText type="body" style={styles.contactItem}>
              Support: support@dripn.app
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            13. Region-Specific Provisions
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            For European Users (GDPR)
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            If you are in the European Economic Area, you have additional rights under GDPR including the right to lodge a complaint with your local data protection authority. Our legal bases for processing include consent, contract performance, and legitimate interests.
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            For California Users (CCPA/CPRA)
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            California residents have the right to know what personal information is collected, request deletion, and opt-out of the sale of personal information. We do not sell personal information. To exercise your rights, email privacy@dripn.app.
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            For UK Users
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            UK residents have rights under UK GDPR similar to those in the EEA. You may contact the Information Commissioner's Office (ICO) with any concerns.
          </ThemedText>
        </View>

        <View style={styles.footer}>
          <ThemedText type="small" style={styles.footerText}>
            Dripn - Fashion Advice App
          </ThemedText>
          <ThemedText type="small" style={styles.footerText}>
            Version 1.0.0
          </ThemedText>
        </View>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing["2xl"],
  },
  mainTitle: {
    marginBottom: Spacing.sm,
  },
  effectiveDate: {
    opacity: 0.6,
    marginBottom: Spacing.xs,
  },
  lastUpdated: {
    opacity: 0.6,
    marginBottom: Spacing.lg,
  },
  welcomeSection: {
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(150, 150, 150, 0.08)',
  },
  welcomeText: {
    lineHeight: 26,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  subsectionTitle: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    fontWeight: "600",
  },
  paragraph: {
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  bulletList: {
    marginLeft: Spacing.md,
    marginBottom: Spacing.sm,
  },
  bulletItem: {
    lineHeight: 24,
    marginBottom: Spacing.xs,
    paddingLeft: Spacing.sm,
  },
  contactInfo: {
    marginTop: Spacing.sm,
    marginLeft: Spacing.md,
  },
  contactItem: {
    marginBottom: Spacing.xs,
  },
  footer: {
    alignItems: "center",
    paddingTop: Spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(150, 150, 150, 0.3)",
    marginTop: Spacing.xl,
  },
  footerText: {
    opacity: 0.5,
    marginBottom: Spacing.xs,
  },
});
