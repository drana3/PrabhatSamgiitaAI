import Link from "next/link"

import type { ActiveSiteAnnouncement } from "@/lib/announcements"

const kindLabels: Record<string, string> = {
  general: "Notice",
  maintenance: "Maintenance",
  quiz: "Quiz",
}

const priorityStyles: Record<string, string> = {
  normal: "border-gold-400/50 bg-gold-50/90 text-navy-950",
  high: "border-amber-500/60 bg-amber-50 text-amber-950",
  urgent: "border-red-500/70 bg-red-50 text-red-950",
}

function formatDeadline(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date)
}

export function SiteAnnouncementsBanner({ items }: { items: ActiveSiteAnnouncement[] }) {
  if (!items.length) return null

  return (
    <section aria-label="Site announcements" className="border-b border-navy-900/10 bg-white">
      <div className="mx-auto flex max-w-[90rem] flex-col gap-3 px-4 py-4 sm:px-6 lg:px-10">
        {items.map((item) => {
          const style = priorityStyles[item.priority] ?? priorityStyles.normal
          const deadline = formatDeadline(item.ends_at)
          return (
            <article
              key={item.id}
              className={`rounded-2xl border px-4 py-3 shadow-sm sm:px-5 sm:py-4 ${style}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-80">
                    {kindLabels[item.kind] ?? "Notice"}
                  </p>
                  <h2 className="mt-1 font-serif text-xl text-inherit sm:text-2xl">{item.title}</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 opacity-90">{item.body}</p>
                </div>
                {deadline ? (
                  <p className="shrink-0 rounded-full border border-current/15 bg-white/50 px-3 py-1 text-xs font-semibold">
                    Until {deadline}
                  </p>
                ) : null}
              </div>
              {item.kind === "quiz" ? (
                <p className="mt-3 text-sm font-semibold">
                  <Link href="/quiz" className="underline decoration-current underline-offset-4">
                    Open quiz hub →
                  </Link>
                </p>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
