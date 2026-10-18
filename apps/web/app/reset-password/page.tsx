import Link from "next/link"
import { Suspense } from "react"

import { ResetPasswordForm } from "@/components/reset-password-form"
import { SiteHeader } from "@/components/site-header"

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <p className="eyebrow">Account</p>
        <h1 className="mt-3 font-serif text-4xl text-navy-950">Choose a new password</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Use at least 8 characters for your new password.
        </p>
        <Suspense fallback={<p className="mt-8 text-sm text-stone-600">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-stone-600">
          <Link href="/forgot-password" className="font-semibold text-navy-950 underline decoration-gold-500 underline-offset-4">
            Request a new reset link
          </Link>
        </p>
      </div>
    </main>
  )
}
