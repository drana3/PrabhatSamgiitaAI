import { useCallback, useMemo } from "react"
import { Alert, StyleSheet, Text, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { ChevronRight, HardDrive, Shuffle } from "lucide-react-native"

import { NewPlaylistForm } from "@/components/saved-v2/NewPlaylistForm"
import { PlaylistRow } from "@/components/saved-v2/PlaylistRows"
import { SongCardRow } from "@/components/saved-v2/SongCardRow"
import { CardRow, HeartButton, Note, PillButton, SectionHeading, rowStyles } from "@/components/saved-v2/ui"
import { PressScale, Reveal } from "@/components/today/motion"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amControl, amGap, amRadius } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useFlushPlaylistsOnBlur } from "@/hooks/useFlushPlaylistsOnBlur"
import { useOfflineStorageItems } from "@/hooks/useOfflineStorageItems"
import { useSongTitles } from "@/hooks/useSongTitles"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { memberAuthAvailable } from "@/lib/memberAuth"
import {
  downloadsRowSummary,
  listViewState,
  mineSyncStatus,
  savedNewestFirst,
  songEyebrow,
} from "@/lib/mineView"
import { playPlaylist } from "@/lib/playPlaylist"
import { sortPlaylistsNewestFirst } from "@/lib/playlistDisplay"
import { parseSongNumber } from "@/lib/songMap"
import { formatBytes, totalBytes } from "@/lib/storageCache"
import { useAuthStore } from "@/stores/authStore"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

/**
 * The content of Songs > Mine (spec SCR-11 item 7), as one reusable block:
 * Saved, Your playlists, Quick start, On this phone. The Songs screen embeds
 * `<MineContent />` under its segmented control; `app/saved-v2.tsx` shows it
 * standalone. Sections reveal in one stagger starting at `revealStart`.
 */
