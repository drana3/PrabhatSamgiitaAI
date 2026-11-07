import { useCallback, useEffect, useRef, useState } from "react"
import { Linking, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Copy, ExternalLink, Share2 } from "lucide-react-native"

import { LiveBadge, LiveGlyph, LivePhoto, liveTone } from "@/components/kirtan/LiveCard"
import { LiveEmbed } from "@/components/kirtan/LiveEmbed"
import { ChevronGlyph } from "@/components/kirtan/KirtanParts"
import { KPress } from "@/components/kirtan/KPress"
import { Toast } from "@/components/songs-v2/Toast"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useKirtanLive } from "@/hooks/useKirtanLive"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { hostLine, liveShareMessage, liveStatus, youtubeWatchUrl } from "@/lib/kirtan/live"
import { copyText, runShare } from "@/lib/playerV2/playerActionsIO"
import { shareToast } from "@/lib/playerV2/playerShare"
import { webBaseUrl } from "@/lib/webLinks"
import { usePlayerStore } from "@/stores/playerStore"
import { href } from "@/utils/href"

/**
 * A live Kiirtan broadcast. It is NOT a track: it never enters the player's queue or the mini-player.
 *  - YouTube: the official IFrame embed only (nothing is downloaded or extracted), plus "Watch on YouTube".
 *  - Zoom: title, time, host, "Join in Zoom" (opens the Zoom app), meeting ID and passcode with copy buttons.
 * Under both: Share, and a note that live audio stops when the app is left.
 * If the queue was playing when the screen opened, it is paused and a toast says so, with Resume.
 * TODO(api): the schedule, YouTube ids and Zoom rooms come from the backend. Live broadcasts have no reminder of their own; a server push can announce them (docs/notifications.md).
 */
export default function KiirtanLiveScreen() {
  const router = useRouter()
  const theme = useSongsTheme()
  const t = useT()
  const { width } = useWindowDimensions()
  const params = useLocalSearchParams<{ id?: string }>()
  const { now, byId } = useKirtanLive()
  const item = params.id ? byId.get(params.id) : undefined
  const [toast, setToast] = useState<string | null>(null)
  const [pausedQueue, setPausedQueue] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const top = useScreenTop()

  const flash = useCallback((message: string) => {
    setToast(message)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 2600)
  }, [])
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  // Opening a stream pauses the queue (once, on arrival) so two sounds never play together.
  const paused = useRef(false)
  useEffect(() => {
    if (!item || paused.current) return
    paused.current = true
    const player = usePlayerStore.getState()
    if (player.isPlaying) {
      player.pause()
      setPausedQueue(true)
      flash(t("kt.live.pausedQueue"))
    }
  }, [item, flash, t])

  const back = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/kiirtan")))

  if (!item) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: theme.page }]}>
        <Text style={[styles.body, { color: theme.textBody }]}>{t("kt.live.missing")}</Text>
        <KPress accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={back} pressedScale={0.96} style={[styles.pill, { backgroundColor: theme.brand }]}>
          <Text style={styles.pillText}>{t("common.back")}</Text>
        </KPress>
      </View>
    )
  }

  const status = liveStatus(item, now)
  const live = status === "live"
  const [from, to] = liveTone(item, now)
  const gutter = 20
  const boxW = width - gutter * 2
  const boxH = Math.round((boxW * 9) / 16)

  const onShare = async () => {
    const url = webBaseUrl()
    const message = shareToast(await runShare("more", { title: t("kt.live.shareTitle", { title: item.title }), message: liveShareMessage(item, now, url), url }))
    if (message) flash(message)
  }
  const copy = async (label: string, value: string) =>
    flash((await copyText(value)) ? t("kt.live.copied", { label }) : t("kt.live.copyFailed", { label: label.toLowerCase() }))
  const open = async (url: string) => {
    try {
      await Linking.openURL(url)
    } catch {
      flash(t("kt.live.openFailed"))
    }
  }
  const resume = () => {
    usePlayerStore.getState().play()
    setPausedQueue(false)
    flash(t("kt.live.resumedQueue"))
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: top + 64 }]}>
        <View style={{ paddingHorizontal: gutter }}>
          {item.platform === "youtube" && item.youtubeId ? (
            <LiveEmbed youtubeId={item.youtubeId} title={item.title} width={boxW} height={boxH} radius={24} />
          ) : (
            <View style={[styles.zoomHero, { width: boxW, height: boxH }]}>
              <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <LivePhoto item={item} big />
              <View style={styles.zoomGlyph}>
                <LiveGlyph platform={item.platform} size={44} />
              </View>
            </View>
          )}

          <View style={styles.badgeRow}>
            <LiveBadge item={item} now={now} />
            <Text style={[styles.when, { color: theme.textBody }]}>{live ? t("kt.live.onNow") : t("kt.live.minutes", { count: item.durationMin })}</Text>
          </View>
          <Text style={[styles.title, { color: theme.textHeading }]} accessibilityRole="header">
            {item.title}
          </Text>
          <Text style={[styles.host, { color: theme.textBody }]}>{hostLine(item)}</Text>

          {item.platform === "zoom" && item.zoom ? (
            <View style={[styles.zoomCard, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <KPress
                accessibilityRole="button"
                accessibilityLabel={t("kt.live.joinZoom")}
                onPress={() => void open(item.zoom!.url)}
                pressedScale={0.97}
                style={[styles.join, { backgroundColor: theme.brand }]}
              >
                <ExternalLink size={20} color={theme.onBrand} strokeWidth={2.2} />
                <Text style={styles.joinText}>{t("kt.live.joinZoom")}</Text>
              </KPress>
              <Text style={[styles.hint, { color: theme.textMuted }]}>{t("kt.live.zoomHint")}</Text>
              <CopyField theme={theme} label={t("kt.live.meetingId")} value={item.zoom.meetingId} onCopy={() => void copy(t("kt.live.meetingId"), item.zoom!.meetingId.replace(/\s+/g, ""))} />
              <CopyField theme={theme} label={t("kt.live.passcode")} value={item.zoom.passcode} onCopy={() => void copy(t("kt.live.passcode"), item.zoom!.passcode)} />
            </View>
          ) : item.youtubeId ? (
            <KPress
              accessibilityRole="link"
              accessibilityLabel={t("kt.live.watchYoutube")}
              onPress={() => void open(youtubeWatchUrl(item.youtubeId!))}
              pressedScale={0.97}
              style={[styles.outline, { borderColor: theme.line, backgroundColor: theme.card }]}
            >
              <ExternalLink size={18} color={theme.textHeading} strokeWidth={2} />
              <Text style={[styles.outlineText, { color: theme.textHeading }]}>{t("kt.live.watchYoutube")}</Text>
            </KPress>
          ) : null}

          <View style={styles.actions}>
            <KPress
              accessibilityRole="button"
              accessibilityLabel={t("common.share")}
              onPress={() => void onShare()}
              pressedScale={0.96}
              outerStyle={styles.actionOuter}
              style={[styles.outline, { borderColor: theme.line, backgroundColor: theme.card }]}
            >
              <Share2 size={18} color={theme.textHeading} strokeWidth={2} />
              <Text style={[styles.outlineText, { color: theme.textHeading }]}>{t("common.share")}</Text>
            </KPress>
          </View>

          {pausedQueue ? (
            <KPress accessibilityRole="button" accessibilityLabel={t("kt.live.resume")} onPress={resume} pressedScale={0.97} style={styles.resumeLink}>
              <Text style={[styles.resumeText, { color: theme.accent }]}>{t("kt.live.resume")}</Text>
            </KPress>
          ) : null}

          <Text style={[styles.note, { color: theme.textMuted }]}>{t("kt.live.bgNote")}</Text>
        </View>
      </ScrollView>

      <KPress
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
        onPress={back}
        pressedScale={0.9}
        outerStyle={[styles.back, { top: top + 6 }]}
        style={[styles.backDisc, { backgroundColor: theme.card, borderColor: theme.line }]}
      >
        <View style={styles.flip}>
          <ChevronGlyph color={theme.textHeading} />
        </View>
      </KPress>
      <Toast message={toast} theme={theme} />
    </View>
  )
}

