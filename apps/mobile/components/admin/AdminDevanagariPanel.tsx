import { useCallback, useEffect, useState } from "react"
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
import type { AdminDevanagariSong } from "@prabhat/core"
import * as Clipboard from "expo-clipboard"
import { Languages } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { api } from "@/lib/client"

export function AdminDevanagariPanel({
  initialSongNumber,
}: {
  initialSongNumber?: number
}) {
  const [songNumber, setSongNumber] = useState(
    initialSongNumber && initialSongNumber >= 1 ? String(initialSongNumber) : "1",
  )
  const [song, setSong] = useState<AdminDevanagariSong | null>(null)
  const [draft, setDraft] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadSong = useCallback(
    async (number = songNumber) => {
      const n = Number(number)
      if (!Number.isInteger(n) || n < 1) {
        Alert.alert("Devanagari", "Enter a valid song number.")
        return
      }
      setBusy(true)
      setMessage(null)
      const result = await api.fetchAdminDevanagari(n)
      setBusy(false)
      if (!result.ok) {
        setSong(null)
        Alert.alert("Devanagari", result.detail)
        return
      }
      setSong(result.song)
      setDraft(result.song.lyrics_devanagari || "")
      setMessage(`Loaded #${result.song.song_number} · ${result.song.devanagari_status}`)
    },
    [songNumber],
  )

  useEffect(() => {
    if (initialSongNumber && initialSongNumber >= 1) {
      setSongNumber(String(initialSongNumber))
      void loadSong(String(initialSongNumber))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when route/feedback picks a song
  }, [initialSongNumber])

  const copyText = async (label: string, text: string) => {
    const value = text.trim()
    if (!value) {
      Alert.alert("Copy", `No ${label} to copy.`)
      return
    }
    try {
      await Clipboard.setStringAsync(value)
      Alert.alert("Copied", `${label} copied.`)
    } catch {
      Alert.alert("Copy", "Could not copy.")
    }
  }

  const save = async (submitForApproval: boolean) => {
    if (!song) return
    if (!draft.trim()) {
      Alert.alert("Devanagari", "Devanagari text is required.")
      return
    }
    setBusy(true)
    setMessage(null)
    const result = await api.updateAdminDevanagari(song.song_number, {
      lyrics_devanagari: draft,
      submit_for_approval: submitForApproval,
      review_note: note.trim() || null,
    })
    setBusy(false)
    if (!result.ok) {
      Alert.alert("Devanagari", result.detail)
      return
    }
    setSong(result.song)
    setDraft(result.song.lyrics_devanagari || "")
    setMessage(
      submitForApproval
        ? "Saved · pending_review"
        : `Saved · ${result.song.devanagari_status}`,
    )
  }

  const approve = async () => {
    if (!song) return
    setBusy(true)
    setMessage(null)
    if (draft.trim() && draft !== (song.lyrics_devanagari || "")) {
      const saved = await api.updateAdminDevanagari(song.song_number, {
        lyrics_devanagari: draft,
        submit_for_approval: false,
        review_note: note.trim() || null,
      })
      if (!saved.ok) {
        setBusy(false)
        Alert.alert("Devanagari", saved.detail)
        return
      }
      setSong(saved.song)
      setDraft(saved.song.lyrics_devanagari || "")
    }
    const result = await api.approveAdminDevanagari(song.song_number, note.trim() || null)
    setBusy(false)
    if (!result.ok) {
      Alert.alert("Devanagari", result.detail)
      return
    }
    setSong(result.song)
    setMessage("Approved — reporters notified by email when contact is set.")
  }

  const roman = song?.lyrics_original?.trim() || ""

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heroSub}>
        Load a song, compare Roman with editable Devanagari, then save or approve. Copy and paste
        freely while editing.
      </Text>

      <View style={styles.grantRow}>
        <TextInput
          value={songNumber}
          onChangeText={setSongNumber}
          keyboardType="number-pad"
          placeholder="Song number"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Pressable
          style={styles.actionBtn}
          disabled={busy}
          onPress={() => void loadSong()}
        >
          {busy && !song ? (
            <ActivityIndicator size="small" color={colors.primaryDark} />
          ) : (
            <Text style={styles.actionText}>Load</Text>
          )}
        </Pressable>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      {song ? (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Languages size={16} color={colors.primary} />
            <Text style={styles.meta}>
              #{song.song_number} · {song.devanagari_status}
            </Text>
          </View>
          <Text style={styles.snippet}>{song.title}</Text>
          {song.conversion_confidence_percent != null ? (
            <View style={styles.confidenceBox}>
              <Text style={styles.confidenceTitle}>
                Roman→Devanagari confidence: {song.conversion_confidence_percent}%
              </Text>
              {song.song_language ? (
                <Text style={styles.meta}>
                  Language: {song.song_language}
                  {song.review_language ? ` · agent ${song.review_language}` : ""}
                </Text>
              ) : null}
              {song.conversion_notes ? (
                <Text style={styles.meta}>{song.conversion_notes}</Text>
              ) : null}
              {song.regional_grammar_notes ? (
                <Text style={styles.meta}>Regional: {song.regional_grammar_notes}</Text>
              ) : null}
              {(song.review_reasons?.length ?? 0) > 0 ? (
                <Text style={styles.meta}>
                  Reasons: {(song.review_reasons ?? []).slice(0, 6).join(" · ")}
                </Text>
              ) : null}
              {(song.ambiguous_tokens?.length ?? 0) > 0 ? (
                <Text style={styles.meta}>
                  Ambiguous: {(song.ambiguous_tokens ?? []).slice(0, 10).join(", ")}
                </Text>
              ) : null}
              {(song.unsupported_tokens?.length ?? 0) > 0 ? (
                <Text style={[styles.meta, styles.warnMeta]}>
                  Unsupported: {(song.unsupported_tokens ?? []).slice(0, 10).join(", ")}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>Roman</Text>
              <Pressable onPress={() => void copyText("Roman", roman)} hitSlop={8}>
                <Text style={styles.copyLink}>Copy</Text>
              </Pressable>
            </View>
            <Text style={styles.lyrics} selectable>
              {roman || "—"}
            </Text>
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>Devanagari (edit)</Text>
              <Pressable onPress={() => void copyText("Devanagari", draft)} hitSlop={8}>
                <Text style={styles.copyLink}>Copy</Text>
              </Pressable>
            </View>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              textAlignVertical="top"
              style={styles.editor}
            />
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Review note (optional)"
            placeholderTextColor={colors.textMuted}
            style={styles.noteInput}
          />

          <View style={styles.actions}>
            <Pressable
              style={styles.actionBtn}
              disabled={busy}
              onPress={() => void save(false)}
            >
              <Text style={styles.actionText}>Save provisional</Text>
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              disabled={busy}
              onPress={() => void save(true)}
            >
              <Text style={styles.actionText}>Submit for approval</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.approveBtn]}
              disabled={busy}
              onPress={() => void approve()}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.primaryDark} />
              ) : (
                <Text style={styles.actionText}>Approve</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.empty}>Enter a song number and tap Load to review Devanagari.</Text>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.section, gap: spacing.md },
  heroSub: { ...typography.bodySmall, color: colors.textSecondary },
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
    ...typography.body,
  },
  actionBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: "center",
  },
  actionText: { ...typography.caption, color: colors.primaryDark },
  approveBtn: { borderWidth: 1, borderColor: colors.primary },
  message: { ...typography.caption, color: colors.primaryDark },
  empty: { ...typography.bodySmall, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...softShadow(1),
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  meta: { ...typography.caption, color: colors.textMuted },
  snippet: { ...typography.bodySmall, color: colors.textPrimary },
  confidenceBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.sm,
    gap: 4,
  },
  confidenceTitle: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: "Inter_600SemiBold",
  },
  warnMeta: { color: colors.error },
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.xs,
  },
  panelHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelTitle: { ...typography.label, color: colors.textPrimary },
  copyLink: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: "Inter_600SemiBold",
    textDecorationLine: "underline",
  },
  lyrics: { ...typography.body, color: colors.textPrimary },
  editor: {
    minHeight: 200,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.bodySmall,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
})
