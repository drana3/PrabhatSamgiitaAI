import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { collectionCount } from "@/data/collections"
import { BabaPhoto } from "@/components/common/BabaPhoto"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { guruCaption } from "@/constants/brand"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { useT } from "@/lib/i18n"
import { takedownUrl } from "@/lib/webLinks"

/**
 * About — the guru quote art as a clean picture (BabaPhoto): nothing over it, the text below it.
 */
export default function AboutScreen() {
  const t = useT()
  return (
    <ScreenContainer edges={["top"]} padded={false} title={t("about.title")} showGuru={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <BabaPhoto
          id="quote"
          ratio={2}
          radius={radius.xl}
          style={styles.photoWrap}
          accessibilityLabel={t("about.photo.a11y", { name: guruCaption.name })}
        />

        <Text style={styles.name}>{guruCaption.name}</Text>
        <Text style={styles.role}>{t("about.role")}</Text>

        <Text style={styles.title}>Prabhat Samgiita AI</Text>
        <Text style={styles.body}>{t("about.body")}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("about.what.title")}</Text>
          <Text style={styles.bullet}>{t("about.what.1")}</Text>
          <Text style={styles.bullet}>{t("about.what.2", { count: collectionCount })}</Text>
          <Text style={styles.bullet}>{t("about.what.3")}</Text>
          <Text style={styles.bullet}>{t("about.what.4")}</Text>
          <Text style={styles.bullet}>{t("about.what.5")}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("about.credits.title")}</Text>
          <Text style={styles.bullet}>{t("about.credits.piano")}</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL("https://creativecommons.org/licenses/by/3.0/")} hitSlop={8}>
            <Text style={[styles.bullet, styles.link]}>{t("about.credits.piano.link")}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("about.copyright.title")}</Text>
          <Text style={styles.bullet}>{t("about.copyright.body")}</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(takedownUrl())} hitSlop={8}>
            <Text style={[styles.bullet, styles.link]}>{t("about.copyright.link")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.section,
    paddingTop: spacing.sm,
  },
  photoWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  name: {
    fontFamily: "Lora_700Bold",
    fontSize: 22,
    lineHeight: 28,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
  },
  role: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontFamily: "Lora_700Bold",
    fontSize: 28,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  card: {
    marginTop: spacing.xxl,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  link: {
    color: colors.textPrimary,
    textDecorationLine: "underline",
  },
  bullet: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
})
