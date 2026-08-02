import canonicalCollections from "../../../data/generated/theme_collections.json"

export type SpecialCollection = {
  label: string
  query: string
  count: number
}

export type SpecialCollectionGroup = {
  title: string
  description: string
  collections: SpecialCollection[]
}

type CanonicalCollection = {
  label: string
  category: string
  value: string
  count: number
  song_numbers: number[]
}

type CollectionRef =
  | { canonicalLabel: string; displayLabel?: string }
  | { displayLabel: string; query: string; sourceLabels: string[] }

type GroupDefinition = {
  title: string
  description: string
  collections: CollectionRef[]
}

const canonicalByLabel = new Map(
  (canonicalCollections as CanonicalCollection[]).map((row) => [row.label, row]),
)

const displayLabelOverrides: Record<string, string> = {
  "Sanskrit Songs": "Sanskrit",
  "English Songs": "English",
  "Hindi Songs": "Hindi",
  "Urdu Songs": "Urdu",
  "Aungika Songs": "Aungika",
  "Maethili Song": "Maithili",
  "Bengali Dialect Songs": "Bengali dialects",
  "Shiva Songs": "Shiva",
  "Krśńa Songs": "Krśńa",
  "Krśńa and Devotees Songs": "Krśńa and devotees",
  "Mahabharata Song": "Mahabharata",
  "Bábá Birthday Songs": "Bábá birthday",
  "New Year Songs": "New Year",
  "Year-end Song": "Year-end",
  "Dipavali (Colour Festival) Day Songs": "Dipavali",
  "Shravanii Purnima Day Song": "Shravanii Purnima",
  "Victory Day Song": "Victory Day",
  "National Day Song (or Song of Love for one's Country)": "National Day",
  "Baby Naming Ceremony Song": "Baby naming",
  "Marriage Ceremony Song": "Marriage",
  "Passing Away Ceremony Song": "Passing away",
  "House Warming Ceremony Song": "House warming",
  "Tree Planting Ceremony Song": "Tree planting",
  "Dharma Song": "Dharma",
  "PROUT Song": "PROUT",
  "Neo-Humanism Songs": "Neo-Humanism",
  "AMURT Song": "AMURT",
  "Flag Ceremony Song": "Flag ceremony",
  "Marching Song": "Marching",
  "VSS Song": "VSS",
  "Gurukula Song": "Gurukula",
  "Ánanda Nagar Song": "Ánanda Nagar",
  "Guru Sakasha Song": "Guru Sakasha",
  "Spring Songs": "Spring",
  "Summer Songs": "Summer",
  "Autumn Songs (Sharat)": "Autumn: Sharat",
  "Autumn Songs (Hemante)": "Autumn: Hemante",
  "Winter Songs": "Winter",
  "Rainy Season Songs": "Rainy season",
  "Dry Season Songs": "Dry season",
  "Songs to Attract Rain / Draught Songs / Farmer's Songs": "Rain, drought, and farmers",
  "Children Songs": "Children",
  "Songs based on the Fairy Tale \"The Golden Lotus of the Blue Sea\"": "The Golden Lotus of the Blue Sea",
  "Songs based on the Folk Tale \"Sat Bhai Chompa\" (The Seven Magnolia Brothers)": "Sat Bhai Chompa",
  "Women Songs": "Women",
  "Song for those approaching the end of their life": "Approaching the end of life",
  "Songs in memory of one's family members": "In memory of family",
  "Song with sanyasii spirit": "Sanyasii spirit",
  "Sinners Song": "Sinners",
  "Song in memory of Lord Buddha": "Lord Buddha",
  "Songs in memory of Rabindranath Tagore": "Rabindranath Tagore",
  "Song in memory of Avtk. Ananda Bharati Ac.": "Avtk. Ananda Bharati Ac.",
  "Song in memory of the musician Suradas": "Musician Suradas",
  "Himalaya Songs": "Himalaya",
  "River Songs": "Rivers",
  "Song for a Dust Particle": "A dust particle",
  "Song for a Dewdrop": "A dewdrop",
  "Taj Mahal Song": "Taj Mahal",
  "End of Communism Song": "End of Communism",
  "Chinese-tune Song": "Chinese tune",
  "Chinese-European blending-tune Song": "Chinese-European blend",
  "Scandinavian-tune Song": "Scandinavian tune",
  "Belgium-tune Song": "Belgium tune",
  "Turkish-tune Song": "Turkish tune",
  "Songs containing 'extinct' melodies": "Extinct melodies",
  "Songs composed in Baba's youth": "Composed in Bábá's youth",
  "Song with a very rare verse form": "Rare verse form",
  "Classicalised kiirtan-style song": "Classicalised kiirtan style",
}

