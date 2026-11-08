import type { Metadata } from "next"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"

import { SiteHeader } from "@/components/site-header"
import { authorCardPath, cardVersion } from "@/lib/author-card"
import {
  authorDescription,
  authorJsonLd,
  authorPath,
  authorPhotoUrl,
  authorRobots,
  authorTitle,
  authorUrl,
  fetchAuthorPage,
  formatCount,
  formatDuration,
  jsonLdString,
  kindLabel,
  kindLabelPlural,
  languageName,
  safeHttpsUrl,
  type AuthorPageData,
  type AuthorRecording,
} from "@/lib/authors"

/**
 * A public author page (docs/author-profiles.md, "Search engines").
 *
 * Design, in the site's own language: navy-950 ground for the name set in Cormorant, ivory for the songbook below it,
 * one gold hairline as the only ornament, recordings as numbered songbook lines. One staggered rise on load
 * (`author-rise`, skipped for reduced motion). Server-rendered: every word search engines index is in the HTML.
 *
 * Search rules: robots follow `indexable` from the API (published, not suspended, not waiting for the team, at least
 * one published recording); a page that moved answers a permanent redirect; one that is gone or never was answers 404.
 */

export const revalidate = 60

type Params = { params: Promise<{ slug: string }> }

async function load(slug: string): Promise<Exclude<AuthorPageData, { kind: "moved" }>> {
  const data = await fetchAuthorPage(slug)
  if (data.kind === "moved") return permanentRedirect(authorPath(data.slug))
  return data
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const data = await fetchAuthorPage(slug)
  if (data.kind !== "profile") {
    return { title: `Author page | Prabhat Samgiita`, robots: authorRobots(false) }
  }
  const { profile } = data
  const title = authorTitle(profile)
  const description = authorDescription(profile)
  const url = authorUrl(profile.slug)
  // the share picture (lib/author-card.ts): always drawn, with the author's photo or a round placeholder, 1.91:1
  const card = `${authorCardPath(profile.id, "link", cardVersion(profile.updated_at))}`
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: authorRobots(profile.indexable),
    openGraph: {
      type: "profile",
      title,
      description,
      url,
      siteName: "Prabhat Samgiita AI",
      images: [{ url: card, width: 1200, height: 630, alt: profile.display_name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [card],
    },
  }
}

function Stats({ profile }: { profile: Extract<AuthorPageData, { kind: "profile" }>["profile"] }) {
  const stats = profile.stats
  if (!stats) return null
  if (!stats.enough_data) {
    return (
      <p className="max-w-md text-sm leading-6 text-white/70">
        Not enough listening yet to show numbers
        {stats.counting_since ? `. Counting since ${new Date(stats.counting_since).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}.` : "."}
      </p>
    )
  }
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-3">
      <div>
        <dt className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-gold-300">Monthly listeners</dt>
        <dd className="mt-1 font-serif text-4xl text-white">{formatCount(stats.monthly_listeners ?? 0)}</dd>
      </div>
      <div>
        <dt className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-gold-300">Plays</dt>
        <dd className="mt-1 font-serif text-4xl text-white">{formatCount(stats.total_plays ?? 0)}</dd>
      </div>
    </dl>
  )
}

function RecordingLine({ recording, index }: { recording: AuthorRecording; index: number }) {
  const audio = safeHttpsUrl(recording.audio_url)
  return (
    <li
      id={`recording-${recording.id}`}
      className="author-rise grid grid-cols-[2.5rem_1fr] gap-x-3 border-t border-gold-500/30 py-4 sm:grid-cols-[3rem_1fr_auto]"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <span className="font-serif text-2xl leading-none text-gold-600" aria-hidden="true">{index + 1}</span>
      <div className="min-w-0">
        <h3 className="font-serif text-xl leading-snug text-navy-950">{recording.title}</h3>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-navy-700">
          {kindLabel(recording.kind)}
          {recording.language ? ` · ${languageName(recording.language)}` : ""}
          {recording.year ? ` · ${recording.year}` : ""}
          {formatDuration(recording.duration_sec) ? ` · ${formatDuration(recording.duration_sec)}` : ""}
        </p>
        {audio ? <audio controls preload="none" src={audio} className="mt-3 h-10 w-full max-w-md" aria-label={`Listen: ${recording.title}`} /> : null}
      </div>
    </li>
  )
}

