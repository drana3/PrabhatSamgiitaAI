import Link from "next/link"
import { notFound } from "next/navigation"

import { HarmoniumPractice } from "@/components/harmonium-practice"
import { AudioRendition } from "@/components/audio-rendition"
import { PracticeCoach } from "@/components/practice-coach"
import { ShareMenu } from "@/components/share-menu"
import { SiteHeader } from "@/components/site-header"
import { SongLanguageSwitcher } from "@/components/song-language-switcher"
import { StreamExplanation } from "@/components/stream-explanation"
import { fetchNotation, fetchSong, fetchSongLocalization } from "@/lib/api"
import { localeLabel } from "@/lib/languages"

export default async function SongPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ language?: string }> }) {
  const { number } = await params
  const { language = "en" } = await searchParams
  const song = await fetchSong(Number(number))
  if (!song) notFound()
  const notation = await fetchNotation(song.number)
  const localized = language !== "en" ? await fetchSongLocalization(song.number, localeLabel(language)) : null
  const audio = song.media.filter((item) => item.kind === "audio")
  const videos = song.media.filter((item) => item.kind === "video" && item.embed_url)

  return (
    <main className="min-h-screen bg-ivory-100">
      <SiteHeader active="Explore" />
      <div className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 lg:px-10">
        <div className="flex items-center gap-2 text-xs text-stone-500"><Link href="/explore" className="hover:text-gold-700">Explore</Link><span>›</span><span>Song {song.number}</span></div>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-navy-900/10 bg-white shadow-xl">
          <div className="grid lg:grid-cols-[0.78fr_1.22fr]">
            <div className="relative min-h-[20rem] bg-[url('/brand/dawn-hero.png')] bg-cover bg-left-bottom p-6 text-white sm:min-h-[25rem] lg:min-h-[32rem]">
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/25 to-transparent" />
              <div className="relative flex h-full flex-col justify-end">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-200">Song {song.number}</p>
                <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{titleCase(localized?.localized_title || song.title)}</h1>
                <p className="mt-3 max-w-md text-sm leading-6 text-white/85">{titleCase(localized?.localized_first_line || song.first_line || song.title)}</p>
                <div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold">{song.is_verified ? "✓ Source verified" : "Source indexed"}</span>{song.language ? <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold">{song.language}</span> : null}</div>
              </div>
            </div>

            <div className="p-5 sm:p-7 lg:p-9">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-900/10 pb-5">
                <nav className="flex flex-wrap gap-5 text-sm font-semibold text-navy-950"><a href="#lyrics" className="hover:text-gold-700">Lyrics</a><a href="#meaning" className="hover:text-gold-700">Meaning</a><a href="#notation" className="hover:text-gold-700">Notation</a><a href="#listen" className="hover:text-gold-700">Listen</a><a href="#ask" className="hover:text-gold-700">Ask AI</a></nav>
                <div className="flex flex-wrap gap-2"><SongLanguageSwitcher selectedLanguage={language} /><ShareMenu title={`Song ${song.number}: ${song.title}`} /></div>
              </div>

              <section id="lyrics" className="scroll-mt-24 py-7">
                <p className="eyebrow">Lyrics</p>
                <p className="mt-4 whitespace-pre-wrap font-serif text-2xl leading-[1.65] text-navy-950">{song.lyrics_original || song.first_line}</p>
                {song.transliteration ? <details className="mt-5 rounded-2xl border border-navy-900/10 bg-ivory-50 p-4" open><summary className="cursor-pointer text-sm font-semibold text-gold-700">Roman transliteration</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">{song.transliteration}</p></details> : null}
              </section>

              <section id="meaning" className="scroll-mt-24 border-t border-navy-900/10 py-7">
                <p className="eyebrow">Meaning</p>
                <h2 className="mt-2 font-serif text-3xl text-navy-950">Understand the song</h2>
                {localized?.localized_meaning ? <MeaningBlock label={`${localeLabel(language)} meaning`} value={localized.localized_meaning} /> : null}
                <MeaningBlock label="English" value={song.english_meaning} />
                <MeaningBlock label="हिन्दी" value={song.hindi_meaning} />
                {!localized?.localized_meaning && !song.english_meaning && !song.hindi_meaning ? <AvailabilityState title="Meaning is being prepared" description="The source lyrics are available above. A reviewed meaning has not yet been published for this song, so we do not invent one." /> : null}
              </section>

              <section className="border-t border-navy-900/10 py-7">
                <HarmoniumPractice songNumber={song.number} initialNotation={notation} sourceUrl={song.notation_source_url} sourceStatus={song.notation_verification_status} />
                <PracticeCoach notation={notation} />
              </section>
            </div>
          </div>
        </section>

        <div className="mt-7 grid gap-7 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-7">
            <section id="ask" className="surface-card p-4 sm:p-6"><StreamExplanation songNumber={song.number} language={language !== "en" ? localeLabel(language) : null} /></section>
            {song.related_songs.length ? <section className="surface-card p-5 sm:p-7"><p className="eyebrow">Continue exploring</p><h2 className="mt-2 font-serif text-3xl text-navy-950">Related songs</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{song.related_songs.map((related) => <Link key={related.number} href={`/songs/${related.number}`} className="rounded-2xl border border-navy-900/10 bg-ivory-50 p-4 hover:border-gold-500"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">Song {related.number}</p><h3 className="mt-2 font-serif text-lg font-semibold text-navy-950">{titleCase(related.title)}</h3></Link>)}</div></section> : null}
          </div>

          <aside className="space-y-7">
            <section id="listen" className="surface-card scroll-mt-24 p-5 sm:p-6"><p className="eyebrow">Listen</p><h2 className="mt-2 font-serif text-3xl text-navy-950">Audio renditions</h2><div className="mt-5 space-y-4">{audio.slice(0, 5).map((item, index) => <AudioRendition key={item.url} url={item.url} title={item.title} provider={item.provider} featured={index === 0} />)}{!audio.length ? <p className="rounded-xl bg-ivory-50 p-4 text-sm text-stone-600">No playable audio is currently matched to this song.</p> : null}</div></section>
            {videos.map((item) => <section key={item.url} className="surface-card overflow-hidden"><div className="p-5"><p className="eyebrow">Watch</p><h2 className="mt-2 font-serif text-2xl text-navy-950">YouTube performance</h2></div><iframe className="aspect-video w-full" src={item.embed_url || undefined} title={item.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></section>)}
            {!videos.length ? <section className="surface-card p-5 sm:p-6"><p className="eyebrow">Watch</p><AvailabilityState title="No verified video match yet" description={`The channel watcher checks new performances by song number. Song ${song.number} will appear here only after a confident match.`} /></section> : null}
            <section className="rounded-2xl bg-navy-950 p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-300">Song details</p><div className="mt-4 grid grid-cols-2 gap-3"><Detail label="Theme" value={song.theme} /><Detail label="Occasion" value={song.occasion} /><Detail label="Festival" value={song.festival} /><Detail label="Season" value={song.season} /><Detail label="Raga" value={song.raga} /><Detail label="Tala" value={song.tala || notation?.notation.tala?.name} /></div></section>
          </aside>
        </div>
      </div>
    </main>
  )
}

function MeaningBlock({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return <article className="mt-4 rounded-2xl border border-navy-900/10 bg-ivory-50 p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-700">{label}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">{value}</p></article>
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return <div className="rounded-xl bg-white/8 p-3"><p className="text-[9px] uppercase tracking-[0.16em] text-navy-200">{label}</p><p className="mt-1 text-xs font-semibold text-white">{value || "Not listed"}</p></div>
}

function AvailabilityState({ title, description }: { title: string; description: string }) {
  return <div className="mt-4 rounded-2xl border border-dashed border-gold-500/40 bg-gold-50/60 p-5"><h3 className="font-serif text-xl text-navy-950">{title}</h3><p className="mt-2 text-sm leading-6 text-stone-600">{description}</p></div>
}

function titleCase(value: string) {
  return value.toLocaleLowerCase().replace(/(^|[\s'’-])\p{L}/gu, (letter) => letter.toLocaleUpperCase())
}
