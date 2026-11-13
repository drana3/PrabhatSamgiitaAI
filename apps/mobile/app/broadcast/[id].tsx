import { useCallback, useEffect, useRef, useState } from "react"
import { Linking, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"

import { LiveMark } from "@/components/broadcasts/LiveMark"
import { AudioOnlyStage } from "@/components/photos/AudioOnlyStage"
import { RecordingBlock } from "@/components/broadcasts/RecordingBlock"
import { SheetTopBar } from "@/components/common/SheetTopBar"
import { KPress } from "@/components/kirtan/KPress"
import { ConfirmDialog, type DialogAction } from "@/components/song-chords/ConfirmDialog"
import { ActionButton, Chip, Hint } from "@/components/song-chords/parts"
import { VideoEmbed } from "@/components/recording-extras/VideoEmbed"
import { useVideoWatch } from "@/components/recording-extras/useVideoWatch"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { broadcastFailure, broadcastsBackend } from "@/lib/broadcasts/backend"
import { addressToOpen, liveDay, phaseNow, playsInApp } from "@/lib/broadcasts/rules"
import type { Broadcast, BroadcastFailure, BroadcastRecording, BroadcastReportReason } from "@/lib/broadcasts/types"
import { whenLine } from "@/lib/broadcasts/when"
import { useLanguage, useT } from "@/lib/i18n"
import { videoEmbed } from "@/lib/recordingVideos/embed"
import { href } from "@/utils/href"

const REASONS: readonly BroadcastReportReason[] = ["broken", "not_a_broadcast", "offensive", "spam", "other"]
const MAX_VIDEO_WIDTH = 512

/**
 * One broadcast: the phase mark ("Live", "Upcoming", "Ended"), the title, the time, who organizes it and what it is, then
 * how to join. A YouTube broadcast plays through the site's own embed like a video link (tap "Watch here"); every other
 * site (Zoom, Facebook, Instagram, anything else) is only ever opened OUTSIDE the app with "Open", after the stored address
 * is parsed again. The author can mark it over or delete it; anybody can report it (docs/broadcasts.md).
 */
export default function BroadcastScreen() {
  const t = useT()
  const language = useLanguage()
  const router = useRouter()
  const theme = useSongsTheme()
  const bottomInset = useScrollBottomInset(24)
  const { width } = useWindowDimensions()
  const { id } = useLocalSearchParams<{ id: string }>()
  const watch = useVideoWatch()

  const [item, setItem] = useState<Broadcast | null>(null)
  const [failure, setFailure] = useState<BroadcastFailure | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)
  const [confirm, setConfirm] = useState<"end" | "delete" | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      setItem(await broadcastsBackend().get(String(id)))
      setFailure(null)
    } catch (error) {
      setFailure(broadcastFailure(error))
    }
  }, [id])
  useEffect(() => {
    void load()
  }, [load])
  // coming back from "Add the recording" shows the new recording (the first focus is the load above)
  const firstFocus = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (!firstFocus.current) void load()
      firstFocus.current = false
    }, [load]),
  )
  // the phase is worked out from the times, so the mark follows the clock while the page is open
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const close = () => (router.canGoBack() ? router.back() : router.replace(href("/broadcasts")))
  const say = (kind: BroadcastFailure) => (t as (key: string) => string)(`bc.err.${kind}`)

  async function open(url: string) {
    // a stored address is parsed again; only one that comes back unchanged leaves the app
    const address = addressToOpen(url)
    if (!address) return setNote(t("bc.p.open.fail"))
    try {
      await Linking.openURL(address)
      setNote(null)
    } catch {
      setNote(t("bc.p.open.fail"))
    }
  }

  async function removeRecording(recording: BroadcastRecording) {
    if (!item) return
    try {
      await broadcastsBackend().removeRecording(item.id, recording.id)
      setItem({ ...item, recordings: item.recordings.filter((r) => r.id !== recording.id) })
    } catch (error) {
      setNote(say(broadcastFailure(error)))
    }
  }

  async function report(reason: BroadcastReportReason) {
    if (!item) return
    setReporting(false)
    try {
      const done = await broadcastsBackend().report(item.id, { reason })
      setNote(done.status === "already_reported" ? t("bc.r.already") : t("bc.r.received"))
    } catch (error) {
      setNote(say(broadcastFailure(error)))
    }
  }

  async function run(action: "end" | "delete") {
    if (!item) return
    setConfirm(null)
    try {
      if (action === "end") setItem(await broadcastsBackend().end(item.id))
      else {
        await broadcastsBackend().remove(item.id)
        close()
      }
    } catch (error) {
      setNote(say(broadcastFailure(error)))
    }
  }

  const dialog: { title: string; body: string; actions: DialogAction[] } | null =
    confirm === "end"
      ? { title: t("bc.p.end"), body: t("bc.p.end.body"), actions: [{ label: t("bc.r.cancel"), tone: "quiet", onPress: () => setConfirm(null) }, { label: t("bc.p.end"), tone: "primary", onPress: () => void run("end") }] }
      : confirm === "delete"
        ? { title: t("bc.p.delete"), body: t("bc.p.delete.body"), actions: [{ label: t("bc.r.cancel"), tone: "quiet", onPress: () => setConfirm(null) }, { label: t("bc.p.delete"), tone: "danger", onPress: () => void run("delete") }] }
        : null

  if (!item) {
    return (
      <View style={[s.root, { backgroundColor: theme.page }]}>
        <SheetTopBar closeLabel={t("bc.f.close")} onClose={close} />
        <View style={s.content}>
          <Hint theme={theme} tone={failure ? "danger" : "body"}>
            {failure ? say(failure) : ""}
          </Hint>
          {failure && failure !== "gone" ? <ActionButton theme={theme} tone="quiet" label={t("bc.p.retry")} onPress={() => void load()} /> : null}
        </View>
      </View>
    )
  }

  const phase = phaseNow(item, now)
  const embed = playsInApp(item.provider) ? videoEmbed({ provider: "youtube", url: item.url, linkStatus: item.linkStatus }) : null
  const watching = embed !== null && watch.openId === item.id
  const videoWidth = Math.min(width - 48, MAX_VIDEO_WIDTH)
  const providerName = item.provider === "other" ? item.host : (t as (key: string) => string)(`bc.p.provider.${item.provider}`)

  return (
    <View style={[s.root, { backgroundColor: theme.page }]}>
      <SheetTopBar closeLabel={t("bc.f.close")} onClose={close} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: bottomInset }]}>
        <Reveal index={0} style={s.head}>
          <LiveMark phase={phase} theme={theme} day={liveDay(item, now)} />
          <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {item.title}
          </Text>
          <Text style={[s.when, { color: theme.accent }]}>{whenLine(item, t as never, language, now)}</Text>
          {item.organizer ? <Text style={[s.body, { color: theme.textBody }]}>{t("bc.p.by", { name: item.organizer })}</Text> : null}
        </Reveal>

        {item.description ? (
          <Reveal index={1}>
            <Text style={[s.body, { color: theme.textBody }]}>{item.description}</Text>
          </Reveal>
        ) : null}

        <Reveal index={2} style={s.stack}>
          {embed && phase !== "ended" ? (
            <AudioOnlyStage seed={item.id} title={item.title} width={videoWidth} height={Math.round((videoWidth * 9) / 16)} radius={20} listening={watching} onToggle={() => (watching ? watch.close() : watch.open(item.id))}>
              <VideoEmbed embed={embed} title={t("bc.p.video.a11y")} width={videoWidth} height={Math.round((videoWidth * 9) / 16)} radius={20} />
            </AudioOnlyStage>
          ) : null}
          {!embed && item.provider === "youtube" ? <Hint theme={theme}>{t("bc.p.noEmbed")}</Hint> : null}
          {phase !== "ended" || !embed ? (
            <>
              {embed ? (
                <ActionButton theme={theme} tone="quiet" label={`${t("bc.p.open")} · ${providerName}`} onPress={() => void open(item.url)} />
              ) : (
                <Join theme={theme} label={`${t("bc.p.open")} · ${providerName}`} onPress={() => void open(item.url)} />
              )}
              <Hint theme={theme}>{item.provider === "zoom" ? t("bc.p.open.zoom") : t("bc.p.open.note", { host: item.host })}</Hint>
            </>
          ) : null}
          {item.liveSource === "youtube" && phase === "now" ? <Hint theme={theme}>{t("bc.p.viaYoutube")}</Hint> : null}
          {item.linkStatus === "unavailable" ? <Hint theme={theme} tone="danger">{t("bc.p.unavailable")}</Hint> : null}
          {note ? <Hint theme={theme}>{note}</Hint> : null}
        </Reveal>

        {phase === "ended" || item.recordings.length > 0 ? (
          <Reveal index={3}>
            <RecordingBlock item={{ ...item, phase }} theme={theme} watch={watch} width={videoWidth} onOpen={(url) => void open(url)} onRemove={(r) => void removeRecording(r)} onAdd={() => router.push(href(`/broadcast-recording?id=${encodeURIComponent(item.id)}`))} />
          </Reveal>
        ) : null}

        <Reveal index={4} style={s.stack}>
          {item.canEnd && phase !== "ended" ? <ActionButton theme={theme} tone="quiet" label={t("bc.p.end")} onPress={() => setConfirm("end")} /> : null}
          {item.mine ? <ActionButton theme={theme} tone="quiet" label={t("bc.p.delete")} onPress={() => setConfirm("delete")} /> : null}
          {!item.mine ? (
            reporting ? (
              <View style={s.reasons} accessibilityRole="radiogroup" accessibilityLabel={t("bc.r.title")}>
                <Text style={[s.label, { color: theme.textHeading }]}>{t("bc.r.title")}</Text>
                <View style={s.chips}>
                  {REASONS.map((reason) => (
                    <Chip key={reason} theme={theme} label={(t as (key: string) => string)(`bc.r.${reason}`)} role="button" onPress={() => void report(reason)} />
                  ))}
                </View>
                <ActionButton theme={theme} tone="quiet" label={t("bc.r.cancel")} onPress={() => setReporting(false)} />
              </View>
            ) : (
              <ActionButton theme={theme} tone="quiet" label={t("bc.p.report")} onPress={() => setReporting(true)} />
            )
          ) : null}
        </Reveal>
      </ScrollView>
      <ConfirmDialog theme={theme} open={dialog !== null} title={dialog?.title ?? ""} body={dialog?.body ?? ""} actions={dialog?.actions ?? []} onDismiss={() => setConfirm(null)} />
    </View>
  )
}

function Join({ label, onPress }: { theme: ReturnType<typeof useSongsTheme>; label: string; onPress: () => void }) {
  return (
    <KPress accessibilityRole="button" accessibilityLabel={label} onPress={onPress} pressedScale={0.98} outerStyle={s.full} style={[s.join, { backgroundColor: amColors.orange700 }]}>
      <Text style={s.joinText}>{label}</Text>
    </KPress>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 24, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  head: { gap: 12 },
  stack: { gap: 16 },
  h1: { fontFamily: amFonts.display, fontSize: 40, lineHeight: 42, letterSpacing: -0.8, textTransform: "uppercase" },
  when: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  reasons: { gap: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  full: { alignSelf: "stretch" },
  join: { height: 56, borderRadius: 70, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  joinText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, color: "#FFFFFF" },
})