export default async function AuthorPage({ params }: Params) {
  const { slug } = await params
  const data = await load(slug)
  if (data.kind === "gone" || data.kind === "missing") notFound()
  if (data.kind === "error") {
    return (
      <main className="min-h-screen bg-ivory-50">
        <SiteHeader active="Explore" />
        <section className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="font-serif text-4xl text-navy-950">This page could not be opened</h1>
          <p className="mt-4 leading-7 text-stone-700">Something went wrong on our side. Please try again in a moment.</p>
          <Link href="/authors" className="gold-button mt-8 px-6 py-3">All authors</Link>
        </section>
      </main>
    )
  }

  const { profile, recordings, collections } = data
  const place = [profile.city, profile.country].filter(Boolean).join(", ")
  const links = profile.links.map((l) => ({ ...l, url: safeHttpsUrl(l.url) })).filter((l): l is typeof l & { url: string } => Boolean(l.url))
  const kinds = profile.kinds.filter((k) => k.count > 0)
  const grouped = kinds
    .map((k) => ({ kind: k.kind, items: recordings.filter((r) => r.kind === k.kind) }))
    .filter((g) => g.items.length > 0)
  let counter = 0

  return (
    <main className="min-h-screen bg-ivory-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(authorJsonLd(profile, recordings)) }} />
      <SiteHeader active="Explore" />

      <section className="relative overflow-hidden bg-navy-950 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(202,138,39,0.28),transparent_45%),radial-gradient(circle_at_0%_100%,rgba(82,97,166,0.35),transparent_40%)]" />
        <div className="relative mx-auto grid max-w-[90rem] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_auto] lg:px-10">
          <div className="min-w-0">
            <p className="eyebrow !text-gold-300">
              {profile.author_type === "group" ? "Group" : "Singer"}
              {profile.verified ? " · Verified" : ""}
            </p>
            <h1 className="mt-4 break-words font-serif text-6xl font-bold leading-[0.95] sm:text-8xl">{profile.display_name}</h1>
            <div className="mt-6 h-px w-24 bg-gold-400" />
            {profile.bio ? <p className="mt-6 max-w-2xl text-lg leading-8 text-white/85">{profile.bio}</p> : null}
            <p className="mt-4 text-sm font-semibold text-white/70">
              {[place, `${profile.recordings_count} ${profile.recordings_count === 1 ? "recording" : "recordings"}`].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-8"><Stats profile={profile} /></div>
            {profile.stats?.enough_data ? <p className="mt-3 text-xs text-white/55">Numbers count listening in the Prabhat Samgiita app.</p> : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={`prabhatai:///author/${encodeURIComponent(profile.slug)}`} className="gold-button px-6 py-3">Open in the app</a>
              <Link href="/authors" className="inline-flex items-center rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">All authors</Link>
            </div>
          </div>
          {authorPhotoUrl(profile.photo_url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={authorPhotoUrl(profile.photo_url) as string} alt={profile.display_name} width={288} height={288} className="h-48 w-48 rounded-full object-cover ring-2 ring-gold-400/70 lg:h-72 lg:w-72" />
          ) : null}
        </div>
      </section>

      <div className="mx-auto grid max-w-[90rem] gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-10">
        <div className="min-w-0">
          {grouped.length === 0 ? (
            <p className="text-stone-700">No recordings on this page yet.</p>
          ) : (
            <>
              {grouped.length > 1 ? (
                <nav aria-label="Kinds of recordings" className="mb-8 flex flex-wrap gap-2">
                  {grouped.map((g) => (
                    <a key={g.kind} href={`#kind-${g.kind}`} className="soft-chip">
                      {kindLabelPlural(g.kind)} <span className="text-gold-700">{kinds.find((k) => k.kind === g.kind)?.count}</span>
                    </a>
                  ))}
                </nav>
              ) : null}
              {grouped.map((g) => (
                <section key={g.kind} id={`kind-${g.kind}`} className="mb-12 scroll-mt-28">
                  <h2 className="font-serif text-3xl font-bold text-navy-950">{kindLabelPlural(g.kind)}</h2>
                  <ol className="mt-4">
                    {g.items.map((r) => (
                      <RecordingLine key={r.id} recording={r} index={counter++} />
                    ))}
                  </ol>
                </section>
              ))}
              {profile.recordings_count > recordings.length ? (
                <p className="text-sm text-stone-600">
                  Showing {recordings.length} of {profile.recordings_count} recordings. The rest are in the app.
                </p>
              ) : null}
            </>
          )}

          {collections.length > 0 ? (
            <section className="mt-6" aria-labelledby="playlists">
              <h2 id="playlists" className="font-serif text-3xl font-bold text-navy-950">Playlists from events</h2>
              <ul className="mt-4">
                {collections.map((c) => (
                  <li key={c.id} className="border-t border-gold-500/30 py-4">
                    <h3 className="font-serif text-xl text-navy-950">{c.title}</h3>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-navy-700">
                      {[c.place, c.starts_on, `${c.tracks_count} ${c.tracks_count === 1 ? "track" : "tracks"}`].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-8">
          {profile.about ? (
            <section aria-labelledby="about">
              <h2 id="about" className="eyebrow">About</h2>
              <div className="mt-3 space-y-4 leading-7 text-navy-900">
                {profile.about.split(/\n{2,}/).map((p, i) => (
                  <p key={i} className="whitespace-pre-line">{p}</p>
                ))}
              </div>
            </section>
          ) : null}
          {profile.languages.length > 0 ? (
            <section>
              <h2 className="eyebrow">Languages</h2>
              <p className="mt-3 text-navy-900">{profile.languages.map(languageName).join(", ")}</p>
            </section>
          ) : null}
          {links.length > 0 ? (
            <section>
              <h2 className="eyebrow">Links</h2>
              <ul className="mt-3 space-y-2">
                {links.map((l) => (
                  <li key={`${l.kind}-${l.url}`}>
                    <a href={l.url} target="_blank" rel="nofollow ugc noopener noreferrer" className="font-semibold text-navy-950 underline decoration-gold-500 decoration-2 underline-offset-4 hover:text-gold-700">
                      {l.kind === "website" ? new URL(l.url).hostname : l.kind.replace("_", " ").replace(/^./, (c) => c.toUpperCase())}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-stone-600">Links are added by the author. We do not check the sites they lead to.</p>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  )
}
