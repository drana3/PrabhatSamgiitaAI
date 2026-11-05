/**
 * TODO(api): the design prototype's own sample data for the Song page (Main.dc.html: `_songs()`, `_content()`,
 * `_recs()` and the base state), used only when MOCKUP_DATA is on (`npm run web`), so the page can be compared
 * 1:1 with the boards. With the flag off the page uses the live catalog. Nothing here is reviewed content: the
 * word glosses, translations, explanations, chords, performers and sizes are the prototype's placeholders.
 * Only PS 1 and PS 3 use it (MOCKUP_CONTENT_NUMBERS); every other song opens the real page. Titles and
 * numbers are the catalog's (lib/previewCatalog.ts), none are invented.
 */
import type { MockSong } from "@/data/mock"
import { fixtureSeconds } from "@/lib/fixtures/songs"
import { previewSummary, previewTitleOrNumber } from "@/lib/previewCatalog"
import { CATEGORY_FALLBACK } from "@/lib/songsV2/entry"
import type { SongVersion } from "@/lib/songPage/versions"
import type { Coverage } from "@/lib/songPage/translations"

type ProtoWord = [roman: string, deva: string]

type Variant = {
  words: ProtoWord[][]
  en: string[]
  ru: string[]
  hi: string[]
  fr: string[]
  es: string[]
  central: string
}

const A: Variant = {
  words: [
    [["Bandhu", "बन्धु"], ["he", "हे"], ["niye", "निये"], ["calo", "चलो"]],
    [["Álor", "आलोर"], ["jharańá", "झरना"], ["dháráy", "धाराय"], ["dhuiye", "धुइये"], ["dáo", "दाओ"]],
    [["Tomár", "तोमार"], ["kole", "कोले"], ["ámáy", "आमाय"], ["tule", "तुले"], ["náo", "नाओ"]],
    [["Andhakár", "अन्धकार"], ["kete", "केटे"], ["yáy", "याय"]],
  ],
  en: ["Friend, take me along.", "Wash me in the flowing stream of light.", "Lift me into your lap.", "Let the darkness be cut away."],
  ru: ["Друг, возьми меня с собой.", "Омой меня в потоке света.", "Подними меня в свои объятия.", "Пусть тьма отступит."],
  hi: ["बंधु, मुझे साथ ले चलो।", "मुझे प्रकाश की धारा में नहला दो।", "मुझे अपनी गोद में उठा लो।", "अंधकार कट जाए।"],
  fr: ["Ami, emmène-moi.", "Lave-moi dans le courant de lumière.", "Prends-moi dans ton giron.", "Que les ténèbres se dissipent."],
  es: ["Amigo, llévame contigo.", "Báñame en la corriente de luz.", "Álzame en tu regazo.", "Que la oscuridad se corte."],
  central:
    "Paramapurus'a, the Supreme Consciousness, is presented as the true friend who guides the seeker out of darkness.",
}

const B: Variant = {
  words: [
    [["Ándhára", "अन्धार"], ["sheśe", "शेषे"], ["álora", "आलोर"], ["deshe", "देशे"]],
    [["Tumi", "तुमि"], ["eso", "एसो"], ["háte", "हाते"], ["dhare", "धरे"]],
    [["Ámár", "आमार"], ["pathe", "पथे"], ["álo", "आलो"], ["jválo", "ज्वालो"]],
  ],
  en: ["At the end of the dark, in the land of light.", "You come, holding my hand.", "Kindle a light on my path."],
  ru: ["В конце тьмы, в стране света.", "Ты приходишь, держа меня за руку.", "Зажги свет на моём пути."],
  hi: ["अंधकार के अंत में, प्रकाश के देश में।", "तुम आओ, मेरा हाथ थामे।", "मेरे पथ पर दीप जलाओ।"],
  fr: ["À la fin de l'obscurité, au pays de la lumière.", "Tu viens, me tenant par la main.", "Allume une lumière sur mon chemin."],
  es: ["Al final de la oscuridad, en la tierra de la luz.", "Vienes, tomándome de la mano.", "Enciende una luz en mi camino."],
  central: "Placeholder. The central idea comes from the song database.",
}

export type MockupRow = { n: number; title: string; secs: number; tag: string; index: number }

/**
 * The songs whose page is drawn from the prototype's sample content (words, translations, chords).
 * The sample words are those of PS 1 ("Bandhu he niye calo") and PS 3 ("Ándhára sheśe álora deshe"),
 * so only these two use them. Every other song of the catalog opens the real song page, with the
 * real lyrics from the API: putting the sample words under another song's title would be an error.
 */
export const MOCKUP_CONTENT_NUMBERS: readonly number[] = [1, 3]

/** Rows of the "More like this" shelf: the first songs of the catalog, real numbers and titles. */
const SHELF_SIZE = 12

function rowFor(n: number): MockupRow {
  const summary = previewSummary(n)
  return {
    n,
    title: previewTitleOrNumber(n),
    // TODO(api): the length is a fixture value (lib/fixtures/songs.ts) until the API sends one.
    secs: fixtureSeconds(n),
    tag: (summary?.theme ?? summary?.mood ?? "").trim() || CATEGORY_FALLBACK,
    index: n - 1,
  }
}

/** Real songs for the "More like this" shelf of a sample song page (PS 1 to 12 of the catalog). */
export function mockupRows(): MockupRow[] {
  return Array.from({ length: SHELF_SIZE }, (_, i) => rowFor(i + 1))
}

