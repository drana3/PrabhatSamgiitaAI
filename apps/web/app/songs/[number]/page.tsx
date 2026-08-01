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
  const hasLyrics = Boolean(song.lyrics_original || song.first_line || song.transliteration)
  const hasMeaning = Boolean(localized?.localized_meaning || song.english_meaning || song.hindi_meaning)
  const hasNotation = Boolean(notation)
  const details = [
    ["Theme", song.theme],
    ["Occasion", song.occasion],
    ["Festival", song.festival],
    ["Season", song.season],
    ["Raga", song.raga],
    ["Tala", song.tala || notation?.notation.tala?.name],
  ].filter((detail): detail is [string, string] => Boolean(detail[1]))

  return (
    <main className="min-h-screen bg-ivory-100">
      <SiteHeader active="Explore" />
      <div className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 lg:px-10">
        <div className="flex items-center gap-2 text-xs text-stone-500"><Link href="/explore" className="hover:text-gold-700">Explore</Link><span>›</span><span>Song {song.number}</span></div>

        <section className="mt-5 rounded-[2rem] border border-navy-900/10 bg-white shadow-xl">
          <div className="grid items-start lg:grid-cols-[0.78fr_1.22fr]">
            <div className="h-full self-stretch rounded-t-[2rem] bg-gold-50 lg:rounded-l-[2rem] lg:rounded-tr-none">
              <div className="relative min-h-[20rem] overflow-hidden rounded-t-[2rem] bg-[url('/brand/dawn-hero.png')] bg-cover bg-left-bottom p-6 text-white sm:min-h-[25rem] lg:sticky lg:top-28 lg:h-[calc(100vh-8.5rem)] lg:min-h-[32rem] lg:max-h-[42rem] lg:rounded-l-[2rem] lg:rounded-tr-none">
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/35 to-transparent" />
                <div className="relative flex h-full flex-col justify-end">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-200">Song {song.number}</p>
                  <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{titleCase(localized?.localized_title || song.title)}</h1>
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/85">{titleCase(localized?.localized_first_line || song.first_line || song.title)}</p>
                  <div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold">{song.is_verified ? "✓ Source verified" : "Source indexed"}</span>{song.language ? <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold">{song.language}</span> : null}</div>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-7 lg:p-9">
              <div className="grid gap-4 border-b border-navy-900/10 pb-5 xl:grid-cols-[1fr_auto] xl:items-center">
                <nav aria-label="Song sections" className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-navy-950">{hasLyrics ? <a href="#lyrics" className="hover:text-gold-700">Lyrics</a> : null}{hasMeaning ? <a href="#meaning" className="hover:text-gold-700">Meaning</a> : null}{hasNotation ? <a href="#notation" className="hover:text-gold-700">Notation</a> : null}{audio.length ? <a href="#listen" className="hover:text-gold-700">Listen</a> : null}<a href="#ask" className="hover:text-gold-700">Ask AI</a></nav>
                <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center xl:w-auto"><SongLanguageSwitcher selectedLanguage={language} /><ShareMenu title={`Song ${song.number}: ${song.title}`} /></div>
              </div>

              {hasLyrics ? <section id="lyrics" className="scroll-mt-28 py-7">
                <p className="eyebrow">Lyrics</p>
                <p className="mt-4 whitespace-pre-wrap font-serif text-2xl leading-[1.65] text-navy-950">{song.lyrics_original || song.first_line}</p>
                {song.transliteration ? <details className="mt-5 rounded-2xl border border-navy-900/10 bg-ivory-50 p-4" open><summary className="cursor-pointer text-sm font-semibold text-gold-700">Roman transliteration</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">{song.transliteration}</p></details> : null}
              </section> : null}

              {hasMeaning ? <section id="meaning" className="scroll-mt-28 border-t border-navy-900/10 py-7">
                <p className="eyebrow">Meaning</p>
                <h2 className="mt-2 font-serif text-3xl text-navy-950">Understand the song</h2>
                {localized?.localized_meaning ? <MeaningBlock label={`${localeLabel(language)} meaning`} value={localized.localized_meaning} /> : null}
                <MeaningBlock label="English" value={song.english_meaning} />
                <MeaningBlock label="हिन्दी" value={song.hindi_meaning} />
              </section> : null}

              {hasNotation ? <section className="border-t border-navy-900/10 py-7">
                <HarmoniumPractice songNumber={song.number} initialNotation={notation} sourceUrl={song.notation_source_url} sourceStatus={song.notation_verification_status} />
                <PracticeCoach notation={notation} />
              </section> : null}
            </div>
          </div>
        </section>

        <div className="mt-7 grid gap-7 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-7">
            <section className="surface-card p-4 sm:p-6"><StreamExplanation songNumber={song.number} language={language !== "en" ? localeLabel(language) : null} /></section>
            {song.related_songs.length ? <section className="surface-card p-5 sm:p-7"><p className="eyebrow">Continue exploring</p><h2 className="mt-2 font-serif text-3xl text-navy-950">Related songs</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{song.related_songs.map((related) => <Link key={related.number} href={`/songs/${related.number}`} className="rounded-2xl border border-navy-900/10 bg-ivory-50 p-4 hover:border-gold-500"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">Song {related.number}</p><h3 className="mt-2 font-serif text-lg font-semibold text-navy-950">{titleCase(related.title)}</h3></Link>)}</div></section> : null}
          </div>

          <aside className="space-y-7">
            {audio.length ? <section id="listen" className="surface-card scroll-mt-28 p-5 sm:p-6"><p className="eyebrow">Listen</p><h2 className="mt-2 font-serif text-3xl text-navy-950">Listen to this song</h2><div className="mt-5 space-y-4">{audio.slice(0, 5).map((item, index) => <AudioRendition key={item.url} url={item.url} title={item.title} provider={item.provider} featured={index === 0} />)}</div></section> : null}
            {videos.map((item) => <section key={item.url} className="surface-card overflow-hidden"><div className="p-5"><p className="eyebrow">Watch</p><h2 className="mt-2 font-serif text-2xl text-navy-950">YouTube performance</h2></div><iframe className="aspect-video w-full" src={item.embed_url || undefined} title={item.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></section>)}
            {details.length ? <section className="rounded-2xl bg-navy-950 p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-300">Song details</p><div className="mt-4 grid grid-cols-2 gap-3">{details.map(([label, value]) => <Detail key={label} label={label} value={value} />)}</div></section> : null}
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

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white/8 p-3"><p className="text-[9px] uppercase tracking-[0.16em] text-navy-200">{label}</p><p className="mt-1 text-xs font-semibold text-white">{value}</p></div>
}

function titleCase(value: string) {
  return value.toLocaleLowerCase().replace(/(^|[\s'’-])\p{L}/gu, (letter) => letter.toLocaleUpperCase())
}
