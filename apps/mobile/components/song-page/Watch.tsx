import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { openExternal } from "@/lib/openLink"
import { WatchVideoCard } from "@/components/player/WatchVideoCard"
import { DownloadButton } from "@/components/offline/DownloadButton"
import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpEqualizer } from "@/components/song-v2/SpVersions"
import { SpPill, SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { songDownloadItem } from "@/lib/offline/downloadItems"
import { usePageT } from "@/lib/songPage/pageCopy"
import { toSentenceCase } from "@/lib/songPage/scripts"
import { href } from "@/utils/href"

import { DemoTag, SectionTitle } from "./ui"
import type { SongPageModel } from "./useSongPageModel"

/**
 * Section 3: the recordings of the song, one row each. The catalogue names a recording by its audio file and does
 * not name a performer, so a performer is shown only where the data has one (the preview's demo songs). Each row has
 * Play and Download, and says which one is playing.
 */
export function RecordingsSection({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const tr = usePageT()
  const song = model.song
  if (!song || !model.recordingRows.length) return null
  return (
    <View>
      <SectionTitle t={t}>{tr("songPage.tab.recordings")}</SectionTitle>
      {model.demo ? <DemoTag t={t} /> : null}
      <View style={styles.recordings}>
        {model.recordingRows.map((row, index) => {
          const here = Boolean(model.playing?.isCurrent && model.playing.versionIndex === index)
          const playingHere = here && model.showPause
          const official = !model.demo && index === 0 && /official/i.test(song.audioRecordings?.[0]?.provider ?? "official")
          const title = model.demo ? row.title : official ? tr("songPage.recordings.official") : toSentenceCase(row.title) || tr("songPage.recordings.other")
          const state = playingHere ? tr("songPage.recordings.playing") : here ? tr("songPage.recordings.paused") : ""
          const subtitle = [model.demo ? row.subtitle : "", state].filter(Boolean).join(" · ")
          // a download belongs to one recording: every row of a demo song, and the chosen one of a real song
          const download =
            model.demo || row.url === model.selectedVersion?.url
              ? songDownloadItem(song.number, { url: row.url, versionIndex: model.demo ? index : undefined, title: song.title, seconds: model.demo ? (row.version?.length ?? undefined) : undefined })
              : null
          return (
            <View key={row.id} style={[styles.rec, { backgroundColor: t.white, borderColor: here ? t.action : t.sand300 }]}>
              <SpPress
                onPress={() => row.version && model.playRecording(row.version)}
                accessibilityLabel={tr(playingHere ? "songPage.recordings.pause.a11y" : "songPage.recordings.play.a11y", { title })}
                style={styles.recMain}
              >
                <View style={[styles.recPlay, { backgroundColor: t.action }]}>
                  <SpIcon name={playingHere ? "pause" : "play"} size={18} color={t.onAction} />
                </View>
                <View style={styles.recText}>
                  <Text style={[styles.recTitle, { color: t.ink900 }]} numberOfLines={2}>{title}</Text>
                  {subtitle ? <Text style={[styles.recSub, { color: here ? t.accentText : t.ink500 }]} numberOfLines={1}>{subtitle}</Text> : null}
                </View>
                {here ? <SpEqualizer color={t.orange500} moving={playingHere} /> : null}
              </SpPress>
              {download ? <DownloadButton item={download} size={22} hit={44} color={t.ink800} /> : null}
            </View>
          )
        })}
      </View>
    </View>
  )
}

/** Section 5: real YouTube videos of this song, each with Open in YouTube and Report. Drawn only when there are some. */
export function VideoSection({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const tr = usePageT()
  const song = model.song
  if (!song || !model.videos.length) return null
  return (
    <View>
      <SectionTitle t={t}>{tr("songPage.tab.video")}</SectionTitle>
      <View style={styles.list}>
        {model.videos.map((video) => (
          <View key={video.id} style={[styles.card, { backgroundColor: t.white, borderColor: t.sand300 }]}>
            <WatchVideoCard video={video} songNumber={song.number} />
            <View style={styles.actions}>
              <SpPill t={t} variant="sand" label={tr("songPage.video.open")} onPress={() => void openExternal(video.url)} style={styles.small} textStyle={styles.smallText} />
              <SpPill t={t} variant="sand" label={tr("songPage.video.report")} onPress={model.sendNote} style={styles.small} textStyle={styles.smallText} />
            </View>
          </View>
        ))}
        <SpPress onPress={model.sendNote} accessibilityLabel={tr("songPage.video.suggestAnother")} style={styles.more}>
          <SpIcon name="plusThin" size={22} color={t.ink800} strokeWidth={2} />
          <Text style={[styles.moreText, { color: t.ink900 }]}>{tr("songPage.video.suggestAnother")}</Text>
          <SpIcon name="chevRight" size={20} color={t.ink500} strokeWidth={2} />
        </SpPress>
        <Text style={[styles.note, { color: t.ink500 }]}>{tr("songPage.video.note")}</Text>
      </View>
    </View>
  )
}

/** Section 6: the story about this song, when the stories service has one. A card that opens the reading page. */
export function StorySection({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const tr = usePageT()
  const router = useRouter()
  const story = model.story
  if (!story) return null
  return (
    <View>
      <SectionTitle t={t}>{tr("songPage.tab.story")}</SectionTitle>
      <SpPress
        onPress={() => router.push(href(`/stories/${story.slug}`))}
        accessibilityLabel={`${story.title}. ${tr("songPage.story.read")}`}
        style={[styles.story, { backgroundColor: t.white, borderColor: t.sand300 }]}
      >
        <Text style={[styles.storyEyebrow, { color: t.ink500 }]}>{tr("songPage.story.eyebrow")}</Text>
        <Text style={[styles.storyTitle, { color: t.ink900 }]}>{story.title}</Text>
        {story.teaser ? <Text style={[styles.storyTeaser, { color: t.ink800 }]} numberOfLines={5}>{story.teaser}</Text> : null}
        {story.author ? <Text style={[styles.storyBy, { color: t.ink500 }]}>{tr("songPage.story.by", { author: story.author })}</Text> : null}
        <View style={styles.storyGo}>
          <Text style={[styles.storyGoText, { color: t.accentText }]}>{tr("songPage.story.read")}</Text>
          <SpIcon name="chevRight" size={18} color={t.accentText} strokeWidth={2.2} />
        </View>
      </SpPress>
    </View>
  )
}

const styles = StyleSheet.create({
  recordings: { gap: 10, paddingHorizontal: 20 },
  rec: { borderRadius: 24, borderWidth: 1.5, paddingRight: 8, flexDirection: "row", alignItems: "center", minHeight: 72 },
  recMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 14, padding: 12 },
  recPlay: { width: 44, height: 44, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  recText: { flex: 1, gap: 2 },
  recTitle: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  recSub: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  list: { gap: 12, paddingHorizontal: 20 },
  card: { borderRadius: 28, borderWidth: 1, padding: 12, gap: 12 },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  small: { height: 40, paddingHorizontal: 16 },
  smallText: { fontSize: 14 },
  more: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4 },
  moreText: { flex: 1, fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  story: { marginHorizontal: 20, borderRadius: 28, borderWidth: 1, padding: 20, gap: 8 },
  storyEyebrow: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase" },
  storyTitle: { fontFamily: amFonts.bold, fontSize: 22, lineHeight: 28 },
  storyTeaser: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 24 },
  storyBy: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  storyGo: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44 },
  storyGoText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
})
