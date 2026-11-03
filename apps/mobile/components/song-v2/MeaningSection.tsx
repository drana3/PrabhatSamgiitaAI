import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native"

import { Card, Pill, SectionHeading } from "@/components/song-v2/common"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amColors } from "@/constants/tokens/amColors"
import { amGap, amRadius, amSpace } from "@/constants/tokens/amSpacing"
import { amType } from "@/constants/tokens/amTypography"
import { localeLabel, localeNativeLabel, localeOptions } from "@/constants/languages"
import type { SongMeaningResolution } from "@/lib/songMeanings"
import { meaningUnavailableMessage } from "@/lib/songMeanings"

/** Languages pinned as chips before the +N button (spec SCR-16 item 6). */
export const PINNED_MEANING_LANGUAGES = ["en", "ru", "hi", "es"] as const

export function MeaningSection({
  theme,
  language,
  chosen,
  meaning,
  centralIdea,
  loading,
  onPick,
  onMore,
  onAsk,
}: {
  theme: AmTheme
  language: string
  /** languages picked in the sheet, shown first */
  chosen: string[]
  meaning: SongMeaningResolution
  centralIdea: string | null
  loading: boolean
  onPick: (code: string) => void
  onMore: () => void
  onAsk?: () => void
}) {
  const chips = [...chosen, ...PINNED_MEANING_LANGUAGES.filter((code) => !chosen.includes(code))]
  const rest = Math.max(0, localeOptions.length - chips.length)
  return (
    <View style={styles.section}>
      <SectionHeading theme={theme}>Meaning</SectionHeading>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipScroll}
      >
        {chips.map((code) => (
          <Pill
            key={code}
            theme={theme}
            label={localeNativeLabel(code)}
            accessibilityLabel={`Meaning in ${localeLabel(code)}`}
            selected={code === language}
            onPress={() => onPick(code)}
          />
        ))}
        <Pill theme={theme} label={`+${rest}`} accessibilityLabel="More languages" onPress={onMore} />
      </ScrollView>
      {centralIdea ? (
        <View style={[styles.idea, { backgroundColor: amColors.sage200 }]}>
          <Text style={[amType.label, { color: amColors.sage900 }]}>Central idea</Text>
          <Text style={[amType.body, { color: amColors.sage900 }]}>{centralIdea}</Text>
        </View>
      ) : null}
      <Card theme={theme}>
        {meaning.status === "ready" ? (
          <Text style={[amType.body, { color: theme.textHeading }]}>{meaning.text}</Text>
        ) : meaning.status === "loading" || loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.brand} />
            <Text style={[amType.body, { color: theme.textBody }]}>{`Translating into ${localeLabel(language)}…`}</Text>
          </View>
        ) : (
          <Text style={[amType.body, { color: theme.textBody }]}>{meaningUnavailableMessage(language)}</Text>
        )}
      </Card>
      {onAsk ? <Pill theme={theme} tone="sand" label="Ask about this song" onPress={onAsk} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: amSpace.s3 },
  chipScroll: { marginHorizontal: -amGap.gutter },
  chips: { paddingHorizontal: amGap.gutter, gap: amSpace.s2 },
  idea: { borderRadius: amRadius.card, padding: amGap.padCard, gap: amSpace.s2 },
  loading: { flexDirection: "row", alignItems: "center", gap: amSpace.s3 },
})
