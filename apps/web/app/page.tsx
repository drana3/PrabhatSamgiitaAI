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

            <article id="about" className="glass-card flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="eyebrow">About Prabhat Samgiita</p>
                <h2 className="mt-3 font-serif text-3xl leading-tight text-navy-950">Songs composed for a new human dawn</h2>
                <p className="mt-3 text-sm leading-7 text-stone-700">
                  Shrii Shrii Anandamurti composed Prabhat Samgiita between 14 September 1982 and 20 October 1990. Its 5,018 songs bring together devotion, mysticism, humanism, nature, and the hope of collective welfare.
                </p>
                <Link href="/explore" className="mt-4 inline-flex text-sm font-semibold text-gold-700">Explore the collection →</Link>
              </div>
              <Image
                src="/brand/shrii-shrii-anandamurti.jpg"
                alt="Shrii Shrii Anandamurti"
                width={240}
                height={174}
                className="h-36 w-full rounded-2xl object-cover object-left sm:w-44"
              />
            </article>
          </div>
          <MiniPlayer />
        </div>
      </section>

      <LandingData initialSongs={seedSongs.slice(0, 9)} initialInventory={seedInventory.slice(0, 4)} />
    </main>
  )
}
