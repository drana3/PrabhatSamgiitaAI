import { memo, type ReactNode } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"

import { HOME_COVERS, HOME_COVER_FOCUS } from "@/components/home/homeCovers"
import { BackGlyph, PlayGlyph, SortGlyph } from "@/components/songs-v2/Glyphs"
import { SaveMark } from "@/components/save/SaveMark"
import { DownloadMark } from "@/components/offline/DownloadMark"
import { DotsIcon, PauseIcon, ShuffleIcon } from "@/components/songs-v2/ListIcons"
import { listDownloadLabel, type ListDownloadView } from "@/lib/offline/downloadModel"
import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { coverFor, stripColors, type HomeCoverId } from "@/lib/homeShelves"
import { formatDuration, type CatalogEntry } from "@/lib/songsV2/entry"
import { accentIndex, splitTitle, type ChipDef, type DownloadAllState } from "@/lib/songsV2/listPage"
import { useT } from "@/lib/i18n"

/** White glyphs and labels on the action fill (orange700): 5.1:1. Never dark text on orange. */
export const ON_ACTION = "#FFFFFF"

export const LIST_SIDE = 20
export const ROW_HEIGHT = 64
const COVER = 84
const COVER_RADIUS = 8

/* ------------------------------------------------------------------ covers */

/** A song's picture: the same photo Home gives it (lib/homeShelves coverFor). */
export const SongCover = memo(function SongCover({
  number,
  size,
  radius,
  tint,
}: {
  number: number
  size: number
  radius: number
  tint: string
}) {
  const id = coverFor(number)
  return <Tile id={id} width={size} height={size} radius={radius} tint={tint} />
})

function Tile({ id, width, height, radius, tint }: { id: HomeCoverId; width: number; height: number; radius: number; tint: string }) {
  return (
    <Image
      source={HOME_COVERS[id]}
      contentFit="cover"
      contentPosition={HOME_COVER_FOCUS[id]}
      accessibilityIgnoresInvertColors
      style={{ width, height, borderRadius: radius, backgroundColor: tint }}
    />
  )
}

/** All songs: four of the six photos, chosen by the first songs of the list. */
export function CollageCover({ ids, tint }: { ids: readonly HomeCoverId[]; tint: string }) {
  const half = COVER / 2
  return (
    <View style={[styles.cover, { backgroundColor: tint }]} accessibilityIgnoresInvertColors>
      {ids.map((id, i) => (
        <View key={i} style={{ width: half, height: half }}>
          <Tile id={id} width={half} height={half} radius={0} tint={tint} />
        </View>
      ))}
    </View>
  )
}

/** A collection: its own accent as a gradient with the first letter of its name. */
export function AccentCover({ label, dark }: { label: string; dark: boolean }) {
  const tone = (["orange", "gold", "sage", "forest"] as const)[accentIndex(label)]
  const { bg, fg } = stripColors(tone, dark)
  const letter = Array.from(label.trim())[0]?.toUpperCase() ?? "·"
  return (
    <View style={[styles.cover, { backgroundColor: bg }]}>
      <Text style={[styles.letter, { color: fg }]} accessibilityElementsHidden>
        {letter}
      </Text>
    </View>
  )
}

/** Multiplies a #RRGGBB colour by `amount` (below 1 = darker). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (shift: number) => Math.round(((n >> shift) & 255) * amount)
  return `rgb(${c(16)}, ${c(8)}, ${c(0)})`
}

/* ------------------------------------------------------------------ header */

export function BackRow({ theme, onBack }: { theme: SongsTheme; onBack: () => void }) {
  const t = useT()
  return (
    <View style={styles.backRow}>
      <Press
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
        onPress={onBack}
        pressedScale={0.9}
        hitSlop={8}
        style={styles.back}
      >
        <BackGlyph color={theme.textHeading} />
      </Press>
    </View>
  )
}

