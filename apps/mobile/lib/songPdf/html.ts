import { lyricLanguage } from "@/lib/songPage/lyricLanguages"
import { glossKey } from "@/lib/songPage/songContent"

import { STAGES, THEMES } from "./themes"
import type { PdfOptions, PdfSongInput, PdfVariantId } from "./types"

/**
 * The song as a printable page: one HTML text per layout (the body) wearing one of five looks (lib/songPdf/themes.ts: colours,
 * type, the head of the page with its photo). The phone prints it to a PDF (lib/songPdf/share.ts); a browser prints it the
 * same way. Fonts come from Google Fonts and fall back to the device's own when the phone is offline, so the page is always
 * complete and only the type changes.
 *
 * Nothing is invented: a word with no meaning in the data prints with an empty line, and a language the song has no
 * translation in is left out of the page (and `missing` says so, so the sheet can tell the person).
 */

export const esc = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const words = (line: string): string[] => line.split(/\s+/).filter(Boolean)

/** The name of a language on the page: `English`, `Russian`. */
export function languageName(code: string): string {
  return lyricLanguage(code)?.name ?? code
}

export type PdfPlan = {
  /** the translation languages that have a text, in the order asked */
  translations: Array<{ code: string; blocks: string[] }>
  /** the word languages that have at least one meaning in this song */
  wordLanguages: string[]
  /** asked for, but the song has nothing in it */
  missing: { translations: string[]; wordLanguages: string[] }
}

