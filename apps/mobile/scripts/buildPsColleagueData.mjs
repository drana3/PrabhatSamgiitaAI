#!/usr/bin/env node
/**
 * Squeezes the colleagues' archives (data/curated/ps_colleagues/*.json, written by scripts/import_colleague_texts.py
 * and scripts/import_colleague_audio.py) into the three small files the phone reads (apps/mobile/data/psColleagues/).
 * Nothing is edited, translated or corrected: texts and chord pages are copied as they are; only fields the app does
 * not show (romanisation lines, derived placements, duplicated line lists) are left out.
 *
 * Two rules, both counted in the output:
 *  - a chord page is kept only when it holds chord symbols (the "placements" of the importer); a page of words alone
 *    is not a chart and is not shipped;
 *  - a second text of a language that is written in capitals (under a fifth of its letters lowercase) is the romanised lyric the document repeats, not a
 *    translation, and is left out (song 3261).
 *
 * usage: node scripts/buildPsColleagueData.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const here = join(fileURLToPath(import.meta.url), "..", "..")
const src = join(here, "..", "..", "data", "curated", "ps_colleagues")
const out = join(here, "data", "psColleagues")
const read = (name) => JSON.parse(readFileSync(join(src, name), "utf8"))
const write = (name, value) => writeFileSync(join(out, name), `${JSON.stringify(value)}\n`)
mkdirSync(out, { recursive: true })

const LANGS = ["en", "ru", "uk", "fr"]
/** Prose has mostly lowercase letters; a romanised lyric is capitals (with a stray "x2"). */
const looksLikeProse = (text) => {
  const letters = text.match(/\p{L}/gu) ?? []
  const lower = text.match(/\p{Ll}/gu) ?? []
  return letters.length > 0 && lower.length / letters.length > 0.2
}
const clean = (value) => (typeof value === "string" && value.trim() ? value : undefined)

/** One translation: `t` text, `n` the document's own source note, `h` its title line. */
function version(v) {
  const t = clean(v.text)
  if (!t) return null
  const out = { t }
  const n = clean(v.source_note)
  const h = clean(v.title_line)
  if (n) out.n = n
  if (h) out.h = h
  return out
}

const translations = {}
const counts = { en: 0, ru: 0, uk: 0, fr: 0, extra: 0, extraDropped: [] }
for (const [number, song] of Object.entries(read("translations.json").songs)) {
  const entry = {}
  for (const lang of LANGS) {
    const main = song.translations?.[lang]
    const v = main ? version(main) : null
    if (!v) continue
    const more = []
    for (const extra of song.extra_versions ?? []) {
      if (extra.language !== lang) continue
      const w = version(extra)
      if (!w) continue
      if (!looksLikeProse(w.t)) counts.extraDropped.push(`${number}/${lang}`)
      else more.push(w)
    }
    if (more.length) {
      v.x = more
      counts.extra += more.length
    }
    entry[lang] = v
    counts[lang] += 1
  }
  if (Object.keys(entry).length) translations[number] = entry
}

const chordsRaw = read("chords.json").songs
const docx = {}
for (const [number, song] of Object.entries(chordsRaw)) {
  const chart = song.charts?.[0]
  if (!chart?.placements?.length) continue
  const k = [...new Set(chart.placements.map((p) => p.line))].sort((a, b) => a - b)
  docx[number] = { c: chart.capo ?? null, l: chart.lines, k }
}

const pdf = {}
for (const [number, song] of Object.entries(read("chords_from_pdf.json").songs)) {
  pdf[number] = { s: song.source_pdf.replace(/\s*\.pdf$/i, "").trim(), c: song.capo ?? null, l: song.chord_lines }
}

const audio = {}
for (const [number, song] of Object.entries(read("audio.json").songs)) {
  const list = (song.recordings ?? []).map((r) => ({ f: r.file_name, k: r.r2_key, cur: r.is_current === true, b: r.bytes, st: r.status }))
  if (list.length) audio[number] = list
}

write("translations.json", translations)
write("chords.json", { docx, pdf })
write("audio.json", audio)
console.log(
  JSON.stringify({
    translations: { songs: Object.keys(translations).length, en: counts.en, ru: counts.ru, uk: counts.uk, fr: counts.fr, extraVersions: counts.extra, extraDropped: counts.extraDropped },
    chords: { docxWithSymbols: Object.keys(docx).length, pdf: Object.keys(pdf).length, docxPagesWithoutSymbols: Object.keys(chordsRaw).length - Object.keys(docx).length },
    audio: { songs: Object.keys(audio).length, recordings: Object.values(audio).reduce((n, l) => n + l.length, 0) },
  }),
)
