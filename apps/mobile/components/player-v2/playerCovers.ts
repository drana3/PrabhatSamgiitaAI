import type { ImageSourcePropType } from "react-native"

import { coverIdFor, type CoverId } from "@/lib/playerV2/coverTint"

/**
 * The six cover pictures (copies of the design prototype's image set, like the Home shelves use).
 * TODO(api): real covers come with the catalog.
 */
const COVERS: Record<CoverId, ImageSourcePropType> = {
  lake: require("../../assets/player-v2/cover-lake.jpg"),
  garland: require("../../assets/player-v2/cover-garland.jpg"),
  portrait: require("../../assets/player-v2/cover-portrait.jpg"),
  lotus: require("../../assets/player-v2/cover-lotus.jpg"),
  seated: require("../../assets/player-v2/cover-seated.jpg"),
  guitar: require("../../assets/player-v2/cover-guitar.jpg"),
}

/** Where to crop each picture so the face or figure stays in the frame. */
const FOCUS: Record<CoverId, { top: `${number}%`; left: `${number}%` }> = {
  lake: { top: "50%", left: "30%" },
  garland: { top: "18%", left: "50%" },
  portrait: { top: "30%", left: "50%" },
  lotus: { top: "50%", left: "62%" },
  seated: { top: "14%", left: "50%" },
  guitar: { top: "50%", left: "70%" },
}

export function coverFor(number: number): { source: ImageSourcePropType; position: { top: `${number}%`; left: `${number}%` } } {
  const id = coverIdFor(number)
  return { source: COVERS[id], position: FOCUS[id] }
}
