import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { VideoEmbed } from "@/components/recording-extras/VideoEmbed"
import type { VideoWatch } from "@/components/recording-extras/useVideoWatch"
import { ActionButton, Hint } from "@/components/song-chords/parts"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import type { Broadcast, BroadcastRecording } from "@/lib/broadcasts/types"
import { videoEmbed } from "@/lib/recordingVideos/embed"
import { href } from "@/utils/href"

/**
 * The "Recording" block of a broadcast's page (docs/broadcasts.md): what was saved of an ended broadcast. A link to YouTube
 * plays through the site's own embed (the same video that was live, once YouTube reports the end); every other link (a Zoom
 * cloud recording, Vimeo, archive.org) is only ever opened OUTSIDE the app by `onOpen`, which parses the address again. A
 * recording of the library opens its own page. The author and the team add a recording ("Add the recording"); another member
 * suggests one and the team decides. A suggestion waits, shown only to the one who sent it and to the team. It never leaves:
 * the recording stays with the broadcast after the broadcast is archived.
 */
export function RecordingBlock({
  item,
  theme,
  watch,
  width,
  onOpen,
  onRemove,
  onAdd,
}: {
  item: Broadcast
  theme: SongsTheme
  watch: VideoWatch
  /** the width of the player */
  width: number
  onOpen: (url: string) => void
  onRemove: (recording: BroadcastRecording) => void
  onAdd: () => void
}) {
  const t = useT()
  const router = useRouter()
  const accepted = item.recordings.filter((r) => r.status === "accepted")
  const pending = item.recordings.filter((r) => r.status === "pending")
  const ended = item.phase === "ended"
  if (!ended && item.recordings.length === 0) return null

  const providerName = (r: BroadcastRecording) => (r.provider === "youtube" ? t("bc.p.provider.youtube") : r.provider === "zoom" ? t("bc.p.provider.zoom") : (r.host ?? ""))

  return (
    <View style={s.block} testID="broadcast-recordings">
      <Text style={[s.h2, { color: theme.textHeading }]} accessibilityRole="header">
        {t("bc.rec.title")}
      </Text>

      {accepted.map((r) => {
        if (r.kind === "file") {
          return (
            <View key={r.id} style={s.row}>
              <ActionButton theme={theme} label={r.recordingTitle ? `${t("bc.rec.listen")} · ${r.recordingTitle}` : t("bc.rec.listen")} onPress={() => r.recordingId && router.push(href(`/recording/${encodeURIComponent(r.recordingId)}`))} />
              <Hint theme={theme}>{t("bc.rec.file.note")}</Hint>
            </View>
          )
        }
        const embed = r.url && r.provider === "youtube" ? videoEmbed({ provider: "youtube", url: r.url, linkStatus: item.linkStatus }) : null
        const watching = embed !== null && watch.openId === `rec:${r.id}`
        return (
          <View key={r.id} style={s.row}>
            {watching && embed ? (
              <>
                <VideoEmbed embed={embed} title={t("bc.rec.video.a11y")} width={width} height={Math.round((width * 9) / 16)} radius={20} />
                <ActionButton theme={theme} tone="quiet" label={t("bc.f.close")} onPress={watch.close} />
              </>
            ) : (
              <>
                {embed ? <ActionButton theme={theme} label={t("bc.rec.watch")} onPress={() => watch.open(`rec:${r.id}`)} /> : null}
                {r.url ? <ActionButton theme={theme} tone={embed ? "quiet" : "primary"} label={`${t("bc.p.open")} · ${providerName(r)}`} onPress={() => onOpen(r.url as string)} /> : null}
                {r.source === "youtube" ? <Hint theme={theme}>{t("bc.rec.fromYoutube")}</Hint> : null}
              </>
            )}
            {r.mine || item.recordingAction === "add" ? <ActionButton theme={theme} tone="quiet" label={t("bc.rec.remove")} onPress={() => onRemove(r)} /> : null}
          </View>
        )
      })}

      {pending.map((r) => (
        <View key={r.id} style={s.row}>
          <Text style={[s.line, { color: theme.textBody }]} numberOfLines={2}>
            {t("bc.rec.pending", { host: providerName(r) })}
          </Text>
          {r.url ? <ActionButton theme={theme} tone="quiet" label={`${t("bc.p.open")} · ${providerName(r)}`} onPress={() => onOpen(r.url as string)} /> : null}
          {r.mine || item.recordingAction === "add" ? <ActionButton theme={theme} tone="quiet" label={t("bc.rec.remove")} onPress={() => onRemove(r)} /> : null}
        </View>
      ))}

      {accepted.length === 0 && pending.length === 0 ? <Hint theme={theme}>{t("bc.rec.none")}</Hint> : null}

      {item.recordingAction ? <ActionButton theme={theme} tone={accepted.length === 0 ? "primary" : "quiet"} label={item.recordingAction === "add" ? t("bc.rec.add") : t("bc.rec.suggest")} onPress={onAdd} /> : null}
      {item.recordingAction === "suggest" ? <Hint theme={theme}>{t("bc.rec.suggest.note")}</Hint> : null}
    </View>
  )
}

const s = StyleSheet.create({
  block: { gap: 16 },
  h2: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 30, letterSpacing: -0.4, textTransform: "uppercase" },
  row: { gap: 8 },
  line: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
})
