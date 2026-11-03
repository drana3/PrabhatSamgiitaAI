import { amColors, type AmTheme, amDark } from "@/constants/tokens/amColors"
import { projectMomentum } from "@/constants/tokens/amMotion"
import { amNav } from "@/constants/tokens/amNav"

/**
 * Navigation shell v2 (spec 2.1 four tabs, SCR-07, SCR-12).
 * Pure logic only: no React Native imports, so everything here is unit tested.
 *
 * To wire a real screen into a tab, edit the matching entry of NAV_V2_TABS
 * (and replace the placeholder file named in `screen` under app/v2/).
 */

export type NavV2TabId = "today" | "songs" | "player" | "learn"

export type NavV2Tab = {
  id: NavV2TabId
  label: string
  /** icon key, resolved to a glyph by components/nav-v2/FloatingTabBar */
  icon: "today" | "songs" | "player" | "learn"
  /** file name (without extension) under app/v2/ that renders this tab */
  screen: string
  /** route that selects this tab inside the v2 shell */
  href: string
  /** path prefixes (segment aware) whose screens belong to this tab, for the active state */
  owns: readonly string[]
}

/**
 * The single tab-to-route mapping. Order is the order in the pill.
 * `href` points inside the v2 shell (/v2/...) so the pill stays mounted;
 * app/v2/today.tsx re-exports the redesigned Today screen that lives at /today.
 */
export const NAV_V2_TABS: readonly NavV2Tab[] = [
  { id: "today", label: "Today", icon: "today", screen: "today", href: "/v2/today", owns: ["/v2/today", "/today"] },
  {
    id: "songs",
    label: "Songs",
    icon: "songs",
    screen: "songs",
    href: "/v2/songs",
    owns: ["/v2/songs", "/songs", "/collections"],
  },
  { id: "player", label: "Player", icon: "player", screen: "player", href: "/v2/player", owns: ["/v2/player", "/player"] },
  {
    id: "learn",
    label: "Learn",
    icon: "learn",
    screen: "learn",
    href: "/v2/learn",
    owns: ["/v2/learn", "/learn", "/stories", "/quiz"],
  },
]

/** Name of the route that other branches build for the profile sheet (avatar button, top right of Today and Songs). */
export const NAV_V2_PROFILE_SHEET_ROUTE = "/profile-sheet"

/** Routes outside the tabs on which the mini-player is also shown (spec SCR-12: "and the Song page"). */
export const NAV_V2_MINI_EXTRA_PREFIXES: readonly string[] = ["/song"]

function normalisePath(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/)[0] ?? ""
  const trimmed = withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, "") : withoutQuery
  return trimmed || "/"
}

/** Segment aware: "/song" matches "/song/12" but not "/songs". */
export function pathHasPrefix(pathname: string, prefix: string): boolean {
  const path = normalisePath(pathname)
  return path === prefix || path.startsWith(`${prefix}/`)
}

/** Which tab a path belongs to, or null for screens that are in none (search, auth ...). */
export function tabIdForPath(pathname: string, tabs: readonly NavV2Tab[] = NAV_V2_TABS): NavV2TabId | null {
  for (const tab of tabs) {
    if (tab.owns.some((prefix) => pathHasPrefix(pathname, prefix))) return tab.id
  }
  return null
}

export function tabIndexForId(id: NavV2TabId, tabs: readonly NavV2Tab[] = NAV_V2_TABS): number {
  return Math.max(
    0,
    tabs.findIndex((tab) => tab.id === id),
  )
}

/**
 * Mini-player rule (SCR-12): visible on Today, Songs, Learn and the Song page while
 * something is loaded; hidden on the Player tab. Anything else (search, auth ...) hides it.
 */
export function miniPlayerVisible(
  input: { pathname: string; hasSong: boolean },
  tabs: readonly NavV2Tab[] = NAV_V2_TABS,
  extraPrefixes: readonly string[] = NAV_V2_MINI_EXTRA_PREFIXES,
): boolean {
  if (!input.hasSong) return false
  const tab = tabIdForPath(input.pathname, tabs)
  if (tab === "player") return false
  if (tab) return true
  return extraPrefixes.some((prefix) => pathHasPrefix(input.pathname, prefix))
}

/** The tab pill turns dark on the Player tab (SCR-12). */
export type PillVariant = "light" | "dark"
export function pillVariantFor(active: NavV2TabId): PillVariant {
  return active === "player" ? "dark" : "light"
}

/* ---------- gesture maths ---------- */

export function clamp(value: number, min: number, max: number): number {
  "worklet"
  return Math.min(max, Math.max(min, value))
}

/** Width of one tab inside the tray (the pill minus its padding). */
export function tabWidthFor(trayWidth: number, count: number): number {
  return count > 0 ? Math.max(0, trayWidth) / count : 0
}

