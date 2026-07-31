import Link from "next/link"

import { LandingData } from "@/components/landing-data"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-aurora">
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-glow backdrop-blur md:p-10">
            <p className="text-xs uppercase tracking-[0.4em] text-ember-700">Prabhat Samgiita AI</p>
            <h1 className="mt-4 font-serif text-5xl leading-none text-ink-900 md:text-7xl">
              Search the dawn songs with grounded, verified context.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-ink-700 md:text-lg">
              Find lyrics by number or first line, explore canonical translations, and listen to verified audio
              or embedded video without the app inventing any of the source content.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#catalog" className="rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-white">
                Browse catalog
              </Link>
              <Link href="#inventory" className="rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-900">
                View inventory
              </Link>
            </div>
          </div>
          <div className="rounded-[2rem] border border-ink-200 bg-ink-900 p-6 text-white shadow-glow md:p-10">
            <p className="text-xs uppercase tracking-[0.4em] text-ember-300">Why this design works</p>
            <ul className="mt-6 space-y-4 text-sm leading-6 text-ink-100">
              <li>Responsive cards and simple navigation for phones and desktops.</li>
              <li>Streaming explanation endpoint for progressive AI responses.</li>
              <li>Separation of verified canonical content from community media.</li>
              <li>Fallback recommendations even with no model key configured.</li>
            </ul>
          </div>
        </div>
        <LandingData />
      </section>
    </main>
  )
}
