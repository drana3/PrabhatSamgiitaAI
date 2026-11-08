import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BackHandler, Platform, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from "react-native"
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AccountButton, topInset } from "@/components/account/AccountUi"
import { AuthorPosterCard } from "@/components/share/AuthorPosterCard"
import { SharePosterCard } from "@/components/share/SharePosterCard"
import { Press } from "@/components/songs-v2/Press"
import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { copyText } from "@/lib/playerV2/playerActionsIO"
import { cardActions, cardFormatsFor, cardFileName, cardSize, type CardAction, type CardFormat, type CardSubject } from "@/lib/share/card"
import { useShareCardT, type ShareCardKey } from "@/lib/share/cardCopy"
import { canShareFileOnWeb, captureCard, saveCardImage, shareCardImage, type CardImage } from "@/lib/share/cardIO"

/** The stage is dark in both themes: a picture reads best against it (same as the photo crop sheet). */
const STAGE = "#14120F"
const WHITE = "#FFFFFF"
const MUTED = "rgba(255, 255, 255, 0.72)"
const EDGE = "rgba(255, 255, 255, 0.4)"
const REDUCED_MS = 150
const SIDE = 24

const ACTION_LABEL: Record<CardAction, ShareCardKey> = { share: "shareCard.share", save: "shareCard.save", copy: "shareCard.copy" }
const FORMAT_LABEL: Record<CardFormat, ShareCardKey> = { portrait: "shareCard.portrait", square: "shareCard.square", story: "shareCard.story" }

/**
 * Full-screen "Share card" step: the card as it will leave the app, in two shapes (1080 x 1350 and 1080 x 1080; an author page also in a third, 1080 x 1920 for Stories).
 * The picture is drawn once at full size out of sight, captured to a PNG, and sent: native shares the file through
 * the system sheet; the web saves it as a download (or shares it where the browser can) and copies the link.
 * Rises on a spring and leaves by the same path. Esc and the Android back button close it.
 */
/** The card of a subject: an author page has its own picture, a song and a Kiirtan share one. */
function Poster({ subject, format, scale, onSettled }: { subject: CardSubject; format: CardFormat; scale?: number; onSettled?: () => void }) {
  return subject.kind === "author" ? <AuthorPosterCard subject={subject} format={format} scale={scale} onSettled={onSettled} /> : <SharePosterCard subject={subject} format={format} scale={scale} onSettled={onSettled} />
}

