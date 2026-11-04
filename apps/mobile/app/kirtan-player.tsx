import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Platform, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { LinearGradient } from "expo-linear-gradient"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { KirtanMenuSheet, KirtanShareSheet } from "@/components/kirtan/KirtanMenus"
import { KirtanTag } from "@/components/kirtan/KirtanParts"
import type { EmbedHandle } from "@/components/kirtan/embedTypes"
import { YouTubeEmbed } from "@/components/kirtan/YouTubeEmbed"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { playerColors, playerSize } from "@/components/player-v2/playerTokens"
import { ThinScrubber } from "@/components/player-v2/Scrubber"
import { TouchButton } from "@/components/player-v2/TouchButton"
import { BottomSheet } from "@/components/songs-v2/BottomSheet"
import { Toast } from "@/components/songs-v2/Toast"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useKirtans } from "@/hooks/useKirtans"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { embedErrorText, type EmbedEvent, type EmbedState } from "@/lib/kirtan/iframeApi"
import { kirtanSubline, splitKirtanTitle } from "@/lib/kirtan/list"
import { handoffAfter, handoffPrompt } from "@/lib/kirtan/mix"
import { startMixItem } from "@/lib/kirtan/mixPlayback"
import { nextAfter, positionLabel, previousBefore } from "@/lib/kirtan/queue"
import { kirtanSharePayload } from "@/lib/kirtan/share"
import type { Kirtan } from "@/lib/kirtan/types"
import { runShare } from "@/lib/playerV2/playerActionsIO"
import { shareToast, type ShareTargetId } from "@/lib/playerV2/playerShare"
import { useKirtanPlayerStore } from "@/stores/kirtanPlayerStore"
import { useKirtanStore } from "@/stores/kirtanStore"
import { href } from "@/utils/href"

/** The tint behind the player, steady per kirtan. */
const TINTS = ["#3C5535", "#B94D0C", "#6B4A12", "#2C3A27"] as const
function tintOf(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return TINTS[h % TINTS.length]
}

/**
 * Kirtan player. The video plays ONLY in YouTube's official embedded player (an iframe on the web, a
 * WebView on the phone); the app never fetches or stores its audio or video. The embed's own
 * controls work too. Play, pause and the thin scrubber talk to it through the IFrame player's
 * postMessage interface, so they follow what YouTube reports. It does not keep playing when the
 * screen locks: that is YouTube's rule for embedded players.
 */
