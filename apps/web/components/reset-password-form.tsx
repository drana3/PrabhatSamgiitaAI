"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

export function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const payload = (await response.json().catch(() => null)) as { detail?: string } | null
      if (!response.ok) {
        throw new Error(payload?.detail || "Could not reset password.")
      }
      setDone(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not reset password.")
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        This reset link is missing or invalid. Request a new one from the forgot-password page.
      </p>
    )
  }

  if (done) {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
        <p>Your password has been updated.</p>
        <Link href="/signin" className="mt-3 inline-flex font-semibold underline decoration-current underline-offset-4">
          Sign in with your new password →
        </Link>
      </div>
    )
  }

  return (
    <form className="mt-8 grid gap-3 rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm" onSubmit={(event) => void submit(event)}>
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold text-navy-950">New password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-xl border border-navy-900/10 px-3 py-3"
        />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold text-navy-950">Confirm password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className="rounded-xl border border-navy-900/10 px-3 py-3"
        />
      </label>
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      <button type="submit" disabled={busy} className="primary-button mt-1">
        {busy ? "Updating…" : "Update password"}
      </button>
    </form>
  )
}
