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

export default function AdminScreen() {
  const router = useRouter()
  const [tab, setTab] = useState<"feedback" | "members">("feedback")
  const [filter, setFilter] = useState<FeedbackFilter>("new")
  const [feedback, setFeedback] = useState<AdminFeedbackItem[]>([])
  const [members, setMembers] = useState<AdminMember[]>([])
  const [loading, setLoading] = useState(false)
  const [grantEmail, setGrantEmail] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const mode = useAuthStore((s) => s.mode)
  const hasFeedbackRef = useRef(false)
  const hasMembersRef = useRef(false)

  const loadFeedback = useCallback(async () => {
    if (!memberAuthAvailable()) {
      setFeedback([])
      hasFeedbackRef.current = false
      return
    }
    if (!hasFeedbackRef.current) setLoading(true)
    const result = await api.fetchAdminFeedback(filter)
    setFeedback(result.items)
    hasFeedbackRef.current = true
    setLoading(false)
  }, [filter])

  const loadMembers = useCallback(async () => {
    if (!memberAuthAvailable()) {
      setMembers([])
      hasMembersRef.current = false
      return
    }
    if (!hasMembersRef.current) setLoading(true)
    setMembers(await api.fetchAdminMembers())
    hasMembersRef.current = true
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
    // Match website admin: publish only — do not force status to "actioned"
    // (that removes the item from the default "new" filter and looks broken).
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

  return (
    <ScreenContainer edges={["top"]} padded={false} title="Admin">
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === "feedback" && styles.tabActive]}
          onPress={() => setTab("feedback")}
        >
          <Text style={styles.tabText}>Feedback</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === "members" && styles.tabActive]}
          onPress={() => setTab("members")}
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

      <ScrollView contentContainerStyle={styles.content}>
        {tab === "feedback" ? (
          <>
            <Text style={styles.heroSub}>Review member feedback and choose what appears on the home ticker.</Text>
            <View style={styles.filterRow}>
              {(["new", "reviewed", "actioned", "all"] as FeedbackFilter[]).map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setFilter(value)}
                  style={[styles.filterChip, filter === value && styles.filterActive]}
                >
                  <Text style={styles.filterText}>{value}</Text>
                </Pressable>
              ))}
            </View>
            {loading ? <ActivityIndicator color={colors.primary} /> : null}
            {!loading && feedback.length === 0 ? (
              <Text style={styles.empty}>No feedback in this filter.</Text>
            ) : null}
            {feedback.map((item) => (
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
                    disabled={busyId === item.feedback_id}
                    onPress={() => void markReviewed(item)}
                  >
                    <Text style={styles.actionText}>Mark reviewed</Text>
                  </Pressable>
                  {item.on_live_ticker ? (
                    <Pressable
                      style={styles.actionBtn}
                      disabled={busyId === item.feedback_id}
                      onPress={() => void removeFromTicker(item)}
                    >
                      <Text style={styles.actionText}>Remove from ticker</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={styles.actionBtn}
                      disabled={busyId === item.feedback_id}
                      onPress={() => void showOnTicker(item)}
                    >
                      <Text style={styles.actionText}>Show on ticker</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
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
                disabled={busyId === "grant"}
                onPress={() => void grantAdmin()}
              >
                <Text style={styles.actionText}>Grant</Text>
              </Pressable>
            </View>
            {loading ? <ActivityIndicator color={colors.primary} /> : null}
            {!loading && members.length === 0 ? (
              <Text style={styles.empty}>No members returned.</Text>
            ) : null}
            {members.map((member) => (
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
                      disabled={busyId === member.id}
                      onPress={() => void revokeAdmin(member)}
                    >
                      <Text style={styles.actionText}>Revoke admin</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
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
  disable: {
    ...typography.caption,
    color: colors.error,
    textAlign: "center",
    marginTop: spacing.md,
  },
})
