import { useRef, type ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Check, Heart, ListPlus, Share2 } from "lucide-react-native"

import { BottomSheet } from "@/components/songs-v2/BottomSheet"
import { Chip, PillButton } from "@/components/songs-v2/Pill"
import { Press } from "@/components/songs-v2/Press"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amGap, amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
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

/** Sort order: radio rows with a subtitle each (spec SCR-30). */
export function SortSheet({
  open,
  theme,
  options,
  value,
  onPick,
  onClose,
}: {
  open: boolean
  theme: AmTheme
  options: readonly SortOption[]
  value: SortKey
  onPick: (key: SortKey) => void
  onClose: () => void
}) {
  return (
    <BottomSheet open={open} onClose={onClose} theme={theme} eyebrow="Sort songs" accessibilityLabel="Sort songs">
      <View style={styles.stack}>
        {options.map((option) => {
          const selected = option.key === value
          return (
            <Press
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.title}. ${option.subtitle}`}
              onPress={() => onPick(option.key)}
              pressedScale={0.985}
              style={[styles.radioRow, { backgroundColor: selected ? theme.inner : "transparent", borderColor: theme.line }]}
            >
              <View style={styles.flex}>
                <Text style={[styles.rowTitle, { color: theme.textHeading }]}>{option.title}</Text>
                <Text style={[amType.body, { color: theme.textBody }]}>{option.subtitle}</Text>
              </View>
              {selected ? <Check size={22} color={theme.brand} /> : null}
            </Press>
          )
        })}
      </View>
    </BottomSheet>
  )
}

function Group({ theme, label, children }: { theme: AmTheme; label: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={[amType.label, { color: theme.eyebrow }]}>{label}</Text>
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
  theme: AmTheme
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
  theme: AmTheme
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

function MenuRow({ theme, label, icon, onPress }: { theme: AmTheme; label: string; icon: ReactNode; onPress: () => void }) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      pressedScale={0.985}
      style={[styles.menuRow, { borderColor: theme.line }]}
    >
      {icon}
      <Text style={[styles.rowTitle, { color: theme.textHeading }]}>{label}</Text>
    </Press>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: amSpace.s2 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: amSpace.s2 },
  group: { gap: amSpace.s3 },
  footer: { flexDirection: "row", gap: amGap.grid, paddingTop: amSpace.s2 },
  radioRow: {
    minHeight: 64,
    borderRadius: amRadius.card,
    borderWidth: 1,
    paddingHorizontal: amGap.padCard,
    paddingVertical: amSpace.s3,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s3,
  },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 24 },
  menuTitle: { fontFamily: amFonts.bold, fontSize: 24, lineHeight: 28 },
  menuRow: {
    minHeight: amTouchTarget + amSpace.s4,
    borderRadius: amRadius.card,
    borderWidth: 1,
    paddingHorizontal: amGap.padCard,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s3,
  },
})
