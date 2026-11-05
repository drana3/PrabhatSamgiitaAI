import { useEffect, useRef, useState, type ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import {
  Check,
  Download,
  EyeOff,
  Heart,
  ListEnd,
  ListPlus,
  ListStart,
  Music2,
  Plus,
  Share2,
  Trash2,
} from "lucide-react-native"

import { BottomSheet } from "@/components/songs-v2/BottomSheet"
import { BackGlyph } from "@/components/songs-v2/Glyphs"
import { SongCover } from "@/components/songs-v2/ListParts"
import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { formatDuration, type CatalogEntry } from "@/lib/songsV2/entry"
import { LIST_SORTS, type DownloadAllState, type ListSortKey } from "@/lib/songsV2/listPage"

const ICON = 24
const STROKE = 1.75

export type MenuPlaylist = { id: string; name: string; meta: string; has: boolean }

/* ---------------------------------------------------------------- song menu */

type SongMenuProps = {
  open: boolean
  theme: SongsTheme
  entry: CatalogEntry | null
  listName: string
  saved: boolean
  download: DownloadAllState
  playlists: readonly MenuPlaylist[]
  onPlayNext: (entry: CatalogEntry) => void
  onQueue: (entry: CatalogEntry) => void
  onToggleSave: (entry: CatalogEntry) => void
  onTogglePlaylist: (entry: CatalogEntry, id: string, has: boolean) => void
  onNewPlaylist: (entry: CatalogEntry) => void
  onShare: (entry: CatalogEntry) => void
  onOpenSong: (entry: CatalogEntry) => void
  onToggleDownload: (entry: CatalogEntry) => void
  onHide: (entry: CatalogEntry) => void
  onClose: () => void
}

/**
 * The menu of a song row (the three dots, or a 500ms press): the song on top, then one 52px row
 * per action, in the look of the Player's More sheet. "Add to playlist" opens a second view in the
 * same sheet; every other row acts and closes.
 */
export function SongMenuSheet(props: SongMenuProps) {
  const { open, theme, entry, listName, saved, download, playlists } = props
  // keep the last song while the sheet slides out, so its title does not vanish mid-exit
  const last = useRef<CatalogEntry | null>(null)
  if (entry) last.current = entry
  const shown = entry ?? last.current
  const [view, setView] = useState<"menu" | "playlists">("menu")
  useEffect(() => {
    if (open) setView("menu")
  }, [open, entry?.number])

  const act = (fn: (e: CatalogEntry) => void) => () => {
    if (shown) fn(shown)
    props.onClose()
  }
  const duration = shown ? formatDuration(shown.durationSeconds) : null
  const subtitle = shown ? `${listName} · PS ${shown.number}${duration ? ` · ${duration}` : ""}` : ""

  return (
    <BottomSheet
      open={open && Boolean(entry)}
      onClose={props.onClose}
      theme={theme}
      eyebrow={view === "playlists" ? "Add to playlist" : "More"}
      accessibilityLabel="Song actions"
      flush
    >
      {shown ? (
        <View style={styles.head}>
          <SongCover number={shown.number} size={56} radius={10} tint={theme.inner} />
          <View style={styles.headText}>
            <Text style={[styles.headTitle, { color: theme.textHeading }]} numberOfLines={1}>
              {shown.title}
            </Text>
            <Text style={[styles.headSub, { color: theme.textBody }]} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>
      ) : null}
      <View style={[styles.rule, { backgroundColor: theme.line }]} />
      {view === "menu" ? (
        <View>
          <Row theme={theme} label="Play next" icon={<ListStart size={ICON} strokeWidth={STROKE} color={theme.textHeading} />} onPress={act(props.onPlayNext)} />
          <Row theme={theme} label="Add to queue" icon={<ListEnd size={ICON} strokeWidth={STROKE} color={theme.textHeading} />} onPress={act(props.onQueue)} />
          <Row
            theme={theme}
            label={saved ? "Saved" : "Save to my songs"}
            meta={saved ? "Tap to remove" : undefined}
            icon={<Heart size={ICON} strokeWidth={STROKE} color={saved ? theme.brand : theme.textHeading} fill={saved ? theme.brand : "none"} />}
            onPress={act(props.onToggleSave)}
          />
          <Row
            theme={theme}
            label="Add to playlist"
            icon={<ListPlus size={ICON} strokeWidth={STROKE} color={theme.textHeading} />}
            onPress={() => setView("playlists")}
          />
          <Row theme={theme} label="Share" icon={<Share2 size={ICON} strokeWidth={STROKE} color={theme.textHeading} />} onPress={act(props.onShare)} />
          <Row theme={theme} label="Open song page" icon={<Music2 size={ICON} strokeWidth={STROKE} color={theme.textHeading} />} onPress={act(props.onOpenSong)} />
          <Row
            theme={theme}
            label={download === "done" ? "Remove download" : download === "downloading" ? "Downloading" : "Download"}
            icon={
              download === "done" ? (
                <Trash2 size={ICON} strokeWidth={STROKE} color={theme.textHeading} />
              ) : (
                <Download size={ICON} strokeWidth={STROKE} color={download === "downloading" ? theme.textMuted : theme.textHeading} />
              )
            }
            disabled={download === "downloading"}
            onPress={act(props.onToggleDownload)}
          />
          <Row theme={theme} label="Hide from this list" icon={<EyeOff size={ICON} strokeWidth={STROKE} color={theme.textHeading} />} onPress={act(props.onHide)} />
        </View>
      ) : (
        <View>
          <Row
            theme={theme}
            label="Back"
            icon={<BackGlyph size={ICON} color={theme.textHeading} />}
            onPress={() => setView("menu")}
          />
          {playlists.map((p) => (
            <Row
              key={p.id}
              theme={theme}
              label={p.name}
              meta={p.meta}
              icon={
                <View style={[styles.ring, p.has ? { backgroundColor: theme.brand, borderColor: theme.brand } : { borderColor: theme.ink300 }]}>
                  {p.has ? <Check size={14} strokeWidth={3} color="#FFFFFF" /> : null}
                </View>
              }
              onPress={() => shown && props.onTogglePlaylist(shown, p.id, p.has)}
            />
          ))}
          <Row
            theme={theme}
            label="New playlist"
            icon={<Plus size={ICON} strokeWidth={STROKE} color={theme.textHeading} />}
            onPress={() => shown && props.onNewPlaylist(shown)}
          />
        </View>
      )}
    </BottomSheet>
  )
}

function Row({
  theme,
  label,
  meta,
  icon,
  disabled,
  onPress,
}: {
  theme: SongsTheme
  label: string
  meta?: string
  icon: ReactNode
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={meta ? `${label}, ${meta}` : label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      pressedScale={0.98}
      style={[styles.row, disabled && { opacity: 0.5 }]}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.textHeading }]} numberOfLines={1}>
          {label}
        </Text>
        {meta ? (
          <Text style={[styles.rowMeta, { color: theme.textBody }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Press>
  )
}

/* --------------------------------------------------------------- sort sheet */

/** Sort by Number (default), A to Z, Duration or Recently played; a tap picks and closes. */
export function ListSortSheet({
  open,
  theme,
  value,
  onPick,
  onClose,
}: {
  open: boolean
  theme: SongsTheme
  value: ListSortKey
  onPick: (key: ListSortKey) => void
  onClose: () => void
}) {
  return (
    <BottomSheet open={open} onClose={onClose} theme={theme} eyebrow="Sort songs by" accessibilityLabel="Sort songs" flush>
      <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.line }]} accessibilityRole="radiogroup">
        {LIST_SORTS.map((option, index) => {
          const selected = option.key === value
          return (
            <Press
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.title}. ${option.subtitle}`}
              onPress={() => onPick(option.key)}
              pressedScale={0.99}
              style={[styles.sortRow, { borderBottomColor: theme.line, borderBottomWidth: index === LIST_SORTS.length - 1 ? 0 : 1 }]}
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: theme.textHeading }]}>{option.title}</Text>
                <Text style={[styles.rowMeta, { color: theme.textBody }]}>{option.subtitle}</Text>
              </View>
              <View style={[styles.radio, selected ? { backgroundColor: theme.brand, borderColor: theme.brand } : { borderColor: theme.ink300 }]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
            </Press>
          )
        })}
      </View>
    </BottomSheet>
  )
}

/* --------------------------------------------------------------- list menu */

/** The three dots of the action row: whole-list actions. */
export function ListMenuSheet({
  open,
  theme,
  name,
  hiddenCount,
  downloadedCount,
  onQueueAll,
  onRemoveDownloads,
  onShowHidden,
  onClose,
}: {
  open: boolean
  theme: SongsTheme
  name: string
  hiddenCount: number
  downloadedCount: number
  onQueueAll: () => void
  onRemoveDownloads: () => void
  onShowHidden: () => void
  onClose: () => void
}) {
  const act = (fn: () => void) => () => {
    fn()
    onClose()
  }
  return (
    <BottomSheet open={open} onClose={onClose} theme={theme} eyebrow={name} accessibilityLabel="List options" flush>
      <View style={{ paddingBottom: 8 }}>
        <Row theme={theme} label="Add all to queue" icon={<ListEnd size={ICON} strokeWidth={STROKE} color={theme.textHeading} />} onPress={act(onQueueAll)} />
        {downloadedCount > 0 ? (
          <Row
            theme={theme}
            label="Remove downloads"
            meta={`${downloadedCount} on this phone`}
            icon={<Trash2 size={ICON} strokeWidth={STROKE} color={theme.textHeading} />}
            onPress={act(onRemoveDownloads)}
          />
        ) : null}
        {hiddenCount > 0 ? (
          <Row
            theme={theme}
            label={`Show ${hiddenCount} hidden ${hiddenCount === 1 ? "song" : "songs"}`}
            icon={<EyeOff size={ICON} strokeWidth={STROKE} color={theme.textHeading} />}
            onPress={act(onShowHidden)}
          />
        ) : null}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingBottom: 16 },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  headTitle: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  headSub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  rule: { height: StyleSheet.hairlineWidth, marginHorizontal: 20, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 52, paddingVertical: 8, paddingHorizontal: 20 },
  rowIcon: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  rowMeta: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  ring: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  group: { marginHorizontal: 10, borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  sortRow: {
    minHeight: 56,
    paddingVertical: 6,
    paddingLeft: 20,
    paddingRight: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFFFFF" },
})
