import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Play, Square } from "lucide-react-native"

import { PhotoSurface } from "@/components/photos/PhotoSurface"
import { KPress } from "@/components/kirtan/KPress"
import { amColors, amPhotoChip } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useBlocksT } from "@/lib/kirtan/blocksCopy"
import { photoForSeed } from "@/lib/photos/catalog"
import { broadcastPhotoMood, broadcastPhotoSeed } from "@/lib/photos/defaultPhoto"

/**
 * Our live broadcasts are AUDIO only (Dada, 13 Nov 2026), so the player of a broadcast never shows a picture of a video. It shows a
 * photo from the app's own library, the same one the broadcast has on its tile (chosen by its id), with one round button:
 * Listen / Stop. The site's own embed (the only thing that can play the stream) is mounted ONLY while listening, under the photo,
 * fully transparent and out of reach of a touch: its sound plays, its picture is never seen. Stop unmounts it, which ends the sound.
 */
export function AudioOnlyStage({
  seed,
  title,
  width,
  height,
  radius,
  listening,
  onToggle,
  children,
}: {
  /** the broadcast's (or recording's) id: it picks the photo */
  seed: string
  title: string
  width: number
  height: number
  radius: number
  listening: boolean
  onToggle: () => void
  /** the embed; drawn only while `listening` */
  children?: ReactNode
}) {
  const t = useBlocksT()
  const photo = photoForSeed(broadcastPhotoSeed(seed), broadcastPhotoMood(title), { size: "small" })
  const label = listening ? t("kb.audio.stop") : t("kb.audio.listen")
  return (
    <View style={[s.box, { width, height, borderRadius: radius }]}>
      {listening ? (
        <View style={[s.hidden, { width, height }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {children}
        </View>
      ) : null}
      <PhotoSurface photo={photo} small={width <= 240} scrim={0.55} />
      <View style={s.chip}>
        <Text style={s.chipText}>{t("kb.audio.only")}</Text>
      </View>
      <View style={s.center} pointerEvents="box-none">
        <KPress accessibilityRole="button" accessibilityLabel={`${label}: ${title}`} accessibilityState={{ selected: listening }} onActivate={onToggle} pressedScale={0.94} style={s.button}>
          {listening ? <Square size={24} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} /> : <Play size={28} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />}
        </KPress>
        <Text style={s.label}>{label}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  box: { overflow: "hidden", backgroundColor: "#0A0E08" },
  hidden: { position: "absolute", left: 0, top: 0, opacity: 0 },
  chip: { position: "absolute", left: 12, top: 12, height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: amPhotoChip.glass.bg, justifyContent: "center" },
  chipText: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 15, letterSpacing: 0.6, color: amPhotoChip.glass.fg, textTransform: "uppercase" },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 8 },
  button: { width: 64, height: 64, borderRadius: 32, backgroundColor: amColors.orange700, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20, color: "#FFFFFF" },
})
