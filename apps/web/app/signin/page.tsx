import Link from "next/link"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import { SignInRedirect } from "@/components/sign-in-redirect"
import { EmailAuthPanel } from "@/components/email-auth-panel"
import { FacebookSignInButton, GoogleSignInButton, MicrosoftSignInButton } from "@/components/social-sign-in-buttons"
import { SiteHeader } from "@/components/site-header"
import { LOCAL_AUTH_COOKIE, facebookAuthEnabled, googleAuthEnabled, localAuthEnabled } from "@/lib/auth-providers"
import {
  mergeRequestCookies,
  requestOriginFromHeaders,
  resolveAuthenticatedPrincipal,
} from "@/lib/easy-auth"
import {
  isAdminDestination,
  resolveMemberSession,
} from "@/lib/member-request"
import {
  safeSignInNextPath,
  signInReturnPath,
} from "@/lib/sign-in"

export const dynamic = "force-dynamic"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; signedOut?: string; googleError?: string }>
}) {
  const params = await searchParams
  const googleError = params.googleError?.trim()
  const next = safeSignInNextPath(params.next)
  const justSignedOut = params.signedOut === "1"
  const cookieStore = await cookies()
  const headerList = mergeRequestCookies(await headers(), cookieStore)
  const origin = requestOriginFromHeaders(headerList)
  const principal = justSignedOut
    ? null
    : await resolveAuthenticatedPrincipal(
        headerList,
        cookieStore.get(LOCAL_AUTH_COOKIE)?.value,
        origin,
      )
  if (principal && !justSignedOut) {
    const session = await resolveMemberSession(principal)
    if (session?.authenticated === true) {
      if (isAdminDestination(next)) {
        if (session.is_admin === true) {
          redirect(signInReturnPath(next))
        }
      } else {
        redirect(signInReturnPath(next))
      }
    }
  }

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
          {googleError ? (
            <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              {googleError === "swa_session"
                ? "Google sign-in through the hosting platform did not finish. Use Continue with Google on this page (direct sign-in)."
                : googleError === "expired"
                  ? "Your Google sign-in timed out before it could finish. Please try Continue with Google again."
                  : googleError === "state" || googleError === "token" || googleError === "profile"
                    ? "Google sign-in could not be verified. Please try again."
                    : "Google sign-in did not complete. Please try again or use Microsoft sign-in."}
            </p>
          ) : null}
          {justSignedOut ? (
            <p className="mt-6 rounded-xl border border-navy-900/10 bg-ivory-50 px-4 py-3 text-sm leading-6 text-stone-700">
              You are signed out of this site. Choose a sign-in option below to continue with your account.
            </p>
          ) : null}
          {authEnabled ? (
            <div className="mt-8 grid gap-3">
              <MicrosoftSignInButton next={next} />
              {googleAuthEnabled() ? <GoogleSignInButton next={next} /> : null}
              {facebookAuthEnabled() ? <FacebookSignInButton next={next} /> : null}
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
