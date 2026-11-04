import { useRef, type ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Check, Heart, ListPlus, Share2 } from "lucide-react-native"

import { BottomSheet } from "@/components/songs-v2/BottomSheet"
import { Chip, PillButton } from "@/components/songs-v2/Pill"
import { Press } from "@/components/songs-v2/Press"
import { overStyle } from "@/components/songs-v2/primitives"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import {
  DURATION_BUCKETS,
  SCRIPT_LABEL,
  toggleDuration,
  toggleHasAudio,
  toggleLanguage,
  toggleScript,
  type FilterState,
  type ScriptId,
} from "@/lib/songsV2/filters"
import type { SortKey, SortOption } from "@/lib/songsV2/sort"

/**
 * Sort order (prototype `SORT SHEET`, lines 2358-2373): "Sort songs by" over a white group of rows,
 * each a name, a small subtitle and a radio dot. A tap picks and closes.
 */
export function SortSheet({
  open,
  theme,
  options,
  value,
  onPick,
  onClose,
}: {
  open: boolean
  theme: SongsTheme
  options: readonly SortOption[]
  value: SortKey
  onPick: (key: SortKey) => void
  onClose: () => void
}) {
  return (
    <BottomSheet open={open} onClose={onClose} theme={theme} eyebrow="Sort songs by" accessibilityLabel="Sort songs" flush>
      <View style={[styles.sortGroup, { backgroundColor: theme.card, borderColor: theme.line }]} accessibilityRole="radiogroup">
        {options.map((option, index) => {
          const selected = option.key === value
          return (
            <Press
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.title}. ${option.subtitle}`}
              onPress={() => onPick(option.key)}
              pressedScale={0.99}
              style={[
                styles.lrow,
                { borderBottomColor: theme.line, borderBottomWidth: index === options.length - 1 ? 0 : 1 },
              ]}
            >
              <View style={styles.lm}>
                <Text style={[styles.lmName, { color: theme.textHeading }]}>{option.title}</Text>
                <Text style={[styles.lmSub, { color: theme.textBody }]}>{option.subtitle}</Text>
              </View>
              <View style={[styles.rdo, selected ? { backgroundColor: theme.brand, borderColor: theme.brand } : { borderColor: theme.ink300 }]}>
                {selected ? <View style={styles.rdoDot} /> : null}
              </View>
            </Press>
          )
        })}
      </View>
    </BottomSheet>
  )
}

function Group({ theme, label, children }: { theme: SongsTheme; label: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={[overStyle, { color: theme.accent }]}>{label}</Text>
      <View style={styles.wrap}>{children}</View>
    </View>
  )
}

/** Funnel sheet: language, script, has audio, duration. */
export function FilterSheet({
  open,
  theme,
  state,
  languages,
  onChange,
  onClear,
  onClose,
  resultCount,
}: {
  open: boolean
  theme: SongsTheme
  state: FilterState
  languages: readonly { language: string; count: number }[]
  onChange: (next: FilterState) => void
  onClear: () => void
  onClose: () => void
  resultCount: number
}) {
  return (
    <BottomSheet open={open} onClose={onClose} theme={theme} eyebrow="Filters" accessibilityLabel="Filters">
      {languages.length ? (
        <Group theme={theme} label="Language">
          {languages.map(({ language, count }) => (
            <Chip
              key={language}
              theme={theme}
              label={`${language} · ${count}`}
              active={state.languages.includes(language)}
              onPress={() => onChange(toggleLanguage(state, language))}
            />
          ))}
        </Group>
      ) : null}
      <Group theme={theme} label="Script">
        {(Object.keys(SCRIPT_LABEL) as ScriptId[]).map((script) => (
          <Chip
            key={script}
            theme={theme}
            label={SCRIPT_LABEL[script]}
            active={state.scripts.includes(script)}
            onPress={() => onChange(toggleScript(state, script))}
          />
        ))}
      </Group>
      <Group theme={theme} label="Audio">
        <Chip theme={theme} label="Has audio" active={state.hasAudio} onPress={() => onChange(toggleHasAudio(state))} />
      </Group>
      <Group theme={theme} label="Duration">
        {DURATION_BUCKETS.map((bucket) => (
          <Chip
            key={bucket.id}
            theme={theme}
            label={bucket.label}
            active={state.durations.includes(bucket.id)}
            onPress={() => onChange(toggleDuration(state, bucket.id))}
          />
        ))}
      </Group>
      <View style={styles.footer}>
        <PillButton theme={theme} tone="sand" label="Clear" onPress={onClear} fill />
        <PillButton
          theme={theme}
          label={`Show ${resultCount} ${resultCount === 1 ? "song" : "songs"}`}
          onPress={onClose}
          fill
        />
      </View>
    </BottomSheet>
  )
}

/** Long press on a row: add to queue, save, share. */
export function RowMenuSheet({
  open,
  theme,
  entry,
  saved,
  onQueue,
  onToggleSave,
  onShare,
  onClose,
}: {
  open: boolean
  theme: SongsTheme
  entry: CatalogEntry | null
  saved: boolean
  onQueue: (entry: CatalogEntry) => void
  onToggleSave: (entry: CatalogEntry) => void
  onShare: (entry: CatalogEntry) => void
  onClose: () => void
}) {
  // keep the last song while the sheet slides out, so its title does not vanish mid-exit
  const last = useRef<CatalogEntry | null>(null)
  if (entry) last.current = entry
  const shown = entry ?? last.current
  const act = (fn: (entry: CatalogEntry) => void) => () => {
    if (shown) fn(shown)
    onClose()
  }
  return (
    <BottomSheet
      open={open && Boolean(entry)}
      onClose={onClose}
      theme={theme}
      eyebrow={shown ? `PS ${shown.number}` : ""}
      accessibilityLabel="Song actions"
    >
      {shown ? <Text style={[styles.menuTitle, { color: theme.textHeading }]}>{shown.title}</Text> : null}
      <View style={styles.stack}>
        <MenuRow theme={theme} label="Add to queue" icon={<ListPlus size={22} color={theme.textHeading} />} onPress={act(onQueue)} />
        <MenuRow
          theme={theme}
          label={saved ? "Remove from saved" : "Save"}
          icon={<Heart size={22} color={theme.textHeading} fill={saved ? theme.brand : "none"} />}
          onPress={act(onToggleSave)}
        />
        <MenuRow theme={theme} label="Share" icon={<Share2 size={22} color={theme.textHeading} />} onPress={act(onShare)} />
      </View>
    </BottomSheet>
  )
}

function MenuRow({ theme, label, icon, onPress }: { theme: SongsTheme; label: string; icon: ReactNode; onPress: () => void }) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      pressedScale={0.985}
      style={[styles.menuRow, { borderColor: theme.line, backgroundColor: theme.card }]}
    >
      {icon}
      <Text style={[styles.rowTitle, { color: theme.textHeading }]}>{label}</Text>
    </Press>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  group: { gap: 12 },
  footer: { flexDirection: "row", gap: 10, paddingTop: 8 },
  sortGroup: { marginHorizontal: 10, borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  lrow: {
    minHeight: 56,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 20,
    paddingRight: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  lm: { flex: 1, minWidth: 0 },
  lmName: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  lmSub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  rdo: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  rdoDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFFFFF" },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  menuTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 24, letterSpacing: -0.48 },
  menuRow: {
    minHeight: 60,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
})
