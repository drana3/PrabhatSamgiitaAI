"use client"

import { useCallback, useEffect, useState } from "react"

import { readErrorDetail } from "@/lib/read-error-detail"

export type YoutubeScanChannel = {
  id: string
  name: string
  channel_id: string
  channel_url: string
  is_trusted: boolean
  is_active: boolean
  notes: string | null
  last_scanned_at: string | null
  last_scan_discovered: number
  last_scan_new: number
  last_scan_known: number
  created_at: string
}

export type YoutubeScanResult = {
  discovered: number
  already_known: number
  new_queued_for_review: number
  new_auto_linked: number
}

export function AdminYoutubeChannelsPanel() {
  const [channels, setChannels] = useState<YoutubeScanChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [channelUrl, setChannelUrl] = useState("")
  const [channelId, setChannelId] = useState("")
  const [isTrusted, setIsTrusted] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/youtube-channels", {
        cache: "no-store",
        credentials: "same-origin",
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not load YouTube channels"))
        setChannels([])
        return
      }
      setChannels((body as { items?: YoutubeScanChannel[] }).items ?? [])
    } catch {
      setError("Could not reach the admin service")
      setChannels([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function addChannel(event: React.FormEvent) {
    event.preventDefault()
    setBusyId("add")
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/youtube-channels", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          channel_url: channelUrl,
          channel_id: channelId || null,
          is_trusted: isTrusted,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not add channel"))
        return
      }
      setNotice("Channel added.")
      setName("")
      setChannelUrl("")
      setChannelId("")
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function scanChannel(id: string) {
    setBusyId(id)
    setError("")
    setNotice("")
    try {
      const response = await fetch(`/api/admin/youtube-channels/${encodeURIComponent(id)}/scan`, {
        method: "POST",
        credentials: "same-origin",
      })
      const body = (await response.json().catch(() => null)) as YoutubeScanResult | null
      if (!response.ok) {
        setError(readErrorDetail(body, "Scan failed"))
        return
      }
      setNotice(
        `Scan complete: ${body?.new_queued_for_review ?? 0} new for review, ` +
          `${body?.new_auto_linked ?? 0} auto-linked, ` +
          `${body?.already_known ?? 0} already in database (${body?.discovered ?? 0} found on channel).`,
      )
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function scanAll() {
    setBusyId("all")
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/youtube-channels/scan-all", {
        method: "POST",
        credentials: "same-origin",
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Scan all failed"))
        return
      }
      const totals = body as {
        new_queued_for_review?: number
        new_auto_linked?: number
        already_known?: number
        discovered?: number
      }
      setNotice(
        `Scanned all channels: ${totals.new_queued_for_review ?? 0} new for review, ` +
          `${totals.new_auto_linked ?? 0} auto-linked, ` +
          `${totals.already_known ?? 0} already known.`,
      )
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function deactivateChannel(id: string) {
    setBusyId(`deactivate-${id}`)
    setError("")
    setNotice("")
    try {
      const response = await fetch(
        `/api/admin/youtube-channels/${encodeURIComponent(id)}/deactivate`,
        { method: "POST", credentials: "same-origin" },
      )
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not remove channel"))
        return
      }
      setNotice("Channel removed from scanning.")
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="mb-10">
      <h2 className="font-serif text-2xl text-navy-950">Scan channels</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
        Add YouTube channels to scan. Each scan compares videos against your database (linked media
        and review queue) and only imports new items.
      </p>

      <form
        className="mt-5 grid gap-3 rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm lg:grid-cols-2"
        onSubmit={(event) => void addChannel(event)}
      >
        <label className="grid gap-1.5 text-sm lg:col-span-2">
          <span className="font-semibold text-navy-950">Channel name</span>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-xl border border-navy-900/10 px-3 py-3"
            placeholder="AMPS Spirituality"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold text-navy-950">Channel URL</span>
          <input
            required
            value={channelUrl}
            onChange={(event) => setChannelUrl(event.target.value)}
            className="rounded-xl border border-navy-900/10 px-3 py-3"
            placeholder="https://www.youtube.com/@AMPS0521spirituality"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold text-navy-950">Channel ID (optional)</span>
          <input
            value={channelId}
            onChange={(event) => setChannelId(event.target.value)}
            className="rounded-xl border border-navy-900/10 px-3 py-3"
            placeholder="UC…"
          />
        </label>
        <label className="flex items-center gap-3 text-sm lg:col-span-2">
          <input
            type="checkbox"
            checked={isTrusted}
            onChange={(event) => setIsTrusted(event.target.checked)}
          />
          <span>Trusted channel (stricter auto-match rules)</span>
        </label>
        <button type="submit" disabled={busyId === "add"} className="primary-button w-fit">
          {busyId === "add" ? "Adding…" : "Add channel"}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busyId === "all"}
          onClick={() => void scanAll()}
          className="gold-button px-4 py-2 text-sm"
        >
          {busyId === "all" ? "Scanning all…" : "Scan all channels"}
        </button>
      </div>

      {notice ? <p className="mt-4 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {loading ? <p className="mt-4 text-sm text-stone-600">Loading channels…</p> : null}
      <ul className="mt-5 grid gap-3">
        {channels
          .filter((channel) => channel.is_active)
          .map((channel) => (
            <li key={channel.id} className="surface-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-navy-950">{channel.name}</h3>
                  <p className="mt-1 text-xs text-stone-500">
                    {channel.channel_id} · {channel.is_trusted ? "trusted" : "community"}
                  </p>
                  <a
                    href={channel.channel_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm text-gold-700 underline"
                  >
                    Open channel
                  </a>
                  {channel.last_scanned_at ? (
                    <p className="mt-2 text-xs text-stone-600">
                      Last scan {new Date(channel.last_scanned_at).toLocaleString()}:{" "}
                      {channel.last_scan_new} new, {channel.last_scan_known} already known (
                      {channel.last_scan_discovered} on channel)
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-stone-600">Not scanned yet.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === channel.id}
                    onClick={() => void scanChannel(channel.id)}
                    className="gold-button px-3 py-2 text-sm"
                  >
                    {busyId === channel.id ? "Scanning…" : "Scan now"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === `deactivate-${channel.id}`}
                    onClick={() => void deactivateChannel(channel.id)}
                    className="outline-button px-3 py-2 text-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
      </ul>
    </section>
  )
}
