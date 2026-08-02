"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { useMember } from "@/components/member-provider"
import { microsoftSignInHref, safeSignInNextPath } from "@/lib/sign-in"

export function SignInPanel({ authEnabled, next }: { authEnabled: boolean; next: string }) {
  const router = useRouter()
  const { loading, session } = useMember()
  const destination = safeSignInNextPath(next)

  useEffect(() => {
    if (!loading && session.authenticated) {
      router.replace(destination)
    }
  }, [destination, loading, router, session.authenticated])

  if (loading || session.authenticated) {
    return (
      <div className="mt-8 flex items-center justify-center rounded-xl border border-navy-900/10 bg-ivory-50 px-4 py-6 text-sm text-stone-600">
        Checking your sign-in…
      </div>
    )
  }

  return (
    <>
      {authEnabled ? (
        <div className="mt-8 grid gap-3">
          <a href={microsoftSignInHref(destination)} className="outline-button justify-center py-3.5">
            Continue with Microsoft
          </a>
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
    </>
  )
}
