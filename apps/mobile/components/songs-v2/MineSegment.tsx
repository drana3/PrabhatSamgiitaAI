import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"
import { PlusGlyph } from "@/components/songs-v2/Glyphs"

import { ListDownloadRow, Switch } from "@/components/offline/ListDownloadRow"
import { PillButton } from "@/components/songs-v2/Pill"
import { PlaylistRow, SystemPlaylistRow } from "@/components/songs-v2/PlaylistRow"
import { Press } from "@/components/songs-v2/Press"
import { CardButton, EmptyNote, overStyle, SectionHeading } from "@/components/songs-v2/primitives"
import { SongCardRow } from "@/components/songs-v2/SongCardRow"
import { SongsReveal } from "@/components/songs-v2/SongsReveal"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import { stackGap } from "@/lib/songsV2/rowStyles"
import { useListViewStore } from "@/stores/listViewStore"
import { downloadsSummary, MINE_COPY, playlistEyebrow, sectionState, type SavedRow } from "@/lib/songsV2/mine"
import { useT } from "@/lib/i18n"

export type MinePlaylist = { id: string; name: string; songCount: number }

type Props = {
  theme: SongsTheme
  savedRows: SavedRow[]
  savedLoading: boolean
  playlists: MinePlaylist[]
  playlistsLoading: boolean
  /** the automatic "My uploads" list: shown only when the person has uploads */
  uploads: { count: number; cover: number } | null
  downloadCount: number
  /** `148 MB` style total shown over "Downloads"; falls back to the recording count */
  downloadsTotal?: string
  /** Saved shows only the songs that are on this phone (the old Downloaded chip, now a state of a saved song) */
  downloadedOnly: boolean
  onDownloadedOnly: (on: boolean) => void
  onOpen: (entry: CatalogEntry) => void
  onToggleSave: (entry: CatalogEntry) => void
  onQueue: (entry: CatalogEntry) => void
  onMenu: (entry: CatalogEntry) => void
  onOpenPlaylist: (id: string) => void
  /** the "..." of a playlist: Rename, Change photo, Delete */
  onPlaylistMenu: (id: string) => void
  onOpenUploads: () => void
  /** opens the name sheet (stores/playlistSheetsStore askNewPlaylist) */
  onNewPlaylist: () => void
  onQuickStart: () => void
  onOpenDownloads: () => void
  /** show one block only (a chip of the Songs screen); omit for all of them */
  only?: "saved" | "playlists"
}

/**
 * Mine (prototype lines 1216-1250): Saved, Your playlists, Quick start, On this phone.
 * Each section is `loading`, `empty` or `ready`, never loading and empty together.
 * Saved and downloaded are ONE thing (Dada, 10 Nov 2026): a downloaded song is a saved song that is also on the phone. Rows
 * carry the Downloaded mark, the list has its Download switch and a "Downloaded only" switch, and "On this phone" (Storage)
 * sits under the saved songs. "Your playlists" lists the automatic "My uploads" first (when there are uploads), then the
 * person's own, each with a "..." menu. Used by the Songs tab.
 */
