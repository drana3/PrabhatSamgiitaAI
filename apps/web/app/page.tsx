import Image from "next/image"
import Link from "next/link"

import { HeroSearch } from "@/components/hero-search"
import { LandingData } from "@/components/landing-data"
import { MiniPlayer } from "@/components/mini-player"
import { RecommendationSection } from "@/components/recommendation-section"
import { SiteHeader } from "@/components/site-header"
import seedInventory from "../../../data/seed/inventory.json"
import seedSongs from "../../../data/seed/songs.json"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader />

      <section className="hero-scene">
        <div className="hero-wash" />
        <div className="relative mx-auto grid min-h-[37rem] max-w-[90rem] items-center gap-9 px-4 py-12 sm:px-6 lg:min-h-[42rem] lg:grid-cols-[0.92fr_1.08fr] lg:gap-12 lg:px-10 xl:gap-16">
          <figure className="order-2 mx-auto w-full max-w-[32rem] lg:order-1 lg:mx-0 lg:justify-self-end">
            <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-navy-950 p-2 shadow-[0_28px_70px_rgba(42,31,15,0.24)]">
              <Image
                src="/brand/shrii-shrii-anandamurti-quote.png"
                alt="Shrii Shrii Anandamurti ji"
                width={1536}
                height={1024}
                priority
                className="h-auto w-full rounded-[1.55rem] object-cover"
              />
            </div>
          </figure>

          <div className="order-1 w-full max-w-[42rem] lg:order-2 lg:justify-self-start lg:pl-4 xl:pl-8">
            <p className="eyebrow">Prabhat Samgiita AI</p>
            <h1 className="mt-4 font-serif text-[3.4rem] leading-[0.9] tracking-[-0.035em] text-navy-950 sm:text-7xl lg:text-[5.4rem]">
              Music for
              <br />
              the inner dawn
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-navy-900/80 sm:text-lg">
              Discover 5,018 songs of devotion, hope, nature, and universal love. Listen, understand, practise, and ask in your own language.
            </p>
            <div className="mt-7 max-w-xl">
              <HeroSearch />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="/explore" className="outline-button">Explore 5,018 songs <span aria-hidden="true">♪</span></Link>
              <Link href="/songs/1#ask" className="text-sm font-semibold text-navy-900 underline decoration-gold-500 underline-offset-4">Start with Song 1</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#fffaf0_0%,#fffdf8_68%,#f7efe3_100%)]">
        <section id="today" aria-labelledby="today-recommendations-title" className="relative mx-auto max-w-[90rem] scroll-mt-28 px-4 pb-8 sm:px-6 lg:px-10">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-3xl">
              <p className="eyebrow">Today&apos;s Prabhat Samgiita</p>
              <h2 id="today-recommendations-title" className="mt-3 font-serif text-4xl leading-tight text-navy-950 sm:text-5xl lg:text-6xl">
                Music for this moment
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-stone-700">
                Songs selected for today&apos;s Ananda Marga observance, important world days, and carefully reviewed humanitarian context. Listen now, understand the meaning, or learn the song.
              </p>
            </div>
            <Link href="/explore" className="outline-button">Explore your own moment →</Link>
          </div>
          <RecommendationSection />
        </section>

        <div className="relative mx-auto -mt-8 max-w-[90rem] px-4 pb-5 sm:px-6 lg:px-10">
          <div className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
            <article className="glass-card text-center">
              <p className="eyebrow">Today&apos;s reflection</p>
              <blockquote className="mt-4 font-serif text-lg italic leading-8 text-navy-950">
                “Let there be peace, let there be love, let there be bliss.”
              </blockquote>
              <p className="mt-2 text-xs text-stone-600">Shrii Shrii Anandamurti ji</p>
              <div className="mx-auto mt-4 h-px w-24 bg-gold-400" />
            </article>

            <article id="about" className="glass-card scroll-mt-24 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="eyebrow">About Prabhat Samgiita</p>
                <h2 className="mt-3 font-serif text-3xl leading-tight text-navy-950">Songs composed for a new human dawn</h2>
                <p className="mt-3 text-sm leading-7 text-stone-700">
                  Shrii Shrii Anandamurti ji composed Prabhat Samgiita between 14 September 1982 and 20 October 1990. Its 5,018 songs bring together devotion, mysticism, humanism, nature, and the hope of collective welfare.
                </p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-navy-800/75" aria-label="Ways to explore Prabhat Samgiita">
                  <span>Listen</span>
                  <span>Understand</span>
                  <span>Practise</span>
                </div>
                <Link href="/explore" className="mt-4 inline-flex text-sm font-semibold text-gold-700">Explore the collection →</Link>
              </div>
              <figure className="mx-auto w-full max-w-44 sm:w-40">
                <div className="overflow-hidden rounded-[1.35rem] border border-gold-500/25 bg-gold-50 p-1.5 shadow-[0_12px_30px_rgba(45,35,24,0.13)]">
                  <Image
                    src="/brand/shrii-shrii-anandamurti-portrait.jpeg"
                    alt="Shrii Shrii Anandamurti ji"
                    width={192}
                    height={262}
                    className="aspect-[192/262] w-full rounded-[1rem] object-cover object-top"
                  />
                </div>
                <figcaption className="mt-2 text-center text-xs leading-5 text-stone-700">
                  <span className="block font-semibold text-navy-950">Shrii Shrii Anandamurti ji</span>
                  Composer of Prabhat Samgiita
                </figcaption>
              </figure>
            </article>
          </div>
          <MiniPlayer />
        </div>
      </section>

      <LandingData initialSongs={seedSongs.slice(0, 9)} initialInventory={seedInventory.slice(0, 4)} />
    </main>
  )
}