/** Which tab slot a touch at x (in tray coordinates) lands in. */
export function tabIndexAtX(x: number, tabWidth: number, count: number): number {
  "worklet"
  if (tabWidth <= 0 || count <= 0) return 0
  return clamp(Math.floor(x / tabWidth), 0, count - 1)
}

/**
 * Apple-style rubber band: past the limits the indicator follows the finger
 * with growing resistance instead of stopping hard. `dimension` is the span
 * over which resistance saturates (the tray width).
 */
export function rubberBand(x: number, min: number, max: number, dimension: number, coefficient = 0.55): number {
  "worklet"
  if (dimension <= 0) return clamp(x, min, max)
  if (x < min) return min - rubberOffset(min - x, dimension, coefficient)
  if (x > max) return max + rubberOffset(x - max, dimension, coefficient)
  return x
}

function rubberOffset(distance: number, dimension: number, coefficient: number): number {
  "worklet"
  return (1 - 1 / ((distance * coefficient) / dimension + 1)) * dimension
}

/**
 * Where a drag of the indicator settles. `indicatorX` is the indicator's left
 * edge on release, `velocity` the finger's horizontal speed in px/s. The landing
 * point is the momentum projection of the indicator centre, then the nearest tab.
 */
export function settleTabIndex(input: {
  indicatorX: number
  velocity: number
  tabWidth: number
  count: number
}): number {
  "worklet"
  const { indicatorX, velocity, tabWidth, count } = input
  if (tabWidth <= 0 || count <= 0) return 0
  const centre = indicatorX + tabWidth / 2
  const landing = projectMomentum(centre, velocity)
  return tabIndexAtX(landing, tabWidth, count)
}

/** Left edge of the indicator for a tab index. */
export function indicatorXFor(index: number, tabWidth: number): number {
  "worklet"
  return index * tabWidth
}

/** Finger speed (px/s) above which the release counts as a fling and may overshoot (damping 0.8). */
export const NAV_V2_FLING_VELOCITY = 500

/** Spring family for a release: default (damping 1.0) unless the gesture carried momentum. */
export function releaseSpringKind(velocity: number): "default" | "fling" {
  "worklet"
  return Math.abs(velocity) > NAV_V2_FLING_VELOCITY ? "fling" : "default"
}

/** Vertical layout of the two pills for a given bottom safe-area inset. */
export function navV2Layout(safeBottom: number): {
  tabBottom: number
  miniBottom: number
  /** bottom padding a scrolling screen needs so its last row clears both pills */
  contentInset: number
} {
  const tabBottom = Math.max(safeBottom, amNav.tabBottom)
  const miniBottom = tabBottom + amNav.tabHeight + amNav.gap
  return { tabBottom, miniBottom, contentInset: miniBottom + amNav.miniHeight + amNav.gap }
}

/* ---------- colour helpers (tokens only) ---------- */

/** "#RRGGBB" plus alpha to rgba(); lets the pills derive translucent fills from am tokens. */
export function hexAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export function isDarkTheme(theme: AmTheme): boolean {
  return theme.page === amDark.page
}

export type PillPalette = {
  background: string
  edge: string
  /** label colour of inactive tabs */
  inactive: string
}

/** Fill of the tab pill for a theme and variant. */
export function tabPillPalette(theme: AmTheme, variant: PillVariant): PillPalette {
  if (variant === "dark") {
    return {
      background: hexAlpha(amColors.sage900, amNav.tabDarkAlpha),
      edge: hexAlpha(amColors.white, amNav.darkEdgeAlpha),
      inactive: hexAlpha(amColors.white, amNav.tabDarkInactiveAlpha),
    }
  }
  return { background: theme.glassStrong, edge: theme.glassEdge, inactive: theme.textBody }
}

/** Matte frosted mini-player: white at 38% (Light), forest at 42% (Dark), 24px blur. */
export function miniPillPalette(theme: AmTheme): { background: string; edge: string } {
  if (isDarkTheme(theme)) {
    return {
      background: hexAlpha(theme.forest, amNav.miniAlphaDark),
      edge: hexAlpha(amColors.white, amNav.darkEdgeAlpha),
    }
  }
  return { background: hexAlpha(amColors.white, amNav.miniAlphaLight), edge: theme.glassEdge }
}

/* ---------- mini-player text ---------- */

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export function miniProgress(position: number, duration: number): number {
  if (!(duration > 0)) return 0
  return clamp(position / duration, 0, 1)
}

/** `PS 12 · 1:05 of 4:31`; the total is left out while the duration is unknown. */
export function miniSubtitle(input: { number: number | string; position: number; duration: number }): string {
  const head = `PS ${input.number}`
  if (!(input.duration > 0)) return head
  return `${head} · ${formatClock(input.position)} of ${formatClock(input.duration)}`
}