function compositeCount(sourceLabels: string[]): number {
  const numbers = new Set<number>()
  for (const label of sourceLabels) {
    for (const number of canonicalByLabel.get(label)?.song_numbers ?? []) {
      numbers.add(number)
    }
  }
  return numbers.size
}

function resolveCollection(ref: CollectionRef): SpecialCollection {
  if ("canonicalLabel" in ref) {
    const row = canonicalByLabel.get(ref.canonicalLabel)
    if (!row) {
      throw new Error(`Missing canonical collection: ${ref.canonicalLabel}`)
    }
    return {
      label: ref.displayLabel ?? displayLabelOverrides[ref.canonicalLabel] ?? ref.canonicalLabel,
      query: ref.canonicalLabel,
      count: row.count,
    }
  }

  return {
    label: ref.displayLabel,
    query: ref.query,
    count: compositeCount(ref.sourceLabels),
  }
}

function intersectionCount(leftLabel: string, rightLabel: string): number {
  const left = new Set(canonicalByLabel.get(leftLabel)?.song_numbers ?? [])
  const right = new Set(canonicalByLabel.get(rightLabel)?.song_numbers ?? [])
  let overlap = 0
  for (const number of left) {
    if (right.has(number)) overlap += 1
  }
  return overlap
}

export const hindiUrduSharedCount = intersectionCount("Hindi Songs", "Urdu Songs")

