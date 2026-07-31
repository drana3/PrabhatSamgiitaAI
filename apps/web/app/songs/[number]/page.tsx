import Link from "next/link"
import { notFound } from "next/navigation"

import { StreamExplanation } from "@/components/stream-explanation"
import { fetchNotation, fetchSong } from "@/lib/api"

export default async function SongPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params
  const song = await fetchSong(Number(number))
  if (!song) {
    notFound()
  }
  const notation = await fetchNotation(song.number)
  const mediaCount = song.media.length
  const relatedCount = song.related_songs.length

  return (
    <main className="min-h-screen bg-aurora px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/" className="text-sm font-semibold text-ember-700 transition hover:text-ember-900">
          Back to search
        </Link>

        <article className="overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/85 shadow-glow backdrop-blur">
          <div className="bg-gradient-to-r from-ink-950 via-ink-900 to-ember-900 px-6 py-6 text-white md:px-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-100">
                Song {song.number}
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-100">
                {song.canonical_source_status} source
              </span>
              {song.is_verified ? (
                <span className="rounded-full border border-white/15 bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-100">
                  Verified
                </span>
              ) : null}
            </div>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[0.95] text-white md:text-7xl">
              {song.title}
            </h1>
            {song.first_line ? (
              <p className="mt-5 max-w-3xl text-lg leading-8 text-ink-100 md:text-xl">{song.first_line}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-ink-100">
              <MetaPill label="Meaning" value={song.english_meaning ? "Available" : "Pending"} />
              <MetaPill label="Notation" value={notation ? "Available" : "Pending"} />
              <MetaPill label="Media" value={`${mediaCount} sources`} />
              <MetaPill label="Related" value={`${relatedCount} songs`} />
            </div>
          </div>

          <div className="grid gap-6 p-6 md:p-10 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <section className="rounded-[1.75rem] border border-ink-100 bg-gradient-to-br from-white to-ink-50 p-5">
                <p className="text-xs uppercase tracking-[0.4em] text-ember-700">Canonical text</p>
                <div className="mt-5 grid gap-4">
                  <InfoBlock label="Original lyrics" value={song.lyrics_original} />
                  <InfoBlock label="Roman transliteration" value={song.transliteration} />
                  <InfoBlock label="Hindi meaning" value={song.hindi_meaning} />
                  <InfoBlock label="English meaning" value={song.english_meaning} />
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-ink-100 bg-white p-5">
                <p className="text-xs uppercase tracking-[0.4em] text-ember-700">Grounded explanation</p>
                <div className="mt-4">
                  <StreamExplanation songNumber={song.number} />
                </div>
              </section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-[1.75rem] border border-ink-100 bg-ink-950 p-5 text-white">
                <p className="text-xs uppercase tracking-[0.4em] text-ember-300">Song details</p>
                <div className="mt-5 grid gap-3">
                  <SideInfo label="Theme" value={song.theme} />
                  <SideInfo label="Occasion" value={song.occasion} />
                  <SideInfo label="Festival" value={song.festival} />
                  <SideInfo label="Season" value={song.season} />
                  <SideInfo label="Raga" value={song.raga} />
                  <SideInfo label="Tala" value={song.tala} />
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-ink-100 bg-white p-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-3xl text-ink-900">Harmonium notation</h2>
                    <p className="mt-2 text-sm text-ink-600">
                      Transposed to {notation?.target_scale ?? "C"} when canonical notation exists.
                    </p>
                  </div>
                  {notation ? (
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">
                      {notation.verification_status}
                    </p>
                  ) : null}
                </div>

                {notation ? (
                  <div className="mt-6 space-y-4">
                    {notation.notation.lines.map((line) => (
                      <article
                        key={line.line_number}
                        className="rounded-3xl border border-ink-100 bg-gradient-to-br from-ink-50 to-white p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="font-semibold text-ink-900">Line {line.line_number}</h3>
                          {line.transliteration ? (
                            <p className="text-sm text-ink-600">{line.transliteration}</p>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm leading-7 text-ink-800">{line.lyrics}</p>
                        <div className="mt-4 grid gap-3">
                          {line.measures.map((measure, measureIndex) => (
                            <div
                              key={`${line.line_number}-${measureIndex}`}
                              className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm"
                            >
                              <p className="text-xs uppercase tracking-[0.3em] text-ember-700">
                                Measure {measureIndex + 1}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {measure.measures.map((beat) => (
                                  <div
                                    key={`${line.line_number}-${measureIndex}-${beat.beat}`}
                                    className="min-w-24 rounded-2xl bg-ink-50 px-3 py-2"
                                  >
                                    <p className="text-[11px] uppercase tracking-[0.25em] text-ink-500">
                                      Beat {beat.beat}
                                    </p>
                                    <div className="mt-2 space-y-1">
                                      {beat.notes.map((note, index) => (
                                        <p key={`${note.sargam}-${index}`} className="text-sm text-ink-800">
                                          {note.sargam}
                                          {note.western ? ` · ${note.western}` : ""}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-ink-600">
                    Notation is not yet available for this song in the synced source set.
                  </p>
                )}
              </section>

              <section className="rounded-[1.75rem] border border-ink-100 bg-ink-50 p-5">
                <h2 className="font-serif text-3xl text-ink-900">Verified media</h2>
                <div className="mt-4 grid gap-4">
                  {song.media.map((item) => (
                    <a
                      key={`${item.url}-${item.title}`}
                      href={item.embed_url ?? item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-ink-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-ember-300 hover:shadow-sm"
                    >
                      <p className="text-xs uppercase tracking-[0.3em] text-ember-700">{item.kind}</p>
                      <h3 className="mt-2 font-semibold text-ink-900">{item.title}</h3>
                      <p className="mt-1 break-all text-sm text-ink-600">{item.url}</p>
                    </a>
                  ))}
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-ink-100 bg-white p-5">
                <h2 className="font-serif text-3xl text-ink-900">Related songs</h2>
                <div className="mt-4 grid gap-4">
                  {song.related_songs.map((related) => (
                    <Link
                      key={related.number}
                      href={`/songs/${related.number}`}
                      className="rounded-2xl border border-ink-200 bg-gradient-to-br from-ink-50 to-white p-4 transition hover:-translate-y-0.5 hover:border-ember-300 hover:shadow-sm"
                    >
                      <p className="text-xs uppercase tracking-[0.3em] text-ember-700">Song {related.number}</p>
                      <h3 className="mt-2 font-semibold text-ink-900">{related.title}</h3>
                      <p className="mt-1 text-sm text-ink-600">{related.first_line}</p>
                    </Link>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </article>
      </div>
    </main>
  )
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2">
      <span className="text-[11px] uppercase tracking-[0.25em] text-amber-100">{label}: </span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.3em] text-ember-700">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink-800">
        {value || "Not yet synced from canonical source."}
      </p>
    </section>
  )
}

function SideInfo({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-[11px] uppercase tracking-[0.25em] text-ink-300">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value || "Not yet synced"}</p>
    </div>
  )
}
