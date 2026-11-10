import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

/** Dada, 10 Nov 2026: the Kiirtan tab top bar is avatar, search, NOTIFICATIONS BELL. The "+" is gone: the Upload button of the tab bar opens the same forms. */

const read = (path: string) => readFileSync(join(__dirname, "..", path), "utf8")

describe("the top row of the Kiirtan tab", () => {
  const kiirtan = read("app/kiirtan.tsx")
  const top = kiirtan.slice(kiirtan.indexOf("<View style={styles.topRow}>"), kiirtan.indexOf("<StickyChipsRow"))

  it("has the bell where the plus was, and no plus button", () => {
    expect(top).toContain("<NotificationBell")
    expect(top).not.toContain("<Plus")
    expect(top).not.toContain("kt.add.title")
  })

  it("opens the notification centre, the same screen as the bell of Today", () => {
    expect(top).toContain('href("/notifications")')
    expect(read("components/home/HomeScreen.tsx")).toContain('href("/notifications")')
  })

  it("shares one bell component with Today and uses the same unread count", () => {
    expect(kiirtan).toMatch(/import \{[^}]*NotificationBell[^}]*\} from "@\/components\/home\/HomeBlocks"/)
    expect(kiirtan).toContain("useNotificationItems()")
    const blocks = read("components/home/HomeBlocks.tsx")
    expect(blocks).toContain("export function NotificationBell")
    expect(blocks).toContain("<NotificationBell p={p} unread={unread} onPress={onBell} />")
    expect(blocks).toContain('t("home.notificationsUnread")')
  })

  it("keeps the way to add recordings: the Upload button of the tab bar opens the hub, which holds the recording form and Others", () => {
    expect(read("components/nav-v2/FloatingTabBar.tsx")).toContain('href("/upload")')
    const hub = read("app/upload.tsx")
    expect(hub).toContain('href("/add-kirtan")')
    expect(hub).toContain('href("/add-mantra")')
  })
})
