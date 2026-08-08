import { useCallback } from "react"
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import {
  Award,
  ChevronRight,
  Heart,
  LogOut,
  MessageSquareHeart,
  Moon,
  Shield,
} from "lucide-react-native"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { api } from "@/lib/client"
import { friendlyPersonName } from "@/lib/displayName"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { refreshMemberSession } from "@/lib/session"
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { usePlayerStore } from "@/stores/playerStore"
import { href } from "@/utils/href"

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  onPress?: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <ChevronRight size={18} color={colors.textMuted} />
    </Pressable>
  )
}

export default function ProfileScreen() {
  const router = useRouter()
  const mode = useAuthStore((s) => s.mode)
  const rawDisplayName = useAuthStore((s) => s.displayName)
  const email = useAuthStore((s) => s.email)
  const displayName = friendlyPersonName(rawDisplayName, email)
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const memberBackend = useAuthStore((s) => s.memberBackend)
  const identityProvider = useAuthStore((s) => s.identityProvider)
  const signOut = useAuthStore((s) => s.signOut)
  const resetWelcome = useAuthStore((s) => s.resetWelcome)
  const savedCount = usePreferencesStore((s) => s.savedSongIds.length)
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong))
  const getAccountId = useChatStore((s) => s.getAccountId)
  const clearAccountMemory = useChatStore((s) => s.clearAccountMemory)
  const accountId = getAccountId(mode, email)

  useFocusEffect(
    useCallback(() => {
      if (mode !== "signed_in" || !memberAuthAvailable()) return
      void refreshMemberSession()
    }, [mode]),
  )

  return (
    <ScreenContainer padded={false} showGuru={false}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: hasSong ? 160 : 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>Profile</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.role}>{mode === "guest" ? "Guest explorer" : email}</Text>
            {mode === "signed_in" ? (
              <Text style={styles.stat}>
                {savedCount} saved · {isAdmin ? "Admin" : "Member"}
                {memberBackend ? " · synced" : ""}
                {identityProvider ? ` · ${identityProvider}` : ""}
              </Text>
            ) : null}
          </View>
        </View>

        {mode === "guest" ? (
          <PrimaryButton label="Login / Sign Up" onPress={() => router.push(href("/signin"))} />
        ) : null}

        <Text style={styles.sectionLabel}>Member</Text>
        <View style={styles.section}>
          <Row
            icon={<Heart size={18} color={colors.primary} />}
            label="Saved songs"
            value={savedCount ? `${savedCount}` : "None yet"}
            onPress={() => router.push(href("/(tabs)/saved"))}
          />
          <Row
            icon={<Award size={18} color={colors.primary} />}
            label="Quiz & certificates"
            onPress={() => router.push(href(mode === "guest" ? "/signin" : "/quiz"))}
          />
          <Row
            icon={<MessageSquareHeart size={18} color={colors.primary} />}
            label="Send feedback"
            onPress={() => router.push(href(mode === "guest" ? "/signin" : "/feedback"))}
          />
          {mode === "signed_in" ? (
            <>
              {isAdmin ? (
                <Row
                  icon={<Shield size={18} color={colors.primary} />}
                  label="Admin console"
                  value="On"
                  onPress={() => router.push(href("/admin"))}
                />
              ) : null}
              <Row
                icon={<LogOut size={18} color={colors.textSecondary} />}
                label="Clear AI chat memory"
                onPress={() =>
                  Alert.alert(
                    "Clear chat memory?",
                    memberAuthAvailable()
                      ? "This clears all AI chat history on this device and on your member account, including song-page conversations."
                      : "This removes saved AI conversations for your account on this device.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Clear",
                        style: "destructive",
                        onPress: () => {
                          void (async () => {
                            clearAccountMemory(accountId)
                            if (memberAuthAvailable()) await api.clearMemberChat()
                            Alert.alert("Cleared", "Your AI chat memory was cleared.")
                          })()
                        },
                      },
                    ],
                  )
                }
              />
              <Row
                icon={<LogOut size={18} color={colors.error} />}
                label="Delete account data"
                onPress={() =>
                  Alert.alert(
                    "Delete account?",
                    "This permanently removes your member profile, saved songs, quiz progress, and chat history. This cannot be undone.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          void (async () => {
                            clearAccountMemory(accountId)
                            if (memberAuthAvailable()) await api.deleteMemberAccount()
                            signOut()
                            Alert.alert("Deleted", "Your local session and member data request completed.")
                          })()
                        },
                      },
                    ],
                  )
                }
              />
            </>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.section}>
          <Row
            icon={<Moon size={18} color={colors.primary} />}
            label="Appearance"
            value="Light"
            onPress={() =>
              Alert.alert(
                "Appearance",
                "The app currently ships in a light brand theme only. Dark mode is not available yet.",
              )
            }
          />
        </View>

        <View style={styles.section}>
          <Row
            icon={<LogOut size={18} color={colors.error} />}
            label={mode === "guest" ? "Show welcome again" : "Sign out"}
            onPress={() => {
              if (mode === "signed_in") {
                signOut()
                Alert.alert(
                  "Signed out",
                  "Your AI chat history stays with your account. Sign back in to continue those conversations.",
                )
              } else {
                resetWelcome()
                router.replace(href("/welcome"))
              }
            }}
          />
        </View>

        <Text style={styles.version}>Prabhat Samgiita AI · mobile</Text>
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { ...typography.h1, color: colors.textPrimary },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(1),
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: "Lora_700Bold", fontSize: 28, color: colors.primaryDark },
  cardMeta: { flex: 1 },
  name: { ...typography.h3, color: colors.textPrimary },
  role: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  stat: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: -8,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    minHeight: 56,
  },
  rowIcon: { width: 32, alignItems: "center" },
  rowLabel: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },
  rowValue: { ...typography.caption, color: colors.textMuted },
  version: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
})
