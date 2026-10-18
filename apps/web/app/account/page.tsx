"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { SavedSongsList } from "@/components/saved-songs-list"
import { QuizCertificate } from "@/components/quiz-certificate"
import { FeelingSearchToggle } from "@/components/feeling-search-toggle"
import { useMember } from "@/components/member-provider"
import { SiteHeader } from "@/components/site-header"
import { memberFirstName, updateMemberPreferences } from "@/lib/member"
import { clearSongChatStorage } from "@/lib/chat"
import { signOutMember } from "@/lib/sign-out"
import { fetchQuizStatus, type QuizStatus } from "@/lib/quiz"

export default function AccountPage() {
  const { loading, session, refresh } = useMember()
  const [notice, setNotice] = useState("")
  const [quizStatus, setQuizStatus] = useState<QuizStatus | null>(null)
  const [displayNameDraft, setDisplayNameDraft] = useState("")
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    if (!session.authenticated) return
    void fetchQuizStatus().then(setQuizStatus)
    setDisplayNameDraft(session.display_name)
  }, [session])
  if (loading) return <main className="min-h-screen bg-ivory-50"><SiteHeader /><p className="p-10 text-center">Preparing your profile…</p></main>
  if (!session.authenticated) return <main className="min-h-screen bg-ivory-50"><SiteHeader /><div className="mx-auto max-w-xl p-10 text-center"><h1 className="font-serif text-4xl text-navy-950">Sign in to continue</h1><Link href="/signin?next=/account" className="gold-button mt-6">Sign in</Link></div></main>

  const firstName = memberFirstName(session.display_name)
  const identityProvider = session.identity_provider
  const nameChanged = displayNameDraft.trim() !== session.display_name.trim()

  async function saveDisplayName() {
    const next = displayNameDraft.trim()
    if (!next || !nameChanged) return
    setSavingName(true)
    setNotice("")
    const result = await updateMemberPreferences({ display_name: next })
    setSavingName(false)
    if (!result.ok) {
      setNotice(result.error)
      return
    }
    await refresh({ silent: true })
    setNotice("Display name updated.")
  }

  async function clearMemory() {
    const response = await fetch("/api/member/chat-memory", { method: "DELETE" })
    if (response.ok) {
      clearSongChatStorage()
      setNotice("Your AI chat memory was cleared.")
    } else {
      setNotice("Memory could not be cleared.")
    }
  }

  async function deleteData() {
    if (!window.confirm("Delete your saved songs, chat memory, playlists, and profile data?")) return
    const response = await fetch("/api/member/me", { method: "DELETE" })
    if (response.ok) {
      clearSongChatStorage()
      await signOutMember(identityProvider)
    }
  }

  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href="/" className="text-sm font-semibold text-gold-700">← Back to home</Link>
        <p className="eyebrow mt-6">Account</p>
        <h1 className="mt-2 font-serif text-4xl text-navy-950">Manage profile</h1>
        <p className="mt-3 max-w-2xl text-stone-600">Update your saved journey, privacy settings, and member preferences.</p>

        <article className="mt-8 rounded-3xl border border-navy-900/10 bg-white p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gold-100 font-serif text-2xl text-gold-800">{firstName.slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-2xl text-navy-950">{firstName}</h2>
              {session.email ? <p className="mt-1 truncate text-sm text-stone-600">{session.email}</p> : null}
              <p className="mt-2 text-sm text-stone-500">Signed in with {session.identity_provider}</p>
              <label className="mt-5 block text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">
                Display name
                <input
                  value={displayNameDraft}
                  onChange={(event) => setDisplayNameDraft(event.target.value)}
                  maxLength={120}
                  className="mt-2 w-full rounded-xl border border-navy-900/10 bg-ivory-50 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-navy-950 outline-none focus:border-gold-500"
                />
              </label>
              <button
                type="button"
                disabled={!nameChanged || savingName || !displayNameDraft.trim()}
                onClick={() => void saveDisplayName()}
                className="outline-button mt-3 disabled:opacity-50"
              >
                {savingName ? "Saving…" : "Save name"}
              </button>
            </div>
          </div>
        </article>

        <div className="mt-5 grid gap-5">
          <article className="rounded-3xl border border-navy-900/10 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl text-navy-950">Saved songs</h2>
                <p className="mt-2 text-sm text-stone-600">{session.favorite_song_numbers.length} song{session.favorite_song_numbers.length === 1 ? "" : "s"} saved with ♡ across your devices.</p>
              </div>
              <Link href="/explore" className="outline-button">Explore more songs</Link>
            </div>
            <SavedSongsList songNumbers={session.favorite_song_numbers} onChange={refresh} />
          </article>

          <article className="rounded-3xl border border-navy-900/10 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl text-navy-950">Quiz certificates</h2>
                <p className="mt-2 text-sm text-stone-600">
                  Earn Starter, Intermediate, and Experienced certificates with 10-question quizzes (70% pass mark).
                </p>
              </div>
              <Link href="/quiz" className="outline-button">Take a quiz</Link>
            </div>
            {quizStatus?.certifications.length ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {quizStatus.certifications.map((certification) => (
                  <QuizCertificate
                    key={certification.certificate_code}
                    certification={certification}
                    displayName={session.display_name}
                    compact
                  />
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-stone-600">No certificates yet. Start with the Starter quiz when you feel ready.</p>
            )}
          </article>

          <article id="feeling-search" className="scroll-mt-28 rounded-3xl border border-navy-900/10 bg-white p-6">
            <h2 className="font-serif text-2xl text-navy-950">Feeling search</h2>
            <p className="mt-2 text-sm text-stone-600">
              Off by default. Turn it on here to search songs by mood or meaning from Explore.
            </p>
            <FeelingSearchToggle />
          </article>

          <article className="rounded-3xl border border-navy-900/10 bg-white p-6">
            <h2 className="font-serif text-2xl text-navy-950">Member benefits</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">Saved playlists, available downloads, practice history, preferences, and personalized AI context.</p>
          </article>
        </div>

        <div className="mt-5 rounded-3xl border border-navy-900/10 bg-white p-6">
          <h2 className="font-serif text-2xl text-navy-950">Privacy and memory</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">Raw AI chat turns expire after 30 days. Your compact interest summary remains until you clear it or delete your account data.</p>
          {notice ? <p role="status" className="mt-4 text-sm font-semibold text-emerald-800">{notice}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => void clearMemory()} className="outline-button">Clear chat memory</button>
            <button type="button" onClick={() => void deleteData()} className="rounded-full border border-red-700/30 px-5 py-3 text-sm font-semibold text-red-800">Delete account data</button>
            <button
              type="button"
              onClick={() => void signOutMember(identityProvider)}
              className="outline-button"
            >
              Sign out
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
