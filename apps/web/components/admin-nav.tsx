import Link from "next/link"

export type AdminSection = "feedback" | "ingest" | "youtube" | "members" | "quiz"

const links: ReadonlyArray<{ href: AdminSection; label: string; shortLabel: string }> = [
  { href: "feedback", label: "Feedback", shortLabel: "Feedback" },
  { href: "ingest", label: "Song ingestion", shortLabel: "Ingestion" },
  {
    href: "youtube",
    label: "YouTube scheduled job review",
    shortLabel: "YouTube review",
  },
  { href: "members", label: "Admins", shortLabel: "Admins" },
  { href: "quiz", label: "Create quiz event", shortLabel: "Quiz event" },
]

export function AdminNav({ active }: { active: AdminSection }) {
  return (
    <nav aria-label="Admin sections" className="border-t border-navy-900/8">
      <ul className="-mb-px flex gap-0 overflow-x-auto">
        {links.map(({ href, label, shortLabel }) => {
          const isActive = active === href
          return (
            <li key={href} className="shrink-0">
              <Link
                href={`/admin/${href}`}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex border-b-2 px-3 py-3 text-sm font-semibold transition sm:px-4 ${
                  isActive
                    ? "border-gold-600 text-navy-950"
                    : "border-transparent text-stone-500 hover:border-navy-900/15 hover:text-navy-950"
                }`}
              >
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