export function planFor(song: PdfSongInput, options: PdfOptions): PdfPlan {
  const translations = options.translationLanguages
    .map((code) => ({ code, blocks: (song.translations[code] ?? "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean) }))
    .filter((t) => t.blocks.length > 0)
  const has = (code: string) => Object.keys(song.glosses?.byLanguage[code] ?? {}).length > 0
  const wordLanguages = options.wordLanguages.filter(has)
  return {
    translations,
    wordLanguages,
    missing: {
      translations: options.translationLanguages.filter((c) => !translations.some((t) => t.code === c)),
      wordLanguages: options.wordLanguages.filter((c) => !has(c)),
    },
  }
}

/** The lines to print for the chosen script (Roman when the song has none in it), and whether the word meanings still line up with them. */
function linesOf(song: PdfSongInput, options: PdfOptions): { lines: string[]; glossable: boolean[] } {
  const own = song.linesByScript[options.script]
  const lines = own && own.length ? own : song.romanLines
  const glossable = lines.map((line, i) => (lines === song.romanLines ? true : words(line).length === words(song.romanLines[i] ?? "").length))
  return { lines, glossable }
}

const CSS = `
*{box-sizing:border-box;margin:0}
html,body{background:var(--paper)}
body{color:var(--ink);font:400 11pt/1.5 var(--body);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.eb{font:500 7.5pt/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
h1{font:var(--hw) 26pt/1.02 var(--display);letter-spacing:-.01em}
.meta{display:flex;gap:5mm;white-space:nowrap}
.meta span+span{border-left:1px solid var(--rule);padding-left:5mm}
.col-h{margin-bottom:4mm}
.stanza{margin-bottom:5mm;break-inside:avoid}
.line{display:flex;flex-wrap:wrap;gap:0 4mm;margin-bottom:3.6mm;break-inside:avoid}
.w{display:flex;flex-direction:column}
.w .r{font:var(--lw) 14.5pt/1.15 var(--lyric)}
.w .g{font:italic 400 7.6pt/1.2 var(--body);color:var(--gloss);border-top:1px dotted var(--rule);margin-top:.9mm;padding-top:.5mm;min-height:3mm}
.w .g+.g{border-top:0;margin-top:0;padding-top:0;color:var(--muted)}
.tl p{font:400 11.5pt/1.5 var(--body);margin-bottom:3.2mm;break-inside:avoid}
.tl .lang{margin:6mm 0 3mm}.tl .lang:first-child{margin-top:0}
footer{margin-top:6mm;border-top:1px solid var(--rule);padding-top:3mm;display:flex;justify-content:space-between}
footer .ok{color:var(--gloss)}
table{width:100%;border-collapse:collapse}td{vertical-align:top}
`

type Frame = { css: string; page: string; body: string; note?: string }

function head(song: PdfSongInput, options: PdfOptions, plan: PdfPlan): string {
  const meta = [song.composed ? `Composed ${song.composed}` : "", song.raga ? `Raga ${song.raga}` : "", song.tala ? `Tala ${song.tala}` : ""].filter(Boolean)
  const langs = [options.script === "roman" ? "Roman" : options.script === "devanagari" ? "Devanagari" : "Bengali", ...plan.translations.map((t) => languageName(t.code))]
  meta.push(langs.join(" · "))
  return THEMES[options.theme].head({ number: song.number, title: song.title, meta, photo: song.photo })
}

function foot(song: PdfSongInput, note: string): string {
  if (!note) return ""
  return `<footer class="eb"><span>Prabhat Samgiita app · song ${song.number}</span><span class="ok">${esc(note)}</span><span></span></footer>`
}

/** One printed line: every word with the meanings of the chosen languages under it. */
function lineHtml(song: PdfSongInput, line: string, index: number, glossable: boolean, plan: PdfPlan, withWords: boolean): string {
  const ws = words(line)
  const cells = ws
    .map((w, j) => {
      const g = withWords && glossable
        ? plan.wordLanguages.map((code) => song.glosses?.byLanguage[code]?.[glossKey(index, j)] ?? "").map((text) => `<span class="g">${esc(text)}</span>`).join("")
        : ""
      return `<span class="w"><span class="r">${esc(w)}</span>${withWords && plan.wordLanguages.length ? g || '<span class="g"></span>' : ""}</span>`
    })
    .join("")
  return `<div class="line">${cells}</div>`
}

function stanzas(lines: string[]): Array<Array<{ line: string; index: number }>> {
  const out: Array<Array<{ line: string; index: number }>> = [[]]
  lines.forEach((line, index) => {
    if (!line.trim()) {
      if (out[out.length - 1].length) out.push([])
      return
    }
    out[out.length - 1].push({ line, index })
  })
  return out.filter((s) => s.length)
}

function songColumn(song: PdfSongInput, options: PdfOptions, plan: PdfPlan, withWords: boolean): string {
  const { lines, glossable } = linesOf(song, options)
  return stanzas(lines).map((st) => `<div class="stanza">${st.map(({ line, index }) => lineHtml(song, line, index, glossable[index] ?? false, plan, withWords)).join("")}</div>`).join("")
}

function translationColumn(plan: PdfPlan, separate: boolean, flow = false): string {
  return plan.translations
    .map((t) => `${separate || plan.translations.length > 1 ? `<div class="eb lang">${esc(languageName(t.code))}</div>` : ""}${t.blocks.map((b) => `<p>${esc(b).replace(/\n/g, flow ? " " : "<br>")}</p>`).join("")}`)
    .join("")
}

/* ---- the Sheet: one page, always. The photo sits at the bottom and melts upward into the paper like a sky; the title is written in
   that sky. The text size is chosen so the whole song fits the page (a long song gets smaller type, never a second page). ---- */

const PT = 25.4 / 72
/** The Sheet at scale 1; the real sizes are these times `--k`. Widths are the text columns in mm on the 297 mm page. */
const SHEET = { lyric: 25, gloss: 14, tr: 17, gap: 5, lineGap: 6, stanzaGap: 9, trGap: 5, wide: { left: 172, right: 81, full: 255 }, dense: { col: 95, colFull: 130, right: 59 }, tight: { col: 78, colFull: 130, right: 93 } }
/** The photo band at the bottom: its height, and the lowest point the text may reach (mm from the top of the 210 mm page). */
const BANDS = { tall: { height: 76, limit: 164 }, slim: { height: 28, limit: 190 } } as const
const TOP_BLOCK = 48 // from the top of the page to where the text starts, mm
const MIN_K = 0.2
const SAFETY = 1.05

/** `wide`: song and translation side by side; `dense`: the song in two columns and a narrow translation; `tight`: the same with a wide translation. */
export type SheetMode = "wide" | "dense" | "tight"
export type SheetModel = { stanzas: Array<{ left: string[]; glosses: number }>; right: string[][]; hasTr: boolean }

/** The height in mm of one printed line at scale k in a column of the given width, from a model of how its words wrap. */
function lineMm(line: string, glossRows: number, k: number, colMm: number): number {
  const c = SHEET
  const r = c.lyric * k
  const g = c.gloss * k
  let rows = 1
  let x = 0
  for (const w of words(line)) {
    const ww = w.length * r * 0.5 * PT
    if (x > 0 && x + c.gap * k + ww > colMm) {
      rows += 1
      x = ww
    } else x += (x > 0 ? c.gap * k : 0) + ww
  }
  return rows * (r * 1.12 * PT + glossRows * 8.6 * k) + c.lineGap * k
}

function translationMm(blocks: string[], k: number, colMm: number, flow = false): number {
  const t = SHEET.tr * k
  const perLine = Math.max(6, Math.floor(colMm / (t * 0.5 * PT)))
  const rows = (b: string) => (flow ? Math.max(1, Math.ceil(b.replace(/\n/g, " ").length / perLine)) : b.split("\n").reduce((n, seg) => n + Math.max(1, Math.ceil(seg.length / perLine)), 0))
  return blocks.reduce((sum, b) => sum + rows(b) * t * 1.38 * PT + SHEET.trGap * k, 0)
}

/** How the song is cut into the two columns of the dense layout: the first stanza (or line) index that starts the second one. */
function splitAt(heights: number[]): number {
  const total = heights.reduce((a, b) => a + b, 0)
  let best = 0
  let bestMax = Infinity
  let acc = 0
  for (let i = 0; i <= heights.length; i++) {
    const m = Math.max(acc, total - acc)
    if (m < bestMax) {
      bestMax = m
      best = i
    }
    acc += heights[i] ?? 0
  }
  return best
}

/** Blocks the dense layout moves around: whole stanzas, or single lines when the song is one run of lines. */
function units(m: SheetModel): string[][] {
  return m.stanzas.length > 1 ? m.stanzas.map((st) => st.left) : (m.stanzas[0]?.left ?? []).map((l) => [l])
}

function denseHeights(m: SheetModel, k: number, mode: SheetMode): { heights: number[]; col: number } {
  const col = m.hasTr ? SHEET[mode === "tight" ? "tight" : "dense"].col : SHEET.dense.colFull
  const gl = m.stanzas[0]?.glosses ?? 0
  const heights = units(m).map((u) => u.reduce((sum, line) => sum + lineMm(line, gl, k, col), 0) + (m.stanzas.length > 1 ? SHEET.stanzaGap * k : 0))
  return { heights, col }
}

/** The translation column of a layout, mm tall at scale kt. */
function trMm(m: SheetModel, kt: number, mode: SheetMode, flow: boolean): number {
  const w = mode === "wide" ? SHEET.wide.right : SHEET[mode].right
  return m.hasTr ? m.right.reduce((sum, blocks) => sum + translationMm(blocks, kt, w, flow), 0) : 0
}

/** The song column(s) of a layout, mm tall at scale k. */
function songMm(m: SheetModel, k: number, mode: SheetMode): number {
  const gl = m.stanzas[0]?.glosses ?? 0
  if (mode !== "wide") {
    const { heights } = denseHeights(m, k, mode)
    const cut = splitAt(heights)
    return Math.max(heights.slice(0, cut).reduce((a, b) => a + b, 0), heights.slice(cut).reduce((a, b) => a + b, 0))
  }
  const leftW = m.hasTr ? SHEET.wide.left : SHEET.wide.full
  return m.stanzas.reduce((sum, st) => sum + st.left.reduce((n, line) => n + lineMm(line, gl, k, leftW), 0) + SHEET.stanzaGap * k, 0)
}

/** Stanza rows with each stanza beside its own translation: one scale for both. */
function alignedMm(m: SheetModel, k: number): number {
  const gl = m.stanzas[0]?.glosses ?? 0
  return m.stanzas.reduce((sum, st, i) => sum + Math.max(st.left.reduce((n, line) => n + lineMm(line, gl, k, SHEET.wide.left), 0), translationMm([m.right[0]?.[i] ?? ""], k, SHEET.wide.right)) + SHEET.stanzaGap * k * 0.6, 0)
}

/** The height in mm the Sheet needs at the scales k (song) and kt (translation) in the given layout. */
export function sheetHeight(m: SheetModel, k: number, kt: number, mode: SheetMode, aligned: boolean, flow = false): number {
  if (aligned && mode === "wide") return 7 + alignedMm(m, k)
  return 7 + Math.max(songMm(m, k, mode), trMm(m, kt, mode, flow))
}

/** `flow`: the translation runs on as paragraphs instead of one short line per line, when its lines would force tiny type. */
export type SheetFit = { k: number; kt: number; band: keyof typeof BANDS; mode: SheetMode; flow: boolean }

const MIN_KT = 0.2

/** The layout, photo band and largest scales at which the song fits on one page. */
export function fitSheet(m: SheetModel, aligned: boolean): SheetFit {
  const largest = (height: (k: number) => number, room: number, floor: number, cap: number) => {
    let k = cap
    while (k > floor && height(k) * SAFETY > room) k = Math.round((k - 0.01) * 100) / 100
    return k
  }
  const candidate = (mode: SheetMode, band: keyof typeof BANDS): SheetFit => {
    const room = BANDS[band].limit - TOP_BLOCK - 7
    if (aligned && mode === "wide") {
      const k = largest((x) => alignedMm(m, x), room, MIN_K, 1)
      return { k, kt: k, band, mode, flow: false }
    }
    const k = largest((x) => songMm(m, x, mode), room, MIN_K, 1)
    const cap = Math.min(1, k * 1.25)
    const lines = largest((x) => trMm(m, x, mode, false), room, MIN_KT, cap)
    if (lines >= 0.55 || lines >= cap) return { k, kt: lines, band, mode, flow: false }
    return { k, kt: largest((x) => trMm(m, x, mode, true), room, MIN_KT, cap), band, mode, flow: true }
  }
  const score = (f: SheetFit) => (m.hasTr ? Math.min(f.k, f.kt * 1.15) : f.k)
  const best = (band: keyof typeof BANDS) => {
    const all = (["wide", "dense", "tight"] as const).map((mode) => candidate(mode, band)).sort((a, b) => score(b) - score(a))
    // Each stanza beside its own translation reads best; it is kept unless it costs more than a tenth of the type size.
    const wide = all.find((f) => f.mode === "wide")
    return aligned && wide && score(wide) >= score(all[0]) * 0.9 ? wide : all[0]
  }
  const tall = best("tall")
  const slim = best("slim")
  // The tall photo is the look; it is given up only when it would cost clearly smaller type.
  return score(slim) > score(tall) * 1.18 && score(tall) < 0.7 ? slim : tall
}

function sheetModel(song: PdfSongInput, options: PdfOptions, plan: PdfPlan) {
  const { lines, glossable } = linesOf(song, options)
  const parts = stanzas(lines)
  const first = plan.translations[0]
  const aligned = !!first && parts.length > 1 && first.blocks.length === parts.length
  const model: SheetModel = {
    stanzas: parts.map((st) => ({ left: st.map((x) => x.line), glosses: plan.wordLanguages.length })),
    right: plan.translations.map((t) => t.blocks),
    hasTr: plan.translations.length > 0,
  }
  void glossable
  return { model, aligned, parts, lines, glossable }
}

/** What the Sheet will do with this song: the layout, the photo band and the scale. For tests and for checking the fit. */
export function sheetPlan(song: PdfSongInput, options: PdfOptions): SheetFit & { aligned: boolean } {
  const plan = planFor(song, options)
  const { model, aligned } = sheetModel(song, options, plan)
  return { ...fitSheet(model, aligned), aligned }
}

/** The height the model gives for this song at a scale and layout, mm. Only for checking the model against a real render. */
export function sheetEstimate(song: PdfSongInput, options: PdfOptions, k: number, kt: number, mode: SheetMode, flow = false): number {
  const { model, aligned } = sheetModel(song, options, planFor(song, options))
  return sheetHeight(model, k, kt, mode, aligned, flow)
}

function sheet(song: PdfSongInput, options: PdfOptions, plan: PdfPlan): Frame {
  const withWords = plan.wordLanguages.length > 0
  const { model, aligned, parts, glossable } = sheetModel(song, options, plan)
  const hasTr = model.hasTr
  const { k, kt, band, mode, flow } = { ...fitSheet(model, aligned), ...options.fit }
  const label = `<div class="eb col-h">Song${withWords ? " · word by word" : ""}</div>`
  const rows = (st: Array<{ line: string; index: number }>) => st.map(({ line, index }) => lineHtml(song, line, index, glossable[index] ?? false, plan, withWords)).join("")
  const trCol = `<div class="eb col-h">Translation</div>${translationColumn(plan, false, flow)}`
  let body: string
  if (mode !== "wide") {
    const flat = parts.length > 1 ? parts.map((st) => `<div class="stanza">${rows(st)}</div>`) : (parts[0] ?? []).map((l) => rows([l]))
    const { heights } = denseHeights(model, k, mode)
    const cut = splitAt(heights)
    body = `<div class="dense"><div class="c">${label}${flat.slice(0, cut).join("")}</div><div class="c"><div class="eb col-h">&nbsp;</div>${flat.slice(cut).join("")}</div>${hasTr ? `<div class="c tl">${trCol}</div>` : ""}</div>`
  } else if (aligned) {
    body =
      `<div class="srow"><div class="col-l">${label}</div><div class="col-r"><div class="eb col-h">Translation</div></div></div>` +
      parts.map((st, i) => `<div class="srow"><div class="col-l"><div class="stanza">${rows(st)}</div></div><div class="col-r tl">${plan.translations.map((t) => `<p>${esc(t.blocks[i] ?? "").replace(/\n/g, "<br>")}</p>`).join("")}</div></div>`).join("")
  } else if (hasTr) body = `<table><tr><td class="col-l">${label}${songColumn(song, options, plan, true)}</td><td class="col-r tl">${trCol}</td></tr></table>`
  else body = `<div class="solo">${label}${songColumn(song, options, plan, true)}</div>`
  const meta = [song.composed ? `Composed ${song.composed}` : "", song.raga ? `Raga ${song.raga}` : "", song.tala ? `Tala ${song.tala}` : ""].filter(Boolean)
  const titleSize = song.title.length <= 22 ? 36 : song.title.length <= 34 ? 28 : 22
  const { height } = BANDS[band]
  const paperAt = (pct: number) => `color-mix(in srgb,var(--paper) ${pct}%,transparent)`
  const fade = `linear-gradient(to bottom,var(--paper) 0%,${paperAt(88)} 14%,${paperAt(60)} 34%,${paperAt(28)} 58%,${paperAt(6)} 86%,transparent 100%)`
  const sky = `<div class="sky"${song.photo ? ` style="background-image:${fade},url('${song.photo}')"` : ""}></div>`
  const title = `<div class="skyhd"><div><span class="chip">№ ${song.number}</span><h1 style="font-size:${titleSize}pt">${esc(song.title)}</h1></div><div class="meta eb">${meta.map((x) => `<span>${esc(x)}</span>`).join("")}</div></div>`
  return {
    css:
      `@page{size:297mm 210mm;margin:12mm 15mm}:root{--k:${k};--kt:${kt}}html,body{height:210mm}body{position:relative;overflow:hidden;box-sizing:border-box}` +
      `.sky{position:absolute;left:0;right:0;bottom:0;height:${height}mm;background:var(--paper) center bottom/cover no-repeat}` +
      ".skyhd,.srow,table,.solo,.dense{position:relative;z-index:1}.skyhd{display:flex;justify-content:space-between;align-items:flex-end;gap:10mm;margin-bottom:9mm}" +
      ".chip{display:inline-block;background:var(--accent);color:#fff;font:800 11pt/1 var(--display);padding:2mm 3mm;margin-bottom:3mm}.skyhd h1{color:var(--ink);letter-spacing:-.02em;line-height:1}.skyhd .meta{flex-direction:column;align-items:flex-end;gap:1.4mm}.skyhd .meta span+span{border:0;padding:0}" +
      ".col-l{width:67%;padding-right:7mm;border-right:1px solid var(--rule)}.col-r{padding-left:7mm;flex:1}.srow{display:flex}.srow .stanza{margin-bottom:0;padding-bottom:calc(5mm*var(--k))}.srow .tl{padding-bottom:calc(5mm*var(--kt))}" +
      `.dense{display:flex;gap:6mm}.dense .c{width:${hasTr ? SHEET[mode === "tight" ? "tight" : "dense"].col : SHEET.dense.colFull}mm}.dense .tl{width:${SHEET[mode === "tight" ? "tight" : "dense"].right + 6}mm;border-left:1px solid var(--rule);padding-left:6mm}` +
      ".w .r{font-size:calc(25pt*var(--k));line-height:1.12}.w .g{font-size:calc(14pt*var(--k));margin-top:calc(1.4mm*var(--k));padding-top:calc(.9mm*var(--k));min-height:calc(6.5mm*var(--k))}" +
      ".line{gap:0 calc(5mm*var(--k));margin-bottom:calc(6mm*var(--k))}.stanza{margin-bottom:calc(9mm*var(--k))}.tl p{font-size:calc(17pt*var(--kt));line-height:1.38;margin-bottom:calc(5mm*var(--kt))}.eb{font-size:9.5pt}",
    page: "landscape",
    note: withWords ? "" : "Word meanings are not in the catalogue for this song yet",
    body: `${sky}${title}${body}`,
  }
}

function study(song: PdfSongInput, options: PdfOptions, plan: PdfPlan): Frame {
  const { lines, glossable } = linesOf(song, options)
  const rows = lines
    .map((line, index) => (glossable[index] ? words(line).map((w, j) => ({ w, g: plan.wordLanguages.map((c) => song.glosses?.byLanguage[c]?.[glossKey(index, j)] ?? "") })) : []))
    .flat()
  const seen = new Set<string>()
  const list = rows.filter((r) => (seen.has(r.w.toLowerCase()) ? false : (seen.add(r.w.toLowerCase()), true)) && r.g.some(Boolean))
  const note = list.length ? "" : "Word meanings are not in the catalogue for this song yet"
  const table = list.length
    ? `<table class="vocab">${list.map((r) => `<tr><td class="vw">${esc(r.w)}</td><td>${r.g.filter(Boolean).map(esc).join(" · ")}</td></tr>`).join("")}</table>`
    : '<p class="empty">No word list yet.</p>'
  return {
    css: "@page{size:297mm 210mm;margin:12mm 15mm}.c1{width:34%;padding-right:7mm}.c2{width:27%;padding:0 7mm;border-left:1px solid var(--rule);border-right:1px solid var(--rule)}.c3{padding-left:7mm}.vocab td{padding:1.3mm 0;border-bottom:1px dotted var(--rule);font:italic 400 9pt/1.3 var(--body);color:var(--gloss)}.vocab .vw{font:300 11pt/1.2 var(--lyric);font-style:normal;color:var(--ink);width:42%;padding-right:3mm}.empty{color:var(--muted);font-style:italic}.notes{margin-top:6mm}.notes i{display:block;height:7mm;border-bottom:1px solid var(--rule)}.w .g{display:none}.line{margin-bottom:2.4mm}",
    page: "landscape",
    note,
    body: `${head(song, options, plan)}<table><tr><td class="c1"><div class="eb col-h">Song</div>${songColumn(song, options, plan, false)}</td><td class="c2"><div class="eb col-h">Words</div>${table}</td><td class="c3 tl"><div class="eb col-h">Translation</div>${translationColumn(plan, false)}<div class="notes"><div class="eb col-h">Notes</div><i></i><i></i></div></td></tr></table>${foot(song, note)}`,
  }
}

function reader(song: PdfSongInput, options: PdfOptions, plan: PdfPlan): Frame {
  return {
    css: "@page{size:210mm 297mm;margin:16mm 18mm}h1{font-size:30pt}.w .r{font-size:16pt}.w .g{display:none}.line{display:block;margin-bottom:1.8mm}.w{display:inline;margin-right:2.2mm}.tl{margin-top:9mm;border-top:1px solid var(--rule);padding-top:6mm;column-count:" + Math.min(2, Math.max(1, plan.translations.length)) + ";column-gap:10mm}",
    page: "portrait",
    body: `${head(song, options, plan)}<div class="eb col-h">Song</div>${songColumn(song, options, plan, false)}<div class="tl">${translationColumn(plan, true)}</div>${foot(song, "")}`,
  }
}

function singing(song: PdfSongInput, options: PdfOptions, plan: PdfPlan): Frame {
  return {
    css: "@page{size:297mm 210mm;margin:14mm 20mm}header{margin-bottom:10mm}h1{font-size:34pt}.w .r{font-size:26pt;line-height:1.2}.w .g{display:none}.line{display:block;margin-bottom:3mm}.w{display:inline;margin-right:4mm}.stanza{margin-bottom:9mm}",
    page: "landscape",
    body: `${head(song, options, { ...plan, translations: [] })}${songColumn(song, options, plan, false)}${foot(song, "")}`,
  }
}

const CHUNK_CHARS = 230

/** Greedy: translation parts packed into slides of at most CHUNK_CHARS letters. */
function chunks(blocks: string[]): string[][] {
  const out: string[][] = [[]]
  let size = 0
  for (const b of blocks) {
    if (size > 0 && size + b.length > CHUNK_CHARS) {
      out.push([])
      size = 0
    }
    out[out.length - 1].push(b)
    size += b.length
  }
  return out
}

/** Type size in pt so the longest line fits the width and all the lines fit the height; as big as that allows. */
function fitSize(lineCount: number, longest: number, cw: number, wmm: number, heightMm: number, cap: number): number {
  const byWidth = (wmm / 25.4 * 72) / (Math.max(longest, 8) * cw)
  const byHeight = (heightMm / 25.4 * 72) / (lineCount * 1.22)
  return Math.round(Math.max(24, Math.min(cap, byWidth, byHeight)))
}

function stage(song: PdfSongInput, options: PdfOptions, plan: PdfPlan): Frame {
  const spec = STAGES[options.theme]
  const { lines } = linesOf(song, options)
  const parts = stanzas(lines)
  const first = plan.translations[0]
  const paired = !!first && first.blocks.length === parts.length
  const slides: string[] = []
  const bar = (n: number, total: number) => `<div class="bar eb"><span>№ ${song.number} · ${esc(song.title)}</span><span>${n} / ${total}</span></div>`
  const wrap = (inner: string, n: number, total: number, cls = "") => `<section class="s ${cls}"><div class="bg"></div><div class="sc"></div><div class="gl"></div><div class="c">${inner}</div>${bar(n, total)}</section>`
  const stanzaSlides = parts.map((st, i) => {
    const longest = Math.max(...st.map((x) => x.line.length))
    const room = paired ? 82 : 118
    const size = fitSize(st.length, longest, spec.cw, spec.wmm, room, paired ? 60 : 84)
    const ts = Math.max(18, Math.min(30, Math.round(size * 0.52)))
    const tr = paired ? plan.translations.slice(0, st.length <= 4 ? 2 : 1).map((t) => `<p>${esc(t.blocks[i] ?? "").replace(/\n/g, "<br>")}</p>`).join("") : ""
    return { size, ts, html: `<div class="no">${i + 1}</div><div class="p"><div class="ly" style="--fs:${size}pt">${st.map((x) => `<div class="l">${esc(x.line)}</div>`).join("")}</div>${tr ? `<div class="tr" style="--ts:${ts}pt">${tr}</div>` : ""}</div>` }
  })
  const trSlides = paired ? [] : plan.translations.flatMap((t) => chunks(t.blocks).map((c) => ({ code: t.code, blocks: c })))
  const total = 1 + stanzaSlides.length + trSlides.length
  const titleSize = song.title.length <= 16 ? 92 : song.title.length <= 26 ? 70 : 52
  const meta = [song.composed ? `Composed ${song.composed}` : "", song.raga ? `Raga ${song.raga}` : "", song.tala ? `Tala ${song.tala}` : ""].filter(Boolean).join("  ·  ")
  slides.push(wrap(`<div class="cv"><div class="eb">Prabhat Samgiita · № ${song.number}</div><h1 style="font-size:${titleSize}pt">${esc(song.title)}</h1>${meta ? `<div class="eb mt">${esc(meta)}</div>` : ""}</div>`, 1, total, "cover"))
  stanzaSlides.forEach((s, i) => slides.push(wrap(s.html, i + 2, total)))
  trSlides.forEach((t, i) => {
    const text = t.blocks.map((b) => `<p>${esc(b).replace(/\n/g, "<br>")}</p>`).join("")
    const size = Math.max(22, Math.min(34, Math.round(34 - t.blocks.join("").length / 22)))
    slides.push(wrap(`<div class="p"><div class="eb lang">${esc(languageName(t.code))}</div><div class="tr big" style="--ts:${size}pt">${text}</div></div>`, 2 + stanzaSlides.length + i, total))
  })
  const css =
    "@page{size:297mm 167mm;margin:0}" +
    ".s{position:relative;width:297mm;height:167mm;overflow:hidden;break-after:page;page-break-after:always;background:var(--paper);color:var(--stext)}.s:last-child{break-after:auto;page-break-after:auto}" +
    `.bg{position:absolute;inset:-8%;background:var(--ink) url('${song.photo ?? ""}') center/cover;filter:blur(var(--blur,24px))}` +
    ".sc,.gl{position:absolute;inset:0}.c{position:absolute;inset:0;padding:14mm 20mm 20mm;display:flex;flex-direction:column;justify-content:center}" +
    ".p{position:relative}.ly .l{font:var(--lw) var(--fs)/1.2 var(--lyric);color:var(--stext)}" +
    ".tr{margin-top:7mm}.tr p{font:400 var(--ts)/1.3 var(--body);color:var(--sdim);margin-bottom:3mm}.tr.big{margin-top:5mm}.tr.big p{color:var(--stext);margin-bottom:5mm}.lang{color:var(--sdim);margin-bottom:5mm}" +
    ".bar{position:absolute;left:20mm;right:20mm;bottom:9mm;display:flex;justify-content:space-between;color:var(--sdim)}" +
    ".cv h1{font:var(--hw) 80pt/1 var(--display);letter-spacing:-.02em;color:var(--stext);margin:6mm 0}.cv .eb{color:var(--sdim)}.cv .mt{margin-top:6mm}" +
    ".cover .no{display:none}.s .eb{font-size:11pt}.bar.eb{font-size:10pt}" +
    spec.css
  return { css, page: "stage", body: slides.join("") }
}

const BUILDERS: Record<PdfVariantId, (s: PdfSongInput, o: PdfOptions, p: PdfPlan) => Frame> = { sheet, study, reader, singing, projector: stage }

export function buildSongPdfHtml(song: PdfSongInput, options: PdfOptions): { html: string; plan: PdfPlan; page: "landscape" | "portrait" | "stage" } {
  const plan = planFor(song, options)
  const frame = BUILDERS[options.variant](song, options, plan)
  // The page margin is painted white by print engines, so the sheet is full-bleed (margin 0) and the margin becomes body padding.
  const m = /@page\{size:([^;}]+);margin:([^}]+)\}/.exec(frame.css)
  if (m) frame.css = frame.css.replace(m[0], `@page{size:${m[1]};margin:0}body{padding:${m[2]};box-decoration-break:clone;-webkit-box-decoration-break:clone}`)
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>PS ${song.number} ${esc(song.title)}</title><link rel="stylesheet" href="${THEMES[options.theme].fonts}"><style>${THEMES[options.theme].css}${CSS}${frame.css}</style></head><body>${frame.body}</body></html>`
  return { html, plan, page: frame.page as "landscape" | "portrait" | "stage" }
}