/** Cover on the left; title and meta bottom-aligned on its right. Roboto 800 over 400, caps, tight. */
export function ListHeader({
  theme,
  title,
  meta,
  cover,
}: {
  theme: SongsTheme
  title: string
  meta: string
  cover: ReactNode
}) {
  const { lead, rest } = splitTitle(title)
  return (
    <View style={styles.header}>
      {cover}
      <View style={styles.headText}>
        <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={3} accessibilityRole="header">
          {lead ? <Text style={styles.titleLight}>{lead} </Text> : null}
          {rest}
        </Text>
        <Text style={[styles.meta, { color: theme.textBody }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </View>
  )
}

/* ----------------------------------------------------------------- actions */

export function ActionBar({
  theme,
  download,
  playing,
  disabled,
  onDownload,
  onSort,
  onMenu,
  onShuffle,
  onPlay,
}: {
  theme: SongsTheme
  /** the list's download state (components/offline: the same mark as every download control) */
  download: ListDownloadView
  /** the player is playing from this list: the big button pauses */
  playing: boolean
  /** nothing to play */
  disabled: boolean
  onDownload: () => void
  onSort: () => void
  onMenu: () => void
  onShuffle: () => void
  onPlay: () => void
}) {
  const t = useT()
  return (
    <View style={styles.actions}>
      <View style={styles.actionsLeft}>
        {download.visible ? (
          <IconButton label={listDownloadLabel(download)} onPress={onDownload}>
            <DownloadMark status={download.status} progress={download.progress} size={24} color={theme.textHeading} track={theme.line} ring={theme.accentBright} />
          </IconButton>
        ) : null}
        <IconButton label={t("songs.bar.sortFilter")} onPress={onSort}>
          <SortGlyph size={24} color={theme.textHeading} />
        </IconButton>
        <IconButton label={t("songs.menu.listOptions")} onPress={onMenu}>
          <DotsIcon color={theme.textHeading} />
        </IconButton>
      </View>
      <View style={styles.actionsRight}>
        <IconButton label={t("songs.bar.shuffle")} onPress={onShuffle} disabled={disabled}>
          <ShuffleIcon color={disabled ? theme.ink300 : theme.textHeading} />
        </IconButton>
        <Press
          accessibilityRole="button"
          accessibilityLabel={playing ? t("songs.bar.pause") : t("songs.bar.play")}
          disabled={disabled}
          onPress={onPlay}
          pressedScale={0.92}
          style={[styles.play, { backgroundColor: theme.brand, opacity: disabled ? 0.45 : 1 }]}
        >
          {playing ? <PauseIcon size={26} color={ON_ACTION} /> : <PlayGlyph size={26} color={ON_ACTION} />}
        </Press>
      </View>
    </View>
  )
}

function IconButton({
  label,
  onPress,
  disabled,
  children,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      pressedScale={0.88}
      style={styles.iconBtn}
    >
      {children}
    </Press>
  )
}

/* ------------------------------------------------------------------- chips */

export function ChipsRow({
  theme,
  chips,
  active,
  onPick,
}: {
  theme: SongsTheme
  chips: readonly ChipDef[]
  active: string
  onPick: (id: string) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      accessibilityRole="tablist"
    >
      {chips.map((chip) => {
        const on = chip.id === active
        return (
          <Press
            key={chip.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={chip.label}
            onPress={() => onPick(chip.id)}
            pressedScale={0.95}
            style={[
              styles.chip,
              on
                ? { backgroundColor: theme.brand, borderColor: theme.brand }
                : { backgroundColor: theme.card, borderColor: theme.line },
            ]}
          >
            <Text style={[styles.chipLabel, { color: on ? ON_ACTION : theme.textHeading }]}>{chip.label}</Text>
          </Press>
        )
      })}
    </ScrollView>
  )
}

/* -------------------------------------------------------------------- rows */

type RowProps = {
  theme: SongsTheme
  entry: CatalogEntry
  current: boolean
  saved: boolean
  download: DownloadAllState
  onPlay: (entry: CatalogEntry) => void
  onMenu: (entry: CatalogEntry) => void
}

/**
 * Spotify-like song row: 48px picture, title (orange when it is the song in the player), then
 * `PS 3 · 4:31` with a small heart when saved and a small circled arrow when downloaded, and the
 * three dots. Tap plays from here; a 500ms press opens the same menu as the dots.
 */
export const SongListRow = memo(function SongListRow({ theme, entry, current, saved, download, onPlay, onMenu }: RowProps) {
  const t = useT()
  const duration = formatDuration(entry.durationSeconds)
  const sub = duration ? `PS ${entry.number} · ${duration}` : `PS ${entry.number}`
  const state = [saved ? t("songs.a11y.saved") : null, download === "done" ? t("songs.a11y.downloaded") : null].filter(Boolean).join(", ")
  return (
    <View style={styles.row}>
      <Press
        accessibilityRole="button"
        accessibilityLabel={`${entry.title}, ${sub}${state ? `, ${state}` : ""}${current ? `, ${t("songs.a11y.playing")}` : ""}`}
        accessibilityActions={[{ name: "menu", label: t("songs.menu.moreActions") }]}
        onAccessibilityAction={() => onMenu(entry)}
        onPress={() => onPlay(entry)}
        onLongPress={() => onMenu(entry)}
        delayLongPress={500}
        pressedScale={0.985}
        outerStyle={styles.rowMainOuter}
        style={styles.rowMain}
      >
        <SongCover number={entry.number} size={48} radius={6} tint={theme.inner} />
        <View style={styles.rowText}>
          <Text
            style={[
              styles.rowTitle,
              current
                ? { color: theme.accentText, fontFamily: amFonts.medium }
                : { color: theme.textHeading, fontFamily: amFonts.regular },
            ]}
            numberOfLines={1}
          >
            {entry.title}
          </Text>
          <View style={styles.rowSubLine}>
            <Text style={[styles.rowSub, { color: theme.textBody }]} numberOfLines={1}>
              {sub}
            </Text>
            {saved ? <SaveMark on size={14} /> : null}
            {download === "done" ? (
              <DownloadMark status="done" size={14} />
            ) : null}
          </View>
        </View>
      </Press>
      <Press
        accessibilityRole="button"
        accessibilityLabel={t("home.moreFor", { title: entry.title })}
        onPress={() => onMenu(entry)}
        pressedScale={0.88}
        style={styles.rowDots}
      >
        <DotsIcon size={22} color={theme.textBody} />
      </Press>
    </View>
  )
})

const styles = StyleSheet.create({
  backRow: { height: 48, paddingHorizontal: LIST_SIDE - 4, justifyContent: "center" },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "flex-end", gap: 16, paddingHorizontal: LIST_SIDE, paddingTop: 8 },
  cover: {
    width: COVER,
    height: COVER,
    borderRadius: COVER_RADIUS,
    overflow: "hidden",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
  },
  letter: { fontFamily: amFonts.display, fontSize: 44, lineHeight: 48, opacity: 0.92 },
  headText: { flex: 1, minWidth: 0, gap: 6 },
  title: {
    fontFamily: amFonts.display,
    fontSize: 26,
    lineHeight: 26,
    letterSpacing: -0.52,
    textTransform: "uppercase",
  },
  titleLight: { fontFamily: amFonts.regular },
  meta: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17, fontVariant: ["tabular-nums"] },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: LIST_SIDE - 10,
    paddingRight: LIST_SIDE,
    paddingTop: 16,
  },
  actionsLeft: { flexDirection: "row", alignItems: "center" },
  actionsRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  play: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", paddingLeft: 2 },
  chips: { paddingHorizontal: LIST_SIDE, paddingTop: 16, paddingBottom: 12, gap: 8 },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipLabel: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  row: { height: ROW_HEIGHT, flexDirection: "row", alignItems: "center", paddingLeft: LIST_SIDE, paddingRight: 6 },
  rowMainOuter: { flex: 1, minWidth: 0 },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 12, height: ROW_HEIGHT },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontSize: 16, lineHeight: 21 },
  rowSubLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowSub: { fontFamily: amFonts.regular, fontSize: 13, lineHeight: 17, fontVariant: ["tabular-nums"], flexShrink: 1 },
  rowDots: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
})
