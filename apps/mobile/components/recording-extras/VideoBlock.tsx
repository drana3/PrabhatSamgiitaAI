import { StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/comments/CommentsView"
import { BlockStack, Section } from "@/components/common/Layout"
import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { openExternal } from "@/lib/openLink"
import { featuredVideo, videoEmbed } from "@/lib/recordingVideos/embed"
import { providerHost, safeToOpen } from "@/lib/recordingVideos/rules"

import { VideoThumb } from "@/components/video/VideoThumb"

import { Note, R_FIELD } from "./ui"
import type { VideosController } from "./useVideos"
import type { VideoWatch } from "./useVideoWatch"
import { WatchPlayer } from "./WatchPlayer"

/**
 * The video block of a Kiirtan page (variant D of docs/kiirtan-video.md): the page's headline video with a short chord line
 * under it, so a person can watch and play along. It is one of the member's links, played by the site's own embed (or opened
 * on its site when the owner does not allow showing it); the app never hosts or downloads it. `chordLine` is the first form of
 * the chord cycle (`Em - C - G - D`), or null while the recording has none. The other links are in the list under it.
 */
export function VideoBlock({
  t,
  videos,
  watch,
  chordLine,
  onAdd,
  onFlash,
}: {
  t: SpTheme
  videos: VideosController
  watch: VideoWatch
  chordLine: string | null
  onAdd: () => void
  onFlash: (text: string) => void
}) {
  const tr = useT()
  const video = featuredVideo(videos.state.items)
  const embed = video ? videoEmbed(video) : null
  const playing = Boolean(video && embed && watch.openId === video.id)
  const site = video ? providerHost(video.provider) : ""
  const title = video ? (video.title ?? tr("recVideos.untitled", { site })) : ""
  const openOnSite = async () => {
    if (!video || !safeToOpen(video.url) || !(await openExternal(video.url))) onFlash(tr("recVideos.openFailed"))
  }

  return (
    <Section title={tr("recVideoBlock.title")}>
      <View testID="recording-video-block">
        <BlockStack gap={12}>
          {video ? (
            <>
              {playing && embed ? (
                <WatchPlayer t={t} embed={embed} title={title} onClose={watch.close} />
              ) : (
                <SpPress
                  onPress={() => (embed ? watch.open(video.id) : void openOnSite())}
                  accessibilityRole={embed ? "button" : "link"}
                  accessibilityLabel={embed ? tr("recVideos.watch.a11y", { title }) : tr("recVideos.open.a11y", { title, site })}
                  pressedScale={0.98}
                  style={styles.poster}
                >
                  <VideoThumb video={video} title={title} radius={R_FIELD} scrim showTitle={false} testID="recording-video-thumb">
                    <View style={styles.over}>
                      <View style={[styles.play, { backgroundColor: t.action }]}>
                        <SpIcon name="play" size={24} color={t.onAction} />
                      </View>
                    </View>
                    <View style={styles.caption}>
                      <Text style={[styles.posterTitle, { color: t.white }]} numberOfLines={2}>
                        {title}
                      </Text>
                      <Text style={[styles.posterSub, { color: t.sand300 }]}>{embed ? tr("recVideos.watch") : tr("recVideos.openSite", { site })}</Text>
                    </View>
                  </VideoThumb>
                </SpPress>
              )}
              {video.linkStatus === "no_embed" ? <Note t={t} tone="body">{tr("recVideos.status.noEmbed", { site })}</Note> : null}
              {chordLine ? (
                <View style={[styles.line, { borderColor: t.sand400, backgroundColor: t.white }]}>
                  <Text selectable style={[styles.lineText, { color: t.ink900 }]} testID="video-chord-line">
                    {tr("recVideoBlock.chords", { line: chordLine })}
                  </Text>
                  <Note t={t}>{tr("recVideoBlock.chordsMore")}</Note>
                </View>
              ) : null}
              {embed && !playing ? <Button t={t} variant="quiet" label={tr("recVideos.openSite", { site })} onPress={() => void openOnSite()} /> : null}
            </>
          ) : (
            <>
              <Note t={t} tone="body">{tr("recVideoBlock.none")}</Note>
              <View style={styles.row}>
                <Button t={t} label={tr("recVideos.add")} onPress={onAdd} />
              </View>
            </>
          )}
        </BlockStack>
      </View>
    </Section>
  )
}

const styles = StyleSheet.create({
  poster: { borderRadius: R_FIELD },
  over: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingBottom: 28 },
  caption: { position: "absolute", left: 16, right: 16, bottom: 12, gap: 2 },
  play: { width: 56, height: 56, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  posterTitle: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  posterSub: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
  line: { borderWidth: 1, borderRadius: R_FIELD, padding: 16, gap: 4 },
  lineText: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 26 },
  row: { flexDirection: "row" },
})