export function ShareCardSheet({ subject, link, message, onClose }: { subject: CardSubject; link: string; message: string; onClose: () => void }) {
  const t = useShareCardT()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const reduce = useReducedMotion()

  const [format, setFormat] = useState<CardFormat>("portrait")
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const [settled, setSettled] = useState(false)
  const [image, setImage] = useState<{ format: CardFormat; value: CardImage } | null>(null)
  const [failed, setFailed] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const captureView = useRef<View>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closing = useRef(false)
  const rise = useSharedValue(windowHeight)

  const native = Platform.OS !== "web"
  const canShareFile = useMemo(() => canShareFileOnWeb(), [])
  const actions = cardActions({ native, canShareFile })
  const ready = image?.format === format

  const say = useCallback((text: string) => {
    setToast(text)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }, [])
  useEffect(() => () => void (toastTimer.current && clearTimeout(toastTimer.current)), [])

  // ---- enter and leave on one spring
  useEffect(() => {
    rise.value = reduce ? withTiming(0, { duration: REDUCED_MS }) : withSpring(0, amSpring.default)
  }, [reduce, rise])

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    cancelAnimation(rise)
    const finish = (done?: boolean) => {
      "worklet"
      if (done) runOnJS(onClose)()
    }
    rise.value = reduce ? withTiming(windowHeight, { duration: REDUCED_MS }, finish) : withSpring(windowHeight, amSpring.default, finish)
  }, [onClose, reduce, rise, windowHeight])

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close()
      return true
    })
    return () => sub.remove()
  }, [close])

  useEffect(() => {
    if (Platform.OS !== "web") return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [close])

  // ---- the picture: captured as soon as the card behind it has loaded, again when the shape changes, so a tap sends at once
  const capture = useCallback(async () => {
    const view = captureView.current
    if (!view) return null
    try {
      const value = await captureCard(view, format)
      setImage({ format, value })
      setFailed(false)
      return value
    } catch (error) {
      if (__DEV__) console.warn("[share-card] capture failed", error)
      setFailed(true)
      return null
    }
  }, [format])

  useEffect(() => {
    if (!settled) return
    // let the new shape lay out (and the fonts settle) before the picture is taken
    const timer = setTimeout(() => void capture(), 180)
    return () => clearTimeout(timer)
  }, [settled, format, capture])

  const onStageLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setStage((current) => (current.width === width && current.height === height ? current : { width, height }))
  }, [])

  const run = useCallback(
    async (action: CardAction) => {
      if (action === "copy") {
        say((await copyText(link)) ? t("shareCard.copied") : t("shareCard.copyFailed"))
        return
      }
      const picture = ready && image ? image.value : await capture()
      if (!picture) {
        say(t("shareCard.failed"))
        return
      }
      const fileName = cardFileName(subject, format)
      if (action === "save") {
        if (saveCardImage(picture, fileName)) say(t("shareCard.saved"))
        return
      }
      try {
        const outcome = await shareCardImage(picture, fileName, message)
        if (outcome === "unsupported") say(t("shareCard.unsupported"))
      } catch {
        say(t("shareCard.failed"))
      }
    },
    [capture, format, image, link, message, ready, say, subject, t],
  )

  const { width: cardW, height: cardH } = cardSize(format)
  const fit = stage.width > 0 && stage.height > 0 ? Math.min((stage.width - SIDE * 2) / cardW, (stage.height - 16) / cardH) : 0
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value }] }))

  return (
    <Animated.View style={[styles.root, sheetStyle]} accessibilityViewIsModal testID="share-card-sheet">
      {/* the card at its real size, first in the stack and covered by the opaque bars and stage on top, so it is on screen for the capture but never seen: this is what is captured */}
      <View
        ref={captureView}
        collapsable={false}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[styles.hidden, { width: cardW, height: cardH }]}
      >
        <Poster subject={subject} format={format} onSettled={() => setSettled(true)} />
      </View>

      <View style={[styles.top, { paddingTop: topInset(insets.top) + 8 }]}>
        <Press accessibilityRole="button" accessibilityLabel={t("shareCard.close")} onPress={close} pressedScale={0.96} style={styles.closeBtn}>
          <Text style={styles.closeText}>{t("shareCard.close")}</Text>
        </Press>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {t("shareCard.title")}
        </Text>
        <View style={styles.closeBtn} />
      </View>

      <View style={styles.stage} onLayout={onStageLayout}>
        {fit > 0 ? <Poster subject={subject} format={format} scale={fit} /> : null}
      </View>

      <View style={styles.controls}>
        <View style={styles.formats} accessibilityRole="radiogroup" accessibilityLabel={t("shareCard.shape")}>
          {cardFormatsFor(subject).map((f) => {
            const on = f.id === format
            return (
              <Press
                key={f.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t(FORMAT_LABEL[f.id])}
                onPress={() => setFormat(f.id)}
                pressedScale={0.96}
                style={[styles.formatPill, on ? styles.formatOn : styles.formatOff]}
              >
                <Text style={[styles.formatText, { color: WHITE }]}>{t(FORMAT_LABEL[f.id])}</Text>
              </Press>
            )
          })}
        </View>
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          {toast ?? (failed ? t("shareCard.failed") : !ready ? t("shareCard.preparing") : native ? t("shareCard.hintNative") : t("shareCard.hintWeb"))}
        </Text>
        <View style={[styles.actions, { paddingBottom: Platform.OS === "web" ? 20 : Math.max(insets.bottom, 12) + 8 }]}>
          {actions.map((action, i) => (
            <AccountButton
              key={action}
              theme={theme}
              tone={i === 0 ? "brand" : "white"}
              label={t(ACTION_LABEL[action])}
              onPress={() => void run(action)}
              disabled={action !== "copy" && !ready && !failed}
              style={styles.action}
            />
          ))}
        </View>
      </View>

    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 60, backgroundColor: STAGE, overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8, backgroundColor: STAGE },
  closeBtn: { minWidth: 72, minHeight: 44, justifyContent: "center" },
  closeText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 22, color: WHITE },
  title: { flex: 1, textAlign: "center", fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22, color: WHITE },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: STAGE },
  controls: { gap: 12, paddingTop: 12, paddingHorizontal: 16, backgroundColor: STAGE },
  formats: { flexDirection: "row", justifyContent: "center", gap: 8 },
  formatPill: { minHeight: 44, minWidth: 96, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  formatOn: { backgroundColor: "rgba(255, 255, 255, 0.2)", borderColor: WHITE },
  formatOff: { backgroundColor: "transparent", borderColor: EDGE },
  formatText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  hint: { textAlign: "center", fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, color: MUTED, minHeight: 20 },
  actions: { gap: 10, paddingTop: 4 },
  action: { alignSelf: "stretch" },
  hidden: { position: "absolute", left: 0, top: 0 },
})
