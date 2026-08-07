import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { SignInRedirect } from "@/components/sign-in-redirect"
import { EmailAuthPanel } from "@/components/email-auth-panel"
import { SiteHeader } from "@/components/site-header"
import { facebookAuthEnabled, googleAuthEnabled, localAuthEnabled } from "@/lib/auth-providers"
import { resolveClientPrincipal } from "@/lib/azure-principal"
import {
  facebookSignInHref,
  googleSignInHref,
  microsoftSignInHref,
  safeSignInNextPath,
} from "@/lib/sign-in"

export const dynamic = "force-dynamic"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  const next = safeSignInNextPath(params.next)
  const principal = resolveClientPrincipal(await headers())
  if (principal) redirect(next)

  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"

  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader />
      <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-[2rem] border border-navy-900/10 bg-white p-7 shadow-xl sm:p-10">
          <p className="eyebrow">Your spiritual companion</p>
          <h1 className="mt-3 font-serif text-4xl text-navy-950">Namaskar. Continue your journey.</h1>
          <p className="mt-4 leading-7 text-stone-600">
            Sign in to save songs, create playlists, download available recordings, keep practice history, and receive guidance shaped by your interests.
          </p>
          <SignInRedirect next={next} />
          {authEnabled ? (
            <div className="mt-8 grid gap-3">
              <a href={microsoftSignInHref(next)} className="outline-button justify-center py-3.5">
                Continue with Microsoft
              </a>
              {googleAuthEnabled() ? (
                <a href={googleSignInHref(next)} className="outline-button justify-center py-3.5">
                  Continue with Google
                </a>
              ) : null}
              {facebookAuthEnabled() ? (
                <a href={facebookSignInHref(next)} className="outline-button justify-center py-3.5">
                  Continue with Facebook
                </a>
              ) : null}
              {localAuthEnabled() ? (
                <>
                  <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                    <span className="h-px flex-1 bg-stone-200" />
                    <span>or</span>
                    <span className="h-px flex-1 bg-stone-200" />
                  </div>
                  <EmailAuthPanel next={next} />
                </>
              ) : null}
            </div>
          ) : (
            <p className="mt-8 rounded-xl border border-gold-500/25 bg-gold-50 px-4 py-3 text-sm leading-6 text-navy-950">
              Member sign-in is being prepared. You can continue using search, lyrics, meanings, listening, and AI guidance without an account.
            </p>
          )}
          <p className="mt-6 text-xs leading-5 text-stone-500">
            Essential search, lyrics, meaning, listening, and basic AI guidance remain available without signing in.
          </p>
          <Link href="/" className="mt-5 inline-flex text-sm font-semibold text-gold-700">
            Continue without an account →
          </Link>
        </div>
      </section>
    </main>
  )
}
