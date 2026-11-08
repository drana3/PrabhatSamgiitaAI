/**
 * THE mini-player policy: for every screen, is the mini-player shown, where does it sit, and does the screen
 * carry the floating tab bar (with its Upload button): on the four tabs and Search the screen draws it, on the browse
 * pages below it the root mini-player host draws it (components/nav-v2/MiniPlayerHost.tsx, DeepTabBar). One table, read by lib/navV2.ts (miniPlayerVisible,
 * NAV_V2_MINI_HIDDEN_PREFIXES) and written out for people in docs/player-visibility.md; __tests__/playerPolicy.test.ts
 * checks the code against this table AND the table against the document, so the three cannot drift apart.
 *
 * Pure, no React. Paths are matched by segment-aware prefix, the longest match wins, and a screen that is in no row
 * gets the default (DEFAULT_ROW): the pill shows above the bottom edge. Nothing loaded in the player: no pill anywhere.
 *
 * The rule behind the table (Dada): the mini-player belongs to screens that BROWSE (they stay useful while a song
 * plays and the pill is the way back to it). It stays away from screens that own the bottom of the display, a keyboard,
 * a form's send button, or a task the person must finish (sign in, upload, settings, the rules they agree to). Where
 * the pill IS shown, the screen scrolls far enough that the last line clears it (useScrollBottomInset).
 */

/** "above-tab-bar": over the floating tab pill. "above-bottom": over the bottom edge. "hidden": not shown. */
export type MiniMode = "above-tab-bar" | "above-bottom" | "hidden"

export type PolicyGroup = "tab" | "browse" | "player" | "account" | "form" | "reading" | "assistant" | "settings"

export type PolicyRow = {
  id: string
  /** English name of the screen group, as the document shows it */
  title: string
  group: PolicyGroup
  /** route prefixes (segment aware); the first is the one shown in the document */
  prefixes: readonly string[]
  /** a real route of the group, used by the tests */
  sample: string
  mini: MiniMode
  /** the floating tab bar and its Upload button are on screen */
  tabBar: boolean
  /** one line: why */
  why: string
}

