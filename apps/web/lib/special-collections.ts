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
      { label: "Sanskrit", query: "Sanskrit", count: 9 },
      { label: "English", query: "English", count: 3 },
      { label: "Hindi", query: "Hindi", count: 12 },
      { label: "Urdu", query: "Urdu", count: 16 },
      { label: "Aungika", query: "Aungika", count: 7 },
      { label: "Maithili", query: "Maithili", count: 1 },
      { label: "Bengali dialects", query: "Bengali dialect", count: 25 },
    ],
  },
  {
    title: "Sacred figures and epics",
    description: "Songs connected with Shiva, Krśńa, devotees, and the Mahabharata.",
    collections: [
      { label: "Shiva", query: "Shiva", count: 15 },
      { label: "Krśńa", query: "Krśńa", count: 15 },
      { label: "Krśńa and devotees", query: "Krśńa and Devotees", count: 5 },
      { label: "Mahabharata", query: "Mahabharata", count: 1 },
    ],
  },
  {
    title: "Festivals and observances",
    description: "Music for annual celebrations, remembrance, and collective occasions.",
    collections: [
      { label: "Bábá birthday", query: "Bábá Birthday", count: 5 },
      { label: "New Year", query: "New Year", count: 4 },
      { label: "Year-end", query: "Year-end", count: 1 },
      { label: "Dipavali", query: "Dipavali", count: 3 },
      { label: "Shravanii Purnima", query: "Shravanii Purnima", count: 1 },
      { label: "Victory Day", query: "Victory Day", count: 1 },
      { label: "National Day", query: "National Day", count: 1 },
    ],
  },
  {
    title: "Life ceremonies",
    description: "Songs for meaningful transitions in family and community life.",
    collections: [
      { label: "Baby naming", query: "Baby Naming Ceremony", count: 1 },
      { label: "Birthday", query: "Birthday", count: 2 },
      { label: "Marriage", query: "Marriage Ceremony", count: 1 },
      { label: "Passing away", query: "Passing Away Ceremony", count: 2 },
      { label: "House warming", query: "House Warming Ceremony", count: 3 },
      { label: "Tree planting", query: "Tree Planting Ceremony", count: 4 },
    ],
  },
  {
    title: "Ideals and Ananda Marga",
    description: "Spiritual, social, service, educational, and organizational themes.",
    collections: [
      { label: "Dharma", query: "Dharma", count: 5 },
      { label: "PROUT", query: "PROUT", count: 3 },
      { label: "Neo-Humanism", query: "Neo-Humanism", count: 11 },
      { label: "AMURT", query: "AMURT", count: 6 },
      { label: "Flag ceremony", query: "Flag Ceremony", count: 7 },
      { label: "Marching", query: "Marching", count: 8 },
      { label: "VSS", query: "VSS", count: 9 },
      { label: "Gurukula", query: "Gurukula", count: 10 },
      { label: "Ánanda Nagar", query: "Ánanda Nagar", count: 11 },
      { label: "Guru Sakasha", query: "Guru Sakasha", count: 12 },
    ],
  },
  {
    title: "Seasons, earth, and rain",
    description: "Follow the natural year and humanity's relationship with the land.",
    collections: [
      { label: "Spring", query: "spring", count: 21 },
      { label: "Summer", query: "summer", count: 20 },
      { label: "Autumn: Sharat", query: "autumn", count: 32 },
      { label: "Autumn: Hemante", query: "autumn", count: 32 },
      { label: "Winter", query: "winter", count: 39 },
      { label: "Rainy season", query: "rainy season", count: 37 },
      { label: "Dry season", query: "dry season", count: 20 },
      { label: "Rain, drought, and farmers", query: "Songs to Attract Rain Draught Farmers", count: 2 },
    ],
  },
  {
    title: "Stories and human experience",
    description: "Songs for children, women, inner struggle, remembrance, and folktales.",
    collections: [
      { label: "Children", query: "Children", count: 6 },
      { label: "The Golden Lotus of the Blue Sea", query: "Golden Lotus of the Blue Sea", count: 12 },
      { label: "Sat Bhai Chompa", query: "Sat Bhai Chompa", count: 3 },
      { label: "Women", query: "Women", count: 44 },
      { label: "Approaching the end of life", query: "approaching the end of their life", count: 2 },
      { label: "In memory of family", query: "memory of one's family members", count: 8 },
      { label: "Sanyasii spirit", query: "sanyasii spirit", count: 2 },
      { label: "Sinners", query: "Sinners", count: 3 },
    ],
  },
  {
    title: "Tributes and remembrance",
    description: "Songs honouring spiritual, literary, and musical lives.",
    collections: [
      { label: "Lord Buddha", query: "memory of Lord Buddha", count: 4 },
      { label: "Rabindranath Tagore", query: "memory of Rabindranath Tagore", count: 7 },
      { label: "Avtk. Ananda Bharati Ac.", query: "memory of Avtk. Ananda Bharati", count: 3 },
      { label: "Musician Suradas", query: "memory of the musician Suradas", count: 5 },
    ],
  },
  {
    title: "Nature, places, and history",
    description: "Landscapes, small wonders, landmarks, and moments in human history.",
    collections: [
      { label: "Himalaya", query: "Himalaya", count: 12 },
      { label: "Rivers", query: "River", count: 12 },
      { label: "A dust particle", query: "Song for a Dust Particle", count: 2 },
      { label: "A dewdrop", query: "Song for a Dewdrop", count: 3 },
      { label: "Taj Mahal", query: "Taj Mahal", count: 4 },
      { label: "End of Communism", query: "End of Communism", count: 5 },
    ],
  },
  {
    title: "Musical traditions and rarities",
    description: "Regional tunes, unusual forms, historic melodies, and distinctive compositions.",
    collections: [
      { label: "Chinese tune", query: "Chinese-tune", count: 5 },
      { label: "Chinese-European blend", query: "Chinese-European blending-tune", count: 6 },
      { label: "Scandinavian tune", query: "Scandinavian-tune", count: 7 },
      { label: "Belgium tune", query: "Belgium-tune", count: 8 },
      { label: "Turkish tune", query: "Turkish-tune", count: 9 },
      { label: "Extinct melodies", query: "extinct melodies", count: 7 },
      { label: "Composed in Bábá's youth", query: "composed in Baba's youth", count: 10 },
      { label: "Rare verse form", query: "very rare verse form", count: 7 },
      { label: "Classicalised kiirtan style", query: "Classicalised kiirtan-style", count: 8 },
    ],
  },
]

export const specialCollectionCount = specialCollectionGroups.reduce(
  (total, group) => total + group.collections.length,
  0,
)
