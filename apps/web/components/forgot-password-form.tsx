"use client"

import { useState } from "react"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const payload = (await response.json().catch(() => null)) as { detail?: string; message?: string } | null
      if (!response.ok) {
        throw new Error(payload?.detail || "Could not send reset email.")
      }
      setNotice(payload?.message || "If an account exists for that email, a reset link has been sent.")
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not send reset email.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="mt-8 grid gap-3 rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm" onSubmit={(event) => void submit(event)}>
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold text-navy-950">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-xl border border-navy-900/10 px-3 py-3"
          placeholder="you@example.com"
        />
      </label>
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</p> : null}
      <button type="submit" disabled={busy} className="primary-button mt-1">
        {busy ? "Sending…" : "Send reset link"}
      </button>
    </form>
  )
}
