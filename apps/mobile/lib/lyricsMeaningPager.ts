export type UnderstandMode = "lyrics" | "meaning"

export function lyricsMeaningOffset(mode: UnderstandMode, pageWidth: number) {
  if (pageWidth <= 0) return 0
  return mode === "meaning" ? -pageWidth : 0
}

/** Snap after a horizontal drag. velocityX is points/sec from the pan gesture. */
export function lyricsMeaningModeFromGesture(
  offset: number,
  pageWidth: number,
  velocityX: number,
): UnderstandMode {
  if (pageWidth <= 0) return "lyrics"
  const projected = offset + Math.max(-pageWidth, Math.min(pageWidth, velocityX * 0.08))
  return projected < -pageWidth / 2 ? "meaning" : "lyrics"
}
