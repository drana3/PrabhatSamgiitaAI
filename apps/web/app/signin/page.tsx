import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { SignInPanel } from "@/components/sign-in-panel"
import { SiteHeader } from "@/components/site-header"
import { resolveClientPrincipal } from "@/lib/azure-principal"
import { safeSignInNextPath } from "@/lib/sign-in"

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
          <SignInPanel authEnabled={authEnabled} next={next} />
        </div>
      </section>
    </main>
  )
}
