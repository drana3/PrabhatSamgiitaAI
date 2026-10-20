"use client"

import { useMemo, useState, type MouseEvent } from "react"

import { CopyTextButton } from "@/components/copy-text-button"
import { submitFeedback } from "@/lib/api"

type Props = {
  songNumber: number
  roman: string
  devanagari?: string | null
  status?: string | null
}

function statusLabel(status: string | null | undefined): string {
  if (status === "approved") return "Approved"
  if (status === "pending_review") return "Pending review"
  if (status === "provisional") return "Provisional"
  return ""
}

/** Keep #lyrics pinned in the viewport when script toggle reflows the block. */
function retainLyricsScroll(mutate: () => void) {
  if (typeof window === "undefined") {
    mutate()
    return
  }
  const lyrics = document.getElementById("lyrics")
  const topBefore = lyrics?.getBoundingClientRect().top
  const yBefore = window.scrollY
  mutate()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (lyrics && topBefore != null) {
        const delta = lyrics.getBoundingClientRect().top - topBefore
        if (Math.abs(delta) > 1) {
          window.scrollBy({ top: delta, left: 0, behavior: "auto" })
          return
        }
      }
      if (Math.abs(window.scrollY - yBefore) > 1) {
        window.scrollTo({ top: yBefore, left: 0, behavior: "auto" })
      }
    })
  })
}

export function LyricsScriptToggle({ songNumber, roman, devanagari, status }: Props) {
  const hasDevanagari = Boolean(devanagari?.trim())
  const [script, setScript] = useState<"roman" | "devanagari">("roman")
  const [reportOpen, setReportOpen] = useState(false)
  const [reportNote, setReportNote] = useState("")
  const [reportBusy, setReportBusy] = useState(false)
  const [reportMsg, setReportMsg] = useState<string | null>(null)
  const [reportErr, setReportErr] = useState<string | null>(null)

  const text = useMemo(
    () => (script === "devanagari" && hasDevanagari ? devanagari!.trim() : roman),
    [script, hasDevanagari, devanagari, roman],
  )
  const badge = script === "devanagari" ? statusLabel(status) : ""

  function selectScript(next: "roman" | "devanagari") {
    if (next === script) return
    retainLyricsScroll(() => {
      setScript(next)
      if (next === "roman") setReportOpen(false)
    })
  }

  async function sendReport() {
    setReportBusy(true)
    setReportErr(null)
    setReportMsg(null)
    try {
      const note = reportNote.trim() || "Please review Devanagari lyrics for this song."
      const result = await submitFeedback({
        category: "devanagari",
        rating: 2,
        comment: `Devanagari report for song #${songNumber}\n${note}`,
        page_path: `/songs/${songNumber}`,
      })
      setReportMsg(result.message)
      setReportNote("")
      setReportOpen(false)
    } catch (err) {
      setReportErr(err instanceof Error ? err.message : "Could not send report")
    } finally {
      setReportBusy(false)
    }
  }

  return (
    <div>
      {hasDevanagari ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {(
            [
              { id: "roman" as const, label: "Roman" },
              { id: "devanagari" as const, label: "Devanagari" },
            ] as const
          ).map((item) => {
            const active = script === item.id
            return (
              <button
                key={item.id}
                type="button"
                // Avoid focus-driven scrollIntoView jumping the song page mid-section.
                onMouseDown={(event: MouseEvent<HTMLButtonElement>) => {
                  if (event.button === 0) event.preventDefault()
                }}
                onClick={() => selectScript(item.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-navy-950 text-white"
                    : "border border-navy-900/15 bg-white text-stone-600 hover:border-navy-900/30"
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {/*
        Lyrics first — status / disclaimer / report sit below so toggling Devanagari
        does not insert chrome above the verse and shove scroll into the gap between
        Lyrics and Listen.
      */}
      <p className="mt-5 [overflow-anchor:none] whitespace-pre-wrap font-serif text-xl leading-[1.7] text-navy-950 sm:text-2xl">
        {text}
      </p>
      <div className="mt-4">
        <CopyTextButton text={text} label="Copy lyrics" />
      </div>

      {script === "devanagari" && hasDevanagari ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {badge ? (
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                status === "approved"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-50 text-amber-900"
              }`}
            >
              {badge}
            </span>
          ) : null}
          <span className="text-[11px] text-stone-500">May contain mistakes.</span>
          <button
            type="button"
            onMouseDown={(event: MouseEvent<HTMLButtonElement>) => {
              if (event.button === 0) event.preventDefault()
            }}
            onClick={() => {
              retainLyricsScroll(() => {
                setReportOpen((v) => !v)
                setReportErr(null)
              })
            }}
            className="text-[11px] font-semibold text-gold-700 underline underline-offset-2"
          >
            Report
          </button>
        </div>
      ) : null}

      {script === "devanagari" && hasDevanagari && reportOpen ? (
        <div className="mt-2 space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
          <textarea
            value={reportNote}
            onChange={(e) => setReportNote(e.target.value)}
            rows={2}
            placeholder="What looks wrong? (optional)"
            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-navy-950 outline-none focus:border-gold-500"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={reportBusy}
              onClick={() => void sendReport()}
              className="rounded-full bg-navy-950 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {reportBusy ? "Sending…" : "Submit to admin"}
            </button>
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              className="rounded-full border border-navy-900/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-navy-950"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {reportMsg ? <p className="mt-2 text-xs text-emerald-800">{reportMsg}</p> : null}
      {reportErr ? <p className="mt-2 text-xs text-red-700">{reportErr}</p> : null}
    </div>
  )
}
