/**
 * Stock photos Dada chose for Kiirtan covers, mixes, live-stream cards and artist placeholders.
 * Metadata only (no image requires), so it can be used in tests and on the server.
 * The images themselves are bound in lib/photos/catalog.ts. Two sources: Unsplash (Unsplash License,
 * credit appreciated but not required) and Ananda Marga's own photographs (anandamarga.org, used with
 * the organisation's permission, credit line required). See docs/photo-credits.md.
 */

import { AM_PHOTO_RAW } from "@/lib/photos/amPhotoData"

export type PhotoCategory =
  | "hands" | "group" | "light" | "sky" | "nature" | "sound" | "texture" | "space"
  | "meditation" | "kiirtan" | "instrument" | "children" | "portrait" | "building"
export type PhotoTone = "warm" | "cool"
export type PhotoMood = "morning" | "evening" | "night" | "long" | "live" | "festival" | "calm"
export type PhotoSource = "unsplash" | "ananda-marga"
/**
 * Who is in the picture. none: nobody or only hands/objects. far: small or seen from behind, no readable
 * faces (or people at mid distance). close: identifiable adults up close. children: any child or youth.
 * close and children are never picked for generic covers, only when the caller opts in (allowPeople).
 */
export type PhotoPeople = "none" | "far" | "close" | "children"

export const PHOTO_MOODS: readonly PhotoMood[] = ["morning", "evening", "night", "long", "live", "festival", "calm"]

export const UNSPLASH_LICENSE_NOTE = "Unsplash License: free to use, credit appreciated but not required"
export const AM_LICENSE = "Used with permission"
export const AM_LICENSE_NOTE = "Ananda Marga's own photograph, used with the organisation's permission"

export type StockPhotoMeta = {
  /** `<nn>-<slug>` (Unsplash) or `am-<n>-<slug>` (Ananda Marga); also the file name without .jpg */
  id: string
  /** number in Dada's shortlist; Unsplash 2..36, Ananda Marga 103..164 */
  n: number
  slug: string
  category: PhotoCategory
  title: string
  source: PhotoSource
  /** Unsplash photographer, or "Ananda Marga" */
  photographer: string
  /** the line to show for the photo on About / Credits */
  credit: string
  pageUrl: string
  license: string
  licenseNote: string
  /** dominant dark colour of the lower third, for gradients and scrims behind text */
  tint: string
  tone: PhotoTone
  moods: readonly PhotoMood[]
  people: PhotoPeople
  /** real pixel size of the cover file (never upscaled) */
  width: number
  height: number
  /** long side under 1000 px: only for small covers and thumbnails, never a full-bleed hero */
  lowRes?: boolean
}

type UnsplashRaw = Pick<StockPhotoMeta, "id" | "n" | "slug" | "category" | "title" | "photographer" | "pageUrl" | "tint" | "tone" | "moods"> & {
  license: "Unsplash License"
}
/** Ananda Marga entries (amPhotoData.ts) carry only what differs per photo; the rest is filled in below. */
export type AmPhotoRaw = Pick<
  StockPhotoMeta,
  "id" | "n" | "slug" | "category" | "title" | "credit" | "pageUrl" | "tint" | "tone" | "moods" | "people" | "width" | "height" | "lowRes"
>

