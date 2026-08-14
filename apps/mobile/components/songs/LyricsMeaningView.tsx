import { useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"

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
import type { SongMeaningResolution } from "@/lib/songMeanings"
import { meaningUnavailableMessage } from "@/lib/songMeanings"

const QUICK_LOCALES = localeOptions.filter((option) =>
  (quickLocaleCodes as readonly string[]).includes(option.code),
)

export type UnderstandMode = "lyrics" | "meaning"

const MODES: { id: UnderstandMode; label: string }[] = [
  { id: "lyrics", label: "Lyrics" },
  { id: "meaning", label: "Meaning" },
]

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
    <Text style={styles.meaningUnavailable}>{meaningUnavailableMessage(localeLabel(language))}</Text>
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.langRow}
      >
        {QUICK_LOCALES.map((option) => (
          <Pressable
            key={option.code}
            onPress={() => onSelectLanguage(option.code)}
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
          >
            <Text style={styles.langText}>{localeNativeLabel(language)}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onOpenMore}
          style={styles.langMore}
          accessibilityRole="button"
          accessibilityLabel="More languages"
        >
          <Text style={styles.langMoreText}>More</Text>
        </Pressable>
      </ScrollView>
      <View style={styles.langHintRow}>
        {localizing ? (
          <>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.langHint}>{localeLabel(language)}</Text>
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

      {mode === "lyrics" ? (
        <View style={styles.pane}>
          <Text style={styles.paneLabel}>Lyrics</Text>
          <Text style={styles.lyrics}>{lyrics}</Text>
        </View>
      ) : (
        <View style={styles.pane}>
          <Text style={styles.paneLabel}>Meaning</Text>
          <LanguageRow
            language={language}
            localizing={localizing}
            onSelectLanguage={onSelectLanguage}
            onOpenMore={() => setLanguagePickerOpen(true)}
          />
          <MeaningBody language={language} meaning={meaning} />
        </View>
      )}

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
    minHeight: 40,
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
  paneLabel: {
    ...typography.caption,
    color: colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  langChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  langActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  langText: { ...typography.caption, color: colors.textPrimary },
  langMore: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
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
  body: { ...typography.bodySmall, color: colors.textSecondary },
  meaningLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  meaningUnavailable: { ...typography.bodySmall, color: colors.textMuted },
  lyrics: { ...typography.body, color: colors.textPrimary },
})
