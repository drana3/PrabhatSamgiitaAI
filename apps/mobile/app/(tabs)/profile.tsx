import { useCallback, useState } from "react"
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import {
  Award,
  ChevronRight,
  LogOut,
  MessageSquareHeart,
  Moon,
  Pencil,
  Shield,
  Sparkles,
} from "lucide-react-native"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { api } from "@/lib/client"
import { friendlyPersonName } from "@/lib/displayName"
import {
  HOME_FEED_KEYS,
  readHomeFeedCacheStale,
  writeHomeFeedCache,
} from "@/lib/homeFeedCache"
import { memberAuthAvailable, memberSyncFailedCopy, memberSyncUnavailableCopy } from "@/lib/memberAuth"
import type { QuizStatus } from "@/lib/quiz"
import { refreshMemberSession, completeMemberSignOut } from "@/lib/session"
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { usePlayerStore } from "@/stores/playerStore"
import { href } from "@/utils/href"

const SESSION_REFRESH_TTL_MS = 60_000
let lastProfileSessionRefreshAt = 0

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

function ToggleRow({
  icon,
  label,
  hint,
  value,
  onValueChange,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  hint?: string
  value: boolean
  onValueChange: (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowLabel, { flex: 0 }]}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.white}
      />
    </View>
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
  const resetWelcome = useAuthStore((s) => s.resetWelcome)
  const setDisplayName = useAuthStore((s) => s.setDisplayName)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState("")
  const openNameEditor = () => {
    setNameDraft(displayName === "Guest" ? "" : displayName)
    setEditingName(true)
  }
  const saveName = () => {
    const trimmed = nameDraft.trim()
    if (trimmed) setDisplayName(trimmed)
    setEditingName(false)
  }
  const savedCount = usePreferencesStore((s) => s.savedSongIds.length)
  const feelingSearchEnabled = usePreferencesStore((s) => s.feelingSearchEnabled)
  const setFeelingSearchEnabled = usePreferencesStore((s) => s.setFeelingSearchEnabled)
  const hydrateFavoritesFromServer = usePreferencesStore((s) => s.hydrateFavoritesFromServer)
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong))
  const [certCount, setCertCount] = useState<number | null>(null)
  const [syncBusy, setSyncBusy] = useState(false)
  const getAccountId = useChatStore((s) => s.getAccountId)
  const clearAccountMemory = useChatStore((s) => s.clearAccountMemory)
  const accountId = getAccountId(mode, email)

  const loadQuizCerts = useCallback(async (forceNetwork = false) => {
    if (!memberAuthAvailable()) {
      setCertCount(null)
      return
    }
    if (!forceNetwork) {
      const stale = await readHomeFeedCacheStale<QuizStatus>(HOME_FEED_KEYS.quizStatus)
      if (stale) setCertCount(stale.certifications?.length ?? 0)
    }
    const status = (await api.fetchQuizStatus()) as QuizStatus | null
    if (status) {
      await writeHomeFeedCache(HOME_FEED_KEYS.quizStatus, status)
      setCertCount(status.certifications?.length ?? 0)
    }
  }, [])

  const retryMemberSync = useCallback(async () => {
    if (!memberAuthAvailable()) {
      Alert.alert("Member sync unavailable", memberSyncUnavailableCopy())
      return
    }
    setSyncBusy(true)
    try {
      const result = await refreshMemberSession()
      lastProfileSessionRefreshAt = Date.now()
      await hydrateFavoritesFromServer()
      await loadQuizCerts(true)
      if (!result.ok || !result.memberBackend) {
        Alert.alert("Sync incomplete", memberSyncFailedCopy())
      }
    } finally {
      setSyncBusy(false)
    }
  }, [hydrateFavoritesFromServer, loadQuizCerts])

  useFocusEffect(
    useCallback(() => {
      if (mode !== "signed_in") {
        setCertCount(null)
        return
      }
      if (!memberAuthAvailable()) {
        setCertCount(null)
        return
      }
      void (async () => {
        await loadQuizCerts(true)
        const now = Date.now()
        if (now - lastProfileSessionRefreshAt < SESSION_REFRESH_TTL_MS) return
        lastProfileSessionRefreshAt = now
        await refreshMemberSession()
        await hydrateFavoritesFromServer()
        await loadQuizCerts(true)
      })()
    }, [mode, loadQuizCerts, hydrateFavoritesFromServer]),
  )

  const quizValue =
    mode !== "signed_in" || !memberAuthAvailable()
      ? undefined
      : certCount === null
        ? undefined
        : certCount > 0
          ? `${certCount} earned`
          : "None yet"

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
            <View style={styles.nameRow}>
              <Text style={styles.name}>{displayName}</Text>
              {mode === "signed_in" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit name"
                  hitSlop={10}
                  onPress={openNameEditor}
                  style={({ pressed }) => [styles.editNameBtn, pressed && { opacity: 0.7 }]}
                >
                  <Pencil size={15} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>
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

        {mode === "signed_in" && !memberBackend ? (
          <View style={styles.syncWarning}>
            <Text style={styles.syncWarningText}>
              {memberAuthAvailable() ? memberSyncFailedCopy() : memberSyncUnavailableCopy()}
            </Text>
            {memberAuthAvailable() ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry member sync"
                onPress={() => void retryMemberSync()}
                disabled={syncBusy}
                style={({ pressed }) => [styles.syncRetry, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.syncRetryText}>{syncBusy ? "Syncing…" : "Retry sync"}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {mode === "guest" ? (
          <PrimaryButton label="Login / Sign Up" onPress={() => router.push(href("/signin"))} />
        ) : null}

        <Text style={styles.sectionLabel}>Member</Text>
        <View style={styles.section}>
          <Row
            icon={<Award size={18} color={colors.primary} />}
            label="Quiz & certificates"
            value={quizValue}
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
                            await completeMemberSignOut()
                            router.replace(href("/welcome"))
                            Alert.alert(
                              "Deleted",
                              "Your local session and member data request completed.",
                            )
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
          <ToggleRow
            icon={<Sparkles size={18} color={colors.primary} />}
            label="Feeling search"
            hint={
              mode === "signed_in"
                ? "Off by default. Turn on to search by mood or meaning."
                : "Sign in, then turn this on in Profile"
            }
            value={mode === "signed_in" && feelingSearchEnabled}
            disabled={false}
            onValueChange={(next) => {
              if (mode !== "signed_in") {
                router.push(href("/signin"))
                return
              }
              setFeelingSearchEnabled(next)
            }}
          />
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
                // Local clear is synchronous; alert immediately for email/Google/Microsoft alike.
                void completeMemberSignOut()
                router.replace(href("/welcome"))
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

      <Modal
        visible={editingName}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingName(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setEditingName(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Edit your name</Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              maxLength={60}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveName}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setEditingName(false)}
                style={({ pressed }) => [styles.modalBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={saveName}
                disabled={!nameDraft.trim()}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  !nameDraft.trim() && { opacity: 0.5 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  editNameBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { ...typography.h3, color: colors.textPrimary },
  modalInput: {
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  modalBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  modalBtnPrimary: { backgroundColor: colors.primary },
  modalBtnText: { ...typography.label, color: colors.textSecondary },
  modalBtnTextPrimary: { color: colors.white },
  name: { ...typography.h3, color: colors.textPrimary },
  role: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  stat: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },
  syncWarning: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  syncWarningText: { ...typography.bodySmall, color: colors.textSecondary },
  syncRetry: {
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  syncRetryText: { ...typography.caption, color: colors.white, fontWeight: "700" },
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
  rowHint: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  rowValue: { ...typography.caption, color: colors.textMuted },
  version: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
})
