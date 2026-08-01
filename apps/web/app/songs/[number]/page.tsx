import Link from "next/link"
import { notFound } from "next/navigation"

import { HarmoniumPractice } from "@/components/harmonium-practice"
import { AudioRendition } from "@/components/audio-rendition"
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
  const lyrics = song.lyrics_original?.trim() || song.transliteration?.trim() || null
  const hasLyrics = Boolean(lyrics)
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

        <section className="relative mt-5 min-h-[18rem] overflow-hidden rounded-[2rem] bg-[url('/brand/dawn-hero.png')] bg-cover bg-center text-white shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/80 to-navy-950/25" />
          <div className="relative flex min-h-[18rem] flex-col justify-between gap-8 p-6 sm:p-8 lg:flex-row lg:items-end lg:p-10">
            <div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-200">Prabhat Samgiita · Song {song.number}</p><h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl lg:text-6xl">{titleCase(localized?.localized_title || song.title)}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">{titleCase(localized?.localized_first_line || song.first_line || song.title)}</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold">{song.is_verified ? "✓ Source verified" : "Source indexed"}</span>{song.language ? <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold">{song.language}</span> : null}</div></div>
            <nav aria-label="Song actions" className="flex max-w-lg flex-wrap gap-2 lg:justify-end"><a href="#ask" className="rounded-full bg-gold-300 px-4 py-2 text-sm font-semibold text-navy-950">✦ Know more with AI</a>{audio.length ? <a href="#listen" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy-950">♪ Listen</a> : null}{videos.length ? <a href="#watch" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy-950">▶ Watch</a> : null}{hasNotation ? <a href="#notation" className="rounded-full border border-white/30 bg-navy-950/35 px-4 py-2 text-sm font-semibold text-white">♬ Harmonium</a> : null}<ShareMenu title={`Song ${song.number}: ${song.title}`} /></nav>
          </div>
        </section>

        <section className="mt-7 rounded-[2rem] border border-navy-900/10 bg-white p-5 shadow-lg sm:p-7 lg:p-9">
          {audio.length || videos.length ? <div className={`mb-6 grid gap-4 ${audio.length && videos.length ? "lg:grid-cols-[0.8fr_1.2fr]" : ""}`}>
            {audio.length ? <div className="flex flex-col justify-center gap-3 rounded-2xl border border-gold-500/30 bg-gold-50 p-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">Listen while you read</p><p className="mt-1 text-xs leading-5 text-stone-600">Follow the lyrics and meaning with the recording.</p></div><AudioRendition url={audio[0].url} title={audio[0].title} provider={audio[0].provider} compact /></div> : null}
            {videos.length ? <div id="watch" className="scroll-mt-28 overflow-hidden rounded-2xl border border-navy-900/10 bg-navy-950"><div className="px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-300">Watch while you learn</p></div><iframe className="aspect-video w-full" src={videos[0].embed_url || undefined} title={videos[0].title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div> : null}
          </div> : null}
          <div className={`grid gap-7 ${hasLyrics && hasMeaning ? "xl:grid-cols-2" : "max-w-4xl"}`}>
            {hasLyrics ? <section id="lyrics" className="scroll-mt-28 rounded-2xl border border-navy-900/10 bg-ivory-50 p-5 sm:p-7"><p className="eyebrow">Lyrics</p><h2 className="mt-2 font-serif text-3xl text-navy-950">Sing with the words</h2><p className="mt-5 whitespace-pre-wrap font-serif text-xl leading-[1.7] text-navy-950 sm:text-2xl">{lyrics}</p>{song.lyrics_original?.trim() && song.transliteration?.trim() ? <details className="mt-5 rounded-2xl border border-navy-900/10 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-gold-700">Roman transliteration</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">{song.transliteration.trim()}</p></details> : null}</section> : null}

            {hasMeaning ? <section id="meaning" className="scroll-mt-28 rounded-2xl border border-navy-900/10 bg-white p-5 sm:p-7"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="eyebrow">Meaning</p><h2 className="mt-2 font-serif text-3xl text-navy-950">Understand the song</h2><p className="mt-2 text-xs leading-5 text-stone-500">Choose a language for an AI-assisted translation grounded in this song.</p></div><SongLanguageSwitcher selectedLanguage={language} /></div>{localized?.localized_meaning ? <MeaningBlock label={`${localeLabel(language)} meaning`} value={localized.localized_meaning} /> : null}<MeaningBlock label="English" value={song.english_meaning} />{language === "hi" || !song.english_meaning ? <MeaningBlock label="हिन्दी" value={song.hindi_meaning} /> : null}</section> : null}
          </div>

          {hasNotation ? <div className="mt-7 border-t border-navy-900/10 pt-7"><HarmoniumPractice songNumber={song.number} initialNotation={notation} sourceUrl={song.notation_source_url} sourceStatus={song.notation_verification_status} /></div> : null}
        </section>

        <div className="mt-7 grid gap-7 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-7">
            <section className="surface-card p-4 sm:p-6"><StreamExplanation songNumber={song.number} language={language !== "en" ? localeLabel(language) : null} /></section>
            {song.related_songs.length ? <section className="surface-card p-5 sm:p-7"><p className="eyebrow">Continue exploring</p><h2 className="mt-2 font-serif text-3xl text-navy-950">Related songs</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{song.related_songs.map((related) => <Link key={related.number} href={`/songs/${related.number}`} className="rounded-2xl border border-navy-900/10 bg-ivory-50 p-4 hover:border-gold-500"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">Song {related.number}</p><h3 className="mt-2 font-serif text-lg font-semibold text-navy-950">{titleCase(related.title)}</h3></Link>)}</div></section> : null}
          </div>

          <aside className="space-y-7">
            {audio.length ? <section id="listen" className="surface-card scroll-mt-28 p-5 sm:p-6"><p className="eyebrow">Listen</p><h2 className="mt-2 font-serif text-3xl text-navy-950">Listen to this song</h2><div className="mt-5"><AudioRendition url={audio[0].url} title={audio[0].title} provider={audio[0].provider} featured />{audio.length > 1 ? <details className="mt-4 rounded-2xl border border-navy-900/10 bg-ivory-50 p-4"><summary className="cursor-pointer text-sm font-semibold text-gold-700">More recordings ({Math.min(audio.length - 1, 4)})</summary><div className="mt-4 space-y-4">{audio.slice(1, 5).map((item) => <AudioRendition key={item.url} url={item.url} title={item.title} provider={item.provider} />)}</div></details> : null}</div></section> : null}
            {videos.length > 1 ? <section className="space-y-7">{videos.slice(1).map((item) => <div key={item.url} className="surface-card overflow-hidden"><div className="p-5"><p className="eyebrow">More performances</p><h2 className="mt-2 font-serif text-2xl text-navy-950">Another verified recording</h2></div><iframe className="aspect-video w-full" src={item.embed_url || undefined} title={item.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>)}</section> : null}
            {details.length ? <section className="rounded-2xl bg-navy-950 p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-300">Song details</p><div className="mt-4 grid grid-cols-2 gap-3">{details.map(([label, value]) => <Detail key={label} label={label} value={value} />)}</div></section> : null}
          </aside>
        </div>
      </div>
    </main>
  )
}

function MeaningBlock({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return <article className="mt-4 rounded-2xl border border-navy-900/10 bg-ivory-50 p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-700">{label}</p><p dir="auto" className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">{value}</p></article>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white/8 p-3"><p className="text-[9px] uppercase tracking-[0.16em] text-navy-200">{label}</p><p className="mt-1 text-xs font-semibold text-white">{value}</p></div>
}

function titleCase(value: string) {
  return value.toLocaleLowerCase().replace(/(^|[\s'’-])\p{L}/gu, (letter) => letter.toLocaleUpperCase())
}
