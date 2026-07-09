import React, { useLayoutEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTranslations } from "@/contexts/TranslationContext";

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();
  const { t } = useTranslations();

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('privacy.screenTitle') });
  }, [navigation, t]);

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <ThemedText type="h2" style={styles.mainTitle}>{t('privacy.title')}</ThemedText>
        <ThemedText type="small" style={styles.effectiveDate}>{t('privacy.effectiveDate')}</ThemedText>
        <ThemedText type="small" style={styles.lastUpdated}>{t('privacy.lastUpdated')}</ThemedText>

        <View style={styles.welcomeSection}>
          <ThemedText type="body" style={styles.welcomeText}>{t('privacy.welcome1')}</ThemedText>
          <ThemedText type="body" style={styles.welcomeText}>{t('privacy.welcome2')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.intro1')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.intro2')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('privacy.section01.title')}</ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('privacy.section01.sub01.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section01.sub01.intro')}</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section01.sub01.bullet1')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section01.sub01.bullet2')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section01.sub01.bullet3')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section01.sub01.bullet4')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section01.sub01.bullet5')}</ThemedText>
          </View>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('privacy.section01.sub02.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section01.sub02.intro')}</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section01.sub02.bullet1')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section01.sub02.bullet2')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section01.sub02.bullet3')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section01.sub02.bullet4')}</ThemedText>
          </View>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('privacy.section01.sub03.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section01.sub03.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('privacy.section02.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section02.intro')}</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section02.bullet1')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section02.bullet2')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section02.bullet3')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section02.bullet4')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section02.bullet5')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section02.bullet6')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section02.bullet7')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section02.bullet8')}</ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('privacy.section03.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section03.intro')}</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section03.bullet1')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section03.bullet2')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section03.bullet3')}</ThemedText>
          </View>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section03.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('privacy.section04.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section04.intro')}</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section04.bullet1')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section04.bullet2')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section04.bullet3')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section04.bullet4')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section04.bullet5')}</ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('privacy.section05.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section05.intro')}</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section05.bullet1')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section05.bullet2')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section05.bullet3')}</ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('privacy.section06.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section06.intro')}</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section06.bullet1')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section06.bullet2')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section06.bullet3')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section06.bullet4')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section06.bullet5')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section06.bullet6')}</ThemedText>
          </View>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section06.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('privacy.section07.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section07.intro')}</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section07.bullet1')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section07.bullet2')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section07.bullet3')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('privacy.section07.bullet4')}</ThemedText>
          </View>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section07.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('privacy.section08.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section08.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('privacy.section09.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section09.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('privacy.section10.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section10.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('privacy.section11.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section11.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('privacy.section12.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section12.intro')}</ThemedText>
          <View style={styles.contactInfo}>
            <ThemedText type="body" style={styles.contactItem}>{t('privacy.section12.emailPrivacy')}</ThemedText>
            <ThemedText type="body" style={styles.contactItem}>{t('privacy.section12.emailSupport')}</ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('privacy.section13.title')}</ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('privacy.section13.sub01.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section13.sub01.body')}</ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('privacy.section13.sub02.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section13.sub02.body')}</ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('privacy.section13.sub03.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('privacy.section13.sub03.body')}</ThemedText>
        </View>

        <View style={styles.footer}>
          <ThemedText type="small" style={styles.footerText}>{t('privacy.footerAppName')}</ThemedText>
          <ThemedText type="small" style={styles.footerText}>{t('privacy.footerVersion')}</ThemedText>
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
