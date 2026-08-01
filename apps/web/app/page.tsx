import Image from "next/image"
import Link from "next/link"

import { HeroSearch } from "@/components/hero-search"
import { LandingData } from "@/components/landing-data"
import { MiniPlayer } from "@/components/mini-player"
import { SiteHeader } from "@/components/site-header"
import seedInventory from "../../../data/seed/inventory.json"
import seedSongs from "../../../data/seed/songs.json"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader />

      <section className="hero-scene">
        <div className="hero-wash" />
        <div className="relative mx-auto flex min-h-[37rem] max-w-[90rem] items-center px-4 py-12 sm:px-6 lg:min-h-[42rem] lg:px-10">
          <div className="w-full max-w-[44rem] lg:ml-[38%] lg:max-w-[39rem]">
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
              <Link href="/songs/1" className="text-sm font-semibold text-navy-900 underline decoration-gold-500 underline-offset-4">Start with Song 1</Link>
            </div>
          </div>
        </div>

        <div className="relative mx-auto -mt-8 max-w-[90rem] px-4 pb-5 sm:px-6 lg:px-10">
          <div className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
            <article id="today" className="glass-card text-center">
              <p className="eyebrow">Today&apos;s reflection</p>
              <blockquote className="mt-4 font-serif text-lg italic leading-8 text-navy-950">
                “Let there be peace, let there be love, let there be bliss.”
              </blockquote>
              <p className="mt-2 text-xs text-stone-600">Shrii Shrii Anandamurti</p>
              <div className="mx-auto mt-4 h-px w-24 bg-gold-400" />
            </article>

            <article id="about" className="glass-card scroll-mt-28 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="eyebrow">About Prabhat Samgiita</p>
                <h2 className="mt-3 font-serif text-3xl leading-tight text-navy-950">Songs composed for a new human dawn</h2>
                <p className="mt-3 text-sm leading-7 text-stone-700">
                  Shrii Shrii Anandamurti composed Prabhat Samgiita between 14 September 1982 and 20 October 1990. Its 5,018 songs bring together devotion, mysticism, humanism, nature, and the hope of collective welfare.
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
                    alt="Shrii Shrii Anandamurti"
                    width={192}
                    height={262}
                    className="aspect-[192/262] w-full rounded-[1rem] object-cover object-top"
                  />
                </div>
                <figcaption className="mt-2 text-center text-xs leading-5 text-stone-700">
                  <span className="block font-semibold text-navy-950">Shrii Shrii Anandamurti</span>
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
