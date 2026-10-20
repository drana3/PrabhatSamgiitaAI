import { useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import * as Clipboard from "expo-clipboard"
import { Check, Copy } from "lucide-react-native"
import { useRouter } from "expo-router"

import { LanguagePickerModal } from "@/components/common/LanguagePickerModal"
import { colors } from "@/constants/colors"
import {
  localeLabel,
  localeNativeLabel,
  localeOptions,
  quickLocaleCodes,
} from "@/constants/languages"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { api } from "@/lib/client"
import type { UnderstandMode } from "@/lib/lyricsMeaningPager"
import type { SongMeaningResolution } from "@/lib/songMeanings"
import { meaningUnavailableMessage } from "@/lib/songMeanings"
import { isNearDuplicateProse, normalizeProseBlock } from "@/lib/songMap"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

const QUICK_LOCALES = localeOptions.filter((option) =>
  (quickLocaleCodes as readonly string[]).includes(option.code),
)

const MODES: { id: UnderstandMode; label: string }[] = [
  { id: "lyrics", label: "Lyrics" },
  { id: "meaning", label: "Meaning" },
]

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const value = text?.trim()
  if (!value) return null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={async () => {
        try {
          await Clipboard.setStringAsync(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* ignore clipboard errors */
        }
      }}
      style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}
    >
      {copied ? (
        <Check size={14} color={colors.primaryDark} />
      ) : (
        <Copy size={14} color={colors.textSecondary} />
      )}
      <Text style={[styles.copyText, copied && { color: colors.primaryDark }]}>
        {copied ? "Copied" : "Copy"}
      </Text>
    </Pressable>
  )
}

type LyricScript = "roman" | "devanagari"

type Props = {
  songNumber: number
  lyrics: string
  lyricsDevanagari?: string | null
  /** none | provisional | pending_review | approved */
  devanagariStatus?: string | null
  language: string
  localizing: boolean
  meaning: SongMeaningResolution
  /** Official Central idea / Purport when present (English source). */
  centralIdea?: string | null
  /** Translated Central idea for the selected meaning language. */
  localizedCentralIdea?: string | null
  /** LLM Central idea generate in flight (meaning already shown). */
  centralIdeaPending?: boolean
  onSelectLanguage: (code: string) => void
}

function MeaningBody({
  language,
  meaning,
}: {
  language: string
  meaning: SongMeaningResolution
}) {
  if (meaning.status === "loading") {
    return (
      <View style={styles.meaningLoadingRow}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.meaningUnavailable}>Translating meaning…</Text>
      </View>
    )
  }
  if (meaning.status === "ready") {
    return <Text style={styles.body}>{normalizeProseBlock(meaning.text)}</Text>
  }
  return (
    <Text style={styles.meaningUnavailable}>{meaningUnavailableMessage(language)}</Text>
  )
}

function LanguageRow({
  language,
  localizing,
  onSelectLanguage,
  onOpenMore,
}: {
  language: string
  localizing: boolean
  onSelectLanguage: (code: string) => void
  onOpenMore: () => void
}) {
  return (
    <>
      <View style={styles.langRow} collapsable={false}>
        {QUICK_LOCALES.map((option) => (
          <Pressable
            key={option.code}
            onPress={() => onSelectLanguage(option.code)}
            delayPressIn={0}
            hitSlop={8}
            style={[styles.langChip, language === option.code && styles.langActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: language === option.code }}
            accessibilityLabel={`Meaning in ${option.label}`}
          >
            <Text style={styles.langText}>{option.nativeLabel}</Text>
          </Pressable>
        ))}
        {!(quickLocaleCodes as readonly string[]).includes(language) ? (
          <Pressable
            style={[styles.langChip, styles.langActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: true }}
            accessibilityLabel={`Meaning in ${localeLabel(language)}`}
            onPress={onOpenMore}
            delayPressIn={0}
            hitSlop={8}
          >
            <Text style={styles.langText}>{localeNativeLabel(language)}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onOpenMore}
          delayPressIn={0}
          hitSlop={8}
          style={styles.langMore}
          accessibilityRole="button"
          accessibilityLabel="More languages"
        >
          <Text style={styles.langMoreText}>More</Text>
        </Pressable>
      </View>
      <View style={styles.langHintRow}>
        {localizing ? (
          <>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.langHint}>Updating {localeLabel(language)}…</Text>
          </>
        ) : (
          <Text style={styles.langHint}>Meaning language · {localeLabel(language)}</Text>
        )}
      </View>
    </>
  )
}

function statusLabel(status: string | null | undefined): string {
  if (status === "approved") return "Approved"
  if (status === "pending_review") return "Pending review"
  if (status === "provisional") return "Provisional"
  return ""
}

