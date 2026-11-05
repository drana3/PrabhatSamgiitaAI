import { useState } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"
import { PlusGlyph } from "@/components/songs-v2/Glyphs"

import { PillButton } from "@/components/songs-v2/Pill"
import { Press } from "@/components/songs-v2/Press"
import { CardButton, EmptyNote, overStyle, SectionHeading } from "@/components/songs-v2/primitives"
import { SongCardRow } from "@/components/songs-v2/SongCardRow"
import { SongsReveal } from "@/components/songs-v2/SongsReveal"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import { downloadsSummary, MINE_COPY, playlistEyebrow, sectionState, type SavedRow } from "@/lib/songsV2/mine"

export type MinePlaylist = { id: string; name: string; songCount: number }

type Props = {
  theme: SongsTheme
  savedRows: SavedRow[]
  savedLoading: boolean
  playlists: MinePlaylist[]
  playlistsLoading: boolean
  downloadCount: number
  /** `148 MB` style total shown over "Downloads"; falls back to the recording count */
  downloadsTotal?: string
  onOpen: (entry: CatalogEntry) => void
  onToggleSave: (entry: CatalogEntry) => void
  onQueue: (entry: CatalogEntry) => void
  onMenu: (entry: CatalogEntry) => void
  onOpenPlaylist: (id: string) => void
  /** Returns an error message to show, or null when the playlist was made. */
  onCreatePlaylist: (name: string) => Promise<string | null>
  onQuickStart: () => void
  onOpenDownloads: () => void
  /** show one block only (a chip of the Songs screen); omit for all of them (/saved-v2) */
  only?: "saved" | "playlists" | "downloaded"
}

/**
 * Mine (prototype lines 1216-1250): Saved, Your playlists, Quick start, On this phone.
 * Each section is `loading`, `empty` or `ready`, never loading and empty together.
 * Used by the Songs tab and by /saved-v2.
 */
export function MineSegment(props: Props) {
  const { theme } = props
  const saved = sectionState({ loading: props.savedLoading, count: props.savedRows.length })
  const lists = sectionState({ loading: props.playlistsLoading, count: props.playlists.length })
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const show = (block: NonNullable<Props["only"]>) => !props.only || props.only === block

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

  return (
    <View>
      {show("saved") ? (
      <View style={[styles.sect, { paddingTop: 28 }]}>
        <SongsReveal index={3} style={styles.pad10}>
          <SectionHeading theme={theme} first="Saved" second={`${props.savedRows.length} ${props.savedRows.length === 1 ? "song" : "songs"}`} />
        </SongsReveal>
        {saved === "ready" ? (
          <SongsReveal index={4} style={styles.list}>
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
          </SongsReveal>
        ) : (
          <EmptyNote theme={theme}>{saved === "loading" ? "Loading your saved songs…" : MINE_COPY.savedEmpty}</EmptyNote>
        )}
      </View>
      ) : null}

      {show("playlists") ? (
      <View style={[styles.sect, props.only ? { paddingTop: 28 } : null]}>
        <SongsReveal index={5} style={styles.pad10}>
          <SectionHeading theme={theme} first="Your" second="playlists" />
        </SongsReveal>
        <SongsReveal index={6}>
          <EmptyNote theme={theme}>{MINE_COPY.playlistCaption}</EmptyNote>
        </SongsReveal>
        <SongsReveal index={7} style={styles.list}>
          {lists === "ready"
            ? props.playlists.map((playlist) => (
                <CardButton
                  key={playlist.id}
                  theme={theme}
                  eyebrow={playlistEyebrow(playlist.songCount)}
                  title={playlist.name}
                  onPress={() => props.onOpenPlaylist(playlist.id)}
                />
              ))
            : (
                <EmptyNote theme={theme} style={{ paddingHorizontal: 10 }}>
                  {lists === "loading" ? "Loading your playlists…" : MINE_COPY.playlistsEmpty}
                </EmptyNote>
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
                placeholderTextColor={theme.textBody}
                accessibilityLabel="Playlist name"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => void create()}
                style={[styles.input, { color: theme.textHeading, borderColor: theme.line }]}
              />
              {formError ? <Text style={[styles.error, { color: theme.dangerText }]}>{formError}</Text> : null}
              <View style={styles.formActions}>
                <PillButton theme={theme} tone="sand" label="Cancel" onPress={() => setNaming(false)} fill />
                <PillButton theme={theme} label="Create" disabled={!name.trim() || busy} onPress={() => void create()} fill />
              </View>
            </View>
          ) : (
            <PillButton
              theme={theme}
              label={MINE_COPY.newPlaylist}
              icon={<PlusGlyph color="#FFFFFF" />}
              onPress={() => setNaming(true)}
              style={styles.start}
            />
          )}
        </SongsReveal>
      </View>

      ) : null}

      {show("playlists") ? (
      <View style={styles.sect}>
        <SongsReveal index={8} style={styles.pad10}>
          <SectionHeading theme={theme} first="Quick" second="start" />
        </SongsReveal>
        <SongsReveal index={9} style={styles.list}>
          <Press
            accessibilityRole="button"
            accessibilityLabel={`Surprise me, ${MINE_COPY.quickStartTitle}`}
            onPress={props.onQuickStart}
            pressedScale={0.98}
            style={[styles.lcard, { backgroundColor: amColors.sage900 }]}
          >
            <Text style={[overStyle, { color: amColors.gold300 }]}>Surprise me</Text>
            <Text style={styles.quickTitle}>{MINE_COPY.quickStartTitle}</Text>
            <Text style={styles.quickBody}>{MINE_COPY.quickStartHint}</Text>
          </Press>
        </SongsReveal>
      </View>

      ) : null}

      {show("downloaded") ? (
      <View style={[styles.sect, props.only ? { paddingTop: 28 } : null]}>
        <SongsReveal index={10} style={styles.pad10}>
          <SectionHeading theme={theme} first="On this" second="phone" />
        </SongsReveal>
        <SongsReveal index={11} style={styles.list}>
          <CardButton
            theme={theme}
            eyebrow={props.downloadsTotal ?? downloadsSummary(props.downloadCount)}
            title="Downloads"
            onPress={props.onOpenDownloads}
            accessibilityLabel={`Downloads, ${props.downloadsTotal ?? downloadsSummary(props.downloadCount)}`}
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
  form: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  input: { height: 48, borderRadius: 70, borderWidth: 1, paddingHorizontal: 20, fontFamily: amFonts.medium, fontSize: 16 },
  error: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  formActions: { flexDirection: "row", gap: 10 },
  lcard: { borderRadius: 30, paddingTop: 20, paddingBottom: 22, paddingHorizontal: 20, gap: 12, overflow: "hidden" },
  quickTitle: { fontFamily: amFonts.display, fontSize: 22, lineHeight: 22, letterSpacing: -0.44, textTransform: "uppercase", color: "#FFFFFF" },
  quickBody: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19, color: "rgba(255,255,255,0.82)" },
})
