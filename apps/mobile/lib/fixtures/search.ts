/**
 * Preview-only sample songs for the search overlay (MOCKUP_DATA). Copied from the design
 * prototype (Main.dc.html, `_songs()`, `_content()` and the search block) so the overlay shows the
 * same rows as the boards: "peaceful" gives 17 songs, "bandhu" gives 2.
 *
 * TODO(api): the real catalog search does the matching; the API sends no length or feeling tags
 * for most songs yet. Delete this file when it does.
 */

export type SampleSong = {
  number: number
  title: string
  seconds: number
  /** The category label ("Light", "Devotion" ...). */
  tag: string
  /** Feelings the song belongs to, lower case. */
  tags: readonly string[]
}

const TAGS = ["devotion", "dawn", "nature", "longing", "surrender", "peaceful", "joy", "guidance"] as const
const LABELS = ["Devotion", "Light", "Nature", "Longing", "Surrender", "Silence", "Joy", "Guidance"] as const
const A1 = ["Ánanda", "Madhur", "Prem", "Áloke", "Sándhya", "Prabháte", "Sháran", "Bhakti", "Niilá", "Sudhá", "Manera", "Dhyáner", "Karuńá", "Jyotir", "Sargam", "Támasii"]
const A2 = ["Dháráy", "Gán", "Sure", "Pathe", "Vináy", "Tarańge", "Nikuñje", "Smaran", "Mantre", "Amiyá", "Sparshe", "Bandaná"]

const HEAD: readonly SampleSong[] = [
  { number: 1, title: "Bandhu He Niye Calo", seconds: 238, tag: "Guidance", tags: ["guidance", "devotion", "longing"] },
  { number: 2, title: "E Gán Ámár, Álor Jharańá Dhárá", seconds: 252, tag: "Light", tags: ["dawn", "joy", "peaceful"] },
  { number: 3, title: "Ándhára Sheśe Álora Deshe", seconds: 271, tag: "Light", tags: ["guidance", "dawn", "peaceful"] },
  { number: 4, title: "Sakal Maner Viińá Ek Sure Báje Áj", seconds: 305, tag: "Devotion", tags: ["devotion", "joy"] },
  { number: 5, title: "Elo, Anek Juger Sei Ajáná Pathik", seconds: 226, tag: "Longing", tags: ["longing", "guidance"] },
  { number: 6, title: "Bandhu Ámár", seconds: 300, tag: "Devotion", tags: ["devotion", "longing", "surrender"] },
  { number: 7, title: "Niiravatá Májhe Ke Go Tumi Ele", seconds: 284, tag: "Silence", tags: ["peaceful", "nature", "surrender"] },
]

let cache: SampleSong[] | null = null

/** The prototype's 64 sample songs: PS 1 to 7 are real titles, the rest are generated. */
export function sampleSongs(): readonly SampleSong[] {
  if (cache) return cache
  const out: SampleSong[] = [...HEAD]
  for (let i = 7; i < 64; i++) {
    out.push({
      number: Math.round(7 + (i - 6) * (5011 / 57)),
      title: `${A1[i % 16]} ${A2[(i * 5) % 12]}${i % 3 === 0 ? " Áj" : ""}`,
      seconds: 180 + ((i * 53) % 170),
      tag: LABELS[i % 8],
      tags: [TAGS[i % 8], TAGS[(i + 3) % 8]],
    })
  }
  cache = out
  return out
}

/** Songs the prototype shows as downloaded (its default `dl` state: PS 1, PS 3, PS 6). */
export const SAMPLE_OFFLINE_NUMBERS: ReadonlySet<number> = new Set([1, 3, 6])

/** Words of PS 1 and PS 3 (roman and English gloss). Only these two songs match by word. */
const WORDS: Record<number, readonly (readonly [string, string])[]> = {
  1: [
    ["Bandhu", "friend"], ["he", "O"], ["niye", "take"], ["calo", "lead on"],
    ["Álor", "of light"], ["jharańá", "spring"], ["dháráy", "in the stream"], ["dhuiye", "wash"], ["dáo", "give"],
    ["Tomár", "your"], ["kole", "lap"], ["ámáy", "me"], ["tule", "lifting"], ["náo", "take"],
    ["Andhakár", "darkness"], ["kete", "cut away"], ["yáy", "goes"],
  ],
  3: [
    ["Ándhára", "darkness"], ["sheśe", "at the end"], ["álora", "of light"], ["deshe", "in the land"],
    ["Tumi", "You"], ["eso", "come"], ["háte", "by the hand"], ["dhare", "holding"],
    ["Ámár", "my"], ["pathe", "on the path"], ["álo", "light"], ["jválo", "kindle"],
  ],
}

/** Lower case, accents stripped, as the prototype's `_plain`. */
export function plainText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export type SampleHit = { song: SampleSong; why: string }

/** The prototype's search rule: number, first line, word (PS 1 and 3), then feeling. */
export function searchSample(query: string): SampleHit[] {
  const q = query.trim()
  if (!q) return []
  const qp = plainText(q).replace(/\s+/g, " ")
  const words = qp.split(" ").filter((w) => w.length > 2)
  const out: SampleHit[] = []
  for (const song of sampleSongs()) {
    let why = ""
    if (/^\d+$/.test(q) && String(song.number).startsWith(q)) why = "Number match"
    else if (plainText(song.title).replace(/\s+/g, " ").includes(qp)) why = "First line match"
    else if (
      words.length &&
      WORDS[song.number]?.some(([roman, gloss]) =>
        words.some((x) => plainText(roman).startsWith(x) || plainText(gloss).startsWith(x)),
      )
    )
      why = "Word match"
    else {
      const hit = words.filter((w) => song.tags.some((tag) => tag.startsWith(w)))
      if (hit.length) why = `Feeling: ${hit.join(", ")}`
    }
    if (why) out.push({ song, why })
  }
  return out
}

/** "4:31". */
export function sampleDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}
