"use client"

import { useCallback, useEffect, useState } from "react"

import { AdminShell } from "@/components/admin-shell"
import { readErrorDetail } from "@/lib/read-error-detail"

type RagaCollection = {
  label: string
  value: string
  description?: string | null
  song_numbers: number[]
  count: number
}

type RagaConflict = {
  song_number: number
  existing_raga: string
  new_raga: string
}

function parseSongNumbers(raw: string): number[] {
  const tokens = raw.split(/[\s,;]+/).map((part) => part.trim()).filter(Boolean)
  const numbers: number[] = []
  for (const token of tokens) {
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(token)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end) {
        for (let value = start; value <= end; value += 1) numbers.push(value)
      }
      continue
    }
    const value = Number(token)
    if (Number.isFinite(value)) numbers.push(value)
  }
  return [...new Set(numbers)].sort((a, b) => a - b)
}

export function AdminRagasPanel() {
  const [items, setItems] = useState<RagaCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [label, setLabel] = useState("")
  const [description, setDescription] = useState("")
  const [numbersText, setNumbersText] = useState("")
  const [assignMetadata, setAssignMetadata] = useState(true)
  const [busy, setBusy] = useState(false)
  const [conflicts, setConflicts] = useState<RagaConflict[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/raga-collections", { cache: "no-store", credentials: "same-origin" })
      if (!response.ok) {
        setError(readErrorDetail(await response.json().catch(() => null), `Load failed (${response.status})`))
        setItems([])
        return
      }
      const payload = (await response.json()) as { items?: RagaCollection[] }
      setItems(payload.items ?? [])
    } catch {
      setError("Could not reach the admin service")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function fillEditor(collection: RagaCollection) {
    setLabel(collection.label)
    setDescription(collection.description ?? "")
    setNumbersText(collection.song_numbers.join(", "))
    setConflicts([])
  }

  async function save(overwrite = false) {
    const song_numbers = parseSongNumbers(numbersText)
    if (!label.trim()) {
      setError("Raga name is required")
      return
    }
    if (!song_numbers.length) {
      setError("Add at least one song number (1–5018)")
      return
    }
    setBusy(true)
    setError("")
    setConflicts([])
    try {
      const response = await fetch("/api/admin/raga-collections", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          description: description.trim() || null,
          song_numbers,
          assign_metadata: assignMetadata,
          overwrite,
        }),
      })
      const body = await response.json().catch(() => null)
      if (response.status === 409 && body && typeof body === "object" && "detail" in body) {
        const detail = (body as { detail?: { conflicts?: RagaConflict[] } }).detail
        const rows = detail?.conflicts ?? []
        setConflicts(rows)
        setError("Some songs already have a different raga. Review conflicts and save with overwrite.")
        return
      }
      if (!response.ok) {
        setError(readErrorDetail(body, `Save failed (${response.status})`))
        return
      }
      await load()
      setConflicts([])
    } catch {
      setError("Could not reach the admin service")
    } finally {
      setBusy(false)
    }
  }

  async function remove(collectionLabel: string) {
    if (!window.confirm(`Delete raga collection “${collectionLabel}”?`)) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch(
        `/api/admin/raga-collections?label=${encodeURIComponent(collectionLabel)}`,
        { method: "DELETE", credentials: "same-origin" },
      )
      if (!response.ok) {
        setError(readErrorDetail(await response.json().catch(() => null), `Delete failed (${response.status})`))
        return
      }
      if (label === collectionLabel) {
        setLabel("")
        setDescription("")
        setNumbersText("")
      }
      await load()
    } catch {
      setError("Could not reach the admin service")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell
      active="ragas"
      title="Raga collections"
      description="Curate browse lists and attach per-song Raga metadata. Song numbers must be between 1 and 5018."
      maxWidth="5xl"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-navy-950">Add or update raga</h2>
          <div className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="font-semibold text-navy-900">Raga name</span>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 text-sm"
                placeholder="Yaman"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-navy-900">Description (optional)</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                className="mt-1.5 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-navy-900">Song numbers</span>
              <textarea
                value={numbersText}
                onChange={(event) => setNumbersText(event.target.value)}
                rows={4}
                className="mt-1.5 w-full rounded-xl border border-navy-900/15 px-3 py-2.5 font-mono text-sm"
                placeholder="1565 or 138-150, 828"
              />
              <p className="mt-1 text-xs text-stone-500">Comma-separated or ranges (e.g. 138-150).</p>
            </label>
            <label className="flex items-center gap-2 text-sm text-navy-950">
              <input
                type="checkbox"
                checked={assignMetadata}
                onChange={(event) => setAssignMetadata(event.target.checked)}
              />
              Set per-song Raga metadata on save
            </label>
            {conflicts.length ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-semibold">Overwrite required</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {conflicts.map((row) => (
                    <li key={row.song_number}>
                      PS {row.song_number}: “{row.existing_raga}” → “{row.new_raga}”
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save(true)}
                  className="mt-3 rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  Save and overwrite metadata
                </button>
              </div>
            ) : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void save(false)}
                className="rounded-full bg-gold-500 px-5 py-2.5 text-sm font-semibold text-navy-950"
              >
                {busy ? "Saving…" : "Save collection"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setLabel("")
                  setDescription("")
                  setNumbersText("")
                  setConflicts([])
                  setError("")
                }}
                className="outline-button px-4 py-2.5 text-sm"
              >
                Clear form
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-navy-950">Published collections</h2>
            <span className="text-xs font-semibold text-stone-500">{items.length} total</span>
          </div>
          {loading ? (
            <p className="mt-4 text-sm text-stone-500">Loading…</p>
          ) : (
            <ul className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto">
              {items.map((row) => (
                <li
                  key={row.label}
                  className="flex items-start justify-between gap-3 rounded-xl border border-navy-900/8 px-3 py-2.5"
                >
                  <button type="button" onClick={() => fillEditor(row)} className="min-w-0 text-left">
                    <p className="text-sm font-semibold text-navy-950">{row.label}</p>
                    <p className="text-xs text-stone-500">{row.count} songs</p>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(row.label)}
                    className="shrink-0 text-xs font-semibold text-red-700"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  )
}