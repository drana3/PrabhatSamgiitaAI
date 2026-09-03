import { useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import * as Clipboard from "expo-clipboard"
import { Check, Copy } from "lucide-react-native"

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
import type { UnderstandMode } from "@/lib/lyricsMeaningPager"
import type { SongMeaningResolution } from "@/lib/songMeanings"
import { meaningUnavailableMessage } from "@/lib/songMeanings"

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

type Props = {
  lyrics: string
  language: string
  localizing: boolean
  meaning: SongMeaningResolution
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
    return <Text style={styles.body}>{meaning.text}</Text>
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

export function LyricsMeaningView({
  lyrics,
  language,
  localizing,
  meaning,
  onSelectLanguage,
}: Props) {
  const [mode, setMode] = useState<UnderstandMode>("lyrics")
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false)

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
        <View style={styles.paneHeader}>
          <CopyButton text={lyrics} label="Copy lyrics" />
        </View>
        <Text style={styles.lyrics}>{lyrics}</Text>
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
  meaningLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  meaningUnavailable: { ...typography.bodySmall, color: colors.textMuted },
  lyrics: { ...typography.body, color: colors.textPrimary },
})
