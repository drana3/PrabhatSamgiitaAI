import { useState } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"
import { ChevronRight, Play, Shuffle } from "lucide-react-native"

import { PillButton } from "@/components/songs-v2/Pill"
import { Press } from "@/components/songs-v2/Press"
import { SongCardRow } from "@/components/songs-v2/SongCardRow"
import { Reveal } from "@/components/today/motion"
import { TwoToneHeading } from "@/components/today/TodayBlocks"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amControl, amGap, amRadius, amSpace } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import {
  downloadsSummary,
  MINE_COPY,
  playlistEyebrow,
  sectionState,
  type SavedRow,
} from "@/lib/songsV2/mine"

export type MinePlaylist = { id: string; name: string; songCount: number }

type Props = {
  theme: AmTheme
  savedRows: SavedRow[]
  savedLoading: boolean
  playlists: MinePlaylist[]
  playlistsLoading: boolean
  downloadCount: number
  onOpen: (entry: CatalogEntry) => void
  onToggleSave: (entry: CatalogEntry) => void
  onQueue: (entry: CatalogEntry) => void
  onMenu: (entry: CatalogEntry) => void
  onOpenPlaylist: (id: string) => void
  onPlayPlaylist: (id: string) => void
  /** Returns an error message to show, or null when the playlist was made. */
  onCreatePlaylist: (name: string) => Promise<string | null>
  onQuickStart: () => void
  /** SCR-20 owns the storage screen; without a target the row is informational. */
  onOpenDownloads?: () => void
}

/**
 * Mine (spec SCR-11 item 7): Saved, Your playlists, Quick start, On this
 * phone. Every section is `loading`, `empty` or `ready`, never loading and
 * empty together.
 */
