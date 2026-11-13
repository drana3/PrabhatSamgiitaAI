import { CHANNELS, categoryOf, channelOf, kindMeta, type ChannelId } from "@/lib/notifications/kinds"
import type { PlannedNotification } from "@/lib/notifications/schedule"

/**
 * What the phone is handed for one planned notification. Pure, so the shape is tested without a phone.
 *
 * - `sound: true`: the system sound on iOS. On Android the sound belongs to the channel (importance
 *   `default` or `high` plays it), so the same field changes nothing there. Reminders are at times the
 *   person chose, so they are meant to be noticed; the app shows no banner sound while it is open (native.ts).
 * - `interruptionLevel`: iOS 15+. `passive` (the streak reminder) goes quietly to the list; the rest are
 *   `active`. Nothing is `timeSensitive`: that breaks through Focus, and a song reminder never should.
 * - `categoryIdentifier`: `ps.<kind>`, the iOS category. Notices about the person's own content have a
 *   category with a private preview (native.ts `registerCategories`).
 * - `data`: `id` (the inbox item), `target` (the route), `kind` (for the tap handler and for pushes later).
 * - Not set, and why: iOS `threadIdentifier` and Android's group key cannot be set on a local notification
 *   with expo-notifications 0.32 (the content record has no such field). iOS then stacks by app; Android
 *   bundles by channel, which is why the kinds have their own channels (kinds.ts).
 */
export type NativeContent = {
  title: string
  body: string
  data: { id: string; target: string; kind: string }
  sound: true
  categoryIdentifier: string
  interruptionLevel: "passive" | "active"
}

export function nativeContent(n: Pick<PlannedNotification, "id" | "kind" | "title" | "text" | "target">): NativeContent {
  return {
    title: n.title,
    body: n.text,
    data: { id: n.id, target: n.target, kind: n.kind },
    sound: true,
    categoryIdentifier: categoryOf(n.kind),
    interruptionLevel: kindMeta(n.kind).ios,
  }
}

/** The Android channel id a planned notification goes to. */
export function channelFor(kind: string): ChannelId {
  return CHANNELS[channelOf(kind)].id
}
