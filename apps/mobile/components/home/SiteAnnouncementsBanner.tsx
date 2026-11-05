import { useCallback, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { Award, Bell, Wrench } from "lucide-react-native"
import type { ActiveSiteAnnouncement } from "@prabhat/core"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { api } from "@/lib/client"
import { href } from "@/utils/href"

const kindLabels: Record<string, string> = {
  general: "Notice",
  maintenance: "Maintenance",
  quiz: "Quiz",
}

const priorityStyles = {
  normal: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.spiritualGold,
    accent: colors.primaryDark,
    text: colors.textPrimary,
    muted: colors.textSecondary,
  },
  high: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.warning,
    accent: colors.primaryDark,
    text: colors.textPrimary,
    muted: colors.textSecondary,
  },
  urgent: {
    backgroundColor: "#FCEAEA",
    borderColor: colors.error,
    accent: colors.error,
    text: colors.textPrimary,
    muted: colors.textSecondary,
  },
} as const

function formatDeadline(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date)
}

function kindIcon(kind: string, color: string) {
  if (kind === "maintenance") return <Wrench size={16} color={color} />
  if (kind === "quiz") return <Award size={16} color={color} />
  return <Bell size={16} color={color} />
}

function AnnouncementCard({
  item,
  onOpenQuiz,
}: {
  item: ActiveSiteAnnouncement
  onOpenQuiz: () => void
}) {
  const palette = priorityStyles[item.priority as keyof typeof priorityStyles] ?? priorityStyles.normal
  const deadline = formatDeadline(item.ends_at)
  const isQuiz = item.kind === "quiz"

  const content = (
    <>
      <View style={styles.cardTop}>
        <View style={[styles.iconWrap, { backgroundColor: colors.white }]}>
          {kindIcon(item.kind, palette.accent)}
        </View>
        <View style={styles.copy}>
          <Text style={[styles.kind, { color: palette.accent }]}>
            {kindLabels[item.kind] ?? "Notice"}
          </Text>
          <Text style={[styles.title, { color: palette.text }]}>{item.title}</Text>
        </View>
        {deadline ? (
          <View style={[styles.deadlineChip, { borderColor: palette.borderColor }]}>
            <Text style={[styles.deadlineText, { color: palette.muted }]}>Until {deadline}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.body, { color: palette.muted }]}>{item.body}</Text>
      {isQuiz ? (
        <Text style={[styles.link, { color: palette.accent }]}>Open quiz hub →</Text>
      ) : null}
    </>
  )

  if (isQuiz) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. Open quiz hub.`}
        onPress={onOpenQuiz}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
          pressed && { opacity: 0.94 },
        ]}
      >
        {content}
      </Pressable>
    )
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
      ]}
    >
      {content}
    </View>
  )
}

export function SiteAnnouncementsBanner() {
  const router = useRouter()
  const [items, setItems] = useState<ActiveSiteAnnouncement[]>([])

  const loadAnnouncements = useCallback(() => {
    let active = true
    void api.fetchActiveAnnouncements().then((value) => {
      if (active) setItems(value)
    })
    return () => {
      active = false
    }
  }, [])

  useFocusEffect(loadAnnouncements)

  if (!items.length) return null

  return (
    <View style={styles.wrap}>
      {items.map((item) => (
        <AnnouncementCard
          key={item.id}
          item={item}
          onOpenQuiz={() => router.push(href("/quiz"))}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    ...softShadow(1),
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  kind: {
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    ...typography.h3,
    marginTop: 2,
  },
  deadlineChip: {
    maxWidth: "42%",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.white,
  },
  deadlineText: {
    ...typography.caption,
    textAlign: "right",
  },
  body: {
    ...typography.bodySmall,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  link: {
    ...typography.bodySmall,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
})