export function MineSegment(props: Props) {
  const t = useT()
  const { theme } = props
  const rowStyle = useListViewStore((s) => s.rowStyle)
  const saved = sectionState({ loading: props.savedLoading, count: props.savedRows.length })
  const lists = sectionState({ loading: props.playlistsLoading, count: props.playlists.length })
  const savedNumbers = useMemo(() => props.savedRows.map((row) => row.number), [props.savedRows])

  const show = (block: NonNullable<Props["only"]>) => !props.only || props.only === block

  const offlineRows = useMemo(() => props.savedRows.filter((row) => row.offline), [props.savedRows])
  const shownRows = props.downloadedOnly ? offlineRows : props.savedRows

  return (
    <View>
      {show("saved") ? (
      <View style={[styles.sect, { paddingTop: 28 }]}>
        <SongsReveal index={3} style={styles.pad10}>
          <SectionHeading theme={theme} first={t("songs.chip.saved")} second={t("songs.count", { count: props.savedRows.length })} />
        </SongsReveal>
        {saved === "ready" ? (
          <SongsReveal index={4} style={styles.list}>
            <ListDownloadRow theme={theme} numbers={savedNumbers} name={t("songs.menu.saved")} />
            {offlineRows.length > 0 || props.downloadedOnly ? (
              <Press
                accessibilityRole="switch"
                accessibilityLabel={t("songs.saved.downloadedOnly")}
                accessibilityState={{ checked: props.downloadedOnly }}
                onPress={() => props.onDownloadedOnly(!props.downloadedOnly)}
                pressedScale={0.98}
                style={[styles.onlyRow, { backgroundColor: theme.card, borderColor: theme.line }]}
              >
                <View style={styles.onlyText}>
                  <Text style={[styles.onlyTitle, { color: theme.textHeading }]}>{t("songs.saved.downloadedOnly")}</Text>
                  <Text style={[styles.onlyHint, { color: theme.textBody }]}>{t("songs.saved.downloadedOnlyHint")}</Text>
                </View>
                <Switch on={props.downloadedOnly} theme={theme} />
              </Press>
            ) : null}
            {props.downloadedOnly && offlineRows.length === 0 ? <EmptyNote theme={theme}>{t("songs.saved.downloadedNone")}</EmptyNote> : null}
            <View style={{ gap: stackGap(rowStyle) }}>
              {shownRows.map((row) => (
                <SongCardRow
                  key={row.number}
                  theme={theme}
                  entry={row.entry}
                  saved
                  offline={row.offline}
                  onOpen={props.onOpen}
                  onToggleSave={props.onToggleSave}
                  onQueue={props.onQueue}
                  onMenu={props.onMenu}
                />
              ))}
            </View>
          </SongsReveal>
        ) : (
          <EmptyNote theme={theme}>{saved === "loading" ? t("songs.mine.loadingSaved") : MINE_COPY.savedEmpty}</EmptyNote>
        )}
      </View>
      ) : null}

      {show("playlists") ? (
      <View style={[styles.sect, props.only ? { paddingTop: 28 } : null]}>
        <SongsReveal index={5} style={styles.pad10}>
          <SectionHeading theme={theme} first={t("songs.mine.your")} second={t("songs.mine.playlists")} />
        </SongsReveal>
        <SongsReveal index={6}>
          <EmptyNote theme={theme}>{MINE_COPY.playlistCaption}</EmptyNote>
        </SongsReveal>
        <SongsReveal index={7} style={styles.list}>
          {props.uploads ? (
            <SystemPlaylistRow
              theme={theme}
              photo={props.uploads.cover}
              title={t("pl.uploads.title")}
              eyebrow={t("pl.uploads.count", { count: props.uploads.count })}
              onOpen={props.onOpenUploads}
            />
          ) : null}
          {lists === "ready"
            ? props.playlists.map((playlist) => (
                <PlaylistRow
                  key={playlist.id}
                  theme={theme}
                  id={playlist.id}
                  eyebrow={playlistEyebrow(playlist.songCount)}
                  title={playlist.name}
                  onOpen={() => props.onOpenPlaylist(playlist.id)}
                  onMenu={() => props.onPlaylistMenu(playlist.id)}
                />
              ))
            : !props.uploads ? (
                <EmptyNote theme={theme} style={{ paddingHorizontal: 10 }}>
                  {lists === "loading" ? t("songs.mine.loadingLists") : MINE_COPY.playlistsEmpty}
                </EmptyNote>
              ) : null}
          <PillButton
            theme={theme}
            label={MINE_COPY.newPlaylist}
            icon={<PlusGlyph color="#FFFFFF" />}
            onPress={props.onNewPlaylist}
            style={styles.start}
          />
        </SongsReveal>
      </View>

      ) : null}

      {show("playlists") ? (
      <View style={styles.sect}>
        <SongsReveal index={8} style={styles.pad10}>
          <SectionHeading theme={theme} first={t("songs.mine.quick")} second={t("songs.mine.start")} />
        </SongsReveal>
        <SongsReveal index={9} style={styles.list}>
          <Press
            accessibilityRole="button"
            accessibilityLabel={t("songs.mine.surpriseA11y", { title: MINE_COPY.quickStartTitle })}
            onPress={props.onQuickStart}
            pressedScale={0.98}
            style={[styles.lcard, { backgroundColor: amColors.sage900 }]}
          >
            <Text style={[overStyle, { color: amColors.gold300 }]}>{t("songs.mine.surprise")}</Text>
            <Text style={styles.quickTitle}>{MINE_COPY.quickStartTitle}</Text>
            <Text style={styles.quickBody}>{MINE_COPY.quickStartHint}</Text>
          </Press>
        </SongsReveal>
      </View>

      ) : null}

      {show("saved") ? (
      <View style={[styles.sect, props.only ? { paddingTop: 28 } : null]}>
        <SongsReveal index={10} style={styles.pad10}>
          <SectionHeading theme={theme} first={t("songs.mine.onThis")} second={t("songs.mine.phone")} />
        </SongsReveal>
        <SongsReveal index={11} style={styles.list}>
          <CardButton
            theme={theme}
            eyebrow={props.downloadsTotal ?? downloadsSummary(props.downloadCount)}
            title={t("songs.mine.downloads")}
            onPress={props.onOpenDownloads}
            accessibilityLabel={t("songs.mine.downloadsA11y", { summary: props.downloadsTotal ?? downloadsSummary(props.downloadCount) })}
          />
        </SongsReveal>
      </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  sect: { paddingTop: 40, gap: 20 },
  pad10: { paddingHorizontal: 10 },
  list: { paddingHorizontal: 10, gap: 10 },
  start: { alignSelf: "flex-start", marginTop: 4 },
  onlyRow: { minHeight: 64, borderRadius: 20, borderWidth: 1, paddingVertical: 12, paddingLeft: 20, paddingRight: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  onlyText: { flex: 1, minWidth: 0, gap: 2 },
  onlyTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  onlyHint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  lcard: { borderRadius: 30, paddingTop: 20, paddingBottom: 22, paddingHorizontal: 20, gap: 12, overflow: "hidden" },
  quickTitle: { fontFamily: amFonts.display, fontSize: 22, lineHeight: 22, letterSpacing: -0.44, textTransform: "uppercase", color: "#FFFFFF" },
  quickBody: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19, color: "rgba(255,255,255,0.82)" },
})
