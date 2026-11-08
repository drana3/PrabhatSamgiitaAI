/**
 * The notice-kind registry: ONE table that says what each kind of notification is. Everything that
 * depends on the kind reads it: how long the centre keeps the item, whether it counts for the badge,
 * whether it collapses into a group, which Android channel it uses, which icon and tile the row gets,
 * where a tap goes when the target is gone, whether it belongs to the signed-in account.
 *
 * To add a kind (for example a chord proposal result), see "Adding a notice kind" in docs/notifications.md.
 * In short: add the name and one entry here, build the item with a small function next to
 * `serverKinds.ts` (id, title, text, target) and hand it to `useNotificationsStore.getState().receive([...], now)`.
 * No other file has to change; an unknown kind is handled with safe defaults (`kindMeta`).
 */

/** How the centre treats a kind. `important` is about the person's own content (a removal, a review result). */
export type KindTier = "reminder" | "important"

/** Where the item comes from: the phone's own scheduler, or the server. */
export type KindSource = "local" | "server"

/** The Android channels (users mute them one by one in system settings). */
export type ChannelId = "reminders" | "festivals" | "team" | "notices" | "replies"

/** The glyph on the row's tile: a name the notifications screen maps to an icon. */
export type KindIcon = "newspaper" | "party" | "repeat" | "book" | "flame" | "radio" | "music" | "megaphone" | "bell" | "check" | "reply"

/** The colours of the tile: names the notifications screen maps to the theme's colours. */
export type KindTone = "song" | "gold" | "action" | "sage" | "sageDeep" | "sand" | "warn"

export type KindMeta = {
  source: KindSource
  tier: KindTier
  /** days an item stays in the centre (read or not) */
  keepDays: number
  /** days an UNREAD item of an important kind stays (never longer than this) */
  unreadKeepDays?: number
  /** order of items that fire in the same minute: lower first */
  priority: number
  /** several of the same day collapse into one group row (see grouping.ts) */
  groupable: boolean
  /** belongs to the signed-in account: removed from this phone at sign-out */
  accountBound: boolean
  channel: ChannelId
  /** iOS: `passive` arrives quietly in the list (no sound, screen stays dark), `active` is the normal banner */
  ios: "passive" | "active"
  icon: KindIcon
  tone: KindTone
  /** an app route to open when the item's own target no longer exists */
  fallback: string
  /** the words of a group row ("3 replies to your comment"); the plain "N reminders" when not set */
  groupCount?: "replies"
}

const REMINDER_DAYS = 14

export const KIND_META = {
  song: { source: "local", tier: "reminder", keepDays: REMINDER_DAYS, priority: 3, groupable: true, accountBound: false, channel: "reminders", ios: "active", icon: "newspaper", tone: "song", fallback: "/v2/songs" },
  festival: { source: "local", tier: "reminder", keepDays: REMINDER_DAYS, priority: 1, groupable: false, accountBound: false, channel: "festivals", ios: "active", icon: "party", tone: "gold", fallback: "/festivals" },
  words: { source: "local", tier: "reminder", keepDays: REMINDER_DAYS, priority: 2, groupable: true, accountBound: false, channel: "reminders", ios: "active", icon: "repeat", tone: "action", fallback: "/v2/learn" },
  streak: { source: "local", tier: "reminder", keepDays: REMINDER_DAYS, priority: 4, groupable: false, accountBound: false, channel: "reminders", ios: "passive", icon: "flame", tone: "song", fallback: "/v2/learn" },
  story: { source: "server", tier: "reminder", keepDays: 30, priority: 5, groupable: false, accountBound: false, channel: "team", ios: "active", icon: "book", tone: "sage", fallback: "/v2/today" },
  live: { source: "server", tier: "reminder", keepDays: 2, priority: 0, groupable: false, accountBound: false, channel: "team", ios: "active", icon: "radio", tone: "sageDeep", fallback: "/v2/kiirtan" },
  announcement: { source: "server", tier: "reminder", keepDays: 30, priority: 5, groupable: false, accountBound: false, channel: "team", ios: "active", icon: "megaphone", tone: "sand", fallback: "/v2/today" },
  reply: { source: "server", tier: "reminder", keepDays: 30, priority: 5, groupable: true, accountBound: true, channel: "replies", ios: "active", icon: "reply", tone: "sage", fallback: "/v2/songs", groupCount: "replies" },
  upload: { source: "server", tier: "important", keepDays: 90, unreadKeepDays: 180, priority: 5, groupable: false, accountBound: true, channel: "notices", ios: "active", icon: "music", tone: "warn", fallback: "/v2/kiirtan" },
} as const satisfies Record<string, KindMeta>

/** Every kind the app knows. Adding a key to `KIND_META` adds it here. */
export type NotificationKind = keyof typeof KIND_META

/** What an unknown kind (one a newer server sends) is treated as: a plain, short-lived reminder from the team. */
export const UNKNOWN_KIND_META: KindMeta = {
  source: "server",
  tier: "reminder",
  keepDays: 30,
  priority: 9,
  groupable: false,
  accountBound: false,
  channel: "team",
  ios: "active",
  icon: "bell",
  tone: "sand",
  fallback: "/v2/today",
}

export function kindMeta(kind: string): KindMeta {
  return (KIND_META as Record<string, KindMeta>)[kind] ?? UNKNOWN_KIND_META
}

export function isImportant(kind: string): boolean {
  return kindMeta(kind).tier === "important"
}

export function isAccountBound(kind: string): boolean {
  return kindMeta(kind).accountBound
}

/* ---------------------------------------------------------------- channels */

export type ChannelMeta = {
  id: ChannelId
  /** Android importance: `default` = sound in the shade; `high` = also a heads-up banner */
  importance: "default" | "high"
  /** the system settings group the channel sits in */
  group: "reminders" | "messages"
}

/**
 * Android channels. `reminders` is the one the app has always had (its id must not change: a user's own
 * choices for a channel are kept by id). A channel is what a person mutes in system settings, so a kind
 * that should be mutable on its own has its own: festivals, team messages, notices about your own uploads.
 * `notices` is the only `high` one: it is rare and about the person's own content.
 */
export const CHANNELS: Record<ChannelId, ChannelMeta> = {
  reminders: { id: "reminders", importance: "default", group: "reminders" },
  festivals: { id: "festivals", importance: "default", group: "reminders" },
  team: { id: "team", importance: "default", group: "messages" },
  notices: { id: "notices", importance: "high", group: "messages" },
  replies: { id: "replies", importance: "default", group: "messages" },
}

export const CHANNEL_GROUPS = ["reminders", "messages"] as const
export type ChannelGroupId = (typeof CHANNEL_GROUPS)[number]

export function channelOf(kind: string): ChannelId {
  return kindMeta(kind).channel
}

/** The iOS category id of a kind (`ps.song`). No `:` or `-`, as expo-notifications asks. */
export function categoryOf(kind: string): string {
  return `ps.${kind.replace(/[^a-zA-Z0-9]/g, "")}`
}