export function MineSegment(props: Props) {
  const { theme } = props
  const saved = sectionState({ loading: props.savedLoading, count: props.savedRows.length })
  const lists = sectionState({ loading: props.playlistsLoading, count: props.playlists.length })
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const create = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const error = await props.onCreatePlaylist(name.trim())
    setBusy(false)
    if (error) {
      setFormError(error)
      return
    }
    setName("")
    setFormError(null)
    setNaming(false)
  }

  let block = 0
  return (
    <View style={styles.root}>
      <Reveal index={block++} style={styles.section}>
        <TwoToneHeading theme={theme} first="Saved" second="songs" />
        {saved === "ready" ? (
          <View style={styles.stack}>
            {props.savedRows.map((row) => (
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
        ) : saved === "loading" ? (
          <Text style={[amType.body, { color: theme.textMuted }]}>Loading your saved songs…</Text>
        ) : (
          <Text style={[amType.body, { color: theme.textBody }]}>{MINE_COPY.savedEmpty}</Text>
        )}
      </Reveal>

      <Reveal index={block++} style={styles.section}>
        <TwoToneHeading theme={theme} first="Your" second="playlists" />
        <Text style={[amType.body, { color: theme.textBody }]}>{MINE_COPY.playlistCaption}</Text>
        {lists === "ready" ? (
          <View style={styles.stack}>
            {props.playlists.map((playlist) => (
              <Press
                key={playlist.id}
                accessibilityRole="button"
                accessibilityLabel={`${playlist.name}, ${playlistEyebrow(playlist.songCount)}`}
                onPress={() => props.onOpenPlaylist(playlist.id)}
                pressedScale={0.985}
                style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }]}
              >
                <View style={styles.flex}>
                  <Text style={[amType.label, { color: theme.eyebrow }]}>{playlistEyebrow(playlist.songCount)}</Text>
                  <Text style={[styles.rowTitle, { color: theme.textHeading }]} numberOfLines={2}>
                    {playlist.name}
                  </Text>
                </View>
                <Press
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${playlist.name}`}
                  onPress={() => props.onPlayPlaylist(playlist.id)}
                  pressedScale={0.92}
                  style={[styles.disc, { backgroundColor: theme.brand }]}
                >
                  <Play size={20} color={theme.onBrand} fill={theme.onBrand} />
                </Press>
              </Press>
            ))}
          </View>
        ) : lists === "loading" ? (
          <Text style={[amType.body, { color: theme.textMuted }]}>Loading your playlists…</Text>
        ) : (
          <Text style={[amType.body, { color: theme.textMuted }]}>{MINE_COPY.playlistsEmpty}</Text>
        )}
        {naming ? (
          <View style={[styles.form, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <TextInput
              value={name}
              onChangeText={(value) => {
                setName(value)
                setFormError(null)
              }}
              placeholder="Playlist name"
              placeholderTextColor={theme.textMuted}
              accessibilityLabel="Playlist name"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void create()}
              style={[styles.input, { color: theme.textHeading, borderColor: theme.line }]}
            />
            {formError ? <Text style={[amType.body, { color: amColors.danger }]}>{formError}</Text> : null}
            <View style={styles.formActions}>
              <PillButton theme={theme} tone="sand" label="Cancel" onPress={() => setNaming(false)} fill />
              <PillButton theme={theme} label="Create" disabled={!name.trim() || busy} onPress={() => void create()} fill />
            </View>
          </View>
        ) : (
          <PillButton theme={theme} label={MINE_COPY.newPlaylist} onPress={() => setNaming(true)} style={styles.start} />
        )}
      </Reveal>

      <Reveal index={block++} style={styles.section}>
        <TwoToneHeading theme={theme} first="Quick" second="start" />
        <View style={[styles.quick, { backgroundColor: theme.forest }]}>
          <Text style={[styles.quickTitle, { color: amColors.white }]}>{MINE_COPY.quickStartTitle}</Text>
          <Text style={[amType.body, { color: amColors.sage300 }]}>{MINE_COPY.quickStartHint}</Text>
          <PillButton
            theme={theme}
            label="Shuffle"
            icon={<Shuffle size={18} color={theme.onBrand} />}
            onPress={props.onQuickStart}
            style={styles.start}
          />
        </View>
      </Reveal>

      <Reveal index={block++} style={styles.section}>
        <TwoToneHeading theme={theme} first="On this" second="phone" />
        <Press
          accessibilityRole={props.onOpenDownloads ? "button" : "text"}
          accessibilityLabel={`Downloads, ${downloadsSummary(props.downloadCount)}`}
          disabled={!props.onOpenDownloads}
          onPress={props.onOpenDownloads}
          pressedScale={0.985}
          style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }]}
        >
          <View style={styles.flex}>
            <Text style={[amType.label, { color: theme.eyebrow }]}>Downloads</Text>
            <Text style={[styles.rowTitle, { color: theme.textHeading }]}>{downloadsSummary(props.downloadCount)}</Text>
          </View>
          {props.onOpenDownloads ? <ChevronRight size={20} color={theme.textMuted} /> : null}
        </Press>
      </Reveal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: amGap.section, paddingHorizontal: amGap.gutter },
  section: { gap: amGap.block },
  stack: { gap: amGap.grid },
  flex: { flex: 1, gap: amSpace.s2 },
  row: {
    minHeight: 72,
    borderRadius: amRadius.card,
    borderWidth: 1,
    paddingHorizontal: amGap.padCard,
    paddingVertical: amSpace.s3,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s3,
  },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 24 },
  disc: {
    width: amControl.pillHeight,
    height: amControl.pillHeight,
    borderRadius: amControl.pillHeight / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  start: { alignSelf: "flex-start" },
  form: { borderRadius: amRadius.card, borderWidth: 1, padding: amGap.padCard, gap: amSpace.s3 },
  input: {
    height: amControl.pillHeight,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    paddingHorizontal: amGap.padCard,
    fontFamily: amFonts.regular,
    fontSize: 16,
  },
  formActions: { flexDirection: "row", gap: amGap.grid },
  quick: { borderRadius: amRadius.panel, padding: amGap.padPanel, gap: amSpace.s3 },
  quickTitle: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 32, textTransform: "uppercase" },
})
