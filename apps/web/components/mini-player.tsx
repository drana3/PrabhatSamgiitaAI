import Link from "next/link"

export function MiniPlayer({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`mini-player ${compact ? "mini-player-compact" : ""}`}>
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[url('/brand/dawn-hero.png')] bg-cover bg-left-bottom" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Begin listening · Song 1</p>
        <Link href="/songs/1" className="block truncate font-serif text-sm font-semibold text-navy-950">
          Bandhu He Niye Calo
        </Link>
      </div>
      <p className="ml-auto hidden text-xs text-stone-500 md:block">Open the song to choose a verified rendition</p>
      <Link href="/songs/1#listen" aria-label="Open Song 1 audio" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-950 pl-0.5 text-white shadow-lg">▶</Link>
    </div>
  )
}