function CopyField({ theme, label, value, onCopy }: { theme: ReturnType<typeof useSongsTheme>; label: string; value: string; onCopy: () => void }) {
  const t = useT()
  return (
    <View style={[styles.field, { borderColor: theme.line }]}>
      <View style={styles.fieldText}>
        <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
        <Text style={[styles.fieldValue, { color: theme.textHeading }]} selectable>
          {value}
        </Text>
      </View>
      <KPress accessibilityRole="button" accessibilityLabel={t("kt.live.copyA11y", { label: label.toLowerCase() })} onPress={onCopy} pressedScale={0.9} style={[styles.copy, { borderColor: theme.line }]}>
        <Copy size={18} color={theme.textHeading} strokeWidth={2} />
      </KPress>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  content: { paddingBottom: 220 },
  back: { position: "absolute", left: 16 },
  backDisc: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  flip: { transform: [{ scaleX: -1 }] },
  zoomHero: { borderRadius: 24, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  zoomGlyph: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 },
  when: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  title: { fontFamily: amFonts.display, fontSize: 34, lineHeight: 35, letterSpacing: -0.7, textTransform: "uppercase", marginTop: 12 },
  host: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, marginTop: 6 },
  zoomCard: { marginTop: 20, borderRadius: 24, borderWidth: 1, padding: 16, gap: 12 },
  join: { height: 56, borderRadius: 70, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  joinText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, color: "#FFFFFF" },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17, textAlign: "center" },
  field: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, paddingTop: 12 },
  fieldText: { flex: 1, gap: 2 },
  fieldLabel: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: "uppercase" },
  fieldValue: { fontFamily: amFonts.semi, fontSize: 20, lineHeight: 26, fontVariant: ["tabular-nums"] },
  copy: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  outline: { height: 52, borderRadius: 70, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18, marginTop: 16 },
  outlineText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  actions: { flexDirection: "row", gap: 10 },
  actionOuter: { flex: 1 },
  resumeLink: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", marginTop: 8 },
  resumeText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20, textDecorationLine: "underline" },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, marginTop: 20 },
  body: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, textAlign: "center" },
  pill: { height: 48, paddingHorizontal: 28, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  pillText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 20, color: "#FFFFFF" },
})