export function MineContent({ theme: themeProp, revealStart = 0 }: { theme?: AmTheme; revealStart?: number }) {
  const defaultTheme = useAmTheme()
  const theme = themeProp ?? defaultTheme
  const router = useRouter()
  useFlushPlaylistsOnBlur()

  const mode = useAuthStore((s) => s.mode)
  const signedIn = mode === "signed_in"
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)
  const syncingFavorites = usePreferencesStore((s) => s.syncingFavorites)
  const toggleSaved = usePreferencesStore((s) => s.toggleSaved)
  const hydrateFavorites = usePreferencesStore((s) => s.hydrateFavoritesFromServer)

  const playlists = usePlaylistStore((s) => s.playlists)
  const playlistsLoading = usePlaylistStore((s) => s.loading)
  const syncing = usePlaylistStore((s) => s.syncing)
  const syncError = usePlaylistStore((s) => s.error)
  const hydratePlaylists = usePlaylistStore((s) => s.hydrateFromCache)
  const refreshPlaylists = usePlaylistStore((s) => s.refresh)
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist)
  const flushSync = usePlaylistStore((s) => s.flushSync)

  const offlineFiles = useOfflineAudioStore((s) => s.files)
  const { items: downloads, scanned } = useOfflineStorageItems()

  useFocusEffect(
    useCallback(() => {
      if (!signedIn) return
      void hydratePlaylists()
      void hydrateFavorites()
      void refreshPlaylists()
    }, [signedIn, hydratePlaylists, hydrateFavorites, refreshPlaylists]),
  )

  const savedNumbers = useMemo(
    () =>
      savedNewestFirst(
        savedSongIds.flatMap((id: string) => {
          const n = parseSongNumber(id)
          return n ? [n] : []
        }),
      ),
    [savedSongIds],
  )
  const titles = useSongTitles(savedNumbers)
  const offlineNumbers = useMemo(
    () => new Set(Object.values(offlineFiles).map((entry) => entry.songNumber)),
    [offlineFiles],
  )
  const sortedPlaylists = useMemo(() => sortPlaylistsNewestFirst(playlists), [playlists])

  const savedState = listViewState({ loading: syncingFavorites, count: savedNumbers.length })
  const playlistState = listViewState({ loading: playlistsLoading, count: playlists.length })
  const sync = mineSyncStatus({
    mode,
    syncAvailable: memberAuthAvailable(),
    syncing,
    error: syncError,
  })
  const downloadsSummary = scanned
    ? downloadsRowSummary(downloads.length, formatBytes(totalBytes(downloads)))
    : "Checking this phone…"

  const askSignIn = () =>
    Alert.alert("Sign in", "Playlists and saved songs need an account so they stay with you.", [
      { text: "Not now", style: "cancel" },
      { text: "Sign in", onPress: () => router.push(href("/signin")) },
    ])

  const unsave = (number: number) => {
    void toggleSaved(`ps-${number}`).then((result: { needsAuth: boolean }) => {
      if (result.needsAuth) askSignIn()
    })
  }

  let block = revealStart
  const next = () => block++

  return (
    <View style={styles.root}>
      <Reveal index={next()}>
        <SectionHeading theme={theme} first="Saved" second="songs" />
        {savedState === "loading" ? (
          <Note theme={theme}>Loading your saved songs…</Note>
        ) : savedState === "empty" ? (
          <Note theme={theme}>Tap the heart on any song to keep it here.</Note>
        ) : (
          <View style={styles.stack}>
            {savedNumbers.map((number: number) => {
              const title = titles.get(number) ?? `Prabhat Samgiita ${number}`
              return (
                <SongCardRow
                  key={number}
                  theme={theme}
                  eyebrow={songEyebrow(number, offlineNumbers.has(number))}
                  title={title}
                  accessibilityLabel={`PS ${number}, ${title}`}
                  onOpen={() => router.push(href(`/song-v2/ps-${number}`))}
                  trailing={
                    <HeartButton
                      theme={theme}
                      saved
                      label={`Remove PS ${number} from saved`}
                      onPress={() => unsave(number)}
                    />
                  }
                />
              )
            })}
          </View>
        )}
      </Reveal>

      <Reveal index={next()}>
        <SectionHeading theme={theme} first="Your" second="playlists" />
        <View style={styles.caption}>
          <Note theme={theme}>
            A playlist is a list of songs you put together yourself, for example for a morning meditation or an
            evening kirtan.
          </Note>
        </View>
        {playlistState === "loading" ? (
          <Note theme={theme}>Loading your playlists…</Note>
        ) : (
          <View style={styles.stack}>
            {sortedPlaylists.map((playlist) => (
              <PlaylistRow
                key={playlist.id}
                theme={theme}
                name={playlist.name}
                songCount={playlist.songs.length}
                onOpen={() => router.push(href(`/playlist-v2/${playlist.id}`))}
                onPlay={() => {
                  void playPlaylist(playlist).then((error) => {
                    if (error) Alert.alert("Playlist", error)
                  })
                }}
              />
            ))}
            <NewPlaylistForm
              theme={theme}
              signedIn={signedIn}
              onRequireSignIn={askSignIn}
              onCreate={async (name: string) => {
                const result = await createPlaylist(name)
                if (!isPlaylist(result)) {
                  Alert.alert("Playlist", "error" in result ? result.error : "Sign in to create a playlist.")
                }
              }}
            />
            {sync.kind !== "hidden" ? (
              <SyncLine
                theme={theme}
                kind={sync.kind}
                text={sync.text}
                onRetry={sync.kind === "error" ? () => void flushSync() : undefined}
                onSignIn={!signedIn ? () => router.push(href("/signin")) : undefined}
              />
            ) : null}
          </View>
        )}
      </Reveal>

      <Reveal index={next()}>
        <SectionHeading theme={theme} first="Quick" second="start" />
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Random Prabhat Samgiita. Shuffles the catalog and plays in Drive mode."
          onPress={() => router.push(href("/drive"))}
          pressedScale={0.985}
          style={[styles.quick, { backgroundColor: theme.forest }]}
        >
          <View style={rowStyles.copy}>
            <Text style={[amType.label, { color: amColors.gold300 }]}>Drive mode</Text>
            <Text style={[styles.quickTitle, { color: amColors.white }]}>Random Prabhat Samgiita</Text>
            <Text style={[amType.body, { color: amColors.sage300 }]}>Shuffles the whole catalog and plays.</Text>
          </View>
          <View style={[styles.disc, { backgroundColor: theme.brand }]}>
            <Shuffle size={20} color={theme.onBrand} />
          </View>
        </PressScale>
      </Reveal>

      <Reveal index={next()}>
        <SectionHeading theme={theme} first="On this" second="phone" />
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`Downloads. ${downloadsSummary}`}
          onPress={() => router.push(href("/storage"))}
          pressedScale={0.985}
        >
          <CardRow theme={theme}>
            <HardDrive size={22} color={theme.textBody} />
            <View style={rowStyles.copy}>
              <Text style={[amType.label, { color: theme.eyebrow }]}>Downloads</Text>
              <Text style={[rowStyles.title, { color: theme.textHeading }]}>{downloadsSummary}</Text>
            </View>
            <ChevronRight size={20} color={theme.textMuted} />
          </CardRow>
        </PressScale>
      </Reveal>
    </View>
  )
}

function SyncLine({
  theme,
  kind,
  text,
  onRetry,
  onSignIn,
}: {
  theme: AmTheme
  kind: "local" | "syncing" | "error"
  text: string
  onRetry?: () => void
  onSignIn?: () => void
}) {
  const action = onRetry ? { label: "Try again", run: onRetry } : onSignIn ? { label: "Sign in", run: onSignIn } : null
  return (
    <View style={styles.sync} accessibilityRole={kind === "error" ? "alert" : undefined}>
      <Text style={[amType.body, { color: kind === "error" ? theme.textHeading : theme.textBody, fontFamily: kind === "error" ? amFonts.semi : amFonts.regular }]}>{text}</Text>
      {action ? <PillButton theme={theme} tone="sand" label={action.label} onPress={action.run} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: amGap.section },
  stack: { gap: amGap.grid },
  caption: { marginBottom: amGap.block },
  quick: {
    borderRadius: amRadius.panel,
    padding: amGap.padPanel,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  quickTitle: { fontFamily: amFonts.bold, fontSize: 24, lineHeight: 28 },
  disc: {
    width: amControl.pillHeight,
    height: amControl.pillHeight,
    borderRadius: amControl.pillHeight / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  sync: { gap: 10 },
})
