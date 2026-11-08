/**
 * Binds the photographs of Baba to their files. Metadata and the rule are in lib/photos/babaData.ts: nothing is
 * drawn over these pictures, so they are shown only by components/common/BabaPhoto.
 */

import type { ImageSourcePropType } from "react-native"

import { BABA_GEOMETRY, type BabaPhotoGeometry, type BabaPhotoId } from "@/lib/photos/babaData"

export { cropFits, type BabaPhotoId } from "@/lib/photos/babaData"

export type BabaPhotoMeta = BabaPhotoGeometry & { source: ImageSourcePropType }

export const BABA_PHOTOS: Record<BabaPhotoId, BabaPhotoMeta> = {
  today: { ...BABA_GEOMETRY.today, source: require("../../assets/today-hero.jpg") },
  quote: { ...BABA_GEOMETRY.quote, source: require("../../assets/guru-quote.webp") },
}
