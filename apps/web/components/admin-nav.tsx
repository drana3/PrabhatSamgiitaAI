import Link from "next/link"

export function AdminNav({
  active,
}: {
  active: "feedback" | "members" | "youtube" | "ingest" | "quiz"
}) {
  const links = [
    ["feedback", "Feedback"],
    ["members", "Members"],
    ["youtube", "YouTube review"],
    ["ingest", "Song ingestion"],
    ["quiz", "Quiz events"],
  ] as const
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={`/admin/${href}`}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            active === href
              ? "bg-navy-950 text-white"
              : "border border-navy-900/10 bg-white text-navy-950 hover:border-gold-500/40"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
