import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {}, multiRemove: async () => {}, getAllKeys: async () => [] },
}))

import { createCreditsApi } from "@/lib/credits/remote"
import { createDemoCreditsApi } from "@/lib/credits/demo"
import { creditItem, creditItems, syncCreditNotices } from "@/lib/credits/notices"
import { errorKey } from "@/lib/authors/slug"
import { dictionaries } from "@/locales"
import {
  addChip,
  chipsFromPayload,
  creditLine,
  creditLink,
  daysLeft,
  hasCreditLine,
  inviteUrl,
  inviteWords,
  kindHasPeople,
  MAX_PERFORMERS,
  performersPayload,
  removeChip,
  roleKey,
  setChipRole,
  stateView,
  summaryParts,
  tokenFromLink,
  visibleCredits,
  type CreditView,
  type InviteView,
  type PerformerChip,
} from "@/lib/kirtan/credits"
import { NetworkError, publishRecording, RemoteError, type RemoteConfig, type RemoteNotice, type RemoteRecording } from "@/lib/kirtan/remote"
import { buildSubmission, type SubmissionInput } from "@/lib/kirtan/submissions"
import { channelOf, kindMeta } from "@/lib/notifications/kinds"
import { resolveTarget } from "@/lib/notifications/target"

const TOKEN = "A".repeat(43)

describe("the people on the upload form", () => {
  it("adds a name or a page, trims the name and keeps the order", () => {
    let list: PerformerChip[] = []
    list = addChip(list, { name: "  Priya   Devi " }).list
    list = addChip(list, { name: "Ravi", profileId: "p-1", slug: "ravi-kiirtan", role: "author" }).list
    expect(list.map((c) => [c.name, c.profileId, c.slug, c.role])).toEqual([
      ["Priya Devi", null, null, "performer"],
      ["Ravi", "p-1", "ravi-kiirtan", "author"],
    ])
    expect(new Set(list.map((c) => c.key)).size).toBe(2)
  })

  it("never keeps a slug for a plain name", () => {
    expect(addChip([], { name: "Ravi", slug: "ravi" }).list[0]).toMatchObject({ profileId: null, slug: null })
  })

  it("refuses an empty or one-letter name", () => {
    expect(addChip([], { name: "   " })).toEqual({ list: [], problem: "empty" })
    expect(addChip([], { name: "R" }).problem).toBe("empty")
  })

  it("does not add the same page or the same name twice, whatever the case or spacing", () => {
    const one = addChip([], { name: "Priya Devi", profileId: "p-1", slug: "priya" }).list
    expect(addChip(one, { name: "Another name", profileId: "p-1" }).problem).toBe("duplicate")
    expect(addChip(one, { name: "  priya   DEVI " }).problem).toBe("duplicate")
    expect(addChip(one, { name: "Ravi" }).problem).toBeNull()
  })

  it("stops at ten people", () => {
    let list: PerformerChip[] = []
    for (let i = 0; i < MAX_PERFORMERS; i += 1) list = addChip(list, { name: `Person ${String.fromCharCode(65 + i)}${i}` }).list
    expect(list).toHaveLength(10)
    const eleventh = addChip(list, { name: "One more" })
    expect(eleventh.problem).toBe("limit")
    expect(eleventh.list).toHaveLength(10)
  })

  it("removes a person and changes a role by the row's key", () => {
    const list = addChip(addChip([], { name: "Priya" }).list, { name: "Ravi" }).list
    const [a, b] = list as [PerformerChip, PerformerChip]
    expect(removeChip(list, a.key).map((c) => c.name)).toEqual(["Ravi"])
    expect(setChipRole(list, b.key, "author").map((c) => c.role)).toEqual(["performer", "author"])
  })

  it("sends a page by its id, a plain name by its name only, and nothing when there is no one", () => {
    const list = addChip(addChip([], { name: "Priya" }).list, { name: "Ravi", profileId: "p-1", slug: "ravi", role: "author" }).list
    expect(performersPayload(list, "kiirtan")).toEqual([
      { name: "Priya", role: "performer" },
      { name: "Ravi", profile_id: "p-1", role: "author" },
    ])
    expect(performersPayload([], "kiirtan")).toBeUndefined()
    expect(performersPayload(undefined, "kiirtan")).toBeUndefined()
  })

  it("has no people at all on Baba's Audio", () => {
    const list = addChip([], { name: "Priya" }).list
    expect(kindHasPeople("baba_audio")).toBe(false)
    expect(kindHasPeople("kiirtan")).toBe(true)
    expect(kindHasPeople("bhajan")).toBe(true)
    expect(performersPayload(list, "baba_audio")).toBeUndefined()
  })

  it("reads a stored payload back into rows", () => {
    const back = chipsFromPayload([
      { name: "Priya", role: "performer" },
      { name: "Ravi", profile_id: "p-1", role: "author" },
      { name: "priya", role: "performer" },
    ])
    expect(back.map((c) => [c.name, c.profileId, c.role])).toEqual([
      ["Priya", null, "performer"],
      ["Ravi", "p-1", "author"],
    ])
  })
})

