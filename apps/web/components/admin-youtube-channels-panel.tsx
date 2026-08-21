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

type EditDraft = {
  name: string
  channelUrl: string
  channelId: string
  isTrusted: boolean
  notes: string
}

const DEFAULT_CHANNELS = [
  {
    name: "AMPS Spirituality",
    url: "https://www.youtube.com/@AMPS0521spirituality",
    channelId: "UCzJy4vdGKx6gzP782-5buOQ",
    notes: "Embedded from the allow-listed AMPS spirituality channel; not re-hosted.",
  },
  {
    name: "ANANDA MARGA",
    url: "https://www.youtube.com/@Ananda_Marga",
    channelId: "UCc3f8g07me5NpqHfAsF8GIA",
    notes: "Embedded from the allow-listed ANANDA MARGA channel; not re-hosted.",
  },
] as const

function ChannelRow({
  channel,
  busyId,
  editing,
  editDraft,
  onEditDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onScan,
  onRemove,
  onRestore,
}: {
  channel: YoutubeScanChannel
  busyId: string | null
  editing: boolean
  editDraft: EditDraft
  onEditDraftChange: (draft: EditDraft) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onScan: () => void
  onRemove: () => void
  onRestore: () => void
}) {
  if (editing) {
    return (
      <li className="surface-card p-5">
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="grid gap-1.5 text-sm lg:col-span-2">
            <span className="font-semibold text-navy-950">Channel name</span>
            <input
              value={editDraft.name}
              onChange={(event) => onEditDraftChange({ ...editDraft, name: event.target.value })}
              className="rounded-xl border border-navy-900/10 px-3 py-3"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold text-navy-950">Channel URL</span>
            <input
              value={editDraft.channelUrl}
              onChange={(event) =>
                onEditDraftChange({ ...editDraft, channelUrl: event.target.value })
              }
              className="rounded-xl border border-navy-900/10 px-3 py-3"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold text-navy-950">Channel ID</span>
            <input
              value={editDraft.channelId}
              onChange={(event) =>
                onEditDraftChange({ ...editDraft, channelId: event.target.value })
              }
              className="rounded-xl border border-navy-900/10 px-3 py-3"
            />
          </label>
          <label className="grid gap-1.5 text-sm lg:col-span-2">
            <span className="font-semibold text-navy-950">Notes (optional)</span>
            <textarea
              value={editDraft.notes}
              onChange={(event) => onEditDraftChange({ ...editDraft, notes: event.target.value })}
              rows={2}
              className="rounded-xl border border-navy-900/10 px-3 py-3"
            />
          </label>
          <label className="flex items-center gap-3 text-sm lg:col-span-2">
            <input
              type="checkbox"
              checked={editDraft.isTrusted}
              onChange={(event) =>
                onEditDraftChange({ ...editDraft, isTrusted: event.target.checked })
              }
            />
            <span>Trusted channel (stricter auto-match rules)</span>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busyId === `edit-${channel.id}`}
            onClick={() => void onSaveEdit()}
            className="primary-button px-3 py-2 text-sm"
          >
            {busyId === `edit-${channel.id}` ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            disabled={busyId === `edit-${channel.id}`}
            onClick={onCancelEdit}
            className="outline-button px-3 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className={`surface-card p-5 ${channel.is_active ? "" : "opacity-70"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-navy-950">
            {channel.name}
            {!channel.is_active ? (
              <span className="ml-2 text-xs font-normal text-stone-500">(removed)</span>
            ) : null}
          </h3>
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
          {channel.notes ? (
            <p className="mt-2 text-xs text-stone-600">{channel.notes}</p>
          ) : null}
          {channel.last_scanned_at ? (
            <p className="mt-2 text-xs text-stone-600">
              Last scan {new Date(channel.last_scanned_at).toLocaleString()}: {channel.last_scan_new}{" "}
              new, {channel.last_scan_known} already known ({channel.last_scan_discovered} on
              channel)
            </p>
          ) : channel.is_active ? (
            <p className="mt-2 text-xs text-stone-600">Not scanned yet.</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {channel.is_active ? (
            <>
              <button
                type="button"
                disabled={busyId === channel.id}
                onClick={() => void onScan()}
                className="gold-button px-3 py-2 text-sm"
              >
                {busyId === channel.id ? "Scanning…" : "Scan now"}
              </button>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={onStartEdit}
                className="outline-button px-3 py-2 text-sm"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busyId === `deactivate-${channel.id}`}
                onClick={() => void onRemove()}
                className="outline-button px-3 py-2 text-sm"
              >
                Remove
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busyId === `restore-${channel.id}`}
              onClick={() => void onRestore()}
              className="gold-button px-3 py-2 text-sm"
            >
              {busyId === `restore-${channel.id}` ? "Restoring…" : "Restore"}
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

export function AdminYoutubeChannelsPanel({
  onScanComplete,
}: {
  onScanComplete?: (result: YoutubeScanResult) => void | Promise<void>
}) {
  const [channels, setChannels] = useState<YoutubeScanChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({
    name: "",
    channelUrl: "",
    channelId: "",
    isTrusted: true,
    notes: "",
  })
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

  const activeChannels = channels.filter((channel) => channel.is_active)
  const inactiveChannels = channels.filter((channel) => !channel.is_active)

  function startEdit(channel: YoutubeScanChannel) {
    setEditingId(channel.id)
    setEditDraft({
      name: channel.name,
      channelUrl: channel.channel_url,
      channelId: channel.channel_id,
      isTrusted: channel.is_trusted,
      notes: channel.notes ?? "",
    })
    setError("")
    setNotice("")
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(channelId: string) {
    setBusyId(`edit-${channelId}`)
    setError("")
    setNotice("")
    try {
      const response = await fetch(`/api/admin/youtube-channels/${encodeURIComponent(channelId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editDraft.name,
          channel_url: editDraft.channelUrl,
          channel_id: editDraft.channelId || null,
          is_trusted: editDraft.isTrusted,
          notes: editDraft.notes || null,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not update channel"))
        return
      }
      setNotice("Channel updated.")
      setEditingId(null)
      await load()
    } finally {
      setBusyId(null)
    }
  }

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

  async function seedDefaultChannels() {
    setBusyId("seed-defaults")
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/youtube-channels/seed-defaults", {
        method: "POST",
        credentials: "same-origin",
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not add default channels"))
        return
      }
      const count = (body as { items?: YoutubeScanChannel[] }).items?.length ?? 0
      setNotice(`Added ${count} default channel(s). Use Scan now on each channel when ready.`)
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
      const response = await fetch(
        `/api/admin/youtube-channels/${encodeURIComponent(id)}/scan?max_pages=12`,
        {
        method: "POST",
        credentials: "same-origin",
        },
      )
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
      if (body) {
        await onScanComplete?.(body)
      }
    } finally {
      setBusyId(null)
    }
  }

  async function scanAllChannels() {
    setBusyId("scan-all")
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/youtube-channels/scan-all?max_pages=12", {
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
        channels_scanned?: number
      }
      setNotice(
        `Scanned ${totals.channels_scanned ?? 0} channel(s): ` +
          `${totals.new_queued_for_review ?? 0} new for review, ` +
          `${totals.new_auto_linked ?? 0} auto-linked, ` +
          `${totals.already_known ?? 0} already known (${totals.discovered ?? 0} found).`,
      )
      await load()
      await onScanComplete?.({
        discovered: totals.discovered ?? 0,
        already_known: totals.already_known ?? 0,
        new_queued_for_review: totals.new_queued_for_review ?? 0,
        new_auto_linked: totals.new_auto_linked ?? 0,
      })
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
      if (editingId === id) {
        setEditingId(null)
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function restoreChannel(id: string) {
    setBusyId(`restore-${id}`)
    setError("")
    setNotice("")
    try {
      const response = await fetch(`/api/admin/youtube-channels/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not restore channel"))
        return
      }
      setNotice("Channel restored.")
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="mb-10">
      <h2 className="font-serif text-2xl text-navy-950">Scan channels</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
        Configure which YouTube channels are scanned for new Prabhat Samgiita videos. A scheduled job
        runs nightly. After channels are saved below, each row gets a <strong>Scan now</strong>{" "}
        button for an immediate check.
      </p>

      {notice ? <p className="mt-4 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-navy-950">
            Configured channels
            {!loading ? (
              <span className="ml-2 text-sm font-normal text-stone-500">
                ({activeChannels.length} active
                {inactiveChannels.length > 0 ? `, ${inactiveChannels.length} removed` : ""})
              </span>
            ) : null}
          </h3>
          {!loading && activeChannels.length > 0 ? (
            <button
              type="button"
              disabled={busyId === "scan-all"}
              onClick={() => void scanAllChannels()}
              className="gold-button px-3 py-2 text-sm"
            >
              {busyId === "scan-all" ? "Scanning all…" : "Scan all channels"}
            </button>
          ) : null}
        </div>

        {loading ? <p className="mt-4 text-sm text-stone-600">Loading channels…</p> : null}

        {!loading && activeChannels.length === 0 && inactiveChannels.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-navy-900/15 bg-stone-50 p-5 text-sm text-stone-600">
            <p>
              Nothing is saved in the database yet, so there is no <strong>Scan now</strong> button.
              The nightly batch job can still use built-in defaults, but this admin page only scans
              channels you save here.
            </p>
            <p className="mt-3">Recommended defaults:</p>
            <ul className="mt-2 grid gap-2">
              {DEFAULT_CHANNELS.map((channel) => (
                <li key={channel.channelId} className="text-stone-700">
                  <strong>{channel.name}</strong> —{" "}
                  <a href={channel.url} target="_blank" rel="noreferrer" className="text-gold-700 underline">
                    {channel.url}
                  </a>{" "}
                  <span className="text-stone-500">({channel.channelId})</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={busyId === "seed-defaults"}
              onClick={() => void seedDefaultChannels()}
              className="primary-button mt-4"
            >
              {busyId === "seed-defaults" ? "Adding defaults…" : "Add both default channels"}
            </button>
          </div>
        ) : null}

        {!loading && (activeChannels.length > 0 || inactiveChannels.length > 0) ? (
          <ul className="mt-4 grid gap-3">
            {activeChannels.map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                busyId={busyId}
                editing={editingId === channel.id}
                editDraft={editDraft}
                onEditDraftChange={setEditDraft}
                onStartEdit={() => startEdit(channel)}
                onCancelEdit={cancelEdit}
                onSaveEdit={() => void saveEdit(channel.id)}
                onScan={() => void scanChannel(channel.id)}
                onRemove={() => void deactivateChannel(channel.id)}
                onRestore={() => void restoreChannel(channel.id)}
              />
            ))}
            {inactiveChannels.map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                busyId={busyId}
                editing={false}
                editDraft={editDraft}
                onEditDraftChange={setEditDraft}
                onStartEdit={() => startEdit(channel)}
                onCancelEdit={cancelEdit}
                onSaveEdit={() => void saveEdit(channel.id)}
                onScan={() => void scanChannel(channel.id)}
                onRemove={() => void deactivateChannel(channel.id)}
                onRestore={() => void restoreChannel(channel.id)}
              />
            ))}
          </ul>
        ) : null}
      </div>

      <h3 className="mt-8 font-semibold text-navy-950">Add channel</h3>
      <form
        className="mt-3 grid gap-3 rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm lg:grid-cols-2"
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
            placeholder="UCzJy4vdGKx6gzP782-5buOQ"
          />
          <p className="text-xs text-stone-500">
            Optional. AMPS: <code className="text-stone-700">UCzJy4vdGKx6gzP782-5buOQ</code>
          </p>
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
    </section>
  )
}
