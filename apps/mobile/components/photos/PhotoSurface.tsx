import { StyleSheet } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"

import type { StockPhoto } from "@/lib/photos/catalog"

/**
 * A stock photo that fills its parent, with the two layers that make text on top readable on any picture (docs/photo-system.md):
 * an optional colour wash (the colours of a kind) and a dark scrim over the lower part (`scrim` is its strength at the bottom edge, `mid` at the half). `small` loads the 480 px file.
 * Nothing here is pressable and nothing moves.
 */
export function PhotoSurface({ photo, small = true, wash, scrim = 0.72, mid = 0.55, washOpacity = 0.5 }: { photo: StockPhoto; small?: boolean; wash?: readonly [string, string]; scrim?: number; mid?: number; washOpacity?: number }) {
  return (
    <>
      <Image source={small ? photo.thumb : photo.cover} contentFit="cover" accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} />
      {wash ? <LinearGradient pointerEvents="none" colors={wash} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: washOpacity }]} /> : null}
      <LinearGradient pointerEvents="none" colors={["rgba(10,14,8,0.08)", `rgba(10,14,8,${Math.min(scrim, mid)})`, `rgba(10,14,8,${scrim})`]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
    </>
  )
}