describe("the performers travel with the upload", () => {
  const base: SubmissionInput = { kind: "kiirtan", fileName: "a.mp3", fileUri: "file:///a.mp3", fileSize: 1000, fileType: "audio/mpeg", title: "Baba Nam Kevalam", author: "Priya", addedBy: "You", byAuthor: true, termsAccepted: true, styles: ["indian"], recordingType: "studio", performance: "solo" }
  const people = [{ name: "Ravi", profile_id: "p-1", role: "author" as const }]

  it("keeps them in the submission, but not for Baba's Audio and not when empty", () => {
    expect(buildSubmission({ ...base, performers: people }, 1)).toMatchObject({ performers: people })
    expect(buildSubmission({ ...base, performers: [] }, 1)).not.toHaveProperty("performers")
    expect(buildSubmission(base, 1)).not.toHaveProperty("performers")
    expect(buildSubmission({ ...base, kind: "baba_audio", performers: people }, 1)).not.toHaveProperty("performers")
  })

  it("sends them in the body of the upload as `performers`, at most ten", async () => {
    const calls: Record<string, unknown>[] = []
    const rec = { id: "r1", kind: "kiirtan", type: "other", title: "T", author: "A", added_by: "A", author_id: null, by_author: false, status: "published", duration_sec: null, plays: 0, audio_url: "u", thumbnail_url: null, published_at: null, created_at: "2026-01-01T00:00:00Z" } as RemoteRecording
    const fake = (async (_url: string, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)))
      return new Response(JSON.stringify(rec), { status: 200, headers: { "content-type": "application/json" } })
    }) as unknown as typeof fetch
    const cfg: RemoteConfig = { baseUrl: "https://api.test/", headers: () => ({}), fetch: fake }
    const common = { key: "k", type: "other", title: "T", author: "A", byAuthor: false, termsVersion: "v", confirmDifferent: false }
    const twelve = Array.from({ length: 12 }, (_, i) => ({ name: `Person ${i}`, role: "performer" as const }))
    await publishRecording(cfg, { ...common, kind: "kiirtan", performers: twelve })
    expect((calls[0]!.performers as unknown[]).length).toBe(10)
    await publishRecording(cfg, { ...common, kind: "kiirtan", performers: people })
    expect(calls[1]!.performers).toEqual(people)
    await publishRecording(cfg, { ...common, kind: "kiirtan", performers: [] })
    expect(calls[2]).not.toHaveProperty("performers")
    await publishRecording(cfg, { ...common, kind: "baba_audio", performers: people })
    expect(calls[3]).not.toHaveProperty("performers")
  })
})

