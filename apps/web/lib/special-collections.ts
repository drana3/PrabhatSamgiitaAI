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

export const specialCollectionGroups: SpecialCollectionGroup[] = [
  {
    title: "Languages",
    description: "Find songs by their original language or dialect.",
    collections: [
      { label: "Sanskrit", query: "Sanskrit Songs", count: 9 },
      { label: "English", query: "English Songs", count: 3 },
      { label: "Hindi", query: "Hindi Songs", count: 12 },
      { label: "Urdu", query: "Urdu Songs", count: 16 },
      { label: "Aungika", query: "Aungika Songs", count: 7 },
      { label: "Maithili", query: "Maethili Song", count: 1 },
      { label: "Bengali dialects", query: "Bengali Dialect Songs", count: 25 },
    ],
  },
  {
    title: "Sacred figures and epics",
    description: "Songs connected with Shiva, Krśńa, devotees, and the Mahabharata.",
    collections: [
      { label: "Shiva", query: "Shiva Songs", count: 15 },
      { label: "Krśńa", query: "Krśńa Songs", count: 15 },
      { label: "Krśńa and devotees", query: "Krśńa and Devotees Songs", count: 5 },
      { label: "Mahabharata", query: "Mahabharata Song", count: 1 },
    ],
  },
  {
    title: "Festivals and observances",
    description: "Music for annual celebrations, remembrance, and collective occasions.",
    collections: [
      { label: "Bábá birthday", query: "Bábá Birthday Songs", count: 5 },
      { label: "New Year", query: "New Year Songs", count: 4 },
      { label: "Year-end", query: "Year-end Song", count: 1 },
      { label: "Dipavali", query: "Dipavali (Colour Festival) Day Songs", count: 3 },
      { label: "Shravanii Purnima", query: "Shravanii Purnima Day Song", count: 1 },
      { label: "Victory Day", query: "Victory Day Song", count: 1 },
      { label: "National Day", query: "National Day Song (or Song of Love for one's Country)", count: 1 },
    ],
  },
  {
    title: "Life ceremonies",
    description: "Songs for meaningful transitions in family and community life.",
    collections: [
      { label: "Baby naming", query: "Baby Naming Ceremony Song", count: 1 },
      { label: "Birthday", query: "Birthday Song", count: 1 },
      { label: "Marriage", query: "Marriage Ceremony Song", count: 1 },
      { label: "Passing away", query: "Passing Away Ceremony Song", count: 1 },
      { label: "House warming", query: "House Warming Ceremony Song", count: 1 },
      { label: "Tree planting", query: "Tree Planting Ceremony Song", count: 1 },
    ],
  },
  {
    title: "Ideals and Ananda Marga",
    description: "Spiritual, social, service, educational, and organizational themes.",
    collections: [
      { label: "Dharma", query: "Dharma Song", count: 1 },
      { label: "PROUT", query: "PROUT Song", count: 3 },
      { label: "Neo-Humanism", query: "Neo-Humanism Songs", count: 11 },
      { label: "AMURT", query: "AMURT Song", count: 1 },
      { label: "Flag ceremony", query: "Flag Ceremony Song", count: 1 },
      { label: "Marching", query: "Marching Song", count: 1 },
      { label: "VSS", query: "VSS Song", count: 1 },
      { label: "Gurukula", query: "Gurukula Song", count: 1 },
      { label: "Ánanda Nagar", query: "Ánanda Nagar Song", count: 1 },
      { label: "Guru Sakasha", query: "Guru Sakasha Song", count: 1 },
    ],
  },
  {
    title: "Seasons, earth, and rain",
    description: "Follow the natural year and humanity's relationship with the land.",
    collections: [
      { label: "Spring", query: "Spring Songs", count: 9 },
      { label: "Summer", query: "Summer Songs", count: 4 },
      { label: "Autumn: Sharat", query: "Autumn Songs (Sharat)", count: 6 },
      { label: "Autumn: Hemante", query: "Autumn Songs (Hemante)", count: 6 },
      { label: "Winter", query: "Winter Songs", count: 7 },
      { label: "Rainy season", query: "Rainy Season Songs", count: 5 },
      { label: "Dry season", query: "Dry Season Songs", count: 2 },
      { label: "Rain, drought, and farmers", query: "Songs to Attract Rain / Draught Songs / Farmer's Songs", count: 2 },
    ],
  },
  {
    title: "Stories and human experience",
    description: "Songs for children, women, inner struggle, remembrance, and folktales.",
    collections: [
      { label: "Children", query: "Children Songs", count: 4 },
      { label: "The Golden Lotus of the Blue Sea", query: "Songs based on the Fairy Tale \"The Golden Lotus of the Blue Sea\"", count: 6 },
      { label: "Sat Bhai Chompa", query: "Songs based on the Folk Tale \"Sat Bhai Chompa\" (The Seven Magnolia Brothers)", count: 2 },
      { label: "Women", query: "Women Songs", count: 28 },
      { label: "Approaching the end of life", query: "Song for those approaching the end of their life", count: 1 },
      { label: "In memory of family", query: "Songs in memory of one's family members", count: 4 },
      { label: "Sanyasii spirit", query: "Song with sanyasii spirit", count: 1 },
      { label: "Sinners", query: "Sinners Song", count: 1 },
    ],
  },
  {
    title: "Tributes and remembrance",
    description: "Songs honouring spiritual, literary, and musical lives.",
    collections: [
      { label: "Lord Buddha", query: "Song in memory of Lord Buddha", count: 1 },
      { label: "Rabindranath Tagore", query: "Songs in memory of Rabindranath Tagore", count: 2 },
      { label: "Avtk. Ananda Bharati Ac.", query: "Song in memory of Avtk. Ananda Bharati Ac.", count: 1 },
      { label: "Musician Suradas", query: "Song in memory of the musician Suradas", count: 1 },
    ],
  },
  {
    title: "Nature, places, and history",
    description: "Landscapes, small wonders, landmarks, and moments in human history.",
    collections: [
      { label: "Himalaya", query: "Himalaya Songs", count: 4 },
      { label: "Rivers", query: "River Songs", count: 6 },
      { label: "A dust particle", query: "Song for a Dust Particle", count: 1 },
      { label: "A dewdrop", query: "Song for a Dewdrop", count: 1 },
      { label: "Taj Mahal", query: "Taj Mahal Song", count: 1 },
      { label: "End of Communism", query: "End of Communism Song", count: 1 },
    ],
  },
  {
    title: "Musical traditions and rarities",
    description: "Regional tunes, unusual forms, historic melodies, and distinctive compositions.",
    collections: [
      { label: "Chinese tune", query: "Chinese-tune Song", count: 1 },
      { label: "Chinese-European blend", query: "Chinese-European blending-tune Song", count: 1 },
      { label: "Scandinavian tune", query: "Scandinavian-tune Song", count: 1 },
      { label: "Belgium tune", query: "Belgium-tune Song", count: 1 },
      { label: "Turkish tune", query: "Turkish-tune Song", count: 1 },
      { label: "Extinct melodies", query: "Songs containing 'extinct' melodies", count: 2 },
      { label: "Composed in Bábá's youth", query: "Songs composed in Baba's youth", count: 3 },
      { label: "Rare verse form", query: "Song with a very rare verse form", count: 1 },
      { label: "Classicalised kiirtan style", query: "Classicalised kiirtan-style song", count: 1 },
    ],
  },
]

export const specialCollectionCount = specialCollectionGroups.reduce(
  (total, group) => total + group.collections.length,
  0,
)
