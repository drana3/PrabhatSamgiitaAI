import { useEffect, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { DownloadButton } from "@/components/offline/DownloadButton"
import { SaveMark } from "@/components/save/SaveMark"
import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useDownloadState } from "@/hooks/useDownloadState"
import { useSaveState } from "@/hooks/useSaveState"
import { songAccents } from "@/lib/songPage/accent"
import { downloadCaptionKey, saveTapPlan, savedCaptionKey } from "@/lib/songPage/actionLegend"
import { toggleMine } from "@/lib/save/saveActions"
import { usePageT, type PageT } from "@/lib/songPage/pageCopy"
import { openSaveSheet } from "@/stores/saveSheetStore"
import { useHintsReady, usePageHintsStore } from "@/stores/pageHintsStore"

import type { SongPageModel } from "./useSongPageModel"

const TOOL_W = 61
const ICON_BOX = 48

/** An icon of the row with its word under it. The word is drawn only while the first-showing captions are on. */
function Tool({
  caption,
  showCaption,
  label,
  hint,
  onPress,
  t,
  children,
}: {
  caption: string
  showCaption: boolean
  label: string
  hint?: string
  onPress: () => void
  t: SpTheme
  children: React.ReactNode
}) {
  const scale = useSharedValue(1)
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  // a long press tells the word of the icon even after the first-showing captions are gone
  const [tip, setTip] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  const showTip = () => {
    setTip(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setTip(false), 1600)
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPressIn={() => {
        scale.value = withSpring(0.9, amSpring.default)
      }}
      onPressOut={() => {
        scale.value = withSpring(1, amSpring.default)
      }}
      onPress={onPress}
      onLongPress={showTip}
      style={styles.tool}
    >
      <Animated.View style={[styles.iconBox, animated]}>{children}</Animated.View>
      {tip && !showCaption ? (
        <View style={[styles.tip, { backgroundColor: t.ink900 }]} pointerEvents="none">
          <Text style={[styles.tipText, { color: t.onInk }]} numberOfLines={1}>
            {caption}
          </Text>
        </View>
      ) : null}
      {showCaption ? (
        <Text style={[styles.caption, { color: t.ink800 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} aria-hidden>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  )
}

/** Saved: one tap puts the song in Mine and says so; a saved song opens the Save to sheet, to change or remove it. */
function SavedTool({ t, tr, model, captions }: { t: SpTheme; tr: PageT; model: SongPageModel; captions: boolean }) {
  const item = model.saveItem
  const { saved } = useSaveState(item)
  if (!item) return null
  const onPress = () => {
    if (saveTapPlan(saved) === "open-sheet") return openSaveSheet(item)
    void toggleMine(item).then((outcome) => {
      if (outcome.ok) return model.showToast(outcome.toast)
      if ("needsAuth" in outcome) return openSaveSheet(item)
      model.showToast(outcome.error)
    })
  }
  return (
    <Tool
      t={t}
      caption={tr(savedCaptionKey(saved))}
      showCaption={captions}
      label={tr(saved ? "songAct.saved.a11y.on" : "songAct.saved.a11y.off")}
      hint={tr("songAct.saved.help")}
      onPress={onPress}
    >
      <SaveMark on={saved} size={30} color={t.ink800} />
    </Tool>
  )
}

/** Download: the one download control of the app, with the word that follows its state. */
function DownloadTool({ t, tr, model, captions }: { t: SpTheme; tr: PageT; model: SongPageModel; captions: boolean }) {
  const { view } = useDownloadState(model.downloadItem)
  if (!view.visible) return null
  return (
    <View style={styles.tool}>
      <View style={styles.iconBox}>
        <DownloadButton item={model.downloadItem} size={26} hit={ICON_BOX} color={t.ink800} />
      </View>
      {captions ? (
        <Text style={[styles.caption, { color: t.ink800 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} aria-hidden>
          {tr(downloadCaptionKey(view.status), { percent: view.percent })}
        </Text>
      ) : null}
    </View>
  )
}

/**
 * The one row of actions of the song page: Saved, Download, Add to playlist, Share, More on the left, the big Play on
 * the right. Under each icon its word shows until the person has used the page once (stores/pageHintsStore.ts); the
 * meaning of each icon is in lib/songPage/actionLegend.ts. Save and Download are the app's own controls, so they look
 * and behave as everywhere else.
 */
export function ActionRow({ t, model, onLayout }: { t: SpTheme; model: SongPageModel; onLayout?: (event: LayoutChangeEvent) => void }) {
  const tr = usePageT()
  const accent = songAccents(t)
  const ready = useHintsReady()
  const seen = usePageHintsStore((s) => s.actionCaptionsSeen)
  const markSeen = usePageHintsStore((s) => s.markActionCaptionsSeen)
  const captions = ready && !seen
  // the captions teach the row once: leaving the page after seeing it ends them
  useEffect(() => {
    if (!captions) return undefined
    return () => markSeen()
  }, [captions, markSeen])
  return (
    <View style={styles.row} onLayout={onLayout}>
      <View style={[styles.tools, { alignItems: captions ? "flex-start" : "center" }]}>
        <SavedTool t={t} tr={tr} model={model} captions={captions} />
        <DownloadTool t={t} tr={tr} model={model} captions={captions} />
        <Tool t={t} caption={tr("songAct.playlist.caption")} showCaption={captions} label={tr("songAct.playlist.a11y")} hint={tr("songAct.playlist.help")} onPress={() => model.onAction("playlist")}>
          <SpIcon name="listPlus" size={26} color={t.ink800} />
        </Tool>
        <Tool t={t} caption={tr("songAct.share.caption")} showCaption={captions} label={tr("songAct.share.a11y")} hint={tr("songAct.share.help")} onPress={() => model.setSheet("share")}>
          <PlayerIcon name="share" size={25} color={t.ink800} />
        </Tool>
        <Tool t={t} caption={tr("songAct.more.caption")} showCaption={captions} label={tr("songAct.more.a11y")} hint={tr("songAct.more.help")} onPress={() => model.setSheet("actions")}>
          <PlayerIcon name="more" size={25} color={t.ink800} />
        </Tool>
      </View>
      <SpPress
        onPress={model.handlePlay}
        accessibilityLabel={model.showPause ? tr("songAct.pause") : tr("songAct.play")}
        pressedScale={0.94}
        style={[styles.play, { backgroundColor: accent.fill }]}
      >
        <SpIcon name={model.showPause ? "pause" : "play"} size={30} color={accent.onFill} />
      </SpPress>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 8, paddingRight: 20, paddingTop: 12 },
  tools: { flexDirection: "row", height: 64 },
  tool: { width: TOOL_W, alignItems: "center" },
  iconBox: { width: ICON_BOX, height: ICON_BOX, alignItems: "center", justifyContent: "center" },
  caption: { fontFamily: amFonts.semi, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 0 },
  tip: { position: "absolute", top: -26, alignSelf: "center", borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3, zIndex: 5 },
  tipText: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16 },
  play: { width: 56, height: 56, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
})
