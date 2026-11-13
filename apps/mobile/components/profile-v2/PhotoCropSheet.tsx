import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BackHandler, Platform, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Image } from "expo-image"
import Svg, { Circle, Path } from "react-native-svg"

import { AccountButton, topInset } from "@/components/account/AccountUi"
import { Press } from "@/components/songs-v2/Press"
import { amSpring, projectMomentum } from "@/constants/tokens/amMotion"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import {
  ZOOM_STEP,
  clampOffset,
  clampScale,
  clampState,
  cropRect,
  defaultCrop,
  minScale,
  offsetLimits,
  softOffset,
  softScale,
  windowDiameter,
  zoomTo,
  type CropRect,
} from "@/lib/profile/crop"
import { useCropT } from "@/lib/profile/cropCopy"
import type { PickedImage } from "@/lib/profile/photo"

/** The stage is dark in both themes: a picture reads best against it. */
const STAGE = "#14120F"
const SCRIM = "rgba(20, 18, 15, 0.62)"
const WHITE = "#FFFFFF"
const MUTED = "rgba(255, 255, 255, 0.72)"
const RING = "rgba(255, 255, 255, 0.92)"
const REDUCED_MS = 150

/**
 * Full-screen step after a picture is chosen: the person moves and zooms it behind a round window until the
 * face sits where they want it; Done cuts that square out. One finger drags, two fingers pinch (and drag);
 * on the web the mouse drags and the wheel zooms. Past an edge the picture meets a rubber band and the window
 * is always fully covered. Every move is a spring from the value on screen, so it can be interrupted at any time.
 * The maths is in lib/profile/crop.ts.
 */
