import { collectionPrompt } from "@/lib/special-collections"

/** Canonical theme collection labels (aligned with apps/api domain_catalog.py). */
const REVIEWED_FESTIVAL_COLLECTION_BY_DATE: Record<string, string> = {
  "4-14": "New Year Songs",
  "5-1": "Bábá Birthday Songs",
  "6-5": "PROUT Song",
  "8-28": "Shravanii Purnima Day Song",
  "10-8": "Classicalised kiirtan-style song",
  "10-16": "Children Songs",
  "10-17": "National Day Song (or Song of Love for one's Country)",
  "10-20": "Victory Day Song",
  "11-8": "Dipavali (Colour Festival) Day Songs",
}

const FESTIVAL_NAME_TO_COLLECTION: Record<string, string> = {
  "Victory Day": "Victory Day Song",
  "New Year": "New Year Songs",
  "Bábá Birthday": "Bábá Birthday Songs",
  "Shravanii Purnima Day": "Shravanii Purnima Day Song",
  "Dipavali (Colour Festival) Day": "Dipavali (Colour Festival) Day Songs",
}

const THEME_TO_COLLECTION: Record<string, string> = {
  Children: "Children Songs",
  PROUT: "PROUT Song",
}

export function festivalExploreQuery(input: {
  month: number
  day: number
  title: string
  festival?: string
  theme?: string
  collectionLabel?: string
}) {
  const explicit = input.collectionLabel?.trim()
  if (explicit) return collectionPrompt(explicit)

  const byDate = REVIEWED_FESTIVAL_COLLECTION_BY_DATE[`${input.month}-${input.day}`]
  if (byDate) return collectionPrompt(byDate)

  if (input.festival) {
    const fromFestival = FESTIVAL_NAME_TO_COLLECTION[input.festival]
    if (fromFestival) return collectionPrompt(fromFestival)
  }

  if (input.theme) {
    const fromTheme = THEME_TO_COLLECTION[input.theme]
    if (fromTheme) return collectionPrompt(fromTheme)
  }

  return collectionPrompt(input.title)
}
