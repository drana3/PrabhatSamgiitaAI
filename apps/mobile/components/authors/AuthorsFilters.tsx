import { StyleSheet, Text, View } from "react-native"

import { SIDE } from "@/components/authors/AuthorsUi"
import { KPress } from "@/components/kirtan/KPress"
import { Sheet } from "@/components/player-v2/Sheet"
import { Radio, SheetGroup, SheetRow } from "@/components/player-v2/Rows"
import { SpIcon } from "@/components/song-v2/SpIcon"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import type { DirectorySort } from "@/lib/authors/types"

/** A filter pill is 36 high to look light; `hitSlop` brings its touch area to 44. */
const TOUCH = { top: 4, bottom: 4, left: 4, right: 4 } as const
/** A sort segment is 32 high inside its 36 track; this gives it a 44 touch area. */
const TOUCH_SEG = { top: 6, bottom: 6, left: 2, right: 2 } as const

export type FilterOption = { id: string; label: string }

/** One small dropdown button: its name and a chevron while nothing is chosen, the chosen value (on a dark fill, no chevron: it needs the room) once something is. */
function FilterPill({ theme, name, value, full, onPress }: { theme: SongsTheme; name: string; value?: string; full?: string; onPress: () => void }) {
  const on = Boolean(value)
  const ink = on ? theme.onInk : theme.textHeading
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel={on ? `${name}: ${full ?? value}` : name}
      accessibilityState={{ expanded: false, selected: on }}
      hitSlop={TOUCH}
      onPress={onPress}
      pressedScale={0.95}
      outerStyle={styles.pillOuter}
      style={[styles.pill, { backgroundColor: on ? theme.ink900 : "transparent", borderColor: on ? theme.ink900 : theme.lineStrong }]}
    >
      <Text style={[styles.pillText, { color: ink }]} numberOfLines={1}>
        {value ?? name}
      </Text>
      {on ? null : <SpIcon name="chevDown" size={16} color={ink} strokeWidth={2} />}
    </KPress>
  )
}

const SORTS: DirectorySort[] = ["listeners", "new", "name"]

/** The sort switch: three short words in one small track; the chosen one sits on a raised chip. */
function SortSwitch({ theme, value, onChange }: { theme: SongsTheme; value: DirectorySort; onChange: (sort: DirectorySort) => void }) {
  const t = useT()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t("authors.dir.sort.label")} style={[styles.track, { backgroundColor: theme.line }]}>
      {SORTS.map((s) => {
        const on = s === value
        return (
          <KPress
            key={s}
            accessibilityRole="radio"
            accessibilityLabel={t(`authors.dir.sort.${s}`)}
            accessibilityState={{ selected: on }}
            hitSlop={TOUCH_SEG}
            onPress={() => onChange(s)}
            pressedScale={0.94}
            style={[styles.seg, { backgroundColor: on ? theme.card : "transparent" }]}
          >
            <Text style={[styles.segText, { color: on ? theme.textHeading : theme.textBody, fontFamily: on ? amFonts.bold : amFonts.semi }]} numberOfLines={1}>
              {t(`authors.dir.sort.short.${s}`)}
            </Text>
          </KPress>
        )
      })}
    </View>
  )
}

/**
 * THE FILTER ROW: one line under the search, two small dropdown buttons (Kind, Language) and the sort switch. A chosen
 * value shows in its own button. Nothing else is filter chrome: the lists open in `FilterSheet`, a quiet "Clear" sits by the count.
 */
export function AuthorsFilterRow({
  theme,
  kindLabel,
  kindFull,
  languageLabel,
  sort,
  onKind,
  onLanguage,
  onSort,
}: {
  theme: SongsTheme
  kindLabel?: string
  /** the whole name of the chosen kind when the button shows a short one (screen readers read this) */
  kindFull?: string
  languageLabel?: string
  sort: DirectorySort
  onKind: () => void
  onLanguage: () => void
  onSort: (sort: DirectorySort) => void
}) {
  const t = useT()
  return (
    <View style={styles.row}>
      <FilterPill theme={theme} name={t("authors.dir.filter.kind")} value={kindLabel} full={kindFull} onPress={onKind} />
      <FilterPill theme={theme} name={t("authors.dir.filter.language")} value={languageLabel} onPress={onLanguage} />
      <View style={styles.spacer} />
      <SortSwitch theme={theme} value={sort} onChange={onSort} />
    </View>
  )
}

/** The count of the list and, only while a filter is on, one tap to drop them all. */
export function AuthorsCountLine({ theme, count, filtered, onClear }: { theme: SongsTheme; count: string; filtered: boolean; onClear: () => void }) {
  const t = useT()
  return (
    <View style={styles.countRow}>
      <Text style={[styles.count, { color: theme.textMuted }]} accessibilityLiveRegion="polite">
        {count}
      </Text>
      {filtered ? (
        <KPress accessibilityRole="button" accessibilityLabel={t("authors.dir.clearFilters")} hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }} onPress={onClear} pressedScale={0.95}>
          <Text style={[styles.clear, { color: theme.accentText }]}>{t("authors.dir.clear")}</Text>
        </KPress>
      ) : null}
    </View>
  )
}

/** A bottom sheet with one choice: "All" on top (this is the reset), then the options; picking one closes the sheet. */
export function FilterSheet({
  visible,
  theme,
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  visible: boolean
  theme: SongsTheme
  title: string
  options: FilterOption[]
  value: string | undefined
  onPick: (id: string | undefined) => void
  onClose: () => void
}) {
  const t = useT()
  const all: FilterOption = { id: "", label: t("authors.dir.filter.all") }
  const rows = [all, ...options]
  return (
    <Sheet visible={visible} onClose={onClose} title={title} theme={theme} hideDone>
      <View style={styles.sheetBody}>
        <SheetGroup theme={theme}>
          {rows.map((o, i) => {
            const on = (value ?? "") === o.id
            return (
              <SheetRow
                key={o.id || "all"}
                theme={theme}
                title={o.label}
                accessibilityRole="radio"
                selected={on}
                last={i === rows.length - 1}
                trailing={<Radio theme={theme} on={on} />}
                onPress={() => {
                  onPick(o.id || undefined)
                  onClose()
                }}
              />
            )
          })}
        </SheetGroup>
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: SIDE },
  spacer: { flex: 1 },
  pillOuter: { flexShrink: 1 },
  pill: { height: 36, borderRadius: 18, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 2, paddingLeft: 12, paddingRight: 12 },
  pillText: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  track: { flexDirection: "row", alignItems: "center", height: 36, borderRadius: 18, padding: 2 },
  seg: { height: 32, minWidth: 34, borderRadius: 16, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" },
  segText: { fontSize: 13, lineHeight: 16 },
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SIDE },
  count: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  clear: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18 },
  sheetBody: { paddingHorizontal: 20, paddingBottom: 8 },
})
