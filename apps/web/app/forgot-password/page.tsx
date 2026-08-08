import Link from "next/link"

import { ForgotPasswordForm } from "@/components/forgot-password-form"
import { SiteHeader } from "@/components/site-header"

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <p className="eyebrow">Account</p>
        <h1 className="mt-3 font-serif text-4xl text-navy-950">Reset your password</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Enter the email for your account. If it exists, we will send a reset link.
        </p>
        <ForgotPasswordForm />
        <p className="mt-6 text-center text-sm text-stone-600">
          <Link href="/signin" className="font-semibold text-navy-950 underline decoration-gold-500 underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
