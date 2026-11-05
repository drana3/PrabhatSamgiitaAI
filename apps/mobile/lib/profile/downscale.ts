/** Longest side of a picture handed to the crop sheet. Enough to frame a 512 px avatar; a 48 MP photo is not. */
export const PHOTO_WORKING_SIDE = 2048

/**
 * The size to shrink a picture to before it is framed, keeping its proportions: `null` when it is
 * already small enough (nothing to do). The longer side becomes `maxSide`.
 */
export function workingSize(width: number, height: number, maxSide = PHOTO_WORKING_SIDE): { width: number; height: number } | null {
  if (!(width > 0) || !(height > 0)) return null
  const longest = Math.max(width, height)
  if (longest <= maxSide) return null
  const scale = maxSide / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
