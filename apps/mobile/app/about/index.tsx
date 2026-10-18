import { Image } from "expo-image"
import { ScrollView, StyleSheet, Text, View } from "react-native"

import { collectionCount } from "@/data/collections"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { brandAssets, guruCaption } from "@/constants/brand"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

/**
 * About — compact smiling guru quote art so the written quote stays readable.
 */
export default function AboutScreen() {
  return (
    <ScreenContainer edges={["top"]} padded={false} title="About" showGuru={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.photoWrap}>
          <Image
            source={brandAssets.guruQuote}
            style={styles.photo}
            contentFit="contain"
            accessibilityLabel={`${guruCaption.name} — Prabhat Samgiita quote`}
          />
        </View>

        <Text style={styles.name}>{guruCaption.name}</Text>
        <Text style={styles.role}>{guruCaption.role}</Text>

        <Text style={styles.title}>Prabhat Samgiita AI</Text>
        <Text style={styles.body}>
          Prabhat Samgiita is a collection of 5,018 songs composed by Shrii Shrii Anandamurti ji
          between 14 September 1982 and 20 October 1990. This app helps you listen, understand,
          practise, and ask — in the same spirit as the website.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What you can do</Text>
          <Text style={styles.bullet}>· Discover today’s song and upcoming festivals</Text>
          <Text style={styles.bullet}>· Browse all {collectionCount} special collections</Text>
          <Text style={styles.bullet}>· Read lyrics, meanings, and stories</Text>
          <Text style={styles.bullet}>· Ask the AI companion for song-grounded insight</Text>
          <Text style={styles.bullet}>· Take the quiz and sync favorites when signed in</Text>
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