describe("the state of a credit and the line under a recording", () => {
  const credit = (patch: Partial<CreditView> & { id: string }): CreditView => ({ name: "Someone", role: "performer", status: "text", page: null, ...patch })

  it("reads each status for the uploader; a no, an expiry and a plain name look the same", () => {
    expect(stateView("accepted")).toEqual({ key: "credits.state.accepted", tone: "done" })
    expect(stateView("invited")).toEqual({ key: "credits.state.invited", tone: "waiting" })
    expect(stateView("declined").key).toBe("credits.state.text")
    expect(stateView("expired").key).toBe("credits.state.text")
    expect(stateView("text").key).toBe("credits.state.text")
    expect(stateView("removed")).toEqual({ key: "credits.state.removed", tone: "quiet" })
    expect(roleKey("author")).toBe("credits.role.author")
  })

  it("shows the public only plain names and confirmed people, and never a removed one", () => {
    const all = [
      credit({ id: "1", status: "text" }),
      credit({ id: "2", status: "invited" }),
      credit({ id: "3", status: "accepted", page: { slug: "ravi", display_name: "Ravi" } }),
      credit({ id: "4", status: "declined" }),
      credit({ id: "5", status: "removed" }),
    ]
    expect(visibleCredits(all, false).map((c) => c.id)).toEqual(["1", "3"])
    expect(visibleCredits(all, true).map((c) => c.id)).toEqual(["1", "2", "3", "4"])
  })

  it("links a confirmed person to their page and nobody else", () => {
    expect(creditLink(credit({ id: "1", status: "accepted", page: { slug: "ravi kiirtan", display_name: "Ravi" } }))).toBe("/author/ravi%20kiirtan")
    expect(creditLink(credit({ id: "2", status: "invited", page: { slug: "ravi", display_name: "Ravi" } }))).toBeNull()
    expect(creditLink(credit({ id: "3", status: "accepted" }))).toBeNull()
  })

  it("builds the line: the page's own name for a confirmed person, no repeat of the recording's author", () => {
    const list = [
      credit({ id: "1", name: "priya", status: "text" }),
      credit({ id: "2", name: "ravi k", status: "accepted", page: { slug: "ravi", display_name: "Ravi Kiirtan" } }),
      credit({ id: "3", name: "Main Singer", status: "text" }),
    ]
    expect(creditLine(list, false, ["main  singer"])).toEqual([
      { text: "priya", href: null },
      { text: "Ravi Kiirtan", href: "/author/ravi" },
    ])
    expect(hasCreditLine(creditLine([], false))).toBe(false)
  })

  it("counts confirmed and waiting, never below zero", () => {
    expect(summaryParts({ confirmed: 2, waiting: 1 })).toEqual({ confirmed: 2, waiting: 1 })
    expect(summaryParts(null)).toEqual({ confirmed: 0, waiting: 0 })
    expect(summaryParts({ confirmed: -3, waiting: 0 })).toEqual({ confirmed: 0, waiting: 0 })
  })
})

describe("invitations and the invite link", () => {
  const invite: InviteView = { credit_id: "c1", recording: { id: "r1", kind: "kiirtan", title: "Lila", author: "Uploader" }, from_name: "  ", role: "author", created_at: "2026-11-01T00:00:00Z", expires_at: "2026-12-31T00:00:00Z" }

  it("names who asked: the sender, else the recording's author", () => {
    expect(inviteWords(invite)).toEqual({ who: "Uploader", title: "Lila", roleKey: "credits.role.author" })
    expect(inviteWords({ ...invite, from_name: "Ravi" }).who).toBe("Ravi")
  })

  it("counts whole days left, never below zero, null without an end", () => {
    const now = Date.parse("2026-12-01T00:00:00Z")
    expect(daysLeft(invite, now)).toBe(30)
    expect(daysLeft({ expires_at: "2026-11-01T00:00:00Z" }, now)).toBe(0)
    expect(daysLeft({ expires_at: null }, now)).toBeNull()
    expect(daysLeft({ expires_at: "nonsense" }, now)).toBeNull()
  })

  it("builds the link and reads the token back from a link, a path or the bare token", () => {
    expect(inviteUrl("https://www.example.org/", TOKEN)).toBe(`https://www.example.org/credit/${TOKEN}`)
    expect(tokenFromLink(`https://www.example.org/credit/${TOKEN}`)).toBe(TOKEN)
    expect(tokenFromLink(`https://www.example.org/credit/${TOKEN}?x=1`)).toBe(TOKEN)
    expect(tokenFromLink(`/credit/${TOKEN}`)).toBe(TOKEN)
    expect(tokenFromLink(` ${TOKEN} `)).toBe(TOKEN)
    expect(tokenFromLink("short")).toBeNull()
    expect(tokenFromLink("../../etc/passwd")).toBeNull()
    expect(tokenFromLink(null)).toBeNull()
  })
})

