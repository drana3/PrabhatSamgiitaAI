"use client"

import { useCallback, useEffect, useState } from "react"

import { AdminShell } from "@/components/admin-shell"
import type { AdminSiteAnnouncement } from "@/lib/announcements"
import { readErrorDetail } from "@/lib/read-error-detail"

const kinds = [
  ["general", "General notice"],
  ["maintenance", "Maintenance"],
  ["quiz", "Quiz"],
] as const

const priorities = [
  ["normal", "Normal"],
  ["high", "High"],
  ["urgent", "Urgent"],
] as const

function toLocalInputValue(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function defaultEndValue() {
  const end = new Date()
  end.setDate(end.getDate() + 7)
  return toLocalInputValue(end.toISOString())
}

export function AdminAnnouncementsPanel() {
  const [items, setItems] = useState<AdminSiteAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [kind, setKind] = useState<(typeof kinds)[number][0]>("general")
  const [priority, setPriority] = useState<(typeof priorities)[number][0]>("normal")
  const [startsAt, setStartsAt] = useState(() => toLocalInputValue(new Date().toISOString()))
  const [endsAt, setEndsAt] = useState(defaultEndValue)
  const [notifyByEmail, setNotifyByEmail] = useState(false)

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/announcements", { cache: "no-store", credentials: "same-origin" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(payload, `Could not load announcements (${response.status})`))
        setItems([])
        return
      }
      setItems((payload as { items?: AdminSiteAnnouncement[] })?.items ?? [])
    } catch {
      setError("Could not reach the admin service")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  async function publishAnnouncement(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          title,
          body,
          kind,
          priority,
          starts_at: new Date(startsAt).toISOString(),
          ends_at: new Date(endsAt).toISOString(),
          notify_by_email: notifyByEmail,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(payload, "Could not publish announcement"))
        return
      }
      const created = payload as AdminSiteAnnouncement
      setNotice(
        notifyByEmail
          ? `Published. Email sent to ${created.email_sent_count} member(s).`
          : "Announcement published on the home page.",
      )
      setTitle("")
      setBody("")
      setNotifyByEmail(false)
      await loadItems()
    } catch {
      setError("Could not publish announcement")
    } finally {
      setBusy(false)
    }
  }

  async function deactivateAnnouncement(id: string) {
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch(`/api/admin/announcements/${encodeURIComponent(id)}/deactivate`, {
        method: "POST",
        credentials: "same-origin",
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(payload, "Could not deactivate announcement"))
        return
      }
      setNotice("Announcement removed from the home page.")
      await loadItems()
    } catch {
      setError("Could not deactivate announcement")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell
      active="announcements"
      title="Site announcements"
      description="Publish maintenance windows, quiz reminders, and other notices. Active items appear on the home page until their deadline."
    >
      <form className="grid gap-4 rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm" onSubmit={(event) => void publishAnnouncement(event)}>
        <h2 className="font-serif text-2xl text-navy-950">Publish announcement</h2>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold text-navy-950">Title</span>
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-xl border border-navy-900/10 px-3 py-3"
            placeholder="Website maintenance tonight"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold text-navy-950">Message</span>
          <textarea
            required
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="rounded-xl border border-navy-900/10 px-3 py-3"
            placeholder="The site will be unavailable from 11 PM to 1 AM IST."
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold text-navy-950">Type</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className="rounded-xl border border-navy-900/10 px-3 py-3">
              {kinds.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold text-navy-950">Priority</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)} className="rounded-xl border border-navy-900/10 px-3 py-3">
              {priorities.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold text-navy-950">Starts</span>
            <input type="datetime-local" required value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="rounded-xl border border-navy-900/10 px-3 py-3" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold text-navy-950">Visible until</span>
            <input type="datetime-local" required value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="rounded-xl border border-navy-900/10 px-3 py-3" />
          </label>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={notifyByEmail}
            onChange={(event) => setNotifyByEmail(event.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="font-semibold text-navy-950">Email all signed-in members</span>
            <span className="mt-1 block text-stone-600">
              Sends one email per member with an account email. Requires ACS email to be configured on the API.
            </span>
          </span>
        </label>
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
        {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</p> : null}
        <button type="submit" disabled={busy} className="primary-button w-fit">
          {busy ? "Publishing…" : "Publish announcement"}
        </button>
      </form>

      <section className="mt-8">
        <h2 className="font-serif text-2xl text-navy-950">Recent announcements</h2>
        {loading ? <p className="mt-4 text-sm text-stone-600">Loading…</p> : null}
        {!loading && !items.length ? (
          <p className="mt-4 text-sm text-stone-600">No announcements yet.</p>
        ) : null}
        <ul className="mt-4 grid gap-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-navy-900/10 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                    {item.kind} · {item.priority} · {item.is_active ? "active" : "inactive"}
                  </p>
                  <h3 className="mt-1 font-serif text-xl text-navy-950">{item.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{item.body}</p>
                  <p className="mt-2 text-xs text-stone-500">
                    {new Date(item.starts_at).toLocaleString()} → {new Date(item.ends_at).toLocaleString()}
                    {item.notify_by_email ? ` · emailed ${item.email_sent_count}` : ""}
                  </p>
                </div>
                {item.is_active ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void deactivateAnnouncement(item.id)}
                    className="outline-button shrink-0 px-3 py-2 text-sm"
                  >
                    Remove from home
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  )
}