const UNSPLASH_RAW: readonly UnsplashRaw[] = [
  {
    id: "02-hands-holding-a-lit-oil",
    n: 2,
    slug: "hands-holding-a-lit-oil",
    category: "hands",
    title: "Hands holding a lit oil lamp",
    photographer: "Prateek Gautam",
    pageUrl: "https://unsplash.com/photos/person-holding-lighted-oil-lamp-wX1GSlEHzuc",
    license: "Unsplash License",
    tint: "#0C0A09",
    tone: "warm",
    moods: ["evening", "calm", "festival"],
  },
  {
    id: "05-five-people-sitting-on-hilltop",
    n: 5,
    slug: "five-people-sitting-on-hilltop",
    category: "group",
    title: "Five people sitting on hilltop, from behind",
    photographer: "Mohammad mahdi kazemi",
    pageUrl: "https://unsplash.com/photos/five-people-sit-on-a-hilltop-overlooking-a-distant-city-AULkWeKzjWs",
    license: "Unsplash License",
    tint: "#030605",
    tone: "warm",
    moods: ["live", "evening"],
  },
  {
    id: "06-row-of-people-sitting-on",
    n: 6,
    slug: "row-of-people-sitting-on",
    category: "group",
    title: "Row of people sitting on seashore at golden hour",
    photographer: "Cristina Cerda",
    pageUrl: "https://unsplash.com/photos/people-sitting-on-seashore-while-watching-golden-hour-e5EioBQmH8c",
    license: "Unsplash License",
    tint: "#291C1E",
    tone: "warm",
    moods: ["evening", "calm", "long"],
  },
  {
    id: "07-silhouettes-facing-low-sun-over",
    n: 7,
    slug: "silhouettes-facing-low-sun-over",
    category: "group",
    title: "Silhouettes facing low sun over mountains",
    photographer: "Tomasz Brengos",
    pageUrl: "https://unsplash.com/photos/people-in-silhouette-against-mountain-landscape-pFVcmHWGCss",
    license: "Unsplash License",
    tint: "#010000",
    tone: "warm",
    moods: ["live", "festival", "evening"],
  },
  {
    id: "10-candle-flame-warm-orange-glow",
    n: 10,
    slug: "candle-flame-warm-orange-glow",
    category: "light",
    title: "Candle flame, warm orange glow",
    photographer: "Mustafi Numann",
    pageUrl: "https://unsplash.com/photos/candle-flame-with-warm-orange-glow-fDRdXqRJiv4",
    license: "Unsplash License",
    tint: "#3D1703",
    tone: "warm",
    moods: ["evening", "festival", "calm"],
  },
  {
    id: "11-single-candle-in-dark-with",
    n: 11,
    slug: "single-candle-in-dark-with",
    category: "light",
    title: "Single candle in dark with soft bokeh",
    photographer: "Sixteen Miles Out",
    pageUrl: "https://unsplash.com/photos/a-single-lit-candle-glows-in-the-dark-QhlWFtwBBlI",
    license: "Unsplash License",
    tint: "#060200",
    tone: "warm",
    moods: ["night", "calm", "long"],
  },
  {
    id: "12-sunlight-streaming-through-forest-trees",
    n: 12,
    slug: "sunlight-streaming-through-forest-trees",
    category: "light",
    title: "Sunlight streaming through forest trees",
    photographer: "Pegah Moghadas",
    pageUrl: "https://unsplash.com/photos/sunlight-streams-through-trees-in-a-forest-A6SRNY2q6hE",
    license: "Unsplash License",
    tint: "#141209",
    tone: "warm",
    moods: ["morning", "calm"],
  },
  {
    id: "14-sunrise-above-a-sea-of",
    n: 14,
    slug: "sunrise-above-a-sea-of",
    category: "sky",
    title: "Sunrise above a sea of clouds",
    photographer: "iuliu illes",
    pageUrl: "https://unsplash.com/photos/sunrise-over-a-sea-of-clouds-with-a-clear-sky-F51Vn7VOsyM",
    license: "Unsplash License",
    tint: "#3F1C13",
    tone: "warm",
    moods: ["morning"],
  },
  {
    id: "15-golden-clouds-in-warm-sunset",
    n: 15,
    slug: "golden-clouds-in-warm-sunset",
    category: "sky",
    title: "Golden clouds in warm sunset light",
    photographer: "Sophia DiDonato",
    pageUrl: "https://unsplash.com/photos/golden-clouds-illuminated-by-warm-sunset-light-r-oVlnmh3eA",
    license: "Unsplash License",
    tint: "#3F2313",
    tone: "warm",
    moods: ["evening", "festival"],
  },
  {
    id: "16-pink-and-orange-streaked-dawn",
    n: 16,
    slug: "pink-and-orange-streaked-dawn",
    category: "sky",
    title: "Pink and orange streaked dawn clouds",
    photographer: "Clint Patterson",
    pageUrl: "https://unsplash.com/photos/pink-and-orange-clouds-tPRFj3A1rxo",
    license: "Unsplash License",
    tint: "#3C2516",
    tone: "warm",
    moods: ["morning", "calm"],
  },
  {
    id: "17-milky-way-above-dark-mountains",
    n: 17,
    slug: "milky-way-above-dark-mountains",
    category: "sky",
    title: "Milky Way above dark mountains",
    photographer: "Dns Dgn",
    pageUrl: "https://unsplash.com/photos/milky-way-on-mountains-9wH624ALFQA",
    license: "Unsplash License",
    tint: "#1A181A",
    tone: "cool",
    moods: ["night", "long"],
  },
  {
    id: "18-full-moon-over-black-sky",
    n: 18,
    slug: "full-moon-over-black-sky",
    category: "sky",
    title: "Full moon over black sky with stars",
    photographer: "Alexander Andrews",
    pageUrl: "https://unsplash.com/photos/full-moon-vGCErDhrc3E",
    license: "Unsplash License",
    tint: "#000000",
    tone: "warm",
    moods: ["night", "live", "long"],
  },
  {
    id: "19-starry-night-and-milky-way",
    n: 19,
    slug: "starry-night-and-milky-way",
    category: "sky",
    title: "Starry night and Milky Way over calm lake",
    photographer: "Evgeni Tcherkasski",
    pageUrl: "https://unsplash.com/photos/starry-night-sky-over-a-calm-lake-reflecting-stars-Wfmjg9oySJY",
    license: "Unsplash License",
    tint: "#16140C",
    tone: "cool",
    moods: ["night", "long"],
  },
  {
    id: "20-fog-wrapped-evergreen-forest",
    n: 20,
    slug: "fog-wrapped-evergreen-forest",
    category: "nature",
    title: "Fog-wrapped evergreen forest",
    photographer: "Inggrid Koe",
    pageUrl: "https://unsplash.com/photos/gray-forest-with-fog-kbKEuU-YEIw",
    license: "Unsplash License",
    tint: "#1A1D1B",
    tone: "warm",
    moods: ["calm", "morning", "long"],
  },
  {
    id: "21-foggy-trail-through-redwoods",
    n: 21,
    slug: "foggy-trail-through-redwoods",
    category: "nature",
    title: "Foggy trail through redwoods",
    photographer: "Dylan Taylor",
    pageUrl: "https://unsplash.com/photos/dirt-path-through-foggy-redwood-forest-vLX1N30FOEY",
    license: "Unsplash License",
    tint: "#0F0D05",
    tone: "warm",
    moods: ["morning", "long", "calm"],
  },
  {
    id: "22-pink-lotus-bud-on-dark",
    n: 22,
    slug: "pink-lotus-bud-on-dark",
    category: "nature",
    title: "Pink lotus bud on dark background",
    photographer: "Tao Yuan",
    pageUrl: "https://unsplash.com/photos/a-beautiful-pink-lotus-flower-blooming-against-a-dark-background-Wr_Pi6Hf0sI",
    license: "Unsplash License",
    tint: "#212712",
    tone: "cool",
    moods: ["night", "calm"],
  },
  {
    id: "23-pink-lotus-in-full-bloom",
    n: 23,
    slug: "pink-lotus-in-full-bloom",
    category: "nature",
    title: "Pink lotus in full bloom, teal backdrop",
    photographer: "AARN GIRI",
    pageUrl: "https://unsplash.com/photos/pink-lotus-flower-in-bloom-B1cJcYPoFxY",
    license: "Unsplash License",
    tint: "#0F1418",
    tone: "cool",
    moods: ["calm", "long"],
  },
  {
    id: "24-warm-desert-dunes-golden-ridge",
    n: 24,
    slug: "warm-desert-dunes-golden-ridge",
    category: "nature",
    title: "Warm desert dunes, golden ridge",
    photographer: "Matteo Di Iorio",
    pageUrl: "https://unsplash.com/photos/brown-desert-under-blue-sky-wkMd_DylG8I",
    license: "Unsplash License",
    tint: "#382A1A",
    tone: "warm",
    moods: ["morning", "evening", "calm", "long"],
  },
  {
    id: "25-calm-sea-under-golden-clouds",
    n: 25,
    slug: "calm-sea-under-golden-clouds",
    category: "nature",
    title: "Calm sea under golden clouds",
    photographer: "Jonathan Bean",
    pageUrl: "https://unsplash.com/photos/calm-sea-under-golden-clouds-ywnnwzcdR5o",
    license: "Unsplash License",
    tint: "#2A2928",
    tone: "warm",
    moods: ["evening", "calm", "long"],
  },
  {
    id: "26-white-and-pink-water-lily",
    n: 26,
    slug: "white-and-pink-water-lily",
    category: "nature",
    title: "White and pink water lily on dark pond",
    photographer: "Jay Castor",
    pageUrl: "https://unsplash.com/photos/rule-of-thirds-photography-of-pink-and-white-lotus-flower-floating-on-body-of-water-7AcMUSYRZpU",
    license: "Unsplash License",
    tint: "#1B1D1B",
    tone: "warm",
    moods: ["calm"],
  },
  {
    id: "27-misty-forest-valley-with-mountains",
    n: 27,
    slug: "misty-forest-valley-with-mountains",
    category: "nature",
    title: "Misty forest valley with mountains",
    photographer: "Roberto Shumski",
    pageUrl: "https://unsplash.com/photos/misty-forest-valley-with-mountains-in-background-oYEGPZebzGw",
    license: "Unsplash License",
    tint: "#060A08",
    tone: "warm",
    moods: ["morning", "calm"],
  },
  {
    id: "28-hands-on-ornate-keyboard-instrument",
    n: 28,
    slug: "hands-on-ornate-keyboard-instrument",
    category: "sound",
    title: "Hands on ornate keyboard instrument",
    photographer: "Xingchen Yan",
    pageUrl: "https://unsplash.com/photos/a-close-up-of-a-person-playing-a-musical-instrument-XL5qlv2LLMs",
    license: "Unsplash License",
    tint: "#2C2725",
    tone: "warm",
    moods: ["live", "festival"],
  },
  {
    id: "29-hand-on-tabla-close-up",
    n: 29,
    slug: "hand-on-tabla-close-up",
    category: "sound",
    title: "Hand on tabla, close-up",
    photographer: "Ricky Singh",
    pageUrl: "https://unsplash.com/photos/a-close-up-of-a-person-playing-a-musical-instrument-rTikKt6ir5g",
    license: "Unsplash License",
    tint: "#352B1C",
    tone: "warm",
    moods: ["live", "festival"],
  },
  {
    id: "30-tabla-drumhead-on-black",
    n: 30,
    slug: "tabla-drumhead-on-black",
    category: "sound",
    title: "Tabla drumhead on black",
    photographer: "Swaroop B Deshpande",
    pageUrl: "https://unsplash.com/photos/blue-and-white-round-ornament-JkbSmeXMoyA",
    license: "Unsplash License",
    tint: "#060401",
    tone: "warm",
    moods: ["night", "calm"],
  },
  {
    id: "31-hands-playing-a-tabla-pair",
    n: 31,
    slug: "hands-playing-a-tabla-pair",
    category: "sound",
    title: "Hands playing a tabla pair, warm light",
    photographer: "Monis Yousafzai",
    pageUrl: "https://unsplash.com/photos/a-close-up-of-a-person-playing-a-musical-instrument-QuuaCzjXOYk",
    license: "Unsplash License",
    tint: "#361D09",
    tone: "warm",
    moods: ["live", "evening", "festival"],
  },
  {
    id: "35-water-ripples-reflecting-warm-sunset",
    n: 35,
    slug: "water-ripples-reflecting-warm-sunset",
    category: "texture",
    title: "Water ripples reflecting warm sunset",
    photographer: "ameenfahmy",
    pageUrl: "https://unsplash.com/photos/gentle-waves-reflecting-warm-sunset-light-1oCXPG_7_U4",
    license: "Unsplash License",
    tint: "#29241E",
    tone: "warm",
    moods: ["evening", "calm"],
  },
  {
    id: "36-wavy-sand-dune-pattern-warm",
    n: 36,
    slug: "wavy-sand-dune-pattern-warm",
    category: "texture",
    title: "Wavy sand dune pattern, warm tones",
    photographer: "Alexey O",
    pageUrl: "https://unsplash.com/photos/wavy-sand-dunes-texture-with-warm-desert-tones-8aiu0xnW4qs",
    license: "Unsplash License",
    tint: "#37261A",
    tone: "warm",
    moods: ["calm", "long"],
  },
]