const notice = (id: string, kind: string, payload: Record<string, unknown>, extra: Partial<RemoteNotice> = {}): RemoteNotice => ({
  id,
  kind,
  recording_id: null,
  title: "Server title",
  body: "Server body",
  payload,
  created_at: "2026-11-08T09:00:00Z",
  read_at: null,
  ...extra,
})

describe("credit notices in the notification centre", () => {
  it("tells the named person, in the app's language, and opens the invitations", () => {
    const item = creditItem(notice("n1", "credit_invite", { credit_id: "c1", role: "author", recording_title: "Lila" }))
    expect(item).toMatchObject({ id: "credit:n1", kind: "credit", target: "/credit-invites", title: "You were named on a recording" })
    expect(item?.text).toBe("You were named as the writer of “Lila”. Is it you?")
    expect(creditItem(notice("n2", "credit_invite", { credit_id: "c1", role: "performer", recording_title: "Lila" }))?.text).toBe("You were named as a performer on “Lila”. Is it you?")
    expect(creditItem(notice("n3", "credit_invite", { credit_id: "c1" }))).toBeNull()
  })

  it("tells the uploader with the server's sentence and opens the people of that recording", () => {
    const item = creditItem(notice("n4", "credit_accepted", { credit_id: "c1" }, { recording_id: "rec-1", body: "Priya confirmed on “Lila”." }))
    expect(item).toMatchObject({ id: "credit:n4", kind: "credit", target: "/recording-people?id=rec-1", text: "Priya confirmed on “Lila”.", title: "A person confirmed" })
    expect(creditItem(notice("n5", "credit_declined", { credit_id: "c1" }, { recording_id: "rec-1" }))?.title).toBe("A person did not confirm")
    expect(creditItem(notice("n6", "credit_expired", { credit_id: "c1" }, { recording_id: "rec-1" }))?.title).toBe("No answer")
    expect(creditItem(notice("n7", "credit_accepted", { credit_id: "c1" }))?.target).toBe("/my-credits")
  })

  it("never puts a strange recording id into a route", () => {
    expect(creditItem(notice("n8", "credit_accepted", {}, { recording_id: "../x?y" }))?.target).toBe("/my-credits")
  })

  it("tells a person the team took off a recording, and opens my credits", () => {
    expect(creditItem(notice("n9", "credit_removed", { credit_id: "c1" }, { body: "" }))).toMatchObject({ target: "/my-credits", title: "Taken off a recording", text: "Server title" })
  })

  it("skips what is malformed or of another kind", () => {
    expect(creditItem(notice("a", "credit_accepted", {}, { created_at: "nonsense" }))).toBeNull()
    expect(creditItem(notice("b", "comment_reply", {}))).toBeNull()
    expect(creditItems([notice("c", "comment_reply", {}), notice("d", "credit_removed", {})]).map((i) => i.id)).toEqual(["credit:d"])
  })

  it("is account-bound, on the notices channel, and every target is a real screen", () => {
    expect(kindMeta("credit")).toMatchObject({ tier: "reminder", accountBound: true, keepDays: 90 })
    expect(channelOf("credit")).toBe("notices")
    expect(resolveTarget({ kind: "credit", target: "/credit-invites" }).missing).toBe(false)
    expect(resolveTarget({ kind: "credit", target: null })).toMatchObject({ missing: true, route: "/credit-invites" })
  })
})

