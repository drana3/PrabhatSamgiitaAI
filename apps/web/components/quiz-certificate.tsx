import type { QuizCertification } from "@/lib/quiz"
import { memberFirstName } from "@/lib/member"

export function QuizCertificate({
  certification,
  displayName,
  compact = false,
}: {
  certification: QuizCertification
  displayName: string
  compact?: boolean
}) {
  const firstName = memberFirstName(displayName)
  const earned = new Date(certification.earned_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <article
      className={
        compact
          ? "rounded-2xl border border-gold-500/30 bg-gradient-to-br from-ivory-50 via-white to-gold-50 p-5 shadow-sm"
          : "rounded-[1.75rem] border-2 border-gold-500/40 bg-gradient-to-br from-ivory-50 via-white to-gold-100 p-8 shadow-xl"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold-700">Certificate of completion</p>
          <h3 className={`mt-2 font-serif text-navy-950 ${compact ? "text-2xl" : "text-3xl"}`}>
            {certification.label} level
          </h3>
        </div>
        <span className="rounded-full bg-navy-950 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gold-200">
          Certified
        </span>
      </div>

      <p className={`mt-5 leading-7 text-stone-700 ${compact ? "text-sm" : "text-base"}`}>
        This certifies that <span className="font-semibold text-navy-950">{firstName}</span> has successfully completed
        the Prabhat Samgiita AI <span className="font-semibold text-navy-950">{certification.label}</span> quiz with a
        passing score of 70% or higher.
      </p>

      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-navy-900/10 bg-white/80 p-3">
          <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Certificate code</dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-navy-950">{certification.certificate_code}</dd>
        </div>
        <div className="rounded-xl border border-navy-900/10 bg-white/80 p-3">
          <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Earned on</dt>
          <dd className="mt-1 font-semibold text-navy-950">{earned}</dd>
        </div>
      </dl>

      <footer className="mt-6 border-t border-gold-500/25 pt-4 text-xs leading-5 text-stone-600">
        Authorized by <span className="font-semibold text-navy-950">Prabhat Samgiita AI</span>
      </footer>
    </article>
  )
}
