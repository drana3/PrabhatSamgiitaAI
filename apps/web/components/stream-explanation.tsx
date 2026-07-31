"use client"

import { useState } from "react"

import { streamExplanation } from "@/lib/explain"

export function StreamExplanation({ songNumber }: { songNumber: number }) {
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)

  return (
    <section className="rounded-3xl border border-ink-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ember-700">Grounded AI</p>
          <h2 className="mt-2 font-serif text-2xl text-ink-900">Streamed explanation</h2>
        </div>
        <button
          type="button"
          className="rounded-2xl bg-ember-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ember-600 disabled:opacity-50"
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
      <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-ink-50 p-4 text-sm leading-6 text-ink-800">
        {text || "The assistant will only use grounded, verified source data."}
      </p>
    </section>
  )
}
