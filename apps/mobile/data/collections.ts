import rawCollections from "../../../data/generated/theme_collections.json"

export type CollectionItem = {
  label: string
  category: "language" | "theme" | "festival" | "occasion" | "season" | string
  value: string
  count: number
  songNumbers: number[]
  sourceUrl?: string
}

export type CollectionGroup = {
  id: string
  title: string
  description: string
  items: CollectionItem[]
}

const categoryMeta: Record<string, { title: string; description: string; order: number }> = {
  language: {
    title: "Languages",
    description: "Find songs by original language or dialect.",
    order: 1,
  },
  festival: {
    title: "Festivals",
    description: "Music for annual celebrations and remembrance.",
    order: 2,
  },
  occasion: {
    title: "Life occasions",
    description: "Ceremonies, service days, and meaningful transitions.",
    order: 3,
  },
  season: {
    title: "Seasons & earth",
    description: "Follow the natural year and land.",
    order: 4,
  },
  theme: {
    title: "Themes & ideals",
    description: "Devotion, nature, ideals, stories, and rare musical forms.",
    order: 5,
  },
}

const hiddenCollectionLabels = new Set(["Bengali Dialect Songs"])

export const allCollections: CollectionItem[] = (rawCollections as Array<{
  label: string
  category: string
  value: string
  count: number
  song_numbers?: number[]
  source_url?: string
}>)
  .filter((row) => !hiddenCollectionLabels.has(row.label))
  .map((row) => ({
    label: row.label,
    category: row.category,
    value: row.value,
    count: row.count,
    songNumbers: Array.isArray(row.song_numbers)
      ? row.song_numbers.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : [],
    sourceUrl: row.source_url,
  }))

export const collectionCount = allCollections.length

export const collectionGroups: CollectionGroup[] = Object.entries(
  allCollections.reduce<Record<string, CollectionItem[]>>((acc, item) => {
    acc[item.category] = acc[item.category] ?? []
    acc[item.category].push(item)
    return acc
  }, {}),
)
  .map(([category, items]) => {
    const meta = categoryMeta[category] ?? {
      title: category,
      description: "Curated Prabhat Samgiita collections.",
      order: 99,
    }
    return {
      id: category,
      title: meta.title,
      description: meta.description,
      items: [...items].sort((a, b) => a.label.localeCompare(b.label)),
      order: meta.order,
    }
  })
  .sort((a, b) => a.order - b.order)
  .map(({ order: _order, ...group }) => group)

/** Featured strip on Home — a calm, high-signal subset. */
export const featuredCollections = [
  "Bábá Birthday Songs",
  "New Year Songs",
  "Dipavali (Colour Festival) Day Songs",
  "Spring Songs",
  "Rainy Season Songs",
  "Neo-Humanism Songs",
  "Children Songs",
  "Sanskrit Songs",
]
  .map((label) => allCollections.find((item) => item.label === label))
  .filter((item): item is CollectionItem => Boolean(item))

export function collectionSearchPrompt(label: string) {
  return `Search Prabhat Samgiita for ${label}`
}