/** The sample row of PS 1 or PS 3; null for every other number (those use the real song page). */
export function mockupRow(number: number): MockupRow | null {
  return MOCKUP_CONTENT_NUMBERS.includes(number) ? rowFor(number) : null
}

/** The prototype keeps content for index 0 and 2; every other index takes one by parity. */
export function mockupVariantFor(index: number): "a" | "b" {
  return index === 0 ? "a" : index === 2 ? "b" : index % 2 ? "b" : "a"
}

/** `songNumber` the chart and explanation fixtures key on (1 = first sample, 3 = second). */
export function mockupFixtureKey(number: number): 1 | 3 {
  const row = mockupRow(number)
  return row && mockupVariantFor(row.index) === "b" ? 3 : 1
}

/** The prototype song as the page's own song type. */
export function mockupSong(number: number): MockSong | null {
  const row = mockupRow(number)
  if (!row) return null
  const v = mockupVariantFor(row.index) === "b" ? B : A
  const roman = v.words.map((line) => line.map((w) => w[0]).join(" "))
  const deva = v.words.map((line) => line.map((w) => w[1]).join(" "))
  return {
    id: String(row.n),
    number: row.n,
    title: row.title,
    shortDescription: "",
    imageUrl: "",
    thumbnailUrl: "",
    themes: [row.tag],
    meaning: v.en.join(" "),
    centralIdea: v.central,
    hindiMeaning: v.hi.join(" "),
    localizedMeanings: { ru: v.ru.join(" "), fr: v.fr.join(" "), es: v.es.join(" ") },
    lyrics: roman.join("\n"),
    transliteration: null,
    lyricsDevanagari: deva.join("\n"),
    translation: "",
    durationSeconds: row.secs,
    performer: "Performer A",
    videos: [],
    audioUrl: mockupVersions(row.n)[0]?.url ?? null,
    mediaHydrated: true,
  }
}

/** The line-by-line translation of a sample song in a language (en, ru, hi, fr, es), or null. */
export function mockupTranslation(number: number, code: string): string[] | null {
  const row = mockupRow(number)
  if (!row) return null
  const v = mockupVariantFor(row.index) === "b" ? B : A
  const lines = (v as unknown as Record<string, unknown>)[code]
  return Array.isArray(lines) && code !== "words" ? (lines as string[]) : null
}

type Rec = { inst: SongVersion["instrument"]; label: string; who: string; tag: SongVersion["tag"]; d: number }

const RECS: Rec[] = [
  { inst: "voice", label: "Voice", who: "Performer A", tag: "Best", d: 0 },
  { inst: "guitar", label: "Guitar", who: "Performer B", tag: "Verified", d: 22 },
  { inst: "harmonium", label: "Harmonium", who: "Performer C", tag: "Verified", d: -18 },
  { inst: "group", label: "Kiirtan group", who: "Group D", tag: "Verified", d: 42 },
  { inst: "guitar", label: "Guitar", who: "Performer E", tag: "Community", d: 9 },
  { inst: "harmonium", label: "Harmonium, solo", who: "Performer F", tag: "Instrumental", d: -30 },
]

/** The six sample versions of a song: performer names, lengths and tags are placeholders. */
export function mockupVersions(number: number): SongVersion[] {
  const row = mockupRow(number)
  const base = row?.secs ?? fixtureSeconds(number)
  return RECS.map((rec, ri) => ({
    id: `mockup-${number}-${ri}`,
    url: `mockup://ps${number}/${ri}`,
    instrument: rec.inst,
    label: rec.label,
    performer: rec.who,
    length: base + rec.d,
    tag: rec.tag,
  }))
}

/** `_mb`/`_fmtMB`: the file size the prototype shows on the Download pill. */
export function mockupSizeText(seconds: number | null): string {
  const mb = (seconds ?? 0) * 0.0156
  return mb >= 1000 ? `${(mb / 1024).toFixed(2)} GB` : mb < 0.05 ? "0 MB" : `${mb.toFixed(1)} MB`
}

/** Saved songs and learning songs in the prototype's base state. */
export const MOCKUP_SAVED = [1, 3]
export const MOCKUP_LEARNING = [1, 3]
/** Downloaded versions in the base state, keyed `<row index>-<version index>`. */
export const MOCKUP_DOWNLOADED = ["0-0", "2-0", "2-1", "5-2"]

/** The prototype's language list (LANGS): code, English name, native name, coverage. */
export const MOCKUP_LANGUAGES: Array<{ code: string; label: string; nativeLabel: string; coverage: Coverage }> = [
  { code: "en", label: "English", nativeLabel: "English", coverage: "full" },
  { code: "ru", label: "Russian", nativeLabel: "Русский", coverage: "full" },
  { code: "fr", label: "French", nativeLabel: "Français", coverage: "full" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", coverage: "lines" },
  { code: "es", label: "Spanish", nativeLabel: "Español", coverage: "lines" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা", coverage: "none" },
  { code: "de", label: "German", nativeLabel: "Deutsch", coverage: "none" },
  { code: "it", label: "Italian", nativeLabel: "Italiano", coverage: "none" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português", coverage: "none" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語", coverage: "none" },
  { code: "zh", label: "Chinese", nativeLabel: "中文", coverage: "none" },
  { code: "pl", label: "Polish", nativeLabel: "Polski", coverage: "none" },
  { code: "uk", label: "Ukrainian", nativeLabel: "Українська", coverage: "none" },
  { code: "tr", label: "Turkish", nativeLabel: "Türkçe", coverage: "none" },
]
