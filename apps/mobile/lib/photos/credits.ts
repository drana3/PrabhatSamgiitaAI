import { STOCK_PHOTO_META } from "@/lib/photos/photoData"

/** One line of the About / Credits screen. Unsplash License: credit is appreciated, not required. */
export type PhotoCredit = {
  n: number
  title: string
  photographer: string
  pageUrl: string
  license: "Unsplash License"
}

export const STOCK_PHOTO_CREDITS: readonly PhotoCredit[] = STOCK_PHOTO_META.map((p) => ({
  n: p.n,
  title: p.title,
  photographer: p.photographer,
  pageUrl: p.pageUrl,
  license: p.license,
}))