export const PLAYER_POLICY: readonly PolicyRow[] = [
  // ---- shown above the tab bar: the four tabs and Search
  { id: "today", title: "Today", group: "tab", prefixes: ["/v2/today"], sample: "/v2/today", mini: "above-tab-bar", tabBar: true, why: "A home tab: the pill sits over the tab bar so the song stays one tap away." },
  { id: "songs", title: "Songs", group: "tab", prefixes: ["/v2/songs"], sample: "/v2/songs", mini: "above-tab-bar", tabBar: true, why: "A browsing tab." },
  { id: "kiirtan", title: "Kiirtan", group: "tab", prefixes: ["/v2/kiirtan"], sample: "/v2/kiirtan", mini: "above-tab-bar", tabBar: true, why: "A browsing tab." },
  { id: "learn", title: "Learn", group: "tab", prefixes: ["/v2/learn"], sample: "/v2/learn", mini: "above-tab-bar", tabBar: true, why: "A browsing tab." },
  { id: "search", title: "Search", group: "tab", prefixes: ["/search-v2"], sample: "/search-v2", mini: "above-tab-bar", tabBar: true, why: "A tab-like page: the bar stays under it, and results are played from it." },

  // ---- shown above the bottom edge: pushed pages with no tab bar
  { id: "song-page", title: "Song page", group: "browse", prefixes: ["/song-v2", "/song"], sample: "/song-v2/ps-1", mini: "above-tab-bar", tabBar: true, why: "The page is about a song; the bar under it takes the person to any tab in one tap, and the pill above it shows what is playing." },
  { id: "lists", title: "Songs lists and collections", group: "browse", prefixes: ["/songs-v2-collection", "/songs-v2-index", "/songs-v2", "/collections-v2", "/collections", "/browse-shelf"], sample: "/collections-v2", mini: "above-tab-bar", tabBar: true, why: "Browsing: the person plays one song after another, and the bar is the way back to any tab." },
  { id: "library", title: "Library, saved and playlists", group: "browse", prefixes: ["/library-v2", "/saved-v2", "/playlist-v2", "/playlist", "/listening-history", "/top-played"], sample: "/library-v2", mini: "above-tab-bar", tabBar: true, why: "Browsing the person's own songs; the bar is the way back to any tab." },
  { id: "kiirtan-pages", title: "Kiirtan pages (list, artist, mix, event playlists, a recording)", group: "browse", prefixes: ["/kiirtan", "/kirtan-artist", "/kirtan-mix", "/recording-set", "/my-sets", "/recording"], sample: "/kirtan-artist", mini: "above-tab-bar", tabBar: true, why: "Browsing recordings; a recording's page (chords, videos, comments) scrolls clear of the pill and the bar, and the bar hides while a keyboard is up." },
  { id: "learn-pages", title: "Learn pages (songs, ragas)", group: "browse", prefixes: ["/learn"], sample: "/learn/songs", mini: "above-tab-bar", tabBar: true, why: "Study with the song playing in the background; the bar is the way back to any tab." },
  { id: "learn-focus", title: "Learn full-screen (flashcards, add a word, quiz, stories, harmonium)", group: "browse", prefixes: ["/learn/words", "/learn/add", "/stories", "/story-sheet", "/quiz", "/harmonium-v2"], sample: "/quiz", mini: "above-bottom", tabBar: false, why: "A full-screen task, card review or story: the screen owns the bottom, so no tab bar; the pill stays above the edge." },
  { id: "festivals", title: "Festivals", group: "browse", prefixes: ["/festivals", "/festival"], sample: "/festivals", mini: "above-tab-bar", tabBar: true, why: "Browsing; songs of the festival can be played, and the bar is the way back to any tab." },
  { id: "notifications", title: "Notifications", group: "browse", prefixes: ["/notifications"], sample: "/notifications", mini: "above-tab-bar", tabBar: true, why: "A list; the bar is the way back to any tab." },
  { id: "author-pages", title: "Author pages (directory, a public page, your own page)", group: "browse", prefixes: ["/author", "/authors", "/my-author"], sample: "/author/priya-devi", mini: "above-tab-bar", tabBar: true, why: "Browsing recordings: a page to play from; the bar is the way back to any tab and the pill to what plays." },

  // ---- hidden: the screen opens over it
  { id: "player", title: "Full player", group: "player", prefixes: ["/player-v2", "/player"], sample: "/player-v2", mini: "hidden", tabBar: false, why: "The player IS the full version of the pill." },
  { id: "onboarding", title: "Welcome, sign in, finish profile", group: "account", prefixes: ["/welcome", "/auth", "/signin", "/complete-profile"], sample: "/signin", mini: "hidden", tabBar: false, why: "A task with a button at the bottom; nothing is playing yet for a new person." },
  { id: "account-sheets", title: "Edit profile and the profile sheets (language, appearance, script)", group: "account", prefixes: ["/edit-profile", "/profile-sheet", "/script-translations", "/review-style", "/language"], sample: "/edit-profile", mini: "hidden", tabBar: false, why: "Sheets and forms that draw over the whole screen." },
  { id: "settings", title: "Settings (notifications, storage, contact us)", group: "settings", prefixes: ["/notification-settings", "/storage", "/feedback"], sample: "/notification-settings", mini: "hidden", tabBar: false, why: "Switches and action buttons at the bottom; the pill would sit on them." },
  { id: "upload", title: "Upload and Add recording", group: "form", prefixes: ["/upload-chords", "/upload", "/add-kirtan", "/upload-set", "/chords-review", "/team-review", "/recording-chords"], sample: "/add-kirtan", mini: "hidden", tabBar: false, why: "Forms with a keyboard and a send button; the screen opens over the tab bar and its Upload button." },
  { id: "author-forms", title: "Become an author, edit the page, claim recordings", group: "form", prefixes: ["/become-author", "/author-edit", "/author-claims", "/author-find"], sample: "/become-author", mini: "hidden", tabBar: false, why: "Forms with a keyboard and a button at the bottom (Publish, Add to my page); the pill would sit on them." },
  { id: "rules", title: "Content rules", group: "reading", prefixes: ["/content-rules"], sample: "/content-rules", mini: "hidden", tabBar: false, why: "A page to read to the end and agree to; the pill covered its last lines." },
  { id: "live", title: "Kiirtan live", group: "browse", prefixes: ["/kiirtan-live"], sample: "/kiirtan-live", mini: "hidden", tabBar: false, why: "A video is playing: two sounds at once would clash." },
  { id: "assistant", title: "Assistant", group: "assistant", prefixes: ["/assistant"], sample: "/assistant", mini: "hidden", tabBar: false, why: "The message box sits where the pill would." },
]

/** Anything that is in no row: a pushed screen, the pill above the bottom edge. */
export const DEFAULT_ROW: PolicyRow = {
  id: "other",
  title: "Any other pushed screen",
  group: "browse",
  prefixes: [],
  sample: "/about",
  mini: "above-bottom",
  tabBar: false,
  why: "The default: a pushed page shows the pill above the bottom edge, and scrolls clear of it.",
}

function normalise(pathname: string): string {
  const bare = pathname.split(/[?#]/)[0] ?? ""
  const trimmed = bare.length > 1 ? bare.replace(/\/+$/, "") : bare
  return trimmed || "/"
}

function hasPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

/** The row that rules a path (longest prefix wins), or the default. */
export function policyForPath(pathname: string): PolicyRow {
  const path = normalise(pathname)
  let best: { row: PolicyRow; length: number } | null = null
  for (const row of PLAYER_POLICY) {
    for (const prefix of row.prefixes) {
      if (hasPrefix(path, prefix) && (!best || prefix.length > best.length)) best = { row, length: prefix.length }
    }
  }
  return best?.row ?? DEFAULT_ROW
}

/** Where the pill sits on this path ("hidden" included). Does not know whether something is loaded. */
export function miniModeForPath(pathname: string): MiniMode {
  return policyForPath(pathname).mini
}

/** Every route prefix of a hidden row: lib/navV2.ts NAV_V2_MINI_HIDDEN_PREFIXES. */
export const HIDDEN_MINI_PREFIXES: readonly string[] = PLAYER_POLICY.filter((row) => row.mini === "hidden").flatMap((row) => row.prefixes)

/**
 * The pushed browse pages that carry the floating tab bar, drawn by the root host (not by the screen): every row with
 * `tabBar` that is not a tab row. A tab row's own screen (the v2 shell, Search) draws its bar.
 */
export function carriesDeepTabBar(pathname: string): boolean {
  const row = policyForPath(pathname)
  return row.tabBar && row.group !== "tab"
}
