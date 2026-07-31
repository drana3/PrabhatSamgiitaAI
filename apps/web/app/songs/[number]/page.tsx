import Link from "next/link"
import { notFound } from "next/navigation"

import { StreamExplanation } from "@/components/stream-explanation"
import { fetchSong } from "@/lib/api"

export default async function SongPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params
  const song = await fetchSong(Number(number))
  if (!song) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-aurora px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/" className="text-sm font-semibold text-ember-700">
          Back to search
        </Link>
        <article className="rounded-[2rem] border border-ink-200 bg-white p-6 shadow-glow md:p-10">
          <p className="text-xs uppercase tracking-[0.4em] text-ember-700">Song {song.number}</p>
          <h1 className="mt-3 font-serif text-5xl text-ink-900">{song.title}</h1>
          <p className="mt-4 text-sm text-ink-600">{song.canonical_source_status} source</p>
          {song.first_line ? <p className="mt-4 text-lg leading-8 text-ink-800">{song.first_line}</p> : null}
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <InfoBlock label="Original lyrics" value={song.lyrics_original} />
            <InfoBlock label="Roman transliteration" value={song.transliteration} />
            <InfoBlock label="Hindi meaning" value={song.hindi_meaning} />
            <InfoBlock label="English meaning" value={song.english_meaning} />
            <InfoBlock label="Theme" value={song.theme} />
            <InfoBlock label="Occasion" value={song.occasion} />
            <InfoBlock label="Festival" value={song.festival} />
            <InfoBlock label="Season" value={song.season} />
            <InfoBlock label="Raga" value={song.raga} />
            <InfoBlock label="Tala" value={song.tala} />
          </div>
        </article>

        <StreamExplanation songNumber={song.number} />

        <section className="rounded-[2rem] border border-ink-200 bg-white p-6">
          <h2 className="font-serif text-3xl text-ink-900">Verified media</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {song.media.map((item) => (
              <a
                key={`${item.url}-${item.title}`}
                href={item.embed_url ?? item.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-ink-200 bg-ink-50 p-4"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-ember-700">{item.kind}</p>
                <h3 className="mt-2 font-semibold text-ink-900">{item.title}</h3>
                <p className="mt-1 break-all text-sm text-ink-600">{item.url}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-ink-200 bg-white p-6">
          <h2 className="font-serif text-3xl text-ink-900">Related songs</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {song.related_songs.map((related) => (
              <Link
                key={related.number}
                href={`/songs/${related.number}`}
                className="rounded-2xl border border-ink-200 bg-ink-50 p-4 transition hover:bg-white"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-ember-700">Song {related.number}</p>
                <h3 className="mt-2 font-semibold text-ink-900">{related.title}</h3>
                <p className="mt-1 text-sm text-ink-600">{related.first_line}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

function InfoBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <section className="rounded-2xl border border-ink-200 bg-ink-50 p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-ember-700">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-800">{value || "Not yet synced from canonical source."}</p>
    </section>
  )
}
