import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { openExternal } from "@/lib/openLink"
import { WatchVideoCard } from "@/components/player/WatchVideoCard"
import { DownloadButton } from "@/components/offline/DownloadButton"
import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpEqualizer } from "@/components/song-v2/SpVersions"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { providerHost } from "@/lib/recordingVideos/rules"
import { subjectFromUrl } from "@/lib/recordingVideos/thumbnail"
import { songDownloadItem } from "@/lib/offline/downloadItems"
import { usePageT } from "@/lib/songPage/pageCopy"
import { toSentenceCase } from "@/lib/songPage/scripts"
import { href } from "@/utils/href"

import { FlagGlyph, OpenOutGlyph } from "./Glyphs"
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

/**
 * The curated videos of the song (the Video tab, first block): each one the card with its picture and play button, and under
 * it two small icon buttons without words (open on the site, report). Then the "Add a video" row. Drawn only when there are some.
 */
export function VideoSection({ t, model, heading = true, add = true }: { t: SpTheme; model: SongPageModel; heading?: boolean; add?: boolean }) {
  const tr = usePageT()
  const song = model.song
  if (!song || !model.videos.length) return null
  return (
    <View>
      {heading ? <SectionTitle t={t}>{tr("songPage.tab.video")}</SectionTitle> : null}
      <View style={styles.list}>
        {model.videos.map((video) => {
          const site = providerHost(subjectFromUrl(video.url)?.provider ?? "youtube")
          return (
            <View key={video.id}>
              <WatchVideoCard video={video} songNumber={song.number} />
              <View style={styles.iconRow}>
                <SpPress onPress={() => void openExternal(video.url)} accessibilityLabel={tr("songVideo.open.a11y", { site })} pressedScale={0.92} hitSlop={4} style={[styles.iconBtn, { borderColor: t.sand400 }]}>
                  <OpenOutGlyph size={18} color={t.ink800} />
                </SpPress>
                <SpPress onPress={model.sendNote} accessibilityLabel={tr("songVideo.report.a11y")} pressedScale={0.92} hitSlop={4} style={[styles.iconBtn, { borderColor: t.sand400 }]}>
                  <FlagGlyph size={18} color={t.ink800} />
                </SpPress>
              </View>
            </View>
          )
        })}
        {add ? (
          <SpPress onPress={model.sendNote} accessibilityLabel={tr("songVideo.add")} pressedScale={0.98} style={[styles.add, { borderColor: t.sand400 }]}>
            <SpIcon name="plusThin" size={22} color={t.ink800} strokeWidth={2} />
            <Text style={[styles.addText, { color: t.ink900 }]}>{tr("songVideo.add")}</Text>
          </SpPress>
        ) : null}
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
  iconRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8, paddingTop: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 9999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  add: { minHeight: 56, borderWidth: 1.5, borderStyle: "dashed", borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  addText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  story: { marginHorizontal: 20, borderRadius: 28, borderWidth: 1, padding: 20, gap: 8 },
  storyEyebrow: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase" },
  storyTitle: { fontFamily: amFonts.bold, fontSize: 22, lineHeight: 28 },
  storyTeaser: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 24 },
  storyBy: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  storyGo: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44 },
  storyGoText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
})
