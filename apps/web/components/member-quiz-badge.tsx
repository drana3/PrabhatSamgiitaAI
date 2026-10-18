"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { useMember } from "@/components/member-provider"
import { fetchQuizStatus, readCachedQuizStatus, type QuizCertification } from "@/lib/quiz"

export function MemberQuizBadge() {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"
  const { session } = useMember()
  const [certifications, setCertifications] = useState<QuizCertification[]>(() => {
    if (typeof window === "undefined") return []
    return readCachedQuizStatus()?.certifications ?? []
  })

  useEffect(() => {
    if (!session.authenticated) {
      setCertifications([])
      return
    }
    const cached = readCachedQuizStatus()?.certifications
    if (cached?.length) setCertifications(cached)
    void fetchQuizStatus().then((status) => {
      if (status) setCertifications(status.certifications)
    })
  }, [session.authenticated])

  if (!authEnabled || !session.authenticated || !certifications.length) return null

  const top = certifications[certifications.length - 1]

  return (
    <div className="rounded-2xl border border-gold-500/25 bg-gradient-to-r from-gold-50 to-ivory-50 px-4 py-3 sm:px-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">Your certification</p>
      <p className="mt-1 text-sm font-semibold text-navy-950">
        {certifications.length} level{certifications.length === 1 ? "" : "s"} certified
        {top ? ` · latest: ${top.label}` : ""}
      </p>
      <Link href="/quiz" className="mt-2 inline-flex text-sm font-semibold text-gold-700">
        View certificates →
      </Link>
    </div>
  )
}
