import { parseVideoUrl } from "./rules"
import type { VideoLink, VideoProvider } from "./types"

/**
 * Watching a link inside the app (docs/kiirtan-video.md). Only the site's OWN embed is ever used (YouTube's IFrame player,
 * Vimeo's player, the Internet Archive's embed): nothing is downloaded, nothing is extracted from the page, and the
 * video never plays in the background (the sites' rules, and ours: a video stops when the screen closes).
 *
 * A link the server found `no_embed` (its owner does not let other apps show it) has no embed here: the person gets "Open".
 * A stored address is never trusted: the id is read again with the same parser as the form, and a row that does not
 * parse has no embed.
 */
export type VideoEmbed = { provider: VideoProvider; id: string; src: string }

/** The player address of a stored video link, or null when it is not to be shown inside the app. */
export function videoEmbed(video: Pick<VideoLink, "provider" | "url" | "linkStatus">): VideoEmbed | null {
  if (video.linkStatus === "no_embed") return null
  const parsed = parseVideoUrl(video.url)
  if (!parsed.ok || parsed.url !== video.url || parsed.provider !== video.provider) return null
  switch (parsed.provider) {
    case "youtube":
      return { provider: "youtube", id: parsed.id, src: `https://www.youtube.com/embed/${parsed.id}?playsinline=1&rel=0&modestbranding=1` }
    case "vimeo": {
      const hash = /^https:\/\/vimeo\.com\/\d+\/([0-9a-f]+)$/.exec(parsed.url)?.[1]
      return { provider: "vimeo", id: parsed.id, src: `https://player.vimeo.com/video/${parsed.id}?dnt=1&playsinline=1${hash ? `&h=${hash}` : ""}` }
    }
    case "archive":
      return { provider: "archive", id: parsed.id, src: `https://archive.org/embed/${encodeURIComponent(parsed.id)}` }
  }
}

type Rule = { hosts: readonly string[]; paths: readonly string[] }

/**
 * Where a player may take the view, per provider. The address is PARSED (never matched as text, which `evil-googlevideo.com`,
 * `youtube.com.evil.com` and `https://youtube.com@evil.com/` all get past): https only, no user name or password, and the host
 * is compared whole (`host === d`, or `host` ends with `.d` for the media domains that have many subdomains).
 *  - `top`: the main frame of the web view. Only the site's own embed page; no media hosts, no CDN, never a watch page.
 *  - `frames`: frames inside the embed page (the player's own iframes). The player's media and script hosts, and the
 *    site's own embed pages.
 * `exact` hosts are compared whole; `suffix` domains also match their subdomains.
 */
const ALLOWED: Record<VideoProvider, { top: Rule; frames: Rule & { suffix: readonly string[] } }> = {
  youtube: {
    top: { hosts: ["youtube.com", "www.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"], paths: ["/embed/"] },
    frames: {
      hosts: ["youtube.com", "www.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com", "www.google.com"],
      paths: ["/embed/", "/recaptcha/"],
      suffix: ["googlevideo.com", "ytimg.com", "gstatic.com"],
    },
  },
  vimeo: {
    top: { hosts: ["player.vimeo.com"], paths: ["/video/"] },
    frames: { hosts: ["player.vimeo.com"], paths: ["/"], suffix: ["vimeocdn.com", "akamaized.net"] },
  },
  archive: {
    top: { hosts: ["archive.org", "www.archive.org"], paths: ["/embed/", "/stream/"] },
    frames: { hosts: ["archive.org", "www.archive.org"], paths: ["/embed/", "/stream/"], suffix: ["us.archive.org"] },
  },
}

const underSuffix = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`)

/**
 * True when the embed page may load this address. `isTopFrame` is the web view's own flag for the request: the main frame
 * (default, the stricter side) or a frame inside the page. In the main frame only the site's own embed and `about:blank` pass;
 * `data:` and `blob:` (and `about:srcdoc`) are for frames inside the page only.
 */
export function embedMayLoad(provider: VideoProvider, url: string, isTopFrame = true): boolean {
  if (!url || url === "about:blank") return true
  if (url === "about:srcdoc" || /^(?:data|blob):/i.test(url)) return !isTopFrame
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) return false
  if (parsed.port && parsed.port !== "443") return false
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "")
  const rule = ALLOWED[provider]
  if (isTopFrame) return rule.top.hosts.includes(host) && rule.top.paths.some((path) => parsed.pathname.startsWith(path))
  if (rule.frames.hosts.includes(host) && rule.frames.paths.some((path) => parsed.pathname.startsWith(path))) return true
  return rule.frames.suffix.some((domain) => underSuffix(host, domain))
}

/** What a row can do: watch inside the app, or only open on the site. */
export type VideoWatch = "in-app" | "open"

export function watchHow(video: Pick<VideoLink, "provider" | "url" | "linkStatus">): VideoWatch {
  return videoEmbed(video) ? "in-app" : "open"
}

/**
 * The audio policy, in two pure rules (the screen wires them to the player store):
 *  1. starting a video pauses the recording's audio (the queue and the radio are not touched and nothing resumes by itself);
 *  2. if the audio starts while a video is open, the video closes (never two sounds at once).
 */
export function audioStartedUnderVideo(before: { isPlaying: boolean }, after: { isPlaying: boolean }, videoOpen: boolean): boolean {
  return videoOpen && !before.isPlaying && after.isPlaying
}

/**
 * The address the player loads. The person tapped "Watch here", so it starts at once (YouTube and Vimeo take `autoplay`;
 * the Internet Archive player has no such switch and waits for its own Play).
 */
export function playerSrc(embed: VideoEmbed): string {
  return embed.provider === "archive" ? embed.src : `${embed.src}&autoplay=1`
}

/**
 * The video the recording page shows first (the "video + chord line" block): the first link that plays inside the app and is not
 * known to be gone, else the first one that is not gone (it opens on its site), else none. A link the team or the checker
 * marked unavailable is never the headline of a page, but it stays in the list.
 */
export function featuredVideo<T extends Pick<VideoLink, "provider" | "url" | "linkStatus">>(items: readonly T[]): T | null {
  const alive = items.filter((v) => v.linkStatus !== "unavailable")
  return alive.find((v) => videoEmbed(v)) ?? alive[0] ?? null
}
