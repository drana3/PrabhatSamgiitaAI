"use client"

import { useState } from "react"
import Link from "next/link"

import { useMember } from "@/components/member-provider"
import { SiteHeader } from "@/components/site-header"

export default function AccountPage() {
  const { loading, session, refresh } = useMember()
  const [notice, setNotice] = useState("")
  if (loading) return <main className="min-h-screen bg-ivory-50"><SiteHeader /><p className="p-10 text-center">Preparing your account…</p></main>
  if (!session.authenticated) return <main className="min-h-screen bg-ivory-50"><SiteHeader /><div className="mx-auto max-w-xl p-10 text-center"><h1 className="font-serif text-4xl text-navy-950">Sign in to continue</h1><Link href="/signin" className="gold-button mt-6">Sign in</Link></div></main>

  async function clearMemory() {
    const response = await fetch("/api/member/chat-memory", { method: "DELETE" })
    setNotice(response.ok ? "Your chat memory and interest summary were cleared." : "Memory could not be cleared.")
  }

  async function deleteData() {
    if (!window.confirm("Delete your saved songs, chat memory, playlists, and profile data?")) return
    const response = await fetch("/api/member/me", { method: "DELETE" })
    if (response.ok) window.location.href = "/.auth/logout?post_logout_redirect_uri=/"
  }

  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="eyebrow">Member space</p>
        <h1 className="mt-2 font-serif text-4xl text-navy-950">Namaskar, {session.display_name}</h1>
        <p className="mt-3 text-stone-600">Your saved spiritual journey stays with you across devices.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl border border-navy-900/10 bg-white p-6"><h2 className="font-serif text-2xl text-navy-950">Saved songs</h2><p className="mt-2 text-sm text-stone-600">{session.favorite_song_numbers.length} favorites</p></article>
          <article className="rounded-3xl border border-navy-900/10 bg-white p-6"><h2 className="font-serif text-2xl text-navy-950">Member benefits</h2><p className="mt-2 text-sm leading-6 text-stone-600">Playlists, available downloads, practice history, preferences, and personalized AI context.</p></article>
        </div>
        <div className="mt-8 rounded-3xl border border-navy-900/10 bg-white p-6">
          <h2 className="font-serif text-2xl text-navy-950">Privacy and memory</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">Raw AI chat turns expire after 30 days. Your compact interest summary remains until you clear it or delete your account data.</p>
          {notice ? <p role="status" className="mt-4 text-sm font-semibold text-emerald-800">{notice}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => void clearMemory()} className="outline-button">Clear chat memory</button><button type="button" onClick={() => void deleteData()} className="rounded-full border border-red-700/30 px-5 py-3 text-sm font-semibold text-red-800">Delete account data</button><a href="/.auth/logout?post_logout_redirect_uri=/" onClick={() => void refresh()} className="outline-button">Sign out</a></div>
        </div>
      </section>
    </main>
  )
}
