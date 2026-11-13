import { BadgeCheck, Bell, BookOpen, Flame, Megaphone, MessageCircle, Music, Newspaper, PartyPopper, Radio, Repeat2 } from "lucide-react-native"

import type { AmProto } from "@/constants/tokens/amToday"
import { kindMeta, type KindIcon, type KindTone } from "@/lib/notifications/kinds"

/**
 * The look of a kind in the centre, from the registry's names (lib/notifications/kinds.ts `icon` and
 * `tone`). A new kind picks existing names there and needs nothing here; a new glyph or tone is one line each.
 */
const ICONS: Record<KindIcon, typeof Bell> = {
  newspaper: Newspaper,
  party: PartyPopper,
  repeat: Repeat2,
  book: BookOpen,
  flame: Flame,
  radio: Radio,
  music: Music,
  megaphone: Megaphone,
  bell: Bell,
  check: BadgeCheck,
  reply: MessageCircle,
}

export function kindIcon(kind: string): typeof Bell {
  return ICONS[kindMeta(kind).icon] ?? Bell
}

/** Tile colours; the glyph always has contrast on its tile. */
export function kindTile(p: AmProto, kind: string): { bg: string; fg: string } {
  const tone: KindTone = kindMeta(kind).tone
  switch (tone) {
    case "gold":
      return { bg: p.gold300, fg: "#1E1E1E" }
    case "action":
      return { bg: p.action, fg: "#FFFFFF" }
    case "sage":
      return { bg: p.sage700, fg: "#FFFFFF" }
    case "sageDeep":
      return { bg: p.sage800, fg: "#FFFFFF" }
    case "warn":
      return { bg: p.orange100, fg: p.orange700 }
    case "sand":
      return { bg: p.sand300, fg: p.ink800 }
    default:
      return { bg: p.dark ? p.sage800 : p.sage900, fg: p.gold300 }
  }
}
