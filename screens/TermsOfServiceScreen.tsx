import React from "react";
import { StyleSheet, View } from "react-native";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";

export default function TermsOfServiceScreen() {
  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <ThemedText type="h2" style={styles.mainTitle}>
          Terms of Service
        </ThemedText>
        <ThemedText type="small" style={styles.effectiveDate}>
          Effective Date: December 6, 2025
        </ThemedText>
        <ThemedText type="small" style={styles.lastUpdated}>
          Last Updated: December 6, 2025
        </ThemedText>

        <View style={styles.section}>
          <ThemedText type="body" style={styles.paragraph}>
            Welcome to Dripn. These Terms of Service ("Terms") govern your access to and use of the Dripn mobile application and related services (collectively, the "Service"). By accessing or using Dripn, you agree to be bound by these Terms.
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            Please read these Terms carefully before using our Service. If you do not agree to these Terms, you may not access or use the Service.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            1. Acceptance of Terms
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            By creating an account or using Dripn, you confirm that you:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>
              Are at least 13 years of age (or the minimum age in your jurisdiction)
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Have the legal capacity to enter into these Terms
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Agree to comply with all applicable laws and regulations
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Have read and understood our Privacy Policy
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            2. Description of Service
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            Dripn is a fashion advice platform that enables users to:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>
              Post outfit photos and videos for feedback
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Receive AI-powered fashion recommendations
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Engage with a community of fashion enthusiasts
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Access personalized styling advice based on preferences
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Discover fashion deals, events, and trends
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Subscribe to premium features for enhanced experiences
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            3. User Accounts
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            3.1 Account Creation
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            To use certain features, you must create an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate.
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            3.2 Account Security
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must immediately notify us of any unauthorized use of your account.
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            3.3 One Account Per Person
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            Each user may maintain only one account. Creating multiple accounts may result in termination of all accounts.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            4. Subscription Plans and Payments
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            4.1 Subscription Tiers
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            Dripn offers the following subscription tiers with varying features:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>
              Free: Limited uploads and AI advice requests
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Basic: Increased uploads and AI requests
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Premium: Unlimited uploads, priority AI, and video posts
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              VIP: All premium features plus personal stylist sessions and video calling
            </ThemedText>
          </View>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            4.2 Billing
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            Paid subscriptions are billed in advance on a monthly or annual basis. Payments are processed securely through Stripe. By subscribing, you authorize us to charge your payment method.
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            4.3 Automatic Renewal
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current billing period. You can manage your subscription through your account settings or the app store.
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            4.4 Refunds
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            Refunds are handled according to the policies of the platform through which you subscribed (Apple App Store or Google Play Store). For direct purchases, refund requests may be considered on a case-by-case basis within 14 days of purchase.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            5. User Content
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            5.1 Your Content
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            You retain ownership of content you post ("User Content"). By posting content, you grant Dripn a worldwide, non-exclusive, royalty-free license to use, display, reproduce, and distribute your content in connection with the Service.
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            5.2 Content Standards
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            You agree that your content will not:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>
              Violate any law or infringe on third-party rights
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Contain nudity, sexually explicit material, or adult content
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Promote violence, hatred, discrimination, or harassment
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Include spam, misleading information, or commercial solicitation
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Impersonate others or misrepresent your identity
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Contain malware, viruses, or harmful code
            </ThemedText>
          </View>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            5.3 Content Moderation
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            We reserve the right to remove any content that violates these Terms or is otherwise objectionable, at our sole discretion and without prior notice.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            6. Acceptable Use
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            You agree not to:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>
              Use the Service for any unlawful purpose
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Harass, bully, or intimidate other users
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Attempt to gain unauthorized access to the Service or other accounts
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Reverse engineer, decompile, or disassemble any part of the Service
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Use automated systems or bots without our written consent
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Collect user information without consent
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Interfere with or disrupt the Service or servers
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Circumvent security measures or usage limits
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            7. Intellectual Property
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            7.1 Our Intellectual Property
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            The Dripn name, logo, design, features, and all related intellectual property are owned by Dripn. You may not use, copy, or distribute our intellectual property without express written permission.
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            7.2 License to Use
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            We grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for personal, non-commercial purposes in accordance with these Terms.
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            7.3 Copyright Claims
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            If you believe content on Dripn infringes your copyright, please contact us at copyright@dripn.app with the required information for a DMCA takedown notice.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            8. AI Fashion Advice
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            Dripn provides AI-powered fashion recommendations as a guide. You acknowledge that:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>
              AI advice is for informational and entertainment purposes
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Recommendations are suggestions, not professional styling services
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              You are responsible for your own fashion choices and purchases
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              AI recommendations may vary and are not guaranteed to be accurate
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            9. Third-Party Services
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            The Service may contain links to third-party websites, affiliate shopping links, or services. We are not responsible for the content, products, or services offered by third parties. Your interactions with third parties are solely between you and them.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            10. Disclaimer of Warranties
          </ThemedText>
          <ThemedText type="body" style={[styles.paragraph, styles.uppercase]}>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            We do not warrant that the Service will be uninterrupted, error-free, or secure. We do not guarantee the accuracy, completeness, or usefulness of any content or recommendations.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            11. Limitation of Liability
          </ThemedText>
          <ThemedText type="body" style={[styles.paragraph, styles.uppercase]}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, STYLEWISE AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            Our total liability for any claims arising from these Terms or your use of the Service shall not exceed the amount you paid to Dripn in the twelve (12) months preceding the claim.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            12. Indemnification
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            You agree to indemnify, defend, and hold harmless Dripn and its affiliates from any claims, damages, losses, or expenses (including reasonable legal fees) arising from your use of the Service, your content, or your violation of these Terms.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            13. Termination
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            13.1 Your Right to Terminate
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            You may terminate your account at any time through the Settings menu or by contacting support. Account deletion requests will be processed within 30 days.
          </ThemedText>

          <ThemedText type="h4" style={styles.subsectionTitle}>
            13.2 Our Right to Terminate
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            We may suspend or terminate your account at our discretion, without prior notice, for violations of these Terms, harmful behavior, or for any other reason. Upon termination, your license to use the Service ends immediately.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            14. Changes to Terms
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            We may modify these Terms at any time. Material changes will be notified through the app or via email. Your continued use of the Service after changes constitutes acceptance of the revised Terms.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            15. Governing Law and Disputes
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            These Terms are governed by the laws of England and Wales. Any disputes arising from these Terms or your use of the Service shall be resolved through binding arbitration or in the courts of England and Wales, except where prohibited by local law.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            16. General Provisions
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>
              Entire Agreement: These Terms, together with our Privacy Policy, constitute the entire agreement between you and Dripn.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Severability: If any provision is found unenforceable, the remaining provisions remain in effect.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Waiver: Our failure to enforce any right does not constitute a waiver.
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              Assignment: You may not assign these Terms without our consent. We may assign our rights freely.
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            17. Contact Us
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            If you have questions about these Terms, please contact us:
          </ThemedText>
          <View style={styles.contactInfo}>
            <ThemedText type="body" style={styles.contactItem}>
              Email: legal@dripn.app
            </ThemedText>
            <ThemedText type="body" style={styles.contactItem}>
              Support: support@dripn.app
            </ThemedText>
          </View>
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
    marginBottom: Spacing.xl,
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
  uppercase: {
    textTransform: "uppercase",
    fontSize: 12,
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