export function LyricsMeaningView({
  songNumber,
  lyrics,
  lyricsDevanagari,
  devanagariStatus,
  language,
  localizing,
  centralIdea,
  localizedCentralIdea,
  centralIdeaPending = false,
  meaning,
  onSelectLanguage,
}: Props) {
  const router = useRouter()
  const authMode = useAuthStore((s) => s.mode)
  const email = useAuthStore((s) => s.email)
  const [mode, setMode] = useState<UnderstandMode>("lyrics")
  const [script, setScript] = useState<LyricScript>("roman")
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportNote, setReportNote] = useState("")
  const [reportBusy, setReportBusy] = useState(false)
  const hasDevanagari = Boolean(lyricsDevanagari?.trim())
  const activeScript = hasDevanagari ? script : "roman"
  const activeLyrics =
    activeScript === "devanagari" && hasDevanagari ? lyricsDevanagari!.trim() : lyrics
  const badge = activeScript === "devanagari" ? statusLabel(devanagariStatus) : ""

  async function sendDevanagariReport() {
    if (authMode === "guest") {
      Alert.alert("Sign-in required", "Please sign in to report Devanagari to admin.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign in", onPress: () => router.push(href("/signin")) },
      ])
      return
    }
    setReportBusy(true)
    try {
      const note = reportNote.trim() || "Please review Devanagari lyrics for this song."
      const result = await api.submitFeedback({
        category: "devanagari",
        rating: 2,
        comment: `Devanagari report for song #${songNumber}\n${note}`,
        page_path: `/songs/${songNumber}`,
        contact: email ?? undefined,
      })
      Alert.alert("Sent to admin", result.message)
      setReportNote("")
      setReportOpen(false)
    } catch (error) {
      Alert.alert(
        "Could not send",
        error instanceof Error ? error.message : "Report could not be sent. Please try again.",
      )
    } finally {
      setReportBusy(false)
    }
  }

  return (
    <View>
      <View style={styles.modeRow} accessibilityRole="tablist">
        {MODES.map((item) => {
          const active = mode === item.id
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setMode(item.id)}
              style={[styles.modeTab, active && styles.modeTabActive]}
            >
              <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{item.label}</Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={styles.lead}>
        {mode === "lyrics" ? "Original words for singing." : "Meaning in the language you choose."}
      </Text>

      <View style={[styles.pane, mode !== "lyrics" && styles.hiddenPane]} pointerEvents={mode === "lyrics" ? "auto" : "none"}>
        {hasDevanagari ? (
          <View style={styles.scriptRow} accessibilityRole="tablist">
            {(
              [
                { id: "roman" as const, label: "Roman" },
                { id: "devanagari" as const, label: "Devanagari" },
              ] as const
            ).map((item) => {
              const active = activeScript === item.id
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setScript(item.id)
                    if (item.id === "roman") setReportOpen(false)
                  }}
                  style={[styles.scriptChip, active && styles.scriptChipActive]}
                >
                  <Text style={[styles.scriptChipText, active && styles.scriptChipTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ) : null}
        <View style={styles.paneHeader}>
          <CopyButton text={activeLyrics} label="Copy lyrics" />
        </View>
        <Text style={styles.lyrics} selectable>
          {activeLyrics.split("\n").map((line, index, lines) => (
            <Text key={`lyric-${index}`} style={styles.lyrics}>
              {line}
              {index < lines.length - 1 ? "\n" : ""}
            </Text>
          ))}
        </Text>
        {/* Status / disclaimer below verse so Devanagari toggle does not shove scroll. */}
        {activeScript === "devanagari" && hasDevanagari ? (
          <View style={styles.scriptMetaRow}>
            {badge ? (
              <Text
                style={[
                  styles.statusBadge,
                  devanagariStatus === "approved" && styles.statusApproved,
                ]}
              >
                {badge}
              </Text>
            ) : null}
            <Text style={styles.disclaimerInline}>May contain mistakes.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setReportOpen((v) => !v)}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.reportLink}>Report</Text>
            </Pressable>
          </View>
        ) : null}
        {activeScript === "devanagari" && hasDevanagari && reportOpen ? (
          <View style={styles.reportBox}>
            <TextInput
              value={reportNote}
              onChangeText={setReportNote}
              placeholder="What looks wrong? (optional)"
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.reportInput}
            />
            <Pressable
              accessibilityRole="button"
              disabled={reportBusy}
              onPress={() => void sendDevanagariReport()}
              style={({ pressed }) => [
                styles.reportSubmit,
                (pressed || reportBusy) && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.reportSubmitText}>
                {reportBusy ? "Sending…" : "Submit to admin"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <View style={[styles.pane, mode !== "meaning" && styles.hiddenPane]} pointerEvents={mode === "meaning" ? "auto" : "none"}>
        <LanguageRow
          language={language}
          localizing={localizing}
          onSelectLanguage={onSelectLanguage}
          onOpenMore={() => setLanguagePickerOpen(true)}
        />
        {meaning.status === "ready" ? (
          <View style={styles.paneHeader}>
            <CopyButton text={meaning.text} label="Copy meaning" />
          </View>
        ) : null}
        <MeaningBody language={language} meaning={meaning} />
        {localizedCentralIdea?.trim() &&
        localizedCentralIdea.trim() !== (centralIdea || "").trim() &&
        // Never show a Central idea that is just the meaning restated (content, not length).
        !(
          meaning.status === "ready" &&
          isNearDuplicateProse(localizedCentralIdea, meaning.text)
        ) ? (
          <View style={styles.centralIdeaBlock}>
            <Text style={styles.centralIdeaLabel}>
              {centralIdea?.trim()
                ? `${localeLabel(language)} · Central idea`
                : language === "en"
                  ? "Central idea · In simple words"
                  : `${localeLabel(language)} · In simple words`}
            </Text>
            <Text style={styles.body}>{normalizeProseBlock(localizedCentralIdea)}</Text>
          </View>
        ) : null}
        {centralIdeaPending && !localizedCentralIdea?.trim() ? (
          <View style={styles.centralIdeaPendingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.centralIdeaPendingText}>
              Central idea generation in progress
            </Text>
          </View>
        ) : null}
        {centralIdea?.trim() ? (
          <View
            style={[
              styles.centralIdeaBlock,
              localizedCentralIdea?.trim() &&
              localizedCentralIdea.trim() !== centralIdea.trim()
                ? styles.centralIdeaFollowUp
                : null,
            ]}
          >
            <Text style={styles.centralIdeaLabel}>
              {localizedCentralIdea?.trim() &&
              localizedCentralIdea.trim() !== centralIdea.trim()
                ? "Central idea (English)"
                : "Central idea"}
            </Text>
            <Text style={styles.body}>{normalizeProseBlock(centralIdea)}</Text>
          </View>
        ) : null}
      </View>

      <LanguagePickerModal
        visible={languagePickerOpen}
        selectedCode={language}
        onClose={() => setLanguagePickerOpen(false)}
        onSelect={onSelectLanguage}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: "row",
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 4,
    marginBottom: spacing.md,
  },
  modeTab: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  modeTabActive: {
    backgroundColor: colors.textPrimary,
  },
  modeTabText: { ...typography.label, color: colors.textSecondary },
  scriptRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  scriptMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  scriptChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 36,
    justifyContent: "center",
  },
  scriptChipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  scriptChipText: { ...typography.label, color: colors.textSecondary },
  scriptChipTextActive: { color: colors.background },
  statusBadge: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  statusApproved: { color: colors.primaryDark, fontWeight: "600" },
  disclaimerInline: { ...typography.caption, color: colors.textMuted },
  reportLink: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: "Inter_600SemiBold",
    textDecorationLine: "underline",
  },
  reportBox: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.sm,
  },
  reportInput: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    minHeight: 72,
    textAlignVertical: "top",
  },
  reportSubmit: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 32,
    justifyContent: "center",
  },
  reportSubmitText: { ...typography.caption, color: colors.white, fontFamily: "Inter_600SemiBold" },
  modeTabTextActive: { color: colors.white },
  lead: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  pane: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  hiddenPane: {
    height: 0,
    overflow: "hidden",
    opacity: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    borderWidth: 0,
  },
  langRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  langChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  langActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  langText: { ...typography.caption, color: colors.textPrimary },
  langMore: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: colors.textPrimary,
  },
  langMoreText: { ...typography.caption, color: colors.white, fontFamily: "Inter_600SemiBold" },
  langHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  langHint: { ...typography.caption, color: colors.textMuted },
  paneHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: spacing.xs,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    minHeight: 32,
  },
  copyText: { ...typography.caption, color: colors.textSecondary },
  body: { ...typography.bodySmall, color: colors.textSecondary },
  centralIdeaBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  centralIdeaPendingRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  centralIdeaPendingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  centralIdeaFollowUp: {
    borderTopWidth: 0,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  centralIdeaLabel: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  meaningLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  meaningUnavailable: { ...typography.bodySmall, color: colors.textMuted },
  lyrics: { ...typography.body, color: colors.textPrimary },
})
