/**
 * Website → mobile feature parity map.
 * Source of truth: apps/web routes + components (reviewed against live product).
 * Status:
 *  - ui: screen/component exists in mobile (may still be mock data)
 *  - next: planned wire to same API as website
 *  - auth: needs mobile auth equivalent of Easy Auth / member session
 *  - skip: ops/admin-web-only or unused web legacy
 */
export const featureParity = [
  { web: "Home hero + brand", mobile: "Welcome + Home", status: "ui" },
  { web: "Today recommendations", mobile: "Home · News & context + song picks (festival / humanitarian)", status: "ui", api: "GET /recommendations/today" },
  { web: "Upcoming observances", mobile: "Home · Festivals + /festivals (reviewed 2026 calendar)", status: "ui" },
  { web: "Daily reflection", mobile: "Home · Daily reflection + book source", status: "ui", api: "GET /reflections/today" },
  { web: "About / composer", mobile: "Home · About + /about", status: "ui" },
  { web: "Explore catalog", mobile: "Songs tab (GET /songs) + Search", status: "ui", api: "GET /songs, POST /search" },
  { web: "Semantic + catalog search", mobile: "/search catalog|semantic", status: "ui", api: "POST /search" },
  { web: "Voice search", mobile: "Native STT (dev build) or keyboard dictation → POST /search/voice", status: "ui", api: "POST /search/voice" },
  { web: "68 special collections", mobile: "/collections", status: "ui" },
  { web: "Song detail", mobile: "/song/[songId] live catalog only", status: "ui", api: "GET /songs/{n}" },
  { web: "Lyrics / meaning / translation", mobile: "Song language switcher + localized API", status: "ui", api: "GET /songs/{n}/localized" },
  { web: "Audio listen", mobile: "Mini + full player (expo-av in-app; hydrates audio_url)", status: "ui" },
  { web: "YouTube watch (#watch)", mobile: "In-app YouTube embed WebView (no external redirect)", status: "ui" },
  { web: "Scenic play art", mobile: "ScenicPlayButton on lists / mini player / today", status: "ui" },
  { web: "Related songs", mobile: "Song · Related from API", status: "ui" },
  { web: "Share", mobile: "Song share sheet", status: "ui" },
  { web: "Favorites", mobile: "Saved tab + song heart (live member sync)", status: "ui", api: "POST/DELETE /members/favorites" },
  { web: "AI explain on song", mobile: "AI tab streams /ai/explain", status: "ui", api: "POST /ai/explain" },
  { web: "Chat memory", mobile: "AI tab syncs /members/chat-memory", status: "ui", api: "/members/chat-memory" },
  { web: "Stories index/detail", mobile: "/stories live API only", status: "ui", api: "GET /stories" },
  { web: "Home stories inspiration", mobile: "Home · Stories (live API)", status: "ui" },
  { web: "Community testimonials", mobile: "Home · Community voices (live API)", status: "ui", api: "GET /testimonials" },
  { web: "Feedback widget", mobile: "/feedback live submit", status: "ui", api: "POST /feedback" },
  { web: "Quiz + certificates", mobile: "/quiz live start/submit", status: "ui", api: "/members/quiz/*" },
  { web: "Account profile", mobile: "Profile + session hydrate + delete", status: "ui", api: "GET/DELETE /members/session|/me" },
  { web: "Sign in (AAD Easy Auth)", mobile: "Microsoft / Google / Facebook / email — no preview member", status: "ui" },
  { web: "Admin feedback", mobile: "/admin live triage", status: "ui", api: "/members/admin/feedback" },
  { web: "Admin members", mobile: "/admin · Members live", status: "ui", api: "/members/admin/users" },
  { web: "Notation / practice coach", mobile: "Song · Harmonium practice", status: "ui", api: "GET /songs/{n}/notation" },
  { web: "Header ticker", mobile: "Community voices (home)", status: "ui" },
  { web: "PWA manifest", mobile: "Native app", status: "skip" },
  { web: "Unused recommendation form", mobile: "—", status: "skip" },
] as const

export type FeatureParityStatus = (typeof featureParity)[number]["status"]
