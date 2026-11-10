import { useMemo, useRef } from "react"
import { Alert, StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"

import { SaveMark } from "@/components/save/SaveMark"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { coverFor } from "@/components/player-v2/playerCovers"
import { ringColor, SheetPill } from "@/components/player-v2/Rows"
import { Sheet } from "@/components/player-v2/Sheet"
import { PressScale } from "@/components/today/motion"
import { amColors, amDarkSurface } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useSaveState } from "@/hooks/useSaveState"
import { isDarkTheme } from "@/lib/navV2"
import { addToCreated, togglePlaylist, toggleMine, type SaveOutcome } from "@/lib/save/saveActions"
import { askNewPlaylist } from "@/stores/playlistSheetsStore"
import { buildSaveRows, type SaveItem, type SaveRow } from "@/lib/save/saveToSheet"
import { usePlaylistStore } from "@/stores/playlistStore"
import { useSaveSheetStore } from "@/stores/saveSheetStore"
import { href } from "@/utils/href"
import { useT } from "@/lib/i18n"

type Props = {
  visible: boolean
  item: SaveItem | null
  onClose: () => void
}

const TILE = 48
const TILE_RADIUS = 8

/**
 * "Save to" (Spotify's sheet in the app's colours): Mine first, then the person's playlists, newest
 * first, then New playlist. A tick applies at once and may be mixed (Mine and several playlists);
 * a toast says what happened. The Done pill closes it, and so does dragging it down.
 */
export function SaveToSheet({ visible, item, onClose }: Props) {
  const t = useT()
  const theme = useAmTheme()
  const router = useRouter()
  const last = useRef<SaveItem | null>(null)
  if (item) last.current = item
  const shown = item ?? last.current
  const state = useSaveState(shown)
  const playlists = usePlaylistStore((s) => s.playlists)
  const showToast = useSaveSheetStore((s) => s.showToast)
  const pending = useRef(new Set<string>())

  const rows = useMemo(() => (shown ? buildSaveRows(shown, state, playlists) : []), [shown, state, playlists, t])
  const firstSong = (id: string) => playlists.find((p) => p.id === id)?.songs[0]?.song_number

  const askSignIn = () => {
    Alert.alert(t("library.signIn"), t("save.alert.body"), [
      { text: t("library.alert.notNow"), style: "cancel" },
      {
        text: t("library.signIn"),
        onPress: () => {
          onClose()
          router.push(href("/signin"))
        },
      },
    ])
  }
  const settle = (outcome: SaveOutcome | undefined) => {
    if (!outcome || outcome.ok) return
    if ("needsAuth" in outcome) askSignIn()
    else Alert.alert(t("player.playlist"), outcome.error)
  }

  const run = async (key: string, task: () => Promise<SaveOutcome>, predicted: string | null) => {
    if (pending.current.has(key)) return
    pending.current.add(key)
    try {
      const work = task()
      // The stores flip their state at once; only a refusal (sign in, error) comes back later.
      const early = await Promise.race([work, new Promise<undefined>((resolve) => setTimeout(resolve, 0))])
      if (early) {
        if (early.ok) showToast(early.toast)
        else settle(early)
        return
      }
      if (predicted) showToast(predicted)
      const outcome = await work
      if (!outcome.ok) settle(outcome)
    } finally {
      pending.current.delete(key)
    }
  }

  const onTick = (row: SaveRow) => {
    if (!shown) return
    if (row.kind === "mine") void run("mine", () => toggleMine(shown), row.on ? t("save.toast.removed", { target: t("songs.mine") }) : t("save.toast.added", { target: t("songs.mine") }))
    else void run(row.id, () => togglePlaylist(shown, row.id), row.on ? t("save.toast.removed", { target: row.name }) : t("save.toast.added", { target: row.name }))
  }
  // New playlist: this sheet leaves, then the name sheet comes up (default name selected); the song goes in once the list exists.
  const onNew = () => {
    if (!shown) return
    const target = shown
    onClose()
    setTimeout(
      () =>
        askNewPlaylist(async (created) => {
          const outcome = await addToCreated(target, created)
          if (outcome.ok) showToast(outcome.toast)
          else settle(outcome)
        }),
      280,
    )
  }

  const dark = isDarkTheme(theme)
  const mineTile: [string, string] = dark ? [amDarkSurface.tile, amDarkSurface.inner] : [amColors.ink500, amColors.ink800]

  return (
    <Sheet visible={visible} onClose={onClose} title={t("save.title")} theme={theme} hideDone>
      <View style={styles.list}>
        {rows.map((row) => {
          const key = row.kind === "mine" ? "mine" : row.id
          const label = `${row.name}, ${row.subtitle}`
          const number = row.kind === "playlist" ? firstSong(row.id) : undefined
          return (
            <PressScale
              key={key}
              accessibilityRole="checkbox"
              accessibilityLabel={label}
              accessibilityState={{ checked: row.on }}
              onPress={() => onTick(row)}
              pressedScale={0.98}
              style={styles.row}
            >
              {row.kind === "mine" ? (
                <LinearGradient colors={mineTile} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.tile, styles.center]}>
                  <PlayerIcon name="heart" size={22} color={amColors.white} filled />
                </LinearGradient>
              ) : number != null ? (
                <Image
                  source={coverFor(number).source}
                  contentFit="cover"
                  contentPosition={coverFor(number).position}
                  style={[styles.tile, { backgroundColor: theme.inner }]}
                />
              ) : (
                <View style={[styles.tile, styles.center, { backgroundColor: theme.inner }]}>
                  <PlayerIcon name="music" size={22} color={theme.textBody} />
                </View>
              )}
              <View style={styles.text}>
                <Text style={[styles.name, { color: theme.textHeading }]} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={[styles.sub, { color: theme.textBody }]} numberOfLines={1}>
                  {row.subtitle}
                </Text>
              </View>
              <SaveMark on={row.on} size={26} empty="ring" color={ringColor(theme)} />
            </PressScale>
          )
        })}
        {shown?.kind === "song" ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={t("songs.mine.newPlaylist")}
            onPress={onNew}
            pressedScale={0.98}
            style={styles.row}
          >
            <View style={[styles.tile, styles.center, { backgroundColor: theme.inner }]}>
              <PlayerIcon name="plus" size={24} color={theme.textHeading} />
            </View>
            <View style={styles.text}>
              <Text style={[styles.name, { color: theme.textHeading }]} numberOfLines={1}>
                {t("songs.mine.newPlaylist")}
              </Text>
            </View>
          </PressScale>
        ) : (
          <Text style={[styles.note, { color: theme.textBody }]}>{t("save.note")}</Text>
        )}
      </View>
      <View style={styles.done}>
        <SheetPill theme={theme} tone="brand" label={t("common.done")} onPress={onClose} />
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  list: { paddingBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 64, paddingVertical: 8, paddingHorizontal: 20 },
  tile: { width: TILE, height: TILE, borderRadius: TILE_RADIUS, overflow: "hidden" },
  center: { alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  sub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingHorizontal: 20, paddingTop: 8 },
  done: { paddingTop: 12, paddingHorizontal: 20 },
})
