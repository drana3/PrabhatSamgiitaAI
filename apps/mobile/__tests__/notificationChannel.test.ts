import { describe, expect, it } from "vitest"

import { remindersChannelName } from "@/lib/notifications/channelNames"

describe("Android reminders channel name", () => {
  it("is translated for every app language", () => {
    expect(remindersChannelName("en")).toBe("Reminders")
    expect(remindersChannelName("ru")).toBe("Напоминания")
    expect(remindersChannelName("es")).toBe("Recordatorios")
  })
})
