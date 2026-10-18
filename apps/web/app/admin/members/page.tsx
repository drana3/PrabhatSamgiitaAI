"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { AdminShell } from "@/components/admin-shell"
import { readErrorDetail } from "@/lib/read-error-detail"

type MemberRow = {
  id: string
  display_name: string
  email: string | null
  phone_e164?: string | null
  identity_provider?: string | null
  last_seen_at?: string | null
  is_admin: boolean
  is_protected: boolean
}

function formatPhone(value: string | null | undefined) {
  if (!value) return "—"
  return value
}

function formatSeen(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export default function AdminMembersPage() {
  const [signedIn, setSignedIn] = useState<MemberRow[]>([])
  const [admins, setAdmins] = useState<MemberRow[]>([])
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [promoting, setPromoting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadData = useCallback(async (query: string) => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ scope: "signed_in" })
      if (query.trim()) params.set("q", query.trim())
      const [signedInResponse, adminsResponse] = await Promise.all([
        fetch(`/api/admin/members?${params}`, { cache: "no-store" }),
        fetch("/api/admin/members?scope=admins", { cache: "no-store" }),
      ])
      const signedInBody = await signedInResponse.json().catch(() => null)
      const adminsBody = await adminsResponse.json().catch(() => null)
      if (!signedInResponse.ok) {
        setError(readErrorDetail(signedInBody, "Could not load signed-in members"))
        setSignedIn([])
      } else {
        setSignedIn(Array.isArray(signedInBody) ? (signedInBody as MemberRow[]) : [])
      }
      if (!adminsResponse.ok) {
        setAdmins([])
      } else {
        setAdmins(Array.isArray(adminsBody) ? (adminsBody as MemberRow[]) : [])
      }
    } catch {
      setError("Could not reach the admin service")
      setSignedIn([])
      setAdmins([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData(search)
    }, search ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [loadData, search])

  const promotable = useMemo(
    () => signedIn.filter((member) => !member.is_admin),
    [signedIn],
  )

  const allPromotableSelected =
    promotable.length > 0 && promotable.every((member) => selected.has(member.id))

  function toggleMember(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allPromotableSelected) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(promotable.map((member) => member.id)))
  }

  async function promoteSelected() {
    const ids = [...selected]
    if (!ids.length) return
    setPromoting(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/members/grant-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: ids }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not promote selected members"))
        return
      }
      const count = Array.isArray(body) ? body.length : ids.length
      setMessage(`${count} member${count === 1 ? "" : "s"} promoted to admin.`)
      setSelected(new Set())
      await loadData(search)
    } finally {
      setPromoting(false)
    }
  }

  async function removeAdmin(member: MemberRow) {
    if (member.is_protected) return
    if (!window.confirm(`Remove admin access for ${member.display_name}?`)) return
    setRemovingId(member.id)
    setError("")
    setMessage("")
    try {
      const response = await fetch(`/api/admin/members?id=${encodeURIComponent(member.id)}`, {
        method: "DELETE",
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not remove admin"))
        return
      }
      setMessage(`${member.display_name} is no longer an admin.`)
      await loadData(search)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <AdminShell
      active="members"
      title="Admin members"
      description="Search everyone who has signed in, select one or many, and promote them to admin. Protected owner accounts cannot be removed."
      maxWidth="5xl"
    >
      <section className="rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-2xl text-navy-950">Signed-in members</h2>
            <p className="mt-1 text-sm text-stone-600">
              Filter by name, email, or mobile number, then promote one or multiple members at once.
            </p>
          </div>
          <button
            type="button"
            disabled={promoting || selected.size === 0}
            onClick={() => void promoteSelected()}
            className="gold-button shrink-0 px-5 py-3 text-sm disabled:opacity-50"
          >
            {promoting
              ? "Promoting…"
              : selected.size
                ? `Promote ${selected.size} selected`
                : "Promote selected"}
          </button>
        </div>

        <label className="mt-4 block text-sm">
          <span className="font-semibold text-navy-950">Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email, or mobile"
            className="mt-2 w-full rounded-xl border border-navy-900/10 bg-ivory-50 px-4 py-3 text-sm outline-none transition focus:border-gold-500"
          />
        </label>

        {error ? (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </p>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-xl border border-navy-900/10">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto_auto] gap-3 border-b border-navy-900/10 bg-ivory-50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allPromotableSelected}
                disabled={!promotable.length}
                onChange={toggleSelectAll}
                aria-label="Select all promotable members"
              />
              <span className="sr-only">Select all</span>
            </label>
            <span>Member</span>
            <span>Email</span>
            <span>Mobile</span>
            <span>Last seen</span>
            <span>Status</span>
          </div>

          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-stone-600">Loading members…</p>
          ) : null}

          {!loading && !signedIn.length ? (
            <p className="px-4 py-8 text-center text-sm text-stone-600">
              No signed-in members match this search.
            </p>
          ) : null}

          {!loading
            ? signedIn.map((member) => (
                <div
                  key={member.id}
                  className="grid grid-cols-[auto_1fr_1fr_1fr_auto_auto] items-center gap-3 border-b border-navy-900/5 px-4 py-3 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(member.id)}
                    disabled={member.is_admin}
                    onChange={() => toggleMember(member.id)}
                    aria-label={`Select ${member.display_name}`}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy-950">{member.display_name}</p>
                    <p className="truncate text-xs text-stone-500">{member.identity_provider ?? "member"}</p>
                  </div>
                  <p className="truncate text-sm text-stone-600">{member.email ?? "No email"}</p>
                  <p className="truncate text-sm text-stone-600">{formatPhone(member.phone_e164)}</p>
                  <p className="whitespace-nowrap text-xs text-stone-500">{formatSeen(member.last_seen_at)}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                      member.is_admin
                        ? "bg-navy-950 text-white"
                        : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {member.is_admin ? "Admin" : "Member"}
                  </span>
                </div>
              ))
            : null}
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="font-serif text-2xl text-navy-950">Current admins</h2>
        <p className="text-sm text-stone-600">
          {loading ? "Loading…" : `${admins.length} admin${admins.length === 1 ? "" : "s"}`}
        </p>
        {!loading && !admins.length ? (
          <div className="rounded-2xl border border-navy-900/10 bg-white p-8 text-center text-sm text-stone-600">
            No admins yet. Promote members from the list above.
          </div>
        ) : null}
        {admins.map((member) => (
          <article
            key={member.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy-900/10 bg-white p-4 shadow-sm"
          >
            <div>
              <p className="font-semibold text-navy-950">{member.display_name}</p>
              <p className="text-sm text-stone-600">{member.email ?? "No email on file"}</p>
              <p className="text-sm text-stone-600">{formatPhone(member.phone_e164)}</p>
            </div>
            <div className="flex items-center gap-2">
              {member.is_protected ? (
                <span className="rounded-full bg-gold-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gold-800">
                  Protected owner
                </span>
              ) : null}
              {!member.is_protected ? (
                <button
                  type="button"
                  disabled={removingId === member.id}
                  onClick={() => void removeAdmin(member)}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                >
                  {removingId === member.id ? "Removing…" : "Remove admin"}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </AdminShell>
  )
}
