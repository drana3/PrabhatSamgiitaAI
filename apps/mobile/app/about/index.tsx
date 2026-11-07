import { Image } from "expo-image"
import { ScrollView, StyleSheet, Text, View } from "react-native"

import { collectionCount } from "@/data/collections"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { brandAssets, guruCaption } from "@/constants/brand"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { useT } from "@/lib/i18n"

/**
 * About — compact smiling guru quote art so the written quote stays readable.
 */
export default function AboutScreen() {
  const t = useT()
  return (
    <ScreenContainer edges={["top"]} padded={false} title={t("about.title")} showGuru={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.photoWrap}>
          <Image
            source={brandAssets.guruQuote}
            style={styles.photo}
            contentFit="contain"
            accessibilityLabel={t("about.photo.a11y", { name: guruCaption.name })}
          />
        </View>

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
    height: 176,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: "#1a2433",
    alignItems: "center",
    justifyContent: "center",
  },
  photo: {
    width: "100%",
    height: "100%",
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
  bullet: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
})