export function PhotoCropSheet({
  image,
  theme,
  onCancel,
  onDone,
}: {
  image: PickedImage
  theme: SongsTheme
  onCancel: () => void
  onDone: (rect: CropRect, image: PickedImage) => void
}) {
  const t = useCropT()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const reduce = useReducedMotion()

  const [size, setSize] = useState({ width: image.width, height: image.height })
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const diameter = stage.width > 0 ? windowDiameter(stage.width, stage.height) : 0

  // shared values the gestures read on the UI thread
  const imgW = useSharedValue(image.width)
  const imgH = useSharedValue(image.height)
  const diam = useSharedValue(0)
  const centerX = useSharedValue(0)
  const centerY = useSharedValue(0)
  const base = useSharedValue(1)
  const scale = useSharedValue(1)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const startScale = useSharedValue(1)
  const startFocalX = useSharedValue(0)
  const startFocalY = useSharedValue(0)
  const pinching = useSharedValue(0)
  const rise = useSharedValue(windowHeight)

  const stageRef = useRef<View>(null)
  const closing = useRef(false)

  // Enter: the sheet rises from the bottom on one spring; leaving is the same path back.
  useEffect(() => {
    rise.value = reduce ? withTiming(0, { duration: REDUCED_MS }) : withSpring(0, amSpring.default)
  }, [reduce, rise])

  const leave = useCallback(
    (after: () => void) => {
      if (closing.current) return
      closing.current = true
      cancelAnimation(rise)
      const finish = (finished?: boolean) => {
        "worklet"
        if (finished) runOnJS(after)()
      }
      rise.value = reduce
        ? withTiming(windowHeight, { duration: REDUCED_MS }, finish)
        : withSpring(windowHeight, amSpring.default, finish)
    },
    [reduce, rise, windowHeight],
  )

  const cancel = useCallback(() => leave(onCancel), [leave, onCancel])

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      cancel()
      return true
    })
    return () => sub.remove()
  }, [cancel])

  useEffect(() => {
    if (Platform.OS !== "web") return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [cancel])

  // The picker's size is used first; the decoded picture has the last word (a phone's EXIF turn).
  const onImageLoad = useCallback((event: { source: { width: number; height: number } }) => {
    const { width, height } = event.source
    if (width > 0 && height > 0) setSize((current) => (current.width === width && current.height === height ? current : { width, height }))
  }, [])

  const settle = useCallback(
    (next: { scale: number; x: number; y: number }, spring: object = amSpring.default) => {
      if (reduce) {
        scale.value = withTiming(next.scale, { duration: REDUCED_MS })
        tx.value = withTiming(next.x, { duration: REDUCED_MS })
        ty.value = withTiming(next.y, { duration: REDUCED_MS })
        return
      }
      scale.value = withSpring(next.scale, spring)
      tx.value = withSpring(next.x, spring)
      ty.value = withSpring(next.y, spring)
    },
    [reduce, scale, tx, ty],
  )

  // Open (and reopen on a new size) in the default framing.
  useEffect(() => {
    if (diameter <= 0) return
    cancelAnimation(scale)
    cancelAnimation(tx)
    cancelAnimation(ty)
    imgW.value = size.width
    imgH.value = size.height
    diam.value = diameter
    centerX.value = stage.width / 2
    centerY.value = stage.height / 2
    base.value = minScale(size, diameter)
    const start = defaultCrop(size, diameter)
    scale.value = start.scale
    tx.value = start.x
    ty.value = start.y
  }, [base, centerX, centerY, diam, diameter, imgH, imgW, scale, size, stage.height, stage.width, tx, ty])

  const onStageLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setStage((current) => (current.width === width && current.height === height ? current : { width, height }))
  }, [])

  const current = useCallback(() => ({ scale: scale.value, x: tx.value, y: ty.value }), [scale, tx, ty])

  const reset = useCallback(() => {
    if (diameter <= 0) return
    cancelAnimation(scale)
    cancelAnimation(tx)
    cancelAnimation(ty)
    settle(defaultCrop(size, diameter))
  }, [diameter, scale, settle, size, tx, ty])

  const zoomBy = useCallback(
    (factor: number) => {
      if (diameter <= 0) return
      cancelAnimation(scale)
      cancelAnimation(tx)
      cancelAnimation(ty)
      const from = current()
      settle(zoomTo(from, from.scale * factor, { x: 0, y: 0 }, size, diameter))
    },
    [current, diameter, scale, settle, size, tx, ty],
  )

  const done = useCallback(() => {
    if (diameter <= 0 || closing.current) return
    const rect = cropRect(current(), size, diameter)
    leave(() => onDone(rect, { uri: image.uri, width: size.width, height: size.height }))
  }, [current, diameter, image.uri, leave, onDone, size])

  // Web: the wheel zooms around the pointer (a trackpad pinch arrives as ctrl + wheel).
  useEffect(() => {
    if (Platform.OS !== "web" || diameter <= 0) return
    const node = stageRef.current as unknown as HTMLElement | null
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      cancelAnimation(scale)
      cancelAnimation(tx)
      cancelAnimation(ty)
      const box = node.getBoundingClientRect()
      const focal = { x: event.clientX - box.left - box.width / 2, y: event.clientY - box.top - box.height / 2 }
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      const factor = Math.exp(-delta * (event.ctrlKey ? 0.012 : 0.002))
      const next = zoomTo({ scale: scale.value, x: tx.value, y: ty.value }, scale.value * factor, focal, size, diameter)
      scale.value = next.scale
      tx.value = next.x
      ty.value = next.y
    }
    node.addEventListener("wheel", onWheel, { passive: false })
    return () => node.removeEventListener("wheel", onWheel)
  }, [diameter, scale, size, tx, ty])

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .maxPointers(1)
      .minDistance(1)
      .onBegin(() => {
        cancelAnimation(tx)
        cancelAnimation(ty)
        startX.value = tx.value
        startY.value = ty.value
      })
      .onUpdate((event) => {
        const img = { width: imgW.value, height: imgH.value }
        const limit = offsetLimits(img, diam.value, scale.value)
        tx.value = softOffset(startX.value + event.translationX, limit.x, diam.value)
        ty.value = softOffset(startY.value + event.translationY, limit.y, diam.value)
      })
      .onEnd((event) => {
        if (pinching.value) return
        const img = { width: imgW.value, height: imgH.value }
        const limit = offsetLimits(img, diam.value, scale.value)
        // land where the throw would carry it, held inside the window's limits
        const targetX = clampOffset(projectMomentum(tx.value, event.velocityX), limit.x)
        const targetY = clampOffset(projectMomentum(ty.value, event.velocityY), limit.y)
        const fast = Math.abs(event.velocityX) > 250 || Math.abs(event.velocityY) > 250
        const config = fast ? amSpring.fling : amSpring.default
        tx.value = withSpring(targetX, { ...config, velocity: event.velocityX })
        ty.value = withSpring(targetY, { ...config, velocity: event.velocityY })
      })

    const pinch = Gesture.Pinch()
      .onBegin((event) => {
        cancelAnimation(scale)
        cancelAnimation(tx)
        cancelAnimation(ty)
        pinching.value = 1
        startScale.value = scale.value
        startX.value = tx.value
        startY.value = ty.value
        startFocalX.value = event.focalX - centerX.value
        startFocalY.value = event.focalY - centerY.value
      })
      .onUpdate((event) => {
        const img = { width: imgW.value, height: imgH.value }
        const next = softScale(startScale.value * event.scale, img, diam.value)
        const ratio = next / startScale.value
        // the picture point that was under the fingers stays under them, wherever they have moved
        const fx = event.focalX - centerX.value
        const fy = event.focalY - centerY.value
        const limit = offsetLimits(img, diam.value, next)
        scale.value = next
        tx.value = softOffset(fx - (startFocalX.value - startX.value) * ratio, limit.x, diam.value)
        ty.value = softOffset(fy - (startFocalY.value - startY.value) * ratio, limit.y, diam.value)
      })
      .onFinalize(() => {
        pinching.value = 0
        const img = { width: imgW.value, height: imgH.value }
        const target = clampState({ scale: scale.value, x: tx.value, y: ty.value }, img, diam.value)
        scale.value = withSpring(target.scale, amSpring.default)
        tx.value = withSpring(target.x, amSpring.default)
        ty.value = withSpring(target.y, amSpring.default)
      })

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((event, success) => {
        if (!success) return
        const img = { width: imgW.value, height: imgH.value }
        const smallest = minScale(img, diam.value)
        const zoomedIn = scale.value > smallest * 1.15
        const next = zoomedIn
          ? defaultCrop(img, diam.value)
          : zoomTo(
              { scale: scale.value, x: tx.value, y: ty.value },
              smallest * 2.2,
              { x: event.x - centerX.value, y: event.y - centerY.value },
              img,
              diam.value,
            )
        scale.value = withSpring(next.scale, amSpring.default)
        tx.value = withSpring(next.x, amSpring.default)
        ty.value = withSpring(next.y, amSpring.default)
      })

    return Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pan, pinch))
  }, [centerX, centerY, diam, imgH, imgW, pinching, scale, startFocalX, startFocalY, startScale, startX, startY, tx, ty])

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: base.value > 0 ? scale.value / base.value : 1 }],
  }))
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value }] }))

  const shown = diameter > 0 ? { width: size.width * minScale(size, diameter), height: size.height * minScale(size, diameter) } : { width: 0, height: 0 }
  const cx = stage.width / 2
  const cy = stage.height / 2
  const r = diameter / 2
  // the scrim is the stage minus the round window
  const scrim =
    diameter > 0
      ? `M0 0H${stage.width}V${stage.height}H0Z M${cx - r} ${cy}a${r} ${r} 0 1 0 ${diameter} 0a${r} ${r} 0 1 0 ${-diameter} 0Z`
      : ""

  return (
    <Animated.View style={[styles.root, sheetStyle]} accessibilityViewIsModal>
      <View style={[styles.top, { paddingTop: topInset(insets.top) + 8 }]}>
        <Press accessibilityRole="button" accessibilityLabel={t("photoCrop.cancel")} onPress={cancel} pressedScale={0.96} style={styles.cancel}>
          <Text style={styles.cancelText}>{t("photoCrop.cancel")}</Text>
        </Press>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {t("photoCrop.title")}
        </Text>
        <View style={styles.cancel} />
      </View>

      <View ref={stageRef} style={styles.stage}>
        <GestureDetector gesture={gesture}>
          <View style={styles.fillAll} onLayout={onStageLayout} accessible accessibilityLabel={t("photoCrop.area")} testID="photo-crop-stage">
            {diameter > 0 ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.picture,
                  { width: shown.width, height: shown.height, left: (stage.width - shown.width) / 2, top: (stage.height - shown.height) / 2 },
                  imageStyle,
                ]}
              >
                <Image source={{ uri: image.uri }} contentFit="fill" accessibilityIgnoresInvertColors onLoad={onImageLoad} style={styles.fill} />
              </Animated.View>
            ) : null}
            {diameter > 0 ? (
              <Svg pointerEvents="none" width={stage.width} height={stage.height} style={StyleSheet.absoluteFill}>
                <Path d={scrim} fill={SCRIM} fillRule="evenodd" />
                <Circle cx={cx} cy={cy} r={r} fill="none" stroke={RING} strokeWidth={2} />
              </Svg>
            ) : null}
          </View>
        </GestureDetector>
      </View>

      <View style={styles.controls}>
        <Text style={styles.hint}>{t("photoCrop.hint")}</Text>
        <View style={styles.zoomRow}>
          <Press accessibilityRole="button" accessibilityLabel={t("photoCrop.zoomOut")} onPress={() => zoomBy(1 / ZOOM_STEP)} pressedScale={0.92} style={styles.zoomBtn}>
            <Text style={styles.zoomGlyph}>{"−"}</Text>
          </Press>
          <Press accessibilityRole="button" accessibilityLabel={t("photoCrop.zoomIn")} onPress={() => zoomBy(ZOOM_STEP)} pressedScale={0.92} style={styles.zoomBtn}>
            <Text style={styles.zoomGlyph}>+</Text>
          </Press>
        </View>
        <View style={[styles.actions, { paddingBottom: Platform.OS === "web" ? 20 : Math.max(insets.bottom, 12) + 8 }]}>
          <AccountButton theme={theme} tone="white" label={t("photoCrop.reset")} onPress={reset} style={styles.action} />
          <AccountButton theme={theme} label={t("photoCrop.done")} onPress={done} style={styles.action} />
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 50, backgroundColor: STAGE },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 },
  cancel: { minWidth: 72, minHeight: 44, justifyContent: "center" },
  cancelText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 22, color: WHITE },
  title: { flex: 1, textAlign: "center", fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22, color: WHITE },
  stage: { flex: 1, overflow: "hidden", ...(Platform.OS === "web" ? ({ touchAction: "none", userSelect: "none", cursor: "grab" } as object) : null) },
  fillAll: { flex: 1 },
  picture: { position: "absolute" },
  fill: { width: "100%", height: "100%" },
  controls: { gap: 12, paddingTop: 12, paddingHorizontal: 16 },
  hint: { textAlign: "center", fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, color: MUTED },
  zoomRow: { flexDirection: "row", justifyContent: "center", gap: 16 },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomGlyph: { fontFamily: amFonts.semi, fontSize: 24, lineHeight: 28, color: WHITE },
  actions: { flexDirection: "row", gap: 12, paddingTop: 4 },
  action: { flex: 1 },
})
