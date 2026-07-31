"use client"

import { useState } from "react"

import { streamExplanation } from "@/lib/explain"

export function StreamExplanation({ songNumber }: { songNumber: number }) {
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)

  return (
    <section className="rounded-[2rem] border border-ink-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ember-700">Grounded AI</p>
          <h2 className="mt-2 font-serif text-3xl text-ink-900">Streamed explanation</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">
            Ask the assistant to explain the song, and it will answer only from verified source material.
          </p>
        </div>
        <button
          type="button"
          className="rounded-full bg-gradient-to-r from-ember-500 to-amber-400 px-5 py-3 text-sm font-semibold text-white transition hover:from-ember-600 hover:to-amber-500 disabled:opacity-60"
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            setText("")
            await streamExplanation(songNumber, (chunk) => setText((current) => `${current}${current ? "\n" : ""}${chunk}`))
            setLoading(false)
          }}
        >
          {loading ? "Streaming..." : "Generate"}
        </button>
      </div>
      <div className="mt-5 rounded-[1.5rem] border border-ink-100 bg-gradient-to-br from-ink-50 to-white p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-ink-500">
          <span className="h-2 w-2 rounded-full bg-ember-500" />
          Live response
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink-800">
          {text || "The assistant will only use grounded, verified source data."}
        </p>
      </div>
    </section>
  )
}
