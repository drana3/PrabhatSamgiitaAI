import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { FavoriteSongButton } from "@/components/favorite-song-button"
import { LoadingIndicator } from "@/components/loading-indicator"
import { HarmoniumPractice } from "@/components/harmonium-practice"
import { HashLanding } from "@/components/hash-landing"
import { AudioRendition } from "@/components/audio-rendition"
import { ShareMenu } from "@/components/share-menu"
import { SiteHeader } from "@/components/site-header"
import { SongLanguageSwitcher } from "@/components/song-language-switcher"
import { SongMobileNav } from "@/components/song-mobile-nav"
import { SongStoriesPanel } from "@/components/stories-inspiration"
import { StreamExplanation } from "@/components/stream-explanation"
import { fetchNotation, fetchSong, fetchSongLocalization } from "@/lib/api"
import { localeLabel } from "@/lib/languages"
import { storedMeaningForLanguage } from "@/lib/song-meanings"
import { splitLyricLines } from "@/lib/sargam-display"
import { songPagePath } from "@/lib/song-path"

export default async function SongPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ language?: string }> }) {
  const { number } = await params
  const { language = "en" } = await searchParams
  const song = await fetchSong(Number(number))
  if (!song) notFound()
  const notation = await fetchNotation(song.number)
  const storedMeaning = storedMeaningForLanguage(song, language)
  const shouldFetchLocalization = language !== "en" && !storedMeaning
  const localized = shouldFetchLocalization ? await fetchSongLocalization(song.number, localeLabel(language)) : null
  const audio = song.media.filter((item) => item.kind === "audio")
  const videos = song.media.filter((item) => item.kind === "video" && item.embed_url)
  const lyrics = song.lyrics_original?.trim() || song.transliteration?.trim() || null
  const hasLyrics = Boolean(lyrics)
  const hasMeaning = Boolean(storedMeaning || localized?.localized_meaning || song.english_meaning || song.hindi_meaning)
  const selectedMeaning = storedMeaning
    ?? (language === "hi" ? song.hindi_meaning || localized?.localized_meaning : localized?.localized_meaning)
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
    <main className="min-h-screen bg-ivory-100 pb-24 md:pb-0">
      <HashLanding />
      <SiteHeader active="Explore" />
      <div className="mx-auto max-w-[90rem] px-4 py-4 sm:px-6 sm:py-6 lg:px-10">
        <div className="flex items-center gap-2 text-xs text-stone-500"><Link href="/" className="hover:text-gold-700">Home</Link><span>›</span><Link href="/explore" className="hover:text-gold-700">Explore</Link><span>›</span><span>Song {song.number}</span></div>

        <section className="relative mt-4 min-h-[13rem] overflow-hidden rounded-[1.75rem] bg-navy-950 text-white shadow-xl sm:mt-5 sm:min-h-[18rem] sm:rounded-[2rem]">
          <div
            role="img"
            aria-label="Shrii Shrii Anandamurti ji at dawn"
            className="absolute inset-0 bg-[url('/brand/dawn-hero.png')] bg-cover bg-[82%_top]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/85 to-navy-950/30" />
          <div className="relative flex min-h-[13rem] flex-col justify-between gap-5 p-5 sm:min-h-[18rem] sm:gap-6 sm:p-8 lg:p-10">
            <div className="max-w-3xl"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold-200 sm:text-xs">Prabhat Samgiita · Song {song.number}</p><h1 className="mt-2 font-serif text-3xl leading-tight sm:mt-3 sm:text-5xl lg:text-6xl">{titleCase(localized?.localized_title || song.title)}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/85 sm:mt-3">{titleCase(localized?.localized_first_line || song.first_line || song.title)}</p><div className="mt-4 flex flex-wrap gap-2 sm:mt-5"><span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold">{song.is_verified ? "✓ Source verified" : "Source indexed"}</span>{song.language ? <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold">{song.language}</span> : null}</div></div>
            <nav aria-label="Song actions" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0 xl:flex-nowrap"><a href="#ask" className="shrink-0 whitespace-nowrap rounded-full bg-gold-300 px-3.5 py-2 text-xs font-semibold text-navy-950 sm:px-4 sm:text-sm">✦ Ask AI</a>{audio.length ? <a href="#listen" className="shrink-0 whitespace-nowrap rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-navy-950 sm:px-4 sm:text-sm">♪ Listen</a> : null}{hasLyrics ? <a href="#lyrics" className="shrink-0 whitespace-nowrap rounded-full border border-white/30 bg-navy-950/35 px-3.5 py-2 text-xs font-semibold text-white sm:px-4 sm:text-sm">Lyrics</a> : null}{videos.length ? <a href="#watch" className="shrink-0 whitespace-nowrap rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-navy-950 sm:px-4 sm:text-sm">▶ Watch</a> : null}{hasNotation ? <a href="#notation" className="shrink-0 whitespace-nowrap rounded-full border border-white/30 bg-navy-950/35 px-3.5 py-2 text-xs font-semibold text-white sm:px-4 sm:text-sm">♬ Harmonium</a> : null}<FavoriteSongButton songNumber={song.number} /><ShareMenu title={`Song ${song.number}: ${song.title}`} /></nav>
          </div>
        </section>

        <section className="mt-7 rounded-[2rem] border border-navy-900/10 bg-white p-5 shadow-lg sm:p-7 lg:p-9">
          <div className={`grid gap-7 ${hasLyrics && hasMeaning ? "xl:grid-cols-2" : "max-w-4xl"}`}>
            {hasLyrics ? <section id="lyrics" className="scroll-mt-28 rounded-2xl border border-navy-900/10 bg-ivory-50 p-5 sm:p-7"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="eyebrow">Lyrics</p><h2 className="mt-2 font-serif text-3xl text-navy-950">Sing with the words</h2></div>{audio.length ? <div id="listen" className="scroll-mt-28 sm:max-w-xs"><AudioRendition url={audio[0].url} title={audio[0].title} provider={audio[0].provider} compact /></div> : null}</div><p className="mt-5 whitespace-pre-wrap font-serif text-xl leading-[1.7] text-navy-950 sm:text-2xl">{lyrics}</p>{song.lyrics_original?.trim() && song.transliteration?.trim() ? <details className="mt-5 rounded-2xl border border-navy-900/10 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-gold-700">Roman transliteration</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">{song.transliteration.trim()}</p></details> : null}{audio.length > 1 ? <details className="mt-5 rounded-2xl border border-navy-900/10 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-gold-700">More recordings ({Math.min(audio.length - 1, 4)})</summary><div className="mt-4 space-y-4">{audio.slice(1, 5).map((item) => <AudioRendition key={item.url} url={item.url} title={item.title} provider={item.provider} />)}</div></details> : null}</section> : null}

            {hasMeaning ? <section id="meaning" className="scroll-mt-28 rounded-2xl border border-navy-900/10 bg-white p-5 sm:p-7"><div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="w-full sm:w-auto"><p className="eyebrow">Meaning</p><h2 className="mt-2 font-serif text-3xl text-navy-950">Understand the song</h2><p className="mt-2 text-xs leading-5 text-stone-500">Choose a reading language. Curated translations from the catalog appear first; AI assists only when none is stored.</p></div><Suspense fallback={<div className="flex justify-center py-2 sm:justify-end"><LoadingIndicator label="Loading languages" compact /></div>}><SongLanguageSwitcher selectedLanguage={language} /></Suspense></div>{language !== "en" && selectedMeaning ? <MeaningBlock label={`${localeLabel(language)} meaning`} value={selectedMeaning} /> : null}<MeaningBlock label="English" value={song.english_meaning} />{language !== "hi" && !song.english_meaning ? <MeaningBlock label="हिन्दी" value={song.hindi_meaning} /> : null}</section> : null}
          </div>

          {hasNotation ? (
            <div className="mt-7 border-t border-navy-900/10 pt-7">
              <HarmoniumPractice
                songNumber={song.number}
                initialNotation={notation}
                sourceUrl={song.notation_source_url}
                sourceStatus={song.notation_verification_status}
                songLyricLines={splitLyricLines(song.transliteration || song.first_line)}
                originalLyricLines={splitLyricLines(song.lyrics_original)}
              />
            </div>
          ) : null}
        </section>

        <div className="mt-7 grid gap-7 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-7">
            <section className="surface-card p-4 sm:p-6"><StreamExplanation songNumber={song.number} language={language !== "en" ? localeLabel(language) : null} /></section>
            {song.related_songs.length ? <section className="surface-card p-5 sm:p-7"><p className="eyebrow">Continue exploring</p><h2 className="mt-2 font-serif text-3xl text-navy-950">Related songs</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{song.related_songs.map((related) => <Link key={related.number} href={songPagePath(related.number)} className="rounded-2xl border border-navy-900/10 bg-ivory-50 p-4 hover:border-gold-500"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">Song {related.number}</p><h3 className="mt-2 font-serif text-lg font-semibold text-navy-950">{titleCase(related.title)}</h3></Link>)}</div></section> : null}
          </div>

          <aside className="flex min-w-0 flex-col gap-7">
            {audio.length ? <section className="surface-card hidden p-5 sm:p-6 xl:block"><p className="eyebrow">Listen</p><h2 className="mt-2 font-serif text-3xl text-navy-950">Listen to this song</h2><p className="mt-2 text-sm leading-6 text-stone-600">Hear the primary recording while you explore this song with the AI Companion.</p><div className="mt-5"><AudioRendition url={audio[0].url} title={audio[0].title} provider={audio[0].provider} /></div><nav aria-label="Return to song text" className="mt-4 flex flex-wrap gap-2"><a href="#lyrics" className="soft-chip">Lyrics</a>{hasMeaning ? <a href="#meaning" className="soft-chip">Meaning</a> : null}</nav></section> : null}
            {videos.length ? <section id="watch" className="surface-card scroll-mt-28 overflow-hidden"><div className="p-5 sm:p-6"><p className="eyebrow">Watch</p><h2 className="mt-2 font-serif text-3xl text-navy-950">Watch this song</h2></div><iframe className="aspect-video w-full" src={videos[0].embed_url || undefined} title={videos[0].title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />{videos.length > 1 ? <details className="border-t border-navy-900/10 p-5"><summary className="cursor-pointer text-sm font-semibold text-gold-700">More performances ({videos.length - 1})</summary><div className="mt-4 space-y-5">{videos.slice(1).map((item) => <iframe key={item.url} className="aspect-video w-full rounded-xl" src={item.embed_url || undefined} title={item.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />)}</div></details> : null}</section> : null}
            {details.length ? <section className="rounded-2xl bg-navy-950 p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-300">Song details</p><div className="mt-4 grid grid-cols-2 gap-3">{details.map(([label, value]) => <Detail key={label} label={label} value={value} />)}</div></section> : null}
            <SongStoriesPanel songNumber={song.number} />
          </aside>
        </div>
      </div>
      <SongMobileNav hasAudio={audio.length > 0} hasLyrics={hasLyrics} hasMeaning={hasMeaning} />
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