const groupDefinitions: GroupDefinition[] = [
  {
    title: "Languages",
    description: `Find songs by their original language or dialect. The canonical Hindi list has ${canonicalByLabel.get("Hindi Songs")?.count ?? 0} songs and Urdu has ${canonicalByLabel.get("Urdu Songs")?.count ?? 0}; ${hindiUrduSharedCount} appear on both lists as Hindustani.`,
    collections: [
      { canonicalLabel: "Sanskrit Songs" },
      { canonicalLabel: "English Songs" },
      { canonicalLabel: "Hindi Songs" },
      { canonicalLabel: "Urdu Songs" },
      { canonicalLabel: "Aungika Songs" },
      { canonicalLabel: "Maethili Song" },
      { canonicalLabel: "Bengali Dialect Songs" },
    ],
  },
  {
    title: "Sacred figures and epics",
    description: "Songs connected with Shiva, Krśńa, devotees, and the Mahabharata.",
    collections: [
      { canonicalLabel: "Shiva Songs" },
      { canonicalLabel: "Krśńa Songs" },
      { canonicalLabel: "Krśńa and Devotees Songs" },
      { canonicalLabel: "Mahabharata Song" },
    ],
  },
  {
    title: "Festivals and observances",
    description: "Music for annual celebrations, remembrance, and collective occasions.",
    collections: [
      { canonicalLabel: "Bábá Birthday Songs" },
      { canonicalLabel: "New Year Songs" },
      { canonicalLabel: "Year-end Song" },
      { canonicalLabel: "Dipavali (Colour Festival) Day Songs" },
      { canonicalLabel: "Shravanii Purnima Day Song" },
      { canonicalLabel: "Victory Day Song" },
      { canonicalLabel: "National Day Song (or Song of Love for one's Country)" },
    ],
  },
  {
    title: "Life ceremonies",
    description: "Songs for meaningful transitions in family and community life.",
    collections: [
      { canonicalLabel: "Baby Naming Ceremony Song" },
      {
        displayLabel: "Birthday songs",
        query: "All Birthday Songs",
        sourceLabels: ["Bábá Birthday Songs", "Birthday Song"],
      },
      { canonicalLabel: "Marriage Ceremony Song" },
      { canonicalLabel: "Passing Away Ceremony Song" },
      { canonicalLabel: "House Warming Ceremony Song" },
      { canonicalLabel: "Tree Planting Ceremony Song" },
    ],
  },
  {
    title: "Ideals and Ananda Marga",
    description: "Spiritual, social, service, educational, and organizational themes.",
    collections: [
      { canonicalLabel: "Dharma Song" },
      { canonicalLabel: "PROUT Song" },
      { canonicalLabel: "Neo-Humanism Songs" },
      { canonicalLabel: "AMURT Song" },
      { canonicalLabel: "Flag Ceremony Song" },
      { canonicalLabel: "Marching Song" },
      { canonicalLabel: "VSS Song" },
      { canonicalLabel: "Gurukula Song" },
      { canonicalLabel: "Ánanda Nagar Song" },
      { canonicalLabel: "Guru Sakasha Song" },
    ],
  },
  {
    title: "Seasons, earth, and rain",
    description: "Follow the natural year and humanity's relationship with the land.",
    collections: [
      { canonicalLabel: "Spring Songs" },
      { canonicalLabel: "Summer Songs" },
      { canonicalLabel: "Autumn Songs (Sharat)" },
      { canonicalLabel: "Autumn Songs (Hemante)" },
      { canonicalLabel: "Winter Songs" },
      { canonicalLabel: "Rainy Season Songs" },
      { canonicalLabel: "Dry Season Songs" },
      { canonicalLabel: "Songs to Attract Rain / Draught Songs / Farmer's Songs" },
    ],
  },
  {
    title: "Stories and human experience",
    description: "Songs for children, women, inner struggle, remembrance, and folktales.",
    collections: [
      { canonicalLabel: "Children Songs" },
      { canonicalLabel: "Songs based on the Fairy Tale \"The Golden Lotus of the Blue Sea\"" },
      { canonicalLabel: "Songs based on the Folk Tale \"Sat Bhai Chompa\" (The Seven Magnolia Brothers)" },
      { canonicalLabel: "Women Songs" },
      { canonicalLabel: "Song for those approaching the end of their life" },
      { canonicalLabel: "Songs in memory of one's family members" },
      { canonicalLabel: "Song with sanyasii spirit" },
      { canonicalLabel: "Sinners Song" },
    ],
  },
  {
    title: "Tributes and remembrance",
    description: "Songs honouring spiritual, literary, and musical lives.",
    collections: [
      { canonicalLabel: "Song in memory of Lord Buddha" },
      { canonicalLabel: "Songs in memory of Rabindranath Tagore" },
      { canonicalLabel: "Song in memory of Avtk. Ananda Bharati Ac." },
      { canonicalLabel: "Song in memory of the musician Suradas" },
    ],
  },
  {
    title: "Nature, places, and history",
    description: "Landscapes, small wonders, landmarks, and moments in human history.",
    collections: [
      { canonicalLabel: "Himalaya Songs" },
      { canonicalLabel: "River Songs" },
      { canonicalLabel: "Song for a Dust Particle" },
      { canonicalLabel: "Song for a Dewdrop" },
      { canonicalLabel: "Taj Mahal Song" },
      { canonicalLabel: "End of Communism Song" },
    ],
  },
  {
    title: "Musical traditions and rarities",
    description: "Regional tunes, unusual forms, historic melodies, and distinctive compositions.",
    collections: [
      { canonicalLabel: "Chinese-tune Song" },
      { canonicalLabel: "Chinese-European blending-tune Song" },
      { canonicalLabel: "Scandinavian-tune Song" },
      { canonicalLabel: "Belgium-tune Song" },
      { canonicalLabel: "Turkish-tune Song" },
      { canonicalLabel: "Songs containing 'extinct' melodies" },
      { canonicalLabel: "Songs composed in Baba's youth" },
      { canonicalLabel: "Song with a very rare verse form" },
      { canonicalLabel: "Classicalised kiirtan-style song" },
    ],
  },
]

export const specialCollectionGroups: SpecialCollectionGroup[] = groupDefinitions.map((group) => ({
  title: group.title,
  description: group.description,
  collections: group.collections.map(resolveCollection),
}))

export const specialCollectionCount = specialCollectionGroups.reduce(
  (total, group) => total + group.collections.length,
  0,
)
