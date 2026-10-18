"use client"

type SongMobileNavProps = {
  hasAudio: boolean
  hasLyrics: boolean
  hasMeaning: boolean
}

export function SongMobileNav({ hasAudio, hasLyrics, hasMeaning }: SongMobileNavProps) {
  const items = [
    hasAudio ? { href: "#listen", label: "Listen", icon: "♪" } : null,
    hasLyrics ? { href: "#lyrics", label: "Lyrics", icon: "≡" } : null,
    hasMeaning ? { href: "#meaning", label: "Meaning", icon: "✦" } : null,
    { href: "#ask", label: "Ask AI", icon: "AI" },
  ].filter(Boolean) as Array<{ href: string; label: string; icon: string }>

  return (
    <nav
      aria-label="Song sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-900/10 bg-ivory-50/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_40px_rgba(34,28,18,0.12)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex max-w-lg justify-around gap-1 px-3">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold text-navy-950 transition active:bg-gold-100"
          >
            <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full border border-navy-900/10 bg-white text-xs">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </a>
        ))}
      </div>
    </nav>
  )
}
