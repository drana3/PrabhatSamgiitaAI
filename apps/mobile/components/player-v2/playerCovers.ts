import type { ImageSourcePropType } from "react-native"

import { coverIdFor, type CoverId } from "@/lib/playerV2/coverTint"

/**
 * The six cover pictures, the same files the Home shelves use (components/home/homeCovers.ts): no Baba
 * in any of them, since titles and chips sit over covers. The ids stay the prototype's.
 * TODO(api): real covers come with the catalog.
 */
const COVERS: Record<CoverId, ImageSourcePropType> = {
  lake: require("../../assets/home/lake.jpg"),
  garland: require("../../assets/home/cover-sunrise.jpg"),
  portrait: require("../../assets/home/cover-mist.jpg"),
  lotus: require("../../assets/home/lotus.jpg"),
  seated: require("../../assets/home/cover-forest.jpg"),
  guitar: require("../../assets/home/cover-dunes.jpg"),
}

/** Where to crop each picture so the face or figure stays in the frame. */
const FOCUS: Record<CoverId, { top: `${number}%`; left: `${number}%` }> = {
  lake: { top: "50%", left: "30%" },
  garland: { top: "50%", left: "50%" },
  portrait: { top: "50%", left: "50%" },
  lotus: { top: "50%", left: "62%" },
  seated: { top: "50%", left: "50%" },
  guitar: { top: "50%", left: "50%" },
}

export function coverFor(number: number): { source: ImageSourcePropType; position: { top: `${number}%`; left: `${number}%` } } {
  const id = coverIdFor(number)
  return { source: COVERS[id], position: FOCUS[id] }
}