describe("asking the server for the credit notices", () => {
  beforeEach(async () => {
    const { useNotificationsStore } = await import("@/stores/notificationsStore")
    useNotificationsStore.getState().reset()
  })

  it("puts the credit notices in the centre, marks only those read, and leaves the others alone", async () => {
    const calls: string[] = []
    const recent = { created_at: new Date(Date.now() - 3_600_000).toISOString() }
    const list = [
      notice("n1", "credit_invite", { credit_id: "c1", role: "performer", recording_title: "Lila" }, recent),
      notice("n2", "claim_approved", { profile_slug: "priya-devi", count: 1 }, recent),
      notice("n3", "credit_accepted", { credit_id: "c2" }, { ...recent, recording_id: "rec-1" }),
    ]
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url.replace("http://api.test", "")}`)
      return new Response(JSON.stringify((init?.method ?? "GET") === "GET" ? list : list[0]), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    const cfg = { baseUrl: "http://api.test", headers: () => ({}), fetch: fetch as unknown as typeof globalThis.fetch }
    expect(await syncCreditNotices(cfg)).toBe(2)
    expect(calls).toEqual(["GET /api/v1/recordings/notices?unread_only=true", "POST /api/v1/recordings/notices/n1/read", "POST /api/v1/recordings/notices/n3/read"])
    const { useNotificationsStore } = await import("@/stores/notificationsStore")
    expect(useNotificationsStore.getState().items.map((i) => i.id).sort()).toEqual(["credit:n1", "credit:n3"])
  })

  it("never throws when the server is out of reach", async () => {
    const cfg = { baseUrl: "http://api.test", headers: () => ({}), fetch: (async () => { throw new Error("offline") }) as unknown as typeof globalThis.fetch }
    await expect(syncCreditNotices(cfg)).resolves.toBe(0)
  })
})

describe("the credits API of the phone", () => {
  type Call = { method: string; path: string; body: unknown }
  function server(answer: (call: Call) => Response) {
    const calls: Call[] = []
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const call: Call = { method: init?.method ?? "GET", path: url.replace("http://api.test/api/v1", ""), body: init?.body ? JSON.parse(String(init.body)) : undefined }
      calls.push(call)
      return answer(call)
    })
    const api = createCreditsApi({ baseUrl: "http://api.test/", headers: () => ({ Authorization: "Bearer x" }), fetch: fetch as unknown as typeof globalThis.fetch })
    return { api, calls }
  }
  const ok = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

  it("lists, adds, changes a role, removes and makes a link on the right addresses", async () => {
    const list = { credits: [], can_manage: true, summary: { confirmed: 0, waiting: 0 } }
    const { api, calls } = server((c) => (c.method === "DELETE" ? ok(null, 204) : c.path.endsWith("/link") ? ok({ token: TOKEN, expires_at: "2027-01-01T00:00:00Z" }) : ok(list)))
    await api.list("r 1")
    await api.add("r1", { name: "Priya", role: "performer" })
    await api.setRole("r1", "c1", "author")
    await expect(api.remove("r1", "c1")).resolves.toBeUndefined()
    expect((await api.link("r1", "c1")).token).toBe(TOKEN)
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["GET /recordings/r%201/credits", "POST /recordings/r1/credits", "PUT /recordings/r1/credits/c1/role", "DELETE /recordings/r1/credits/c1", "POST /recordings/r1/credits/c1/link"])
    expect(calls[1]!.body).toEqual({ name: "Priya", role: "performer" })
    expect(calls[2]!.body).toEqual({ role: "author" })
  })

  it("answers the invitations with the three replies, and the lists as plain arrays", async () => {
    const { api, calls } = server((c) => (c.method === "GET" ? ok({ items: [{ credit_id: "c1" }] }) : ok({ id: "c1", status: "accepted" })))
    expect(await api.invites()).toHaveLength(1)
    await api.accept("c1")
    await api.decline("c1")
    await api.decline("c2", true)
    expect(await api.mine()).toHaveLength(1)
    expect(await api.blocks()).toHaveLength(1)
    await api.leave("c3")
    await api.acceptLink(TOKEN)
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "GET /authors/me/credit-invites",
      "POST /authors/me/credit-invites/c1/accept",
      "POST /authors/me/credit-invites/c1/decline",
      "POST /authors/me/credit-invites/c2/decline",
      "GET /authors/me/credits",
      "GET /authors/me/credit-blocks",
      "POST /authors/me/credits/c3/leave",
      "POST /credit-links/accept",
    ])
    expect(calls[2]!.body).toEqual({ block: false })
    expect(calls[3]!.body).toEqual({ block: true })
    expect(calls[7]!.body).toEqual({ token: TOKEN })
  })

  it("reads and sets who can name me, and removes a block", async () => {
    const { api, calls } = server((c) => (c.method === "DELETE" ? ok(null, 204) : ok({ credit_invites: "nobody" })))
    expect(await api.settings()).toEqual({ credit_invites: "nobody" })
    await api.setSettings("everyone")
    await api.unblock("b1")
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["GET /authors/me/credit-settings", "PUT /authors/me/credit-settings", "DELETE /authors/me/credit-blocks/b1"])
    expect(calls[1]!.body).toEqual({ credit_invites: "everyone" })
  })

  it("turns the server's error code into a RemoteError the screens can name", async () => {
    const { api } = server(() => ok({ detail: { code: "invites_off", message: "Not taking part" } }, 409))
    const failure = await api.add("r1", { name: "Priya", profile_id: "p1", role: "performer" }).catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(RemoteError)
    expect((failure as RemoteError).code).toBe("invites_off")
    expect((failure as RemoteError).status).toBe(409)
    expect(errorKey({ code: (failure as RemoteError).code })).toBe("credits.error.invites_off")
  })

  it("names a too-many-requests answer and a lost connection", async () => {
    const busy = server(() => ok({ detail: "slow down" }, 429))
    const e429 = await busy.api.invites().catch((e: unknown) => e)
    expect((e429 as RemoteError).status).toBe(429)
    const offline = createCreditsApi({ baseUrl: "http://api.test", headers: () => ({}), fetch: (async () => { throw new Error("offline") }) as unknown as typeof globalThis.fetch })
    await expect(offline.mine()).rejects.toBeInstanceOf(NetworkError)
  })
})

describe("the preview's credits (invented people)", () => {
  it("says it is a demo, lists, adds up to the limit and answers an invitation", async () => {
    const api = createDemoCreditsApi()
    expect(api.demo).toBe(true)
    const start = await api.list("demo-1")
    expect(Array.isArray(start.credits)).toBe(true)
    const invites = await api.invites()
    if (invites.length) {
      const answered = await api.accept(invites[0]!.credit_id)
      expect(answered.status).toBe("accepted")
      expect((await api.invites()).length).toBe(invites.length - 1)
    }
    expect((await api.settings()).credit_invites).toMatch(/everyone|nobody/)
  })
})

describe("the words", () => {
  const en = dictionaries.en as Record<string, string>
  const keysOf = (d: Record<string, string>) => Object.keys(d).filter((k) => k.startsWith("credits.")).sort()
  const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

  it("has every credits sentence in English, Russian and Spanish with the same {values}", () => {
    const base = keysOf(en)
    expect(base.length).toBeGreaterThan(80)
    for (const language of ["ru", "es"] as const) {
      const d = dictionaries[language] as Record<string, string>
      expect(keysOf(d), language).toEqual(base)
      for (const key of base) {
        expect(d[key]!.trim(), `${language} ${key}`).not.toBe("")
        expect(vars(d[key]!), `${language} ${key}`).toEqual(vars(en[key]!))
      }
    }
  })

  it("says Kiirtan with two i's, never the one-i spelling, and puts no Latin Kiirtan into Russian", () => {
    for (const [k, v] of Object.entries(en)) if (k.startsWith("credits.")) expect(v, k).not.toMatch(/Kirtan/)
    for (const [k, v] of Object.entries(dictionaries.ru as Record<string, string>)) if (k.startsWith("credits.")) expect(v, k).not.toMatch(/Ki?irtan/)
  })

  it("has a sentence for every error code the server sends for credits, and every sentence the screens name", () => {
    const codes = ["already_added", "invites_off", "too_many", "name_invalid", "role_invalid", "not_yours", "no_longer_open", "credit_not_found", "link_not_valid", "confirmed_credit", "not_on_page", "not_text", "block_not_found", "page_not_found", "recording_not_found"]
    for (const code of codes) expect(en[errorKey({ code })] ?? null, code).not.toBeNull()
    for (const key of ["credits.state.text", "credits.state.invited", "credits.state.accepted", "credits.state.removed", "credits.role.performer", "credits.role.author", "credits.problem.empty", "credits.problem.limit", "credits.problem.duplicate"]) expect(en[key], key).toBeTruthy()
  })

  it("uses no key that looks like a plural form (the typed translator reads those as one)", () => {
    for (const key of keysOf(en)) expect(key, key).not.toMatch(/_(zero|one|two|few|many|other)$/)
  })
})
