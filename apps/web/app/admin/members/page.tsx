"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { readErrorDetail } from "@/lib/read-error-detail"

type AdminMember = {
  id: string
  display_name: string
  email: string | null
  is_admin: boolean
  is_protected: boolean
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<AdminMember[]>([])
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadMembers = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/members", { cache: "no-store" })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not load admins"))
        setMembers([])
        return
      }
      setMembers(Array.isArray(body) ? (body as AdminMember[]) : [])
    } catch {
      setError("Could not reach the admin service")
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  async function promoteMember(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
      const body = await response.json().catch(() => null) as { display_name?: string } | null
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not promote member"))
        return
      }
      setEmail("")
      setMessage(`${body?.display_name ?? trimmed} is now an admin.`)
      await loadMembers()
    } finally {
      setSubmitting(false)
    }
  }

  async function removeAdmin(member: AdminMember) {
    if (member.is_protected) return
    if (!window.confirm(`Remove admin access for ${member.display_name}?`)) return
    setRemovingId(member.id)
    setError("")
    setMessage("")
    try {
      const response = await fetch(`/api/admin/members?id=${encodeURIComponent(member.id)}`, { method: "DELETE" })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not remove admin"))
        return
      }
      setMessage(`${member.display_name} is no longer an admin.`)
      await loadMembers()
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-ivory-50">
      <header className="border-b border-navy-900/10 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="eyebrow">Admin console</p>
            <h1 className="font-serif text-3xl text-navy-950">Admin members</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/feedback" className="outline-button px-4 py-2.5">Feedback</Link>
            <Link href="/" className="outline-button px-4 py-2.5">Back to site</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <p className="text-sm leading-7 text-stone-600">
          Promote signed-in members by email. Protected accounts (project owners) cannot be removed by anyone else.
        </p>

        <form onSubmit={(event) => void promoteMember(event)} className="mt-6 rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm">
          <label htmlFor="admin-email" className="block text-sm font-semibold text-navy-950">Promote by email</label>
          <p className="mt-1 text-xs text-stone-500">They must have signed in at least once.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="member@example.com"
              className="min-w-0 flex-1 rounded-xl border border-navy-900/10 px-4 py-3 text-sm"
              required
            />
            <button type="submit" disabled={submitting} className="primary-button shrink-0 px-5 py-3 text-sm">
              {submitting ? "Promoting..." : "Promote to admin"}
            </button>
          </div>
        </form>

        {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}

        <div className="mt-6 space-y-3">
          <p className="text-sm font-semibold text-navy-950">{loading ? "Loading admins..." : `${members.length} admin${members.length === 1 ? "" : "s"}`}</p>
          {!loading && !members.length ? (
            <div className="rounded-2xl border border-navy-900/10 bg-white p-8 text-center text-sm text-stone-600">
              No admins yet. Promote a member who has signed in at least once, or set{" "}
              <code className="rounded bg-stone-100 px-1 py-0.5">is_admin = true</code> in the database.
            </div>
          ) : null}
          {members.map((member) => (
            <article key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy-900/10 bg-white p-4 shadow-sm">
              <div>
                <p className="font-semibold text-navy-950">{member.display_name}</p>
                <p className="text-sm text-stone-600">{member.email ?? "No email on file"}</p>
              </div>
              <div className="flex items-center gap-2">
                {member.is_protected ? (
                  <span className="rounded-full bg-gold-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gold-800">Protected owner</span>
                ) : null}
                {!member.is_protected ? (
                  <button
                    type="button"
                    disabled={removingId === member.id}
                    onClick={() => void removeAdmin(member)}
                    className="rounded-full px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    {removingId === member.id ? "Removing..." : "Remove admin"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
