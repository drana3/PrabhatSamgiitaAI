import { useMemo, useState } from "react"
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native"

import { SpIcon } from "@/components/song-v2/SpIcon"
import { Press } from "@/components/songs-v2/Press"
import { overStyle } from "@/components/songs-v2/primitives"
import { CloseGlyph, SearchGlyph } from "@/components/songs-v2/Glyphs"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { FEEDBACK_KINDS, songLabel, type FeedbackKind, type PickedSong } from "@/lib/feedback/model"
import { catalogSongByNumber, isCatalogNumberQuery, searchCatalogLyrics } from "@/lib/lyricSearch"
import { songTitleFromHit } from "@/lib/mineView"
import { displayTitle } from "@/lib/songsV2/entry"

type ThemeProps = { theme: SongsTheme }

const NO_OUTLINE = Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null

/** Over-label of a field: `WHAT IS IT?`, with an optional quiet note on the right. */
export function FieldLabel({ theme, children, note }: ThemeProps & { children: string; note?: string }) {
  return (
    <View style={styles.labelRow}>
      <Text style={[overStyle, { color: theme.accent }]}>{children}</Text>
      {note ? <Text style={[styles.note, { color: theme.textBody }]}>{note}</Text> : null}
    </View>
  )
}

/**
 * The segmented choice of what the message is. Two columns; the chosen one is an orange700 pill with a
 * check, the others are outlined, so the state never relies on colour alone.
 */
export function KindPicker({ theme, value, onChange }: ThemeProps & { value: FeedbackKind; onChange: (kind: FeedbackKind) => void }) {
  return (
    <View style={styles.kinds} accessibilityRole="radiogroup" accessibilityLabel="What is it?">
      {FEEDBACK_KINDS.map((option) => {
        const on = option.id === value
        return (
          <Press
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, selected: on }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.id)}
            pressedScale={0.97}
            outerStyle={styles.kindOuter}
            style={[
              styles.kind,
              on
                ? { backgroundColor: theme.brand, borderColor: theme.brand }
                : { backgroundColor: theme.card, borderColor: theme.line },
            ]}
          >
            <View style={[styles.dot, on ? { backgroundColor: amColors.white, borderColor: amColors.white } : { borderColor: theme.textMuted }]}>
              {on ? <SpIcon name="check" size={13} strokeWidth={2.6} color={amColors.orange700} /> : null}
            </View>
            <Text style={[styles.kindText, { color: on ? amColors.white : theme.textHeading }]}>{option.label}</Text>
          </Press>
        )
      })}
    </View>
  )
}

/** A text box in the page's style: card ground, hairline, orange700 ring while focused. */
export function TextBox({
  theme,
  invalid,
  style,
  ...rest
}: ThemeProps & TextInputProps & { invalid?: boolean }) {
  const [focused, setFocused] = useState(false)
  return (
    <TextInput
      {...rest}
      onFocus={(event) => {
        setFocused(true)
        rest.onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        rest.onBlur?.(event)
      }}
      placeholderTextColor={theme.textMuted}
      style={[
        styles.box,
        {
          color: theme.textHeading,
          backgroundColor: theme.card,
          borderColor: invalid ? theme.dangerText : focused ? theme.brand : theme.line,
          borderWidth: focused || invalid ? 2 : 1,
        },
        NO_OUTLINE,
        style,
      ]}
    />
  )
}

type Hit = PickedSong & { eyebrow: string }

function hitsFor(query: string): Hit[] {
  const text = query.trim()
  if (text.length < 1) return []
  const hits = isCatalogNumberQuery(text)
    ? [catalogSongByNumber(text)].filter((hit): hit is NonNullable<typeof hit> => hit != null)
    : text.length >= 2
      ? searchCatalogLyrics(text, 5)
      : []
  return hits.map((hit) => ({
    number: hit.number,
    title: displayTitle(songTitleFromHit(hit, hit.number)),
    eyebrow: `PS ${hit.number}`,
  }))
}

/**
 * Optional song for "A mistake in a song or lyrics": type a number or part of the title, tap a result.
 * The chosen song shows as a chip with a remove button.
 */
export function SongPicker({
  theme,
  value,
  onChange,
}: ThemeProps & { value: PickedSong | null; onChange: (song: PickedSong | null) => void }) {
  const [query, setQuery] = useState("")
  const hits = useMemo(() => hitsFor(query), [query])
  const searching = query.trim().length > 0

  if (value) {
    return (
      <View style={[styles.chosen, { backgroundColor: theme.card, borderColor: theme.line }]}>
        <Text style={[styles.chosenText, { color: theme.textHeading }]} numberOfLines={2}>
          {songLabel(value)}
        </Text>
        <Press
          accessibilityRole="button"
          accessibilityLabel="Remove the chosen song"
          onPress={() => {
            onChange(null)
            setQuery("")
          }}
          pressedScale={0.88}
          style={styles.remove}
        >
          <CloseGlyph size={18} color={theme.textBody} />
        </Press>
      </View>
    )
  }

  return (
    <View style={styles.pickerWrap}>
      <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.line }]}>
        <SearchGlyph color={theme.textBody} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Song number or title"
          placeholderTextColor={theme.textMuted}
          accessibilityLabel="Find the song by number or title"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.searchInput, { color: theme.textHeading }, NO_OUTLINE]}
        />
        {query ? (
          <Press accessibilityRole="button" accessibilityLabel="Clear" onPress={() => setQuery("")} pressedScale={0.88} style={styles.remove}>
            <CloseGlyph size={18} color={theme.textBody} />
          </Press>
        ) : null}
      </View>
      {searching ? (
        hits.length > 0 ? (
          <View style={[styles.results, { backgroundColor: theme.card, borderColor: theme.line }]}>
            {hits.map((hit, index) => (
              <Press
                key={hit.number}
                accessibilityRole="button"
                accessibilityLabel={songLabel(hit)}
                onPress={() => onChange({ number: hit.number, title: hit.title })}
                pressedScale={0.99}
                style={[styles.hit, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }]}
              >
                <Text style={[styles.hitEyebrow, { color: theme.accent }]}>{hit.eyebrow}</Text>
                <Text style={[styles.hitTitle, { color: theme.textHeading }]} numberOfLines={1}>
                  {hit.title}
                </Text>
              </Press>
            ))}
          </View>
        ) : (
          <Text style={[styles.note, { color: theme.textBody }]}>No song found. You can skip this and say which one in your message.</Text>
        )
      ) : (
        <Text style={[styles.note, { color: theme.textBody }]}>Optional. It helps us find the right page.</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, paddingHorizontal: 4, minHeight: 20 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kindOuter: { width: "48.5%", flexGrow: 1 },
  kind: {
    minHeight: 72,
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  kindText: { flex: 1, fontFamily: amFonts.semi, fontSize: 15, lineHeight: 19 },
  box: { minHeight: 56, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22 },
  pickerWrap: { gap: 8 },
  search: { height: 52, borderRadius: 26, borderWidth: 1, paddingLeft: 16, paddingRight: 6, flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: { flex: 1, height: 52, fontFamily: amFonts.medium, fontSize: 16 },
  remove: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  results: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  hit: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 10, justifyContent: "center", gap: 2 },
  hitEyebrow: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 15, letterSpacing: 0.9, textTransform: "uppercase" },
  hitTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  chosen: { minHeight: 56, borderRadius: 20, borderWidth: 1, paddingLeft: 16, paddingRight: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  chosenText: { flex: 1, fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
})
