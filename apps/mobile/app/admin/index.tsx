import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import type { AdminFeedbackItem, AdminMember } from "@prabhat/core"
import { useRouter } from "expo-router"
import { MessageSquare, Shield, Users } from "lucide-react-native"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { api } from "@/lib/client"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

type FeedbackFilter = "new" | "reviewed" | "actioned" | "all"

const MIN_LIVE_QUOTE_LENGTH = 8

function AdminProgressBar({ visible, label }: { visible: boolean; label: string }) {
  if (!visible) return null
  return (
    <View style={styles.progressBanner} accessibilityLabel={label}>
      <ActivityIndicator size="small" color={colors.primary} />
      <View style={styles.progressCopy}>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>
        <Text style={styles.progressLabel}>{label}</Text>
      </View>
    </View>
  )
}

export default function AdminScreen() {
  const router = useRouter()
  const [tab, setTab] = useState<"feedback" | "members">("feedback")
  const [filter, setFilter] = useState<FeedbackFilter>("new")
  const [feedback, setFeedback] = useState<AdminFeedbackItem[]>([])
  const [members, setMembers] = useState<AdminMember[]>([])
  const [loading, setLoading] = useState(true)
  const [grantEmail, setGrantEmail] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const mode = useAuthStore((s) => s.mode)
  const feedbackRequest = useRef(0)
  const membersRequest = useRef(0)

  const loadFeedback = useCallback(async () => {
    if (!memberAuthAvailable()) {
      setFeedback([])
      setLoading(false)
      return
    }
    const id = ++feedbackRequest.current
    setLoading(true)
    const result = await api.fetchAdminFeedback(filter)
    if (id !== feedbackRequest.current) return
    setFeedback(result.items)
    setLoading(false)
  }, [filter])

  const loadMembers = useCallback(async () => {
    if (!memberAuthAvailable()) {
      setMembers([])
      setLoading(false)
      return
    }
    const id = ++membersRequest.current
    setLoading(true)
    const rows = await api.fetchAdminMembers()
    if (id !== membersRequest.current) return
    setMembers(rows)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (mode !== "signed_in" || !isAdmin) return
    if (tab === "feedback") void loadFeedback()
    else void loadMembers()
  }, [mode, isAdmin, tab, loadFeedback, loadMembers])

  if (mode !== "signed_in" || !isAdmin) {
    return (
      <ScreenContainer edges={["top"]} title="Admin">
        <View style={styles.locked}>
          <Shield size={28} color={colors.primary} />
          <Text style={styles.lockedTitle}>Admin only</Text>
          <Text style={styles.lockedBody}>
            Admin tools are available only to team members with admin access. Ask an existing admin
            to grant access from the Members tab.
          </Text>
          <PrimaryButton label="Go to Profile" onPress={() => router.replace(href("/(tabs)/profile"))} />
        </View>
      </ScreenContainer>
    )
  }

  const markReviewed = async (item: AdminFeedbackItem) => {
    setBusyId(item.feedback_id)
    const result = await api.updateAdminFeedback(item.feedback_id, { status: "reviewed" })
    setBusyId(null)
    if (!result.ok) Alert.alert("Admin", result.detail ?? "Could not update feedback.")
    else await loadFeedback()
  }

  const showOnTicker = async (item: AdminFeedbackItem) => {
    if (item.comment.trim().length < MIN_LIVE_QUOTE_LENGTH) {
      Alert.alert(
        "Admin",
        `Comment needs at least ${MIN_LIVE_QUOTE_LENGTH} characters to show on the live ticker.`,
      )
      return
    }
    setBusyId(item.feedback_id)
    const result = await api.updateAdminFeedback(item.feedback_id, {
      publish_to_live: true,
    })
    setBusyId(null)
    if (!result.ok) {
      Alert.alert("Admin", result.detail ?? "Could not publish to ticker.")
      return
    }
    Alert.alert("Admin", "Published to the live ticker. Open Home to see it scroll.")
    await loadFeedback()
  }

  const removeFromTicker = async (item: AdminFeedbackItem) => {
    setBusyId(item.feedback_id)
    const result = await api.updateAdminFeedback(item.feedback_id, {
      unpublish_from_live: true,
    })
    setBusyId(null)
    if (!result.ok) {
      Alert.alert("Admin", result.detail ?? "Could not remove from ticker.")
      return
    }
    Alert.alert("Admin", "Removed from the live ticker.")
    await loadFeedback()
  }

  const grantAdmin = async () => {
    const email = grantEmail.trim()
    if (!email.includes("@")) {
      Alert.alert("Admin", "Enter a valid email.")
      return
    }
    setBusyId("grant")
    const ok = await api.grantAdmin(email)
    setBusyId(null)
    if (!ok) Alert.alert("Admin", "Could not grant admin.")
    else {
      setGrantEmail("")
      await loadMembers()
    }
  }

  const revokeAdmin = async (member: AdminMember) => {
    if (member.is_protected) {
      Alert.alert("Admin", "This admin is protected.")
      return
    }
    setBusyId(member.id)
    const ok = await api.revokeAdmin(member.id)
    setBusyId(null)
    if (!ok) Alert.alert("Admin", "Could not revoke admin.")
    else await loadMembers()
  }

  const progressLabel =
    tab === "feedback"
      ? filter === "all"
        ? "Loading feedback…"
        : `Loading ${filter} feedback…`
      : "Loading members…"

  return (
    <ScreenContainer edges={["top"]} padded={false} title="Admin">
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === "feedback" && styles.tabActive]}
          onPress={() => {
            if (tab === "feedback") return
            setLoading(true)
            setTab("feedback")
          }}
        >
          <Text style={styles.tabText}>Feedback</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === "members" && styles.tabActive]}
          onPress={() => {
            if (tab === "members") return
            setLoading(true)
            setTab("members")
          }}
        >
          <Text style={styles.tabText}>Members</Text>
        </Pressable>
      </View>

      {!memberAuthAvailable() ? (
        <Text style={styles.warn}>
          Member sync is not configured on this build. Admin data from the website cannot load until
          you install an app update that includes member sync.
        </Text>
      ) : null}

      <AdminProgressBar visible={loading} label={progressLabel} />

      <ScrollView contentContainerStyle={styles.content}>
        {tab === "feedback" ? (
          <>
            <Text style={styles.heroSub}>Review member feedback and choose what appears on the home ticker.</Text>
            <View style={styles.filterRow}>
              {(["new", "reviewed", "actioned", "all"] as FeedbackFilter[]).map((value) => (
                <Pressable
                  key={value}
                  onPress={() => {
                    if (value === filter) return
                    setLoading(true)
                    setFeedback([])
                    setFilter(value)
                  }}
                  style={[styles.filterChip, filter === value && styles.filterActive]}
                >
                  <Text style={styles.filterText}>{value}</Text>
                </Pressable>
              ))}
            </View>
            {loading ? (
              <Text style={styles.empty}>Fetching the latest {filter} items…</Text>
            ) : feedback.length === 0 ? (
              <Text style={styles.empty}>No feedback in this filter.</Text>
            ) : (
              feedback.map((item) => (
                <View key={item.feedback_id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <MessageSquare size={16} color={colors.primary} />
                    <Text style={styles.meta}>
                      {item.category} · {item.rating}/5 · {item.status}
                      {item.on_live_ticker ? " · ticker" : ""}
                    </Text>
                  </View>
                  <Text style={styles.snippet}>{item.comment}</Text>
                  {item.contact ? <Text style={styles.meta}>{item.contact}</Text> : null}
                  <View style={styles.actions}>
                    <Pressable
                      style={styles.actionBtn}
                      disabled={busyId === item.feedback_id || loading}
                      onPress={() => void markReviewed(item)}
                    >
                      {busyId === item.feedback_id ? (
                        <ActivityIndicator size="small" color={colors.primaryDark} />
                      ) : (
                        <Text style={styles.actionText}>Mark reviewed</Text>
                      )}
                    </Pressable>
                    {item.on_live_ticker ? (
                      <Pressable
                        style={styles.actionBtn}
                        disabled={busyId === item.feedback_id || loading}
                        onPress={() => void removeFromTicker(item)}
                      >
                        <Text style={styles.actionText}>Remove from ticker</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={styles.actionBtn}
                        disabled={busyId === item.feedback_id || loading}
                        onPress={() => void showOnTicker(item)}
                      >
                        <Text style={styles.actionText}>Show on ticker</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        ) : (
          <>
            <Text style={styles.heroSub}>View members and grant or revoke admin access.</Text>
            <View style={styles.grantRow}>
              <TextInput
                value={grantEmail}
                onChangeText={setGrantEmail}
                placeholder="Grant admin by email"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
              <Pressable
                style={styles.actionBtn}
                disabled={busyId === "grant" || loading}
                onPress={() => void grantAdmin()}
              >
                {busyId === "grant" ? (
                  <ActivityIndicator size="small" color={colors.primaryDark} />
                ) : (
                  <Text style={styles.actionText}>Grant</Text>
                )}
              </Pressable>
            </View>
            {loading ? (
              <Text style={styles.empty}>Fetching members…</Text>
            ) : members.length === 0 ? (
              <Text style={styles.empty}>No members returned.</Text>
            ) : (
              members.map((member) => (
                <View key={member.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Users size={16} color={colors.primary} />
                    <Text style={styles.meta}>
                      {member.is_admin ? "Admin" : "Member"}
                      {member.is_protected ? " · protected" : ""}
                    </Text>
                  </View>
                  <Text style={styles.snippet}>{member.display_name}</Text>
                  <Text style={styles.meta}>{member.email ?? "No email"}</Text>
                  <Text style={styles.meta}>{member.phone_e164 ?? "No mobile"}</Text>
                  {member.is_admin && !member.is_protected ? (
                    <View style={styles.actions}>
                      <Pressable
                        style={styles.actionBtn}
                        disabled={busyId === member.id || loading}
                        onPress={() => void revokeAdmin(member)}
                      >
                        {busyId === member.id ? (
                          <ActivityIndicator size="small" color={colors.primaryDark} />
                        ) : (
                          <Text style={styles.actionText}>Revoke admin</Text>
                        )}
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tabText: { ...typography.label, color: colors.textPrimary },
  progressBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  progressCopy: { flex: 1, gap: 6 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  progressFill: {
    width: "55%",
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressLabel: { ...typography.caption, color: colors.textSecondary },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.section, gap: spacing.md },
  locked: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  lockedTitle: { ...typography.h2, color: colors.textPrimary },
  lockedBody: { ...typography.bodySmall, color: colors.textSecondary, textAlign: "center" },
  heroSub: { ...typography.bodySmall, color: colors.textSecondary },
  warn: {
    ...typography.caption,
    color: colors.error,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  filterText: { ...typography.caption, color: colors.textPrimary, textTransform: "capitalize" },
  empty: { ...typography.bodySmall, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(1),
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  meta: { ...typography.caption, color: colors.textMuted },
  snippet: { ...typography.bodySmall, color: colors.textPrimary, marginTop: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionText: { ...typography.caption, color: colors.primaryDark },
  grantRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
})
