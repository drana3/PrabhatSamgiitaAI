"use client"

import { useEffect, useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import { ExpertSheetImage, NotationMatraSheet, playCellsInBrowser } from "@/components/notation-matra-sheet"
import { PracticeCoach } from "@/components/practice-coach"
import { fetchNotation } from "@/lib/api"
import type { NotationLine, TransposedNotation } from "@/lib/api"
import {
  alignNotationToSongLines,
  buildDisplayNotes,
  distributeNotesToWords,
  formatPracticeSequence,
  hasPlayableNotation,
  HINDI_SARGAM_LEGEND,
  notationCoverage,
  notationPdfHref,
  resolveLineLyrics,
  toDevanagariSwara,
  toLatinSwara,
} from "@/lib/sargam-display"
import { buildNotationSheetLine } from "@prabhat/core"

const tonics = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const scaleSteps = [0, 2, 4, 5, 7, 9, 11, 12]
const swaras = ["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni", "Sa′"]
const hindiSwaras = ["सा", "रे", "ग", "म", "प", "ध", "नि", "सां"]
const beginnerAlankar = "Sa Re Ga Re · Re Ga Ma Ga · Ga Ma Pa Ma · Ma Pa Dha Pa · Pa Dha Ni Dha · Dha Ni Sa′ Ni"
const beginnerAlankarDescending = "Sa′ Ni Dha Ni · Ni Dha Pa Dha · Dha Pa Ma Pa · Pa Ma Ga Ma · Ma Ga Re Ga · Ga Re Sa Re"

function harmoniumKeys(tonic: string) {
  const start = Math.max(tonics.indexOf(tonic), 0)
  return scaleSteps.map((step) => tonics[(start + step) % tonics.length])
}

export function HarmoniumPractice({
  songNumber,
  initialNotation,
  sourceUrl,
  sourceStatus: _sourceStatus,
  songLyricLines = [],
  originalLyricLines = [],
}: {
  songNumber: number
  initialNotation: TransposedNotation | null
  sourceUrl?: string | null
  sourceStatus?: string | null
  songLyricLines?: string[]
  originalLyricLines?: string[]
}) {
  const [notation, setNotation] = useState(initialNotation)
  const [tonic, setTonic] = useState(initialNotation?.target_scale || "C")
  const [system, setSystem] = useState<"guide" | "keys" | "sargam">("sargam")
  const [loading, setLoading] = useState(!initialNotation)

  useEffect(() => {
    if (initialNotation) return
    let active = true
    setLoading(true)
    void fetchNotation(songNumber)
      .then((next) => {
        if (!active) return
        if (next) {
          setNotation(next)
          setTonic(next.target_scale || "C")
        }
        setLoading(false)
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [initialNotation, songNumber])
  const playable = hasPlayableNotation(notation)
  const incomplete = notation
    ? notationCoverage(
        notation.notation.lines.length,
        Math.max(songLyricLines.length, originalLyricLines.length),
      ).incomplete
    : false
  const pdfHref = notationPdfHref(sourceUrl, { playable, incomplete })

  async function changeTonic(value: string) {
    setTonic(value)
    if (!initialNotation) return
    setLoading(true)
    const next = await fetchNotation(songNumber, value)
    if (next) setNotation(next)
    setLoading(false)
  }

  function hearLine(lineIndex: number) {
    if (!notation) return
    const line = notation.notation.lines[lineIndex]
    if (!line) return
    const sheet = buildNotationSheetLine(line, notation.notation.tala)
    void playCellsInBrowser(sheet.cells, notation.notation.tempo_bpm)
  }

  return (
    <details id="notation" className="group scroll-mt-28 rounded-2xl border border-gold-500/30 bg-gold-50/50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 marker:content-none sm:p-6">
        <div>
          <p className="eyebrow">Optional learning studio</p>
          <h2 className="mt-2 font-serif text-3xl text-navy-950">Practise on harmonium</h2>
          <p className="mt-2 text-sm text-stone-600">
            {pdfHref ? HINDI_SARGAM_LEGEND : "Practice the sargam available in the app."}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-950 text-xl text-white transition group-open:rotate-45"
        >
          +
        </span>
      </summary>

      {hasPlayableNotation(notation) ? (
        <div className="border-t border-gold-500/20 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-600">
              अपना Sa चुनें, फिर एक-एक पंक्ति अभ्यास करें · Choose your Sa, then practise one line at a time.
            </p>
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${
                notation.verification_status.includes("verified")
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-900"
              }`}
            >
              {notation.verification_status === "expert_verified"
                ? "Expert-verified sheet"
                : notation.verification_status.includes("verified")
                  ? "Verified notation"
                  : "Practice draft"}
            </span>
          </div>
          {notation.verification_status === "expert_verified" ? (
            <ExpertSheetImage songNumber={songNumber} />
          ) : null}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-navy-900/10 bg-gold-50 p-3">
            <label className="flex items-center gap-2 text-xs font-bold text-navy-950">
              Your Sa / आपका Sa
              <select
                value={tonic}
                onChange={(event) => void changeTonic(event.target.value)}
                className="rounded-lg border border-gold-500/40 bg-white px-3 py-2"
              >
                {tonics.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap rounded-lg border border-navy-900/10 bg-white p-1">
              <ModeButton active={system === "sargam"} onClick={() => setSystem("sargam")}>
                हिंदी सारगम + keys
              </ModeButton>
              <ModeButton active={system === "keys"} onClick={() => setSystem("keys")}>
                Keys only
              </ModeButton>
              <ModeButton active={system === "guide"} onClick={() => setSystem("guide")}>
                Warm-up guide
              </ModeButton>
            </div>
            {loading ? (
              <LoadingIndicator label="Changing Sa" compact />
            ) : (
              <span className="ml-auto text-xs text-stone-600">Sa = {tonic}</span>
            )}
          </div>
          {system === "guide" ? (
            <SargamGuide tonic={tonic} />
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-gold-500/25 bg-white p-4 sm:p-5">
                  <p className="eyebrow">Song melody</p>
                <h3 className="mt-2 font-serif text-2xl text-navy-950">
                  {system === "sargam"
                    ? "पंक्ति · हिंदी सारगम · मात्रा शीट · Keys"
                    : "Lyric · Harmonium keys"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {pdfHref ? HINDI_SARGAM_LEGEND : "Practice the sargam available in the app."}
                </p>
                {(() => {
                  const coverage = notationCoverage(
                    notation.notation.lines.length,
                    Math.max(songLyricLines.length, originalLyricLines.length),
                  )
                  if (!coverage.incomplete) return null
                  return (
                    <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">
                      अभ्यास ड्राफ्ट में {coverage.covered}/{coverage.total} पंक्तियों का हिंदी सारगम है (अक्सर
                      Andromeda PDF के पहले पृष्ठ से)। बाकी पंक्तियाँ बिना अनुमानित notes के रहती हैं
                      {pdfHref ? (
                        <>
                          {" · "}
                          <a href={pdfHref} target="_blank" rel="noreferrer" className="font-semibold underline">
                            पूरी स्वरलिपि PDF खोलें
                          </a>
                          .
                        </>
                      ) : (
                        "."
                      )}
                    </p>
                  )
                })()}
              </div>
              {alignNotationToSongLines(
                notation.notation.lines,
                songLyricLines.length >= originalLyricLines.length ? songLyricLines : originalLyricLines,
              ).map(({ line, lineIndex }) => (
                <div key={`notation-line-${lineIndex}`}>
                  <LinePracticeCard
                    line={line}
                    lineIndex={lineIndex}
                    system={system}
                    songLyricLines={songLyricLines}
                    originalLyricLines={originalLyricLines}
                    onHear={() => hearLine(lineIndex)}
                    hasPdfLink={Boolean(pdfHref)}
                  />
                  {line ? (
                    <NotationMatraSheet
                      songNumber={songNumber}
                      line={line}
                      lineIndex={lineIndex}
                      tala={notation.notation.tala}
                      tempoBpm={notation.notation.tempo_bpm}
                      expertVerified={notation.verification_status === "expert_verified"}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <PracticeCoach notation={notation} lyricLines={songLyricLines} />
        </div>
      ) : null}
    </details>
  )
}

function LinePracticeCard({
  line,
  lineIndex,
  system,
  songLyricLines,
  originalLyricLines,
  onHear,
  hasPdfLink = false,
}: {
  line: NotationLine | null
  lineIndex: number
  system: "keys" | "sargam"
  songLyricLines: string[]
  originalLyricLines: string[]
  onHear: () => void
  hasPdfLink?: boolean
}) {
  const notes = line ? buildDisplayNotes(line) : []
  const hasNotes = notes.length > 0
  const lyrics = line
    ? resolveLineLyrics(line, lineIndex, songLyricLines, originalLyricLines)
    : {
        roman: songLyricLines[lineIndex]?.trim() || originalLyricLines[lineIndex]?.trim() || `Line ${lineIndex + 1}`,
        original: originalLyricLines[lineIndex]?.trim() || null,
      }
  const wordGroups = distributeNotesToWords(lyrics.roman.split(/\s+/).filter(Boolean), notes)

  return (
    <article className="overflow-hidden rounded-2xl border border-navy-900/10 bg-white shadow-sm">
      <div className="border-b border-gold-500/20 bg-ivory-50 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold-700">
              पंक्ति {lineIndex + 1} · Song line {lineIndex + 1}
            </p>
            <p className="mt-2 font-serif text-lg font-semibold leading-8 text-navy-950 sm:text-xl">{lyrics.roman}</p>
            {lyrics.original && lyrics.original !== lyrics.roman ? (
              <p className="mt-1 font-serif text-base leading-7 text-stone-700" lang="hi">
                {lyrics.original}
              </p>
            ) : null}
            {line?.transliteration && line.transliteration !== lyrics.roman ? (
              <p className="mt-1 text-xs text-stone-500">{line.transliteration}</p>
            ) : null}
          </div>
          {hasNotes ? (
            <button type="button" onClick={onHear} className="soft-chip shrink-0">
              ▶ Harmonium
            </button>
          ) : null}
        </div>
      </div>

      {hasNotes ? (
        <div className="border-l-4 border-gold-400 bg-gold-50/60 px-4 py-4 sm:px-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-900">
            ↑ इस पंक्ति के लिए यह सारगम बजाएँ · Play this Sargam for the line above
          </p>

          {system === "sargam" && wordGroups.length > 1 ? (
            <div className="mt-4 overflow-x-auto">
              <div className="inline-flex min-w-full gap-3">
                {wordGroups.map((group, index) => (
                  <div
                    key={`${line?.line_number ?? "empty"}-word-${index}`}
                    className="min-w-[4.5rem] flex-1 rounded-xl border border-navy-900/10 bg-white px-2 py-3 text-center"
                  >
                    <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500">
                      {group.word}
                    </p>
                    <p className="mt-2 font-serif text-lg font-bold leading-7 text-navy-950" lang="hi">
                      {formatPracticeSequence(group.notes, "devanagari").replace(/ · /g, " ")}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-stone-600">
                      {formatPracticeSequence(group.notes, "latin").replace(/ · /g, " ")}
                    </p>
                    <p className="mt-1 text-[10px] font-bold text-gold-800">
                      {formatPracticeSequence(group.notes, "key").replace(/ · /g, " ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className={`${system === "sargam" && wordGroups.length > 1 ? "mt-4 border-t border-gold-500/20 pt-4" : "mt-3"}`}>
            {system === "sargam" ? (
              <>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">पूरी पंक्ति · Full line Sargam</p>
                <p className="mt-2 font-serif text-2xl font-bold leading-9 tracking-wide text-navy-950 sm:text-3xl" lang="hi">
                  {formatPracticeSequence(notes, "devanagari")}
                </p>
                <p className="mt-2 font-serif text-base font-semibold tracking-wide text-navy-800">
                  {formatPracticeSequence(notes, "latin")}
                </p>
              </>
            ) : (
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Harmonium keys for this line</p>
            )}
            <p className="mt-2 text-sm font-bold tracking-wide text-gold-900">
              Keys: {formatPracticeSequence(notes, "key")}
            </p>
          </div>
        </div>
      ) : (
        <p className="px-4 py-4 text-sm text-stone-500 sm:px-5">
          {hasPdfLink
            ? "Notation for this lyric line is not in the practice draft yet — use the source PDF for the full melody."
            : "Notation for this lyric line is not in the practice draft yet."}
        </p>
      )}

      {hasNotes && line ? (
        <details className="border-t border-navy-900/8 bg-ivory-50/80">
          <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-navy-950 marker:content-none sm:px-5">
            Beat-by-beat detail · विस्तार से देखें
          </summary>
          <div className="flex gap-2 overflow-x-auto px-4 pb-4 sm:px-5">
            {line.measures.flatMap((measure) =>
              measure.beats.map((beat, beatIndex) => (
                <div
                  key={`${line.line_number}-${beat.beat}-${beatIndex}`}
                  className="min-w-20 rounded-xl border border-gold-500/25 bg-white p-3 text-center"
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-stone-400">Beat {beat.beat}</p>
                  <p className="mt-2 font-serif text-xl font-bold text-navy-950" lang="hi">
                    {beat.notes.map((note) => toDevanagariSwara(note.sargam, note.octave ?? "middle")).join(" ") || "–"}
                  </p>
                  <p className="mt-1 font-serif text-sm text-navy-800">
                    {beat.notes.map((note) => toLatinSwara(note.sargam)).join(" ") || "–"}
                  </p>
                  <p className="mt-1 text-[10px] text-stone-500">
                    {beat.notes
                      .map((note) => note.western?.replace(/\d+$/, "") || "–")
                      .join(" ")}
                  </p>
                </div>
              )),
            )}
          </div>
        </details>
      ) : null}
    </article>
  )
}

function ModeButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${active ? "bg-navy-950 text-white" : "text-navy-950"}`}
    >
      {children}
    </button>
  )
}

function SargamGuide({ tonic }: { tonic: string }) {
  const keys = harmoniumKeys(tonic)
  return (
    <section className="mt-4 rounded-2xl bg-navy-950 p-5 text-white sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-300">Optional warm-up</p>
          <h3 className="mt-2 font-serif text-2xl">Sargam warm-up guide</h3>
        </div>
        <p className="text-xs text-navy-100">
          Current Sa: <strong className="text-white">{tonic}</strong>
        </p>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {swaras.map((swara, index) => (
          <div key={swara} className="rounded-xl border border-white/15 bg-white/8 p-3 text-center">
            <p className="text-2xl font-semibold text-gold-200" lang="hi">
              {hindiSwaras[index]}
            </p>
            <p className="mt-1 font-serif text-sm font-semibold text-white">{swara}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-navy-100">Key {keys[index]}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-2xl border border-white/15 bg-white/8 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-300">On harmonium keys</p>
            <h4 className="mt-1 font-serif text-xl text-white">Visual key guide</h4>
          </div>
          <p className="text-xs text-navy-100">Press from left to right for aroha</p>
        </div>
        <div
          className="mt-4 flex min-w-0 overflow-x-auto rounded-xl border-4 border-gold-900/55 bg-gold-900/55 p-1"
          role="img"
          aria-label={`Harmonium key guide with Sa on ${tonic}`}
        >
          {keys.map((key, index) => (
            <div
              key={`${key}-${index}`}
              className="relative flex h-28 min-w-14 flex-1 flex-col items-center justify-end border-r border-stone-300 bg-ivory-50 px-1 pb-2 text-navy-950 last:border-r-0 sm:min-w-16"
            >
              <span className="absolute inset-x-1 top-2 rounded-md bg-navy-950 px-1 py-2 text-center text-[10px] font-bold text-white">
                {key}
              </span>
              <span className="text-lg font-semibold" lang="hi">
                {hindiSwaras[index]}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-stone-500">{swaras[index]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <GuideRow label="Aroha · ascending" value="Sa Re Ga Ma Pa Dha Ni Sa′" />
        <GuideRow label="Avaroha · descending" value="Sa′ Ni Dha Pa Ma Ga Re Sa" />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <GuideRow label="Beginner alankar · ascending" value={beginnerAlankar} />
        <GuideRow label="Beginner alankar · descending" value={beginnerAlankarDescending} />
      </div>
      <div className="mt-4 grid gap-3 text-xs leading-6 text-navy-100 sm:grid-cols-2">
        <div className="rounded-xl bg-white/8 p-4">
          <strong className="text-white">Key points:</strong> Sa and Pa are stable swaras. Re, Ga, Dha, and Ni can be
          komal; Ma can be tivra. Begin slowly and keep each note even.
        </div>
        <div className="rounded-xl bg-white/8 p-4">
          <strong className="text-white">Reading marks:</strong> amber chips = komal swara, green chip = tivra Ma, a
          lower dot means lower octave, and a prime means upper octave.
        </div>
      </div>
      <p className="mt-4 text-[11px] leading-5 text-navy-200">
        The key map and alankar are general learning aids. Song cards below preserve the available source notation
        rather than inventing missing notes or a raga-specific pakad.
      </p>
    </section>
  )
}

function GuideRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/15 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold-300">{label}</p>
      <p className="mt-2 font-serif text-lg tracking-wide text-white">{value}</p>
    </div>
  )
}
