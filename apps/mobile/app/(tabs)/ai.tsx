import { useEffect, useMemo, useState } from "react"
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Check, Copy, History, Home, Plus, X, ChevronLeft } from "lucide-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as Clipboard from "expo-clipboard"
import Markdown from "react-native-markdown-display"

import { AIComposer } from "@/components/ai/AIComposer"
import { AIWelcomeCard, SuggestionRow } from "@/components/ai/AIWelcomeCard"
import { IconButton } from "@/components/common/IconButton"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import type { MockSong } from "@/data/mock"
import {
  formatAssistantMessage,
  generalCompanionSuggestions,
  remainingCompanionSuggestions,
  companionLeaveAction,
  resolveExplainSongNumber,
  songCompanionSuggestions,
  validatePrompt,
} from "@/lib/chat"
import { api } from "@/lib/client"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { songDetailToMockSong, songSummaryToMockSong } from "@/lib/songMap"
import { useVoiceSearch } from "@/lib/useVoiceSearch"
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { usePlayerStore } from "@/stores/playerStore"
import { href } from "@/utils/href"

// Mobile AI companion keeps its own look/feel and history UX — intentionally separate from web.
export default function AIScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const params = useLocalSearchParams<{ song?: string }>()
  const paramSongNumber = Number(params.song)
  const focusedSongNumber =
    Number.isFinite(paramSongNumber) && paramSongNumber >= 1 && paramSongNumber <= 5018
      ? paramSongNumber
      : null

  const [draft, setDraft] = useState("")
  const voice = useVoiceSearch({
    onPartial: (text) => setDraft(text),
    onFinal: (text) => setDraft(text),
  })
  const [historyOpen, setHistoryOpen] = useState(false)
  const [serverHistoryDays, setServerHistoryDays] = useState<
    Array<{ date: string; turns: Array<{ role: "user" | "assistant"; content: string }> }>
  >([])
  const [archivedSummary, setArchivedSummary] = useState("")
  const [sending, setSending] = useState(false)
  const [syncingHistory, setSyncingHistory] = useState(false)
  const [focusSong, setFocusSong] = useState<MockSong | null>(null)
  const mode = useAuthStore((s) => s.mode)
  const email = useAuthStore((s) => s.email)
  const memberBackend = useAuthStore((s) => s.memberBackend)
  const currentSong = usePlayerStore((s) => s.currentSong)
  const companionSong = focusSong ?? (focusedSongNumber ? null : currentSong)
  const groundedNumber = companionSong?.number ?? focusedSongNumber
  const hasSong = Boolean(groundedNumber)

  const getAccountId = useChatStore((s) => s.getAccountId)
  const byAccount = useChatStore((s) => s.byAccount)
  const beginExchange = useChatStore((s) => s.beginExchange)
  const updateAssistantMessage = useChatStore((s) => s.updateAssistantMessage)
  const hydrateFromServerTurns = useChatStore((s) => s.hydrateFromServerTurns)
  const syncServerHistory = useChatStore((s) => s.syncServerHistory)
  const ensureScopeThread = useChatStore((s) => s.ensureScopeThread)
  const startNewThread = useChatStore((s) => s.startNewThread)
  const setActiveThread = useChatStore((s) => s.setActiveThread)
  const clearAccountMemory = useChatStore((s) => s.clearAccountMemory)

  const accountId = getAccountId(mode, email)
  const account = byAccount[accountId] ?? { threads: [], activeThreadId: null }
  const activeThread = useMemo(
    () => account.threads.find((t) => t.id === account.activeThreadId) ?? null,
    [account],
  )
  const messages = activeThread?.messages ?? []
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copyMessage = async (id: string, text: string) => {
    const value = text?.trim()
    if (!value) return
    try {
      await Clipboard.setStringAsync(value)
      setCopiedId(id)
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500)
    } catch {
      /* ignore clipboard errors */
    }
  }
  const scopeSongNumber = groundedNumber ?? null
  const pastThreads = account.threads.filter(
    (t) =>
      t.messages.length > 0 &&
      (typeof t.songNumber === "number" ? t.songNumber : null) === scopeSongNumber,
  )

  const suggestions = useMemo(() => {
    if (companionSong) return songCompanionSuggestions(companionSong)
    if (focusedSongNumber) {
      return songCompanionSuggestions({
        number: focusedSongNumber,
        title: `Prabhat Samgiita ${focusedSongNumber}`,
      })
    }
    return generalCompanionSuggestions()
  }, [companionSong, focusedSongNumber])

  const askedTexts = useMemo(
    () => messages.filter((message) => message.role === "user").map((message) => message.text),
    [messages],
  )
  const visibleSuggestions = useMemo(
    () => remainingCompanionSuggestions(suggestions, askedTexts),
    [suggestions, askedTexts],
  )

  const leaveCompanion = () => {
    const action = companionLeaveAction(focusedSongNumber, router.canGoBack())
    if (action.type === "back") {
      router.back()
      return
    }
    if (action.type === "song") {
      router.replace(href(`/song/ps-${action.number}`))
      return
    }
    router.replace(href("/(tabs)"))
  }

  useEffect(() => {
    if (!focusedSongNumber) {
      setFocusSong(null)
      return
    }
    let active = true
    void api.fetchSong(focusedSongNumber).then((detail) => {
      if (!active) return
      if (detail) setFocusSong(songDetailToMockSong(detail))
      else {
        setFocusSong(
          songSummaryToMockSong({
            number: focusedSongNumber,
            title: `Prabhat Samgiita ${focusedSongNumber}`,
            is_verified: false,
          }),
        )
      }
    })
    return () => {
      active = false
    }
  }, [focusedSongNumber])

  useEffect(() => {
    ensureScopeThread(accountId, groundedNumber ?? null)
  }, [accountId, groundedNumber, ensureScopeThread])

  useEffect(() => {
    if (mode !== "signed_in" || !memberAuthAvailable()) return
    let active = true
    setSyncingHistory(true)
    void api
      .fetchMemberChat(groundedNumber ?? undefined)
      .then((memory) => {
        if (!active || !memory.ok) return
        if (!groundedNumber) {
          setServerHistoryDays(memory.history_days ?? [])
          setArchivedSummary(memory.archived_summary ?? "")
          if (!memory.recent_turns.length && !(memory.history_days?.length)) return
          syncServerHistory(accountId, memory, null)
          hydrateFromServerTurns(
            accountId,
            memory.recent_turns,
            memory.summary || undefined,
            null,
          )
          return
        }
        setServerHistoryDays([])
        setArchivedSummary("")
        if (!memory.recent_turns.length) return
        hydrateFromServerTurns(
          accountId,
          memory.recent_turns,
          memory.summary || undefined,
          groundedNumber,
        )
      })
      .finally(() => {
        if (active) setSyncingHistory(false)
      })
    return () => {
      active = false
    }
  }, [mode, accountId, groundedNumber, hydrateFromServerTurns, syncServerHistory])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const blocked = validatePrompt(trimmed)
    if (blocked) {
      Alert.alert("Try a clearer question", blocked)
      return
    }

    const assistantId = beginExchange(accountId, trimmed)
    if (!assistantId) return
    setDraft("")
    setSending(true)

    const history = messages
      .slice(-12)
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.text,
      }))
      .filter((message) => message.content.trim().length > 0)

    const songNumber = resolveExplainSongNumber(trimmed, groundedNumber)
    let buffer = ""
    try {
      await api.streamExplanation(
        songNumber,
        (chunk) => {
          buffer += chunk
          updateAssistantMessage(accountId, assistantId, formatAssistantMessage(buffer) || "…")
        },
        trimmed,
        history,
      )
      const finalText = buffer.trim()
        ? formatAssistantMessage(buffer)
        : "I couldn’t find a grounded answer just now. Try naming a song number or opening a song first."
      updateAssistantMessage(accountId, assistantId, finalText)

      if (mode === "signed_in" && memberAuthAvailable() && finalText) {
        void api.saveMemberChat({
          song_number: groundedNumber ?? undefined,
          turns: [
            { role: "user", content: trimmed },
            { role: "assistant", content: finalText.slice(0, 8000) },
          ],
        })
      }
    } catch (error) {
      updateAssistantMessage(
        accountId,
        assistantId,
        error instanceof Error
          ? error.message
          : "The song companion is temporarily unavailable. Please try again.",
      )
    } finally {
      setSending(false)
    }
  }

  const composerBottomPad = (hasSong ? 76 : 12) + Math.max(insets.bottom > 0 ? 0 : 4, 0)

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={8}
      >
        <View style={styles.header}>
          <View style={styles.headerLead}>
            <IconButton
              soft
              accessibilityLabel={groundedNumber ? "Back to song" : "Go back"}
              onPress={leaveCompanion}
            >
              <ChevronLeft size={22} color={colors.textPrimary} />
            </IconButton>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>AI Companion</Text>
              <Text style={styles.subtitle}>
                {mode === "signed_in"
                  ? memberBackend
                    ? "Synced with your member chat memory"
                    : "History saved on this device"
                  : "Guest history on this device"}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <IconButton
              soft
              accessibilityLabel="Go to Home"
              onPress={() => router.replace(href("/(tabs)"))}
            >
              <Home size={20} color={colors.textPrimary} />
            </IconButton>
            <IconButton
              soft
              accessibilityLabel="New chat"
              onPress={() => startNewThread(accountId, scopeSongNumber)}
            >
              <Plus size={20} color={colors.textPrimary} />
            </IconButton>
            <IconButton soft accessibilityLabel="Chat history" onPress={() => setHistoryOpen(true)}>
              <History size={20} color={colors.textPrimary} />
            </IconButton>
          </View>
        </View>

        {syncingHistory ? (
          <View style={styles.syncBanner} accessibilityLabel="Syncing chat history">
            <ActivityIndicator size="small" color={colors.primary} />
            <View style={styles.syncCopy}>
              <View style={styles.syncTrack}>
                <View style={styles.syncFill} />
              </View>
              <Text style={styles.syncLabel}>Syncing chat history…</Text>
            </View>
          </View>
        ) : null}

        <ScrollView
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {messages.length === 0 ? (
            <>
              <AIWelcomeCard
                songNumber={groundedNumber}
                songTitle={companionSong?.title ?? null}
              />
              <Text style={styles.section}>
                {groundedNumber ? `Ask about PS ${groundedNumber}` : "Suggested for you"}
              </Text>
              {visibleSuggestions.map((item) => (
                <SuggestionRow key={item} label={item} onPress={() => void send(item)} />
              ))}
            </>
          ) : (
            <View style={styles.thread}>
              {messages.map((msg) => {
                // Skip empty assistant placeholder — status is shown once in the composer hint.
                if (msg.role === "assistant" && !msg.text.trim()) return null
                return (
                  <View
                    key={msg.id}
                    style={[styles.bubble, msg.role === "user" ? styles.user : styles.assistant]}
                  >
                    {msg.role === "user" ? (
                      <Text style={styles.userText}>{msg.text}</Text>
                    ) : (
                      <Markdown style={markdownStyles}>{msg.text}</Markdown>
                    )}
                    {msg.role === "assistant" && msg.text.trim() ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Copy answer"
                        hitSlop={8}
                        onPress={() => copyMessage(msg.id, msg.text)}
                        style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}
                      >
                        {copiedId === msg.id ? (
                          <Check size={13} color={colors.primaryDark} />
                        ) : (
                          <Copy size={13} color={colors.textMuted} />
                        )}
                        <Text style={[styles.copyText, copiedId === msg.id && { color: colors.primaryDark }]}>
                          {copiedId === msg.id ? "Copied" : "Copy"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                )
              })}
              {visibleSuggestions.length ? (
                <View style={styles.followUps}>
                  <Text style={styles.section}>
                    {askedTexts.length ? "Ask next" : "Suggested for you"}
                  </Text>
                  {visibleSuggestions.map((item) => (
                    <SuggestionRow key={item} label={item} onPress={() => void send(item)} />
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: composerBottomPad }]}>
          <AIComposer
            value={draft}
            onChangeText={setDraft}
            onSend={() => void send(draft)}
            voiceListening={voice.listening}
            onVoicePress={() => void voice.toggle()}
            hint={
              voice.listening
                ? "Listening… speak your question."
                : voice.error
                  ? voice.error
                  : sending
                    ? "Companion is answering…"
                    : hasSong
                      ? `Grounded on PS ${groundedNumber}`
                      : mode === "guest"
                        ? "Ask about a song number, or open a song first"
                        : undefined
            }
          />
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={historyOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setHistoryOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setHistoryOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Chat history</Text>
              <IconButton soft accessibilityLabel="Close history" onPress={() => setHistoryOpen(false)}>
                <X size={18} color={colors.textPrimary} />
              </IconButton>
            </View>
            <Text style={styles.sheetLead}>
              {mode === "signed_in" && !groundedNumber
                ? "Conversations from the last 30 days are grouped by day. Older context is kept as a summary."
                : mode === "signed_in"
                  ? "Song questions keep recent context only. Open AI Companion without a song for full history."
                  : "Sign in to keep history with your account."}
            </Text>
            {mode === "signed_in" && !groundedNumber && archivedSummary ? (
              <Text style={styles.archiveSummary} numberOfLines={4}>
                Earlier context: {archivedSummary}
              </Text>
            ) : null}
            <Pressable
              style={styles.newChatBtn}
              onPress={() => {
                startNewThread(accountId, scopeSongNumber)
                setHistoryOpen(false)
              }}
            >
              <Plus size={16} color={colors.white} />
              <Text style={styles.newChatText}>Start new chat</Text>
            </Pressable>
            {pastThreads.length > 0 ? (
              <Pressable
                style={styles.clearHistoryBtn}
                onPress={() => {
                  Alert.alert(
                    "Clear chat history?",
                    mode === "guest"
                      ? "This removes all guest conversations saved on this device."
                      : "This removes conversations saved on this device for your account.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Clear all",
                        style: "destructive",
                        onPress: () => {
                          clearAccountMemory(accountId)
                          setHistoryOpen(false)
                        },
                      },
                    ],
                  )
                }}
                accessibilityRole="button"
                accessibilityLabel="Clear all chat history"
              >
                <Text style={styles.clearHistoryText}>Clear all history</Text>
              </Pressable>
            ) : null}
            <ScrollView style={styles.historyList}>
              {mode === "signed_in" && !groundedNumber && serverHistoryDays.length > 0 ? (
                serverHistoryDays.map((day) => (
                  <View key={day.date} style={styles.historyDayGroup}>
                    <Text style={styles.historyDayLabel}>
                      {new Date(`${day.date}T12:00:00.000Z`).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {day.turns.filter((turn) => turn.role === "user").length} questions
                    </Text>
                  </View>
                ))
              ) : null}
              {pastThreads.length === 0 ? (
                <Text style={styles.emptyHistory}>No saved conversations yet.</Text>
              ) : (
                pastThreads.map((thread) => (
                  <Pressable
                    key={thread.id}
                    onPress={() => {
                      setActiveThread(accountId, thread.id)
                      setHistoryOpen(false)
                    }}
                    style={[
                      styles.historyRow,
                      thread.id === account.activeThreadId && styles.historyRowActive,
                    ]}
                  >
                    <Text style={styles.historyTitle} numberOfLines={1}>
                      {thread.title}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {thread.messages.filter((m) => m.role === "user").length} questions ·{" "}
                      {new Date(thread.updatedAt).toLocaleDateString()}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerLead: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minWidth: 0,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  syncCopy: { flex: 1, gap: 6 },
  syncTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  syncFill: {
    width: "55%",
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  syncLabel: { ...typography.caption, color: colors.textSecondary },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  section: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  thread: {
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  followUps: {
    marginTop: spacing.sm,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  user: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    maxWidth: "86%",
  },
  assistant: {
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userText: {
    ...typography.bodySmall,
    color: colors.white,
  },
  assistantText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  copyText: { ...typography.caption, color: colors.textMuted },
  composer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(20,14,10,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    maxHeight: "72%",
    ...softShadow(2),
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  sheetLead: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  archiveSummary: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  clearHistoryBtn: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
  clearHistoryText: {
    ...typography.caption,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
  newChatBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  newChatText: {
    ...typography.caption,
    color: colors.white,
  },
  historyList: {
    maxHeight: 320,
  },
  historyDayGroup: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  historyDayLabel: {
    ...typography.label,
    color: colors.textPrimary,
  },
  emptyHistory: {
    ...typography.bodySmall,
    color: colors.textMuted,
    paddingVertical: spacing.lg,
  },
  historyRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  historyRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  historyTitle: {
    ...typography.label,
    color: colors.textPrimary,
  },
  historyMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
})

// ChatGPT-style rich formatting for assistant answers.
const markdownStyles = StyleSheet.create({
  body: { ...typography.body, color: colors.textPrimary, lineHeight: 26 },
  paragraph: { marginTop: 0, marginBottom: spacing.md },
  heading1: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm },
  heading2: { ...typography.h3, color: colors.primaryDark, marginTop: spacing.md, marginBottom: spacing.sm },
  heading3: { ...typography.label, color: colors.primaryDark, fontSize: 16, marginTop: spacing.sm, marginBottom: spacing.xs },
  strong: { fontWeight: "700", color: colors.textPrimary },
  em: { fontStyle: "italic", color: colors.textSecondary },
  bullet_list: { marginBottom: spacing.md, paddingLeft: 2 },
  ordered_list: { marginBottom: spacing.md, paddingLeft: 2 },
  list_item: { flexDirection: "row", marginBottom: spacing.sm },
  bullet_list_icon: { color: colors.primary, marginRight: spacing.sm, marginTop: 6, fontSize: 16 },
  ordered_list_icon: { color: colors.primaryDark, marginRight: spacing.sm, marginTop: 2, fontWeight: "700" },
  code_inline: {
    ...typography.caption,
    color: colors.primaryDark,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 4,
  },
  fence: {
    ...typography.caption,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  code_block: {
    ...typography.caption,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  blockquote: {
    backgroundColor: colors.surfaceSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  link: { color: colors.primaryDark, textDecorationLine: "underline" },
  hr: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth, marginVertical: spacing.sm },
})
