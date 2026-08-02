import Link from "next/link"

import { SiteHeader } from "@/components/site-header"

export default function SignInPage() {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"
  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader />
      <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-[2rem] border border-navy-900/10 bg-white p-7 shadow-xl sm:p-10">
          <p className="eyebrow">Your spiritual companion</p>
          <h1 className="mt-3 font-serif text-4xl text-navy-950">Namaskar. Continue your journey.</h1>
          <p className="mt-4 leading-7 text-stone-600">Sign in to save songs, create playlists, download available recordings, keep practice history, and receive guidance shaped by your interests.</p>
          {authEnabled ? (
            <div className="mt-8 grid gap-3">
              <a href="/.auth/login/aad?post_login_redirect_uri=/" className="outline-button justify-center py-3.5">Continue with Microsoft</a>
            </div>
          ) : (
            <p className="mt-8 rounded-xl border border-gold-500/25 bg-gold-50 px-4 py-3 text-sm leading-6 text-navy-950">
              Member sign-in is being prepared. You can continue using search, lyrics, meanings, listening, and AI guidance without an account.
            </p>
          )}
          <p className="mt-6 text-xs leading-5 text-stone-500">Essential search, lyrics, meaning, listening, and basic AI guidance remain available without signing in.</p>
          <Link href="/" className="mt-5 inline-flex text-sm font-semibold text-gold-700">Continue without an account →</Link>
        </div>
      </section>
    </main>
  )
}