export default function KirtanPlayerScreen() {
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ id?: string }>()
  const actions = useKirtanActions()
  const { byId } = useKirtans()
  const savedIds = useKirtanStore((s) => s.savedIds)
  const context = useKirtanPlayerStore((s) => s.context)
  const queued = useKirtanPlayerStore((s) => s.queued)
  const mix = useKirtanPlayerStore((s) => s.mix)

  const [currentId, setCurrentId] = useState<string | null>(typeof params.id === "string" ? params.id : null)
  useEffect(() => {
    if (typeof params.id === "string") setCurrentId(params.id)
  }, [params.id])
  const kirtan = currentId ? byId.get(currentId) ?? null : null

  const embed = useRef<EmbedHandle | null>(null)
  const [state, setState] = useState<EmbedState>("unstarted")
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState<number | null>(null)
  const [errorCode, setErrorCode] = useState<number | null>(null)
  const [sheet, setSheet] = useState<null | "menu" | "share" | "queue">(null)
  const [autoplay, setAutoplay] = useState(true)

  // YouTube reports "ended" twice (state change and info delivery); only the first one moves on.
  const endedFor = useRef<string | null>(null)

  // A new kirtan starts from nothing.
  useEffect(() => {
    endedFor.current = null
    setState("unstarted")
    setPosition(0)
    setDuration(null)
    setErrorCode(null)
  }, [currentId])

  const top = Platform.OS === "web" ? 28 : Math.max(insets.top, 16)
  const bottom = Platform.OS === "web" ? 32 : Math.max(insets.bottom, 16) + 12
  const saved = kirtan ? savedIds.includes(kirtan.id) : false
  const playing = state === "playing" || state === "buffering"

  /* ----- what comes before and after ----- */
  const mixItems = mix?.items ?? null
  const mixIndex = mix && kirtan ? mix.items.findIndex((i) => i.kind === "kirtan" && i.id === kirtan.id) : -1
  const inMix = Boolean(mix && mixIndex >= 0)
  const next = useMemo(() => (inMix ? handoffAfter(mixItems!, mixIndex) : null), [inMix, mixItems, mixIndex])

  const titleOfMixItem = useCallback(
    (item: { kind: "ps"; number: number } | { kind: "kirtan"; id: string }) => (item.kind === "kirtan" ? byId.get(item.id)?.title ?? "Kiirtan" : `PS ${item.number}`),
    [byId],
  )

  const goTo = useCallback(
    (id: string, fromQueue: boolean) => {
      if (fromQueue) useKirtanPlayerStore.getState().takeQueued(id)
      setAutoplay(true)
      setCurrentId(id)
    },
    [],
  )

  const goNext = useCallback(() => {
    if (!kirtan) return
    if (inMix && next) {
      if (next.action === "done") return actions.flash("That was the last one in this mix")
      if (next.action === "continue" && next.item.kind === "kirtan") {
        useKirtanPlayerStore.getState().setMixIndex(next.index)
        return goTo(next.item.id, false)
      }
      // the other player has to open; the hand-over is not gapless
      return startMixItem((path) => router.replace(href(path)), mix!, next.index)
    }
    const after = nextAfter({ context, queued }, kirtan.id)
    if (after) goTo(after.id, after.fromQueue)
    else actions.flash("That was the last one in the list")
  }, [actions, context, goTo, inMix, kirtan, mix, next, queued, router])

  const goPrevious = useCallback(() => {
    if (!kirtan) return
    if (position > 5) {
      embed.current?.seekTo(0)
      return
    }
    if (inMix && mix) {
      const before = mix.items[mixIndex - 1]
      if (!before) return embed.current?.seekTo(0)
      if (before.kind === "kirtan") {
        useKirtanPlayerStore.getState().setMixIndex(mixIndex - 1)
        return goTo(before.id, false)
      }
      return startMixItem((path) => router.replace(href(path)), mix, mixIndex - 1)
    }
    const before = previousBefore({ context, queued: [] }, kirtan.id)
    if (before) goTo(before, false)
    else embed.current?.seekTo(0)
  }, [context, goTo, inMix, kirtan, mix, mixIndex, position, router])

  const onEvent = useCallback(
    (event: EmbedEvent) => {
      if (event.type === "state") {
        setState(event.state)
        if (event.state === "ended" && endedFor.current !== currentId) {
          endedFor.current = currentId
          goNext()
        }
      } else if (event.type === "time") {
        setPosition(event.current)
        if (event.duration) setDuration(event.duration)
        if (event.state) setState((cur) => (cur === event.state ? cur : event.state!))
      } else if (event.type === "error") {
        setErrorCode(event.code)
      }
    },
    [currentId, goNext],
  )

  const togglePlay = () => {
    if (playing) {
      embed.current?.pause()
      setState("paused")
    } else {
      embed.current?.play()
      setState("playing")
    }
  }

  const onShare = async (k: Kirtan, target: ShareTargetId) => {
    const message = shareToast(await runShare(target, kirtanSharePayload(k)))
    if (message) actions.flash(message)
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/songs?source=kirtan")))

  const tint = tintOf(kirtan?.id ?? "none")
  const split = splitKirtanTitle(kirtan?.title ?? "")
  const upcoming = useMemo(() => {
    const ids = [...queued]
    const at = kirtan ? context.indexOf(kirtan.id) : -1
    for (const id of at >= 0 ? context.slice(at + 1) : []) if (!ids.includes(id)) ids.push(id)
    return ids.map((id) => byId.get(id)).filter((k): k is Kirtan => Boolean(k))
  }, [byId, context, kirtan, queued])

  return (
    <View style={[styles.root, { backgroundColor: playerColors.ground }]}>
      <LinearGradient colors={[`${tint}99`, `${tint}33`, "rgba(18,17,16,0)"]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={[styles.column, { paddingTop: top, paddingBottom: bottom }]}>
        <Reveal index={0}>
          <View style={styles.topBar}>
            <TouchButton accessibilityRole="button" accessibilityLabel="Close the kiirtan player" onAction={close} style={styles.topButton}>
              <PlayerIcon name="chevronDown" size={30} color={amColors.white} />
            </TouchButton>
            <Text style={styles.label} accessibilityRole="header">
              Kiirtan
            </Text>
            <TouchButton accessibilityRole="button" accessibilityLabel="More actions" onAction={() => kirtan && setSheet("menu")} style={styles.topButton}>
              <PlayerIcon name="more" size={playerSize.topIcon} color={amColors.white} />
            </TouchButton>
          </View>
        </Reveal>

        {!kirtan ? (
          <View style={styles.missing}>
            <Text style={styles.missingTitle}>This kiirtan is not in the list.</Text>
            <TouchButton accessibilityRole="button" accessibilityLabel="Back to the list" onAction={close} style={styles.listButton}>
              <Text style={styles.listButtonText}>Back to the list</Text>
            </TouchButton>
          </View>
        ) : (
          <>
            <Reveal index={1}>
              <View style={styles.videoWrap} accessibilityLabel={`YouTube player: ${kirtan.title}`}>
                <YouTubeEmbed ref={embed} videoId={kirtan.videoId} autoplay={autoplay} onEvent={onEvent} />
              </View>
              {errorCode != null ? (
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {embedErrorText(errorCode)} Use "Open on YouTube" in the menu.
                </Text>
              ) : null}
            </Reveal>

            <Reveal index={2}>
              <View style={styles.titleBlock}>
                <Text style={styles.title} accessibilityRole="header">
                  {split.heavy}
                  {split.light ? <Text style={styles.titleLight}>{` ${split.light}`}</Text> : null}
                </Text>
                <View style={styles.metaRow}>
                  <KirtanTag theme={theme} color={playerColors.gold} />
                  <Text style={styles.meta} numberOfLines={1}>
                    {[kirtanSubline(kirtan), !inMix ? positionLabel(context, kirtan.id) : ""].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                {inMix && mix ? (
                  <Text style={styles.mixLine} numberOfLines={2}>
                    {`In a mix · item ${mixIndex + 1} of ${mix.items.length}`}
                    {next && next.action === "switch" ? `\n${handoffPrompt(titleOfMixItem(next.item), next.to)}` : next && next.action === "continue" ? `\nNext: ${titleOfMixItem(next.item)}` : ""}
                  </Text>
                ) : null}
              </View>
            </Reveal>

            <Reveal index={3}>
              <View style={styles.scrub}>
                {duration ? (
                  <ThinScrubber position={position} duration={duration} onSeek={(s) => embed.current?.seekTo(s)} />
                ) : (
                  <Text style={styles.noScrub}>Use the controls in the video above.</Text>
                )}
              </View>
            </Reveal>

            <Reveal index={4}>
              <View style={styles.transport}>
                <TouchButton accessibilityRole="button" accessibilityLabel="Previous" onAction={goPrevious} style={styles.skip}>
                  <PlayerIcon name="prev" size={30} color={amColors.white} />
                </TouchButton>
                <TouchButton accessibilityRole="button" accessibilityLabel={playing ? "Pause" : "Play"} onAction={togglePlay} pressedScale={0.94} style={styles.disc}>
                  <PlayerIcon name={playing ? "pause" : "play"} size={playerSize.playGlyph} color={playerColors.onBrand} />
                </TouchButton>
                <TouchButton accessibilityRole="button" accessibilityLabel="Next" onAction={goNext} style={styles.skip}>
                  <PlayerIcon name="next" size={30} color={amColors.white} />
                </TouchButton>
              </View>
            </Reveal>

            <View style={styles.flex} />

            <Reveal index={5}>
              <View style={styles.utilRow}>
                <TouchButton accessibilityRole="button" accessibilityLabel={saved ? "Remove from saved" : "Save"} accessibilityState={{ selected: saved }} onAction={() => actions.toggleSaved(kirtan)} style={styles.util}>
                  <PlayerIcon name="heart" size={24} color={saved ? playerColors.gold : playerColors.utilIcon} filled={saved} />
                  <Text style={styles.utilLabel}>{saved ? "Saved" : "Save"}</Text>
                </TouchButton>
                <TouchButton accessibilityRole="button" accessibilityLabel="Queue" onAction={() => setSheet("queue")} style={styles.util}>
                  <PlayerIcon name="queue" size={24} color={playerColors.utilIcon} />
                  <Text style={styles.utilLabel}>Queue</Text>
                </TouchButton>
                <TouchButton accessibilityRole="button" accessibilityLabel="Share" onAction={() => setSheet("share")} style={styles.util}>
                  <PlayerIcon name="share" size={24} color={playerColors.utilIcon} />
                  <Text style={styles.utilLabel}>Share</Text>
                </TouchButton>
              </View>
              <View style={styles.note}>
                <PlayerIcon name="music" size={14} color={playerColors.textFaint} />
                <Text style={styles.noteText}>Plays in the YouTube player.</Text>
              </View>
            </Reveal>
          </>
        )}
      </View>

      <KirtanMenuSheet
        open={sheet === "menu"}
        theme={theme}
        kirtan={sheet === "menu" ? kirtan : null}
        saved={saved}
        onPlayNext={actions.playNext}
        onAddToPlaylist={actions.addToPlaylist}
        onToggleSave={actions.toggleSaved}
        onShare={() => setSheet("share")}
        onOpenYouTube={actions.openOnYouTube}
        onReport={actions.report}
        onClose={() => setSheet((cur) => (cur === "menu" ? null : cur))}
      />
      <KirtanShareSheet open={sheet === "share"} theme={theme} kirtan={sheet === "share" ? kirtan : null} onShare={onShare} onClose={() => setSheet((cur) => (cur === "share" ? null : cur))} />
      <BottomSheet open={sheet === "queue"} onClose={() => setSheet((cur) => (cur === "queue" ? null : cur))} theme={theme} eyebrow="Up next" accessibilityLabel="Kiirtan queue">
        {upcoming.length ? (
          <View style={styles.queue}>
            {upcoming.map((k) => (
              <TouchButton
                key={k.id}
                accessibilityRole="button"
                accessibilityLabel={`Play ${k.title}`}
                onAction={() => {
                  setSheet(null)
                  goTo(k.id, queued.includes(k.id))
                }}
                style={[styles.queueRow, { backgroundColor: theme.card, borderColor: theme.line }]}
              >
                <Text style={[styles.queueTitle, { color: theme.textHeading }]} numberOfLines={2}>
                  {k.title}
                </Text>
                {queued.includes(k.id) ? <Text style={[styles.queueTag, { color: theme.accent }]}>PLAYS NEXT</Text> : null}
              </TouchButton>
            ))}
          </View>
        ) : (
          <Text style={[styles.queueEmpty, { color: theme.textBody }]}>Nothing is waiting. Choose "Play next" in a kiirtan's menu to line one up.</Text>
        )}
      </BottomSheet>
      <Toast message={actions.toast} theme={theme} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { flex: 1, maxWidth: 560, width: "100%", alignSelf: "center" },
  flex: { flex: 1, minHeight: 8 },
  topBar: { height: playerSize.topBar, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: playerSize.topBarInsetLeft - 8, paddingRight: playerSize.topBarInsetRight },
  topButton: { width: playerSize.topButton, height: playerSize.topButton, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  label: { ...amType.label, color: playerColors.text, textAlign: "center" },
  videoWrap: { marginHorizontal: 20, marginTop: 12, aspectRatio: 16 / 9, borderRadius: 20, overflow: "hidden", backgroundColor: "#000000" },
  errorText: { marginHorizontal: 20, marginTop: 10, fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, color: playerColors.gold },
  titleBlock: { paddingHorizontal: 20, marginTop: 22, gap: 12 },
  title: { fontFamily: amFonts.display, fontSize: playerSize.titleFont, lineHeight: playerSize.titleLine, letterSpacing: playerSize.titleFont * -0.02, textTransform: "uppercase", color: playerColors.text },
  titleLight: { fontFamily: amFonts.regular, color: playerColors.textSoft, letterSpacing: 0 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  meta: { flexShrink: 1, fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17, color: playerColors.textSoft },
  mixLine: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, color: playerColors.gold },
  scrub: { marginTop: 14, marginHorizontal: 20, minHeight: 56, justifyContent: "center" },
  noScrub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, color: playerColors.textFaint, textAlign: "center" },
  transport: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28, marginTop: 4 },
  skip: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  disc: { width: playerSize.playDisc, height: playerSize.playDisc, borderRadius: 9999, backgroundColor: playerColors.brand, alignItems: "center", justifyContent: "center" },
  utilRow: { flexDirection: "row", justifyContent: "space-evenly", marginHorizontal: 24 },
  util: { minWidth: 72, height: 56, alignItems: "center", justifyContent: "center", gap: 4 },
  utilLabel: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 14, color: playerColors.textSoft },
  note: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 },
  noteText: { fontFamily: amFonts.medium, fontSize: 12.5, lineHeight: 16, color: playerColors.textFaint },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, paddingHorizontal: 32 },
  missingTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, color: playerColors.text, textTransform: "uppercase", textAlign: "center" },
  listButton: { height: 48, paddingHorizontal: 24, borderRadius: 70, backgroundColor: playerColors.brand, alignItems: "center", justifyContent: "center" },
  listButtonText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 20, color: "#FFFFFF" },
  queue: { gap: 8 },
  queueRow: { minHeight: 56, borderRadius: 20, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  queueTitle: { flex: 1, fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  queueTag: { fontFamily: amFonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
  queueEmpty: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
})
