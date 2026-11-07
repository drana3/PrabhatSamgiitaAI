import { useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { Button } from "@/components/comments/CommentsView"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { SectionTitle } from "@/components/song-page/ui"
import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { formatDate, useT } from "@/lib/i18n"
import { openExternal } from "@/lib/openLink"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { authHeadersFromStore } from "@/lib/memberAuth"
import { VIDEO_REPORT_REASONS, providerHost, safeToOpen } from "@/lib/recordingVideos/rules"
import type { VideoLink } from "@/lib/recordingVideos/types"
import { videoFailureText } from "@/lib/recordingVideos/words"
import { elapsed, postingAccess } from "@/lib/songComments/rules"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

import { DeletePanel, ReportPanel } from "./Panels"
import { Note, R_CARD, R_FIELD } from "./ui"
import type { VideosController } from "./useVideos"

type Panel = null | "menu" | "report" | "delete"

/**
 * "Videos": links members attached to a recording or a song, each opening on the video's own site (YouTube, Vimeo,
 * the Internet Archive). The app never downloads or plays them, and says so. A row shows the title (or "Video on
 * youtube.com"), the site, who added it ("a member" when anonymous), and Watch. The menu: report (not your own),
 * delete (your own), remove (the team). The list is read by everyone; adding needs sign-in (the gate says so).
 */
export function VideosSection({ t, videos, onAdd, onFlash }: { t: SpTheme; videos: VideosController; onAdd: () => void; onFlash: (text: string) => void }) {
  const tr = useT()
  const router = useRouter()
  const mode = useAuthStore((s) => s.mode)
  const access = postingAccess({ preview: MOCKUP_DATA, signedIn: mode === "signed_in", canProve: Object.keys(authHeadersFromStore()).length > 0 })
  const { state } = videos
  const full = state.status === "ready" && state.room === 0
  return (
    <View testID="recording-videos">
      <SectionTitle t={t}>{tr("recVideos.title")}</SectionTitle>
      <View style={styles.pad}>
        <Note t={t} tone="body">{tr("recVideos.intro")}</Note>
        <Note t={t}>{tr("recVideos.note")}</Note>
        {MOCKUP_DATA ? <Note t={t}>{tr("recVideos.preview")}</Note> : null}
      </View>

      <View style={styles.list}>
        {state.status === "loading" && state.items.length === 0 ? (
          <View style={styles.status} accessibilityLiveRegion="polite">
            <ActivityIndicator color={t.ink500} />
            <Note t={t}>{tr("recVideos.loading")}</Note>
          </View>
        ) : null}
        {state.status === "error" || state.status === "offline" ? (
          <View style={styles.status} accessibilityLiveRegion="polite">
            <Note t={t} tone="body">{tr(state.status === "offline" ? "recVideos.offline" : "recVideos.error")}</Note>
            <Button t={t} variant="quiet" label={tr("recVideos.retry")} onPress={() => void videos.reload()} />
          </View>
        ) : null}
        {state.status === "ready" && state.items.length === 0 ? <Text style={[styles.empty, { color: t.ink500 }]}>{tr("recVideos.empty")}</Text> : null}
        {state.items.map((video) => (
          <VideoRow key={video.id} t={t} video={video} videos={videos} onFlash={onFlash} />
        ))}
      </View>

      <View style={styles.pad}>
        {access === "ok" ? (
          <>
            {state.status === "ready" ? <Note t={t}>{full ? tr("recVideos.full") : tr("recVideos.room", { count: state.room })}</Note> : null}
            {!full ? <View style={styles.addRow}><Button t={t} label={tr("recVideos.add")} onPress={onAdd} /></View> : null}
          </>
        ) : (
          <View style={[styles.gate, { borderColor: t.sand400, backgroundColor: t.white }]}>
            <Text style={[styles.gateText, { color: t.ink800 }]}>{tr(access === "signin" ? "recVideos.signin.text" : "recVideos.unavailable")}</Text>
            {access === "signin" ? <Button t={t} label={tr("recVideos.signin.button")} onPress={() => router.push(href("/signin"))} /> : null}
          </View>
        )}
      </View>
    </View>
  )
}

function whenText(tr: ReturnType<typeof useT>, createdAt: string): string {
  const e = elapsed(createdAt)
  switch (e.kind) {
    case "now":
      return tr("songComments.time.now")
    case "minutes":
      return tr("songComments.time.minutes", { count: e.count })
    case "hours":
      return tr("songComments.time.hours", { count: e.count })
    case "days":
      return tr("songComments.time.days", { count: e.count })
    default:
      return formatDate(createdAt, "medium")
  }
}

function VideoRow({ t, video, videos, onFlash }: { t: SpTheme; video: VideoLink; videos: VideosController; onFlash: (text: string) => void }) {
  const tr = useT()
  const [panel, setPanel] = useState<Panel>(null)
  const site = providerHost(video.provider)
  const title = video.title ?? tr("recVideos.untitled", { site })
  const by = video.mine ? tr("recVideos.by.you") : video.author ? tr("recVideos.by", { name: video.author.name }) : tr("recVideos.by.anonymous")
  const openable = safeToOpen(video.url)
  const watch = async () => {
    if (!openable) return onFlash(tr("recVideos.openFailed"))
    if (!(await openExternal(video.url))) onFlash(tr("recVideos.openFailed"))
  }
  const mineOrTeam = video.mine || video.canRemove
  return (
    <View style={[styles.card, { backgroundColor: t.white, borderColor: t.sand400 }]}>
      <View style={styles.head}>
        <SpPress onPress={() => void watch()} disabled={!openable} accessibilityRole="link" accessibilityLabel={tr("recVideos.open.a11y", { title, site })} style={styles.main}>
          <View style={[styles.play, { backgroundColor: t.action }]}>
            <SpIcon name="play" size={18} color={t.onAction} />
          </View>
          <View style={styles.text}>
            <Text style={[styles.title, { color: t.ink900 }]} numberOfLines={2}>
              {title}
            </Text>
            <Text style={[styles.sub, { color: t.accentText }]} numberOfLines={1}>
              {tr("recVideos.open", { site })}
            </Text>
          </View>
        </SpPress>
        <SpPress onPress={() => setPanel(panel ? null : "menu")} accessibilityLabel={panel ? tr("recVideos.menu.close") : tr("recVideos.menu.a11y")} accessibilityState={{ selected: panel !== null }} pressedScale={0.92} style={styles.more}>
          {panel ? <SpIcon name="close" size={20} color={t.ink800} strokeWidth={2} /> : <PlayerIcon name="more" size={22} color={t.ink800} />}
        </SpPress>
      </View>
      <Note t={t}>{`${by}  ·  ${whenText(tr, video.createdAt)}`}</Note>

      {panel === "menu" ? (
        <View style={styles.actions}>
          {!video.mine ? <Button t={t} variant="quiet" label={tr("recVideos.menu.report")} onPress={() => setPanel("report")} /> : null}
          {mineOrTeam ? <Button t={t} variant="quiet" tone="danger" label={tr(video.mine ? "recVideos.menu.delete" : "recVideos.menu.remove")} onPress={() => setPanel("delete")} /> : null}
        </View>
      ) : null}
      {panel === "report" ? (
        <ReportPanel
          t={t}
          title={tr("recVideos.report.title")}
          reasons={VIDEO_REPORT_REASONS.map((r) => ({ id: r, label: tr(`recVideos.report.${r}`) }))}
          sendLabel={tr("recVideos.report.send")}
          sendingLabel={tr("recVideos.report.sending")}
          cancelLabel={tr("recVideos.delete.cancel")}
          onCancel={() => setPanel(null)}
          onSend={async (reason) => {
            const result = await videos.report(video.id, reason as (typeof VIDEO_REPORT_REASONS)[number])
            if (!result.ok) return videoFailureText(tr, result.failure)
            onFlash(tr(MOCKUP_DATA ? "recVideos.report.demo" : result.status === "already_reported" ? "recVideos.report.already" : "recVideos.report.sent"))
            setPanel(null)
            return null
          }}
        />
      ) : null}
      {panel === "delete" ? (
        <DeletePanel
          t={t}
          title={tr("recVideos.delete.title")}
          body={tr(video.mine ? "recVideos.delete.body" : "recVideos.remove.body")}
          confirmLabel={tr("recVideos.delete.confirm")}
          cancelLabel={tr("recVideos.delete.cancel")}
          onCancel={() => setPanel(null)}
          onConfirm={async () => {
            const failure = await videos.remove(video.id)
            return failure ? videoFailureText(tr, failure) : null
          }}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20, gap: 4, paddingBottom: 8 },
  list: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  status: { alignItems: "flex-start", gap: 12, paddingVertical: 8 },
  empty: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 24, paddingVertical: 8 },
  addRow: { paddingTop: 8 },
  gate: { marginTop: 8, padding: 20, borderWidth: 1, borderRadius: R_CARD, gap: 12, alignItems: "flex-start" },
  gateText: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 24 },
  card: { borderWidth: 1, borderRadius: R_FIELD, padding: 12, gap: 4 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  play: { width: 44, height: 44, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  sub: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
  more: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 8 },
})
