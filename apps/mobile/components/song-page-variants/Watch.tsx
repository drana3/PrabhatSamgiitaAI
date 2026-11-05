import { Linking, StyleSheet, Text, View } from "react-native"

import { WatchVideoCard } from "@/components/player/WatchVideoCard"
import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPill, SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { toSentenceCase } from "@/lib/songPage/scripts"
import { useVariantT } from "@/lib/songPageVariants/copy"

import { DemoTag, Eyebrow } from "./ui"
import type { SongVariantModel } from "./useSongVariantModel"

/** Real YouTube videos of this song (matched by the song number), each with Open in YouTube and Report. */
export function VideoList({ t, model }: { t: SpTheme; model: SongVariantModel }) {
  const tr = useVariantT()
  const song = model.song
  if (!song) return null
  if (!model.videos.length) {
    return (
      <View style={styles.none}>
        <Text style={[styles.noneText, { color: t.ink500 }]}>{tr("songVariant.watch.none")}</Text>
        <SpPill t={t} variant="sand" icon="plusThin" label={tr("songVariant.watch.suggest")} onPress={model.sendNote} style={styles.suggest} />
      </View>
    )
  }
  return (
    <View style={styles.list}>
      {model.videos.map((video) => (
        <View key={video.id} style={[styles.card, { backgroundColor: t.white, borderColor: t.sand300 }]}>
          <WatchVideoCard video={video} songNumber={song.number} />
          <View style={styles.actions}>
            <SpPill t={t} variant="sand" label={tr("songVariant.watch.open")} onPress={() => void Linking.openURL(video.url)} style={styles.small} textStyle={styles.smallText} />
            <SpPill t={t} variant="sand" label={tr("songVariant.watch.report")} onPress={model.sendNote} style={styles.small} textStyle={styles.smallText} />
          </View>
        </View>
      ))}
      <SpPress onPress={model.sendNote} accessibilityLabel={tr("songVariant.watch.suggestAnother")} style={styles.more}>
        <SpIcon name="plusThin" size={22} color={t.ink800} strokeWidth={2} />
        <Text style={[styles.moreText, { color: t.ink900 }]}>{tr("songVariant.watch.suggestAnother")}</Text>
        <SpIcon name="chevRight" size={20} color={t.ink500} strokeWidth={2} />
      </SpPress>
      <Text style={[styles.note, { color: t.ink500 }]}>{tr("songVariant.watch.note")}</Text>
    </View>
  )
}

/** The recordings of the song. The catalogue names a recording by its file, never a performer, so none is shown. */
export function RecordingList({ t, model }: { t: SpTheme; model: SongVariantModel }) {
  const tr = useVariantT()
  if (!model.recordingRows.length) return null
  return (
    <View style={styles.recordings}>
      <Eyebrow t={t} style={styles.eyebrow}>{tr("songVariant.watch.recordings")}</Eyebrow>
      {model.demo ? <DemoTag t={t} /> : null}
      {model.recordingRows.map((row, index) => {
        const playingHere = model.playing?.isCurrent && model.playing.versionIndex === index && model.showPause
        const official = !model.demo && index === 0 && /official/i.test(model.song?.audioRecordings?.[0]?.provider ?? "official")
        const title = model.demo ? row.title : official ? tr("songVariant.recording.official") : toSentenceCase(row.title) || tr("songVariant.recording.other")
        return (
          <SpPress
            key={row.id}
            onPress={() => row.version && model.playRecording(row.version)}
            accessibilityLabel={`${title}. ${tr(playingHere ? "songVariant.pause" : "songVariant.play")}`}
            style={[styles.rec, { backgroundColor: t.white, borderColor: t.sand300 }]}
          >
            <View style={[styles.recPlay, { backgroundColor: t.action }]}>
              <SpIcon name={playingHere ? "pause" : "play"} size={18} color={t.onAction} />
            </View>
            <View style={styles.recText}>
              <Text style={[styles.recTitle, { color: t.ink900 }]} numberOfLines={2}>{title}</Text>
              <Text style={[styles.recSub, { color: t.ink500 }]} numberOfLines={1}>{model.demo ? row.subtitle : tr("songVariant.watch.performerUnknown")}</Text>
            </View>
          </SpPress>
        )
      })}
    </View>
  )
}

/** The Watch page (B), the Watch section (A) and the Watch sheet (C): videos, then the recordings. */
export function WatchPanel({ t, model }: { t: SpTheme; model: SongVariantModel }) {
  return (
    <View style={styles.panel}>
      <VideoList t={t} model={model} />
      <RecordingList t={t} model={model} />
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { gap: 24, paddingBottom: 8 },
  none: { paddingHorizontal: 20, gap: 12, alignItems: "flex-start" },
  noneText: { fontFamily: amFonts.medium, fontSize: 17, lineHeight: 24 },
  suggest: { paddingHorizontal: 22 },
  list: { gap: 12, paddingHorizontal: 20 },
  card: { borderRadius: 28, borderWidth: 1, padding: 12, gap: 12 },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  small: { height: 40, paddingHorizontal: 16 },
  smallText: { fontSize: 14 },
  more: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4 },
  moreText: { flex: 1, fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  recordings: { gap: 10 },
  eyebrow: { paddingHorizontal: 20 },
  rec: { marginHorizontal: 20, borderRadius: 24, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 14, minHeight: 72 },
  recPlay: { width: 44, height: 44, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  recText: { flex: 1, gap: 2 },
  recTitle: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  recSub: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
})
