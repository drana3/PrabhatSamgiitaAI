import { STOCK_PHOTO_META, type PhotoSource } from "@/lib/photos/photoData"

/** One line of the About / Credits screen. Unsplash: credit appreciated, not required. Ananda Marga: credit line required. */
export type PhotoCredit = {
  n: number
  title: string
  source: PhotoSource
  photographer: string
  /** ready-to-show credit line */
  credit: string
  pageUrl: string
  license: string
  licenseNote: string
}

export const STOCK_PHOTO_CREDITS: readonly PhotoCredit[] = STOCK_PHOTO_META.map((p) => ({
  n: p.n,
  title: p.title,
  source: p.source,
  photographer: p.photographer,
  credit: p.credit,
  pageUrl: p.pageUrl,
  license: p.license,
  licenseNote: p.licenseNote,
}))
