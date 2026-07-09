import React, { useLayoutEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslations } from "@/contexts/TranslationContext";

export default function TermsOfServiceScreen() {
  const navigation = useNavigation();
  const { t } = useTranslations();

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('terms.screenTitle') });
  }, [navigation, t]);

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <ThemedText type="h2" style={styles.mainTitle}>
          {t('terms.title')}
        </ThemedText>
        <ThemedText type="small" style={styles.effectiveDate}>
          {t('terms.effectiveDate')}
        </ThemedText>
        <ThemedText type="small" style={styles.lastUpdated}>
          {t('terms.lastUpdated')}
        </ThemedText>

        <View style={styles.welcomeSection}>
          <ThemedText type="body" style={styles.welcomeText}>
            {t('terms.welcome1')}
          </ThemedText>
          <ThemedText type="body" style={styles.welcomeText}>
            {t('terms.welcome2')}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="body" style={styles.paragraph}>
            {t('terms.intro1')}
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            {t('terms.intro2')}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            {t('terms.section01.title')}
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            {t('terms.section01.intro')}
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>
              {t('terms.section01.bullet1')}
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              {t('terms.section01.bullet2')}
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              {t('terms.section01.bullet3')}
            </ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>
              {t('terms.section01.bullet4')}
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            {t('terms.section02.title')}
          </ThemedText>
          <ThemedText type="body" style={styles.paragraph}>
            {t('terms.section02.intro')}
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section02.bullet1')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section02.bullet2')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section02.bullet3')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section02.bullet4')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section02.bullet5')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section02.bullet6')}</ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            {t('terms.section03.title')}
          </ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('terms.section03.sub01.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section03.sub01.body')}</ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('terms.section03.sub02.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section03.sub02.body')}</ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('terms.section03.sub03.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section03.sub03.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            {t('terms.section04.title')}
          </ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('terms.section04.sub01.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section04.sub01.intro')}</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section04.sub01.bullet1')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section04.sub01.bullet2')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section04.sub01.bullet3')}</ThemedText>
          </View>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('terms.section04.sub02.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section04.sub02.body1')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section04.sub02.body2')}</ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('terms.section04.sub03.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section04.sub03.body')}</ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('terms.section04.sub04.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section04.sub04.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('terms.section05.title')}</ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('terms.section05.sub01.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section05.sub01.body')}</ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('terms.section05.sub02.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section05.sub02.intro')}</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section05.sub02.bullet1')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section05.sub02.bullet2')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section05.sub02.bullet3')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section05.sub02.bullet4')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section05.sub02.bullet5')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section05.sub02.bullet6')}</ThemedText>
          </View>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('terms.section05.sub03.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section05.sub03.body')}</ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('terms.section05.sub04.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section05.sub04.intro')}</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section05.sub04.bullet1')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section05.sub04.bullet2')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section05.sub04.bullet3')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section05.sub04.bullet4')}</ThemedText>
          </View>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section05.sub04.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('terms.section06.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section06.intro')}</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section06.bullet1')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section06.bullet2')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section06.bullet3')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section06.bullet4')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section06.bullet5')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section06.bullet6')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section06.bullet7')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section06.bullet8')}</ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('terms.section07.title')}</ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('terms.section07.sub01.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section07.sub01.body')}</ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('terms.section07.sub02.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section07.sub02.body')}</ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('terms.section07.sub03.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section07.sub03.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('terms.section08.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section08.intro')}</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section08.bullet1')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section08.bullet2')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section08.bullet3')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section08.bullet4')}</ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('terms.section09.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section09.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('terms.section10.title')}</ThemedText>
          <ThemedText type="body" style={[styles.paragraph, styles.uppercase]}>{t('terms.section10.body1')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section10.body2')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('terms.section11.title')}</ThemedText>
          <ThemedText type="body" style={[styles.paragraph, styles.uppercase]}>{t('terms.section11.body1')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section11.body2')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('terms.section12.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section12.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('terms.section13.title')}</ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('terms.section13.sub01.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section13.sub01.body')}</ThemedText>
          <ThemedText type="h4" style={styles.subsectionTitle}>{t('terms.section13.sub02.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section13.sub02.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('terms.section14.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section14.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('terms.section15.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section15.body')}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('terms.section16.title')}</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section16.bullet1')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section16.bullet2')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section16.bullet3')}</ThemedText>
            <ThemedText type="body" style={styles.bulletItem}>{t('terms.section16.bullet4')}</ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>{t('terms.section17.title')}</ThemedText>
          <ThemedText type="body" style={styles.paragraph}>{t('terms.section17.intro')}</ThemedText>
          <View style={styles.contactInfo}>
            <ThemedText type="body" style={styles.contactItem}>{t('terms.section17.emailLegal')}</ThemedText>
            <ThemedText type="body" style={styles.contactItem}>{t('terms.section17.emailSupport')}</ThemedText>
          </View>
        </View>

        <View style={styles.footer}>
          <ThemedText type="small" style={styles.footerText}>{t('terms.footerAppName')}</ThemedText>
          <ThemedText type="small" style={styles.footerText}>{t('terms.footerVersion')}</ThemedText>
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