/** Real cover size of the Unsplash files. */
const UNSPLASH_SIZE: Record<number, readonly [number, number]> = {
  2: [1400, 933],
  5: [1400, 765],
  6: [1400, 897],
  7: [1400, 933],
  10: [1400, 1869],
  11: [1400, 1750],
  12: [1400, 933],
  14: [1400, 1035],
  15: [1400, 1867],
  16: [1400, 935],
  17: [1400, 933],
  18: [1400, 1366],
  19: [1400, 935],
  20: [1400, 1023],
  21: [1400, 890],
  22: [1400, 2100],
  23: [1400, 1626],
  24: [1400, 1960],
  25: [1400, 934],
  26: [1400, 933],
  27: [1400, 933],
  28: [1400, 2099],
  29: [1400, 933],
  30: [1400, 2489],
  31: [1400, 788],
  35: [1400, 2100],
  36: [1400, 2102],
}

/** Photos of Unsplash with people in them, all seen from behind or as silhouettes; the rest show nobody. */
const UNSPLASH_PEOPLE: Record<number, PhotoPeople> = { 5: "far", 6: "far", 7: "far" }

export const STOCK_PHOTO_META: readonly StockPhotoMeta[] = [
  ...UNSPLASH_RAW.map(
    (p): StockPhotoMeta => ({
      ...p,
      source: "unsplash",
      credit: `Photo: ${p.photographer} / Unsplash`,
      licenseNote: UNSPLASH_LICENSE_NOTE,
      people: UNSPLASH_PEOPLE[p.n] ?? "none",
      width: UNSPLASH_SIZE[p.n][0],
      height: UNSPLASH_SIZE[p.n][1],
    }),
  ),
  ...AM_PHOTO_RAW.map(
    (p): StockPhotoMeta => ({
      ...p,
      source: "ananda-marga",
      photographer: "Ananda Marga",
      license: AM_LICENSE,
      licenseNote: AM_LICENSE_NOTE,
    }),
  ),
]
