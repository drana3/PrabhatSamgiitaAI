import { runtimeEnv } from "@/lib/runtime-env"

/**
 * Honest HTTP status for public author pages (docs/author-profiles.md, "Search engines").
 *
 * The site's root `loading.tsx` makes every page stream, and a streamed page has already sent "200" by the time it
 * finds out that an author moved or is gone. Search engines need the real codes (308, 404, 410), so the middleware asks
 * the API first, cheaply, and answers those three cases itself. Anything else, including an API that cannot be reached,
 * is left to the page, which renders its own error state.
 */

export type AuthorStatusDecision =
  | { kind: "pass" }
  | { kind: "redirect"; slug: string }
  | { kind: "status"; status: 404 | 410 }

const AUTHOR_PATH = /^\/author\/([^/]+)\/?$/

export function authorSlugFromPath(pathname: string): string | null {
  const match = AUTHOR_PATH.exec(pathname)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

export function decideAuthorStatus(status: number, body: { slug?: unknown } | null): AuthorStatusDecision {
  if (status === 404) return { kind: "status", status: 404 }
  if (status === 410) return { kind: "status", status: 410 }
  if ((status === 301 || status === 308) && typeof body?.slug === "string" && body.slug) {
    return { kind: "redirect", slug: body.slug }
  }
  return { kind: "pass" }
}

export async function probeAuthorStatus(slug: string, fetcher: typeof fetch = fetch): Promise<AuthorStatusDecision> {
  const base = (runtimeEnv("API_BASE_URL") ?? runtimeEnv("NEXT_PUBLIC_API_BASE_URL") ?? "http://localhost:8000").replace(/\/+$/, "")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)
  try {
    const response = await fetcher(`${base}/api/v1/authors/${encodeURIComponent(slug)}`, {
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    })
    let body: { slug?: unknown } | null = null
    if (response.status === 301 || response.status === 308) {
      try {
        body = (await response.json()) as { slug?: unknown }
      } catch {
        body = null
      }
    }
    return decideAuthorStatus(response.status, body)
  } catch {
    return { kind: "pass" }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The answer for a page that is gone (410) or never was (404): a real status code with a small page and `noindex`.
 * Written here, not by rewriting to the page, because a rewrite cannot carry its own status reliably.
 */
export function authorGoneResponse(status: 404 | 410): Response {
  const title = status === 410 ? "This author page was removed" : "This author page was not found"
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} | Prabhat Samgiita</title></head><body style="margin:0;display:grid;min-height:100vh;place-items:center;background:#0b1b34;color:#fff;font-family:Georgia,serif;text-align:center;padding:24px"><main><h1 style="font-weight:400;font-size:2rem;margin:0 0 16px">${title}</h1><p style="margin:0 0 24px;opacity:.75">Authors share their kiirtans and bhajans here.</p><a href="/authors" style="color:#e2c066">See all authors</a></main></body></html>`
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "public, max-age=60" },
  })
}
