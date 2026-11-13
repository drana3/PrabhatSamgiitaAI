import { describe, expect, it } from "vitest"

import { actionsFor, deskReasonKey, groupByPage, reasonChips, setMany, toggled, UNDO } from "@/lib/authors/desk"
import { createDeskDemo } from "@/lib/authors/deskDemo"
import { claimsDeskEn, claimsDeskEs, claimsDeskRu } from "@/locales/claimsDesk"

const NOW = Date.parse("2026-11-09T12:00:00Z")
const demo = (team = true) => createDeskDemo({ team: () => team, now: () => NOW })

describe("the team desk for author claims, rules", () => {
  it("offers a waiting request approve or decline, an approved one take-off or put-back, the rest approve or put-back", () => {
    expect(actionsFor("pending")).toEqual(["approve", "reject"])
    expect(actionsFor("approved")).toEqual(["revoke", "reopen"])
    expect(actionsFor("rejected")).toEqual(["approve", "reopen"])
    expect(actionsFor("revoked")).toEqual(["approve", "reopen"])
  })

  it("keeps the order of the reason chips: biggest first, none empty", () => {
    expect(reasonChips({ pending: 5, approved: 0, rejected: 0, revoked: 0, by_reason: { b: 1, a: 3, c: 0, z: 1 } })).toEqual([
      { reason: "a", count: 3 },
      { reason: "b", count: 1 },
      { reason: "z", count: 1 },
    ])
  })

  it("selects and clears one id and a whole group without touching the old set", () => {
    const one = new Set(["a"])
    const two = toggled(one, "b")
    expect([...two].sort()).toEqual(["a", "b"])
    expect([...one]).toEqual(["a"])
    expect([...toggled(two, "a")]).toEqual(["b"])
    expect([...setMany(two, ["c", "d"], true)].sort()).toEqual(["a", "b", "c", "d"])
    expect([...setMany(two, ["a"], false)]).toEqual(["b"])
  })

  it("writes the reason words key without a plural-looking ending", () => {
    expect(deskReasonKey("taken_by_other")).toBe("claimsDesk.reason.taken")
    expect(deskReasonKey("famous_name")).toBe("claimsDesk.reason.famous_name")
    expect(deskReasonKey("other")).toBe("claimsDesk.reason.other")
  })

  it("has every reason the server can send in all three languages", () => {
    const reasons = ["protected_name", "famous_name", "taken_by_other", "alias_match", "group_credit", "group_page", "not_same_name", "unverified_page", "draft_page", "review_flag", "other"]
    for (const dict of [claimsDeskEn, claimsDeskRu, claimsDeskEs] as Record<string, string>[]) {
      for (const reason of reasons) {
        const key = deskReasonKey(reason)
        expect(dict[key], key).toBeTruthy()
        expect(dict[key.replace("reason.", "why.")], key).toBeTruthy()
      }
    }
  })

  it("keeps the three dictionaries on the same keys", () => {
    expect(Object.keys(claimsDeskRu).sort()).toEqual(Object.keys(claimsDeskEn).sort())
    expect(Object.keys(claimsDeskEs).sort()).toEqual(Object.keys(claimsDeskEn).sort())
  })
})

describe("the team desk, the preview's stand-in", () => {
  it("groups the waiting requests by author page", async () => {
    const desk = demo()
    const page = await desk.list("pending")
    const groups = groupByPage(page.items)
    expect(groups.map((g) => g.name)).toEqual(["Dharmacakra Kiirtan", "Priya Devi", "Ravi Kiirtan"])
    expect(groups.find((g) => g.name === "Priya Devi")?.items).toHaveLength(3)
  })

  it("counts the tabs and the waiting reasons", async () => {
    const summary = await demo().summary()
    expect(summary).toMatchObject({ pending: 5, approved: 1, rejected: 1, revoked: 0 })
    expect(summary.by_reason.unverified_page).toBe(2)
    expect(summary.by_reason.famous_name).toBe(1)
  })

  it("filters the waiting tab by one reason", async () => {
    const page = await demo().list("pending", "famous_name")
    expect(page.items.map((i) => i.id)).toEqual(["d4"])
  })

  it("decides requests of several pages at once, and the Undo puts every one back to waiting", async () => {
    const desk = demo()
    expect(await desk.decide(["d1", "d4", "d5"], "approve")).toBe(3)
    expect((await desk.summary()).pending).toBe(2)
    expect((await desk.list("approved")).items.map((i) => i.id).sort()).toEqual(["d1", "d4", "d5", "d6"])
    expect(await desk.decide(["d1", "d4", "d5"], UNDO)).toBe(3)
    expect((await desk.summary()).pending).toBe(5)
  })

  it("never changes what is not in the right state, and says how many changed", async () => {
    const desk = demo()
    expect(await desk.decide(["d6"], "reject")).toBe(0) // approved cannot be declined
    expect(await desk.decide(["d1"], "revoke")).toBe(0) // waiting cannot be taken off
    expect(await desk.decide(["d6"], "revoke")).toBe(1)
    expect(await desk.decide(["d6"], "revoke")).toBe(0) // twice
    expect(await desk.decide([], "approve")).toBe(0)
    expect(await desk.decide(["d7"], "approve")).toBe(1) // a declined one can be approved later
  })

  it("keeps a decision note and clears it when the decision is put back", async () => {
    const desk = demo()
    await desk.decide(["d2"], "reject", "  not her  ")
    expect((await desk.list("rejected")).items.find((i) => i.id === "d2")?.decision_note).toBe("not her")
    await desk.decide(["d2"], "reopen")
    expect((await desk.list("pending")).items.find((i) => i.id === "d2")?.decision_note).toBeNull()
  })

  it("refuses everybody who is not the team", async () => {
    const desk = demo(false)
    await expect(desk.list("pending")).rejects.toMatchObject({ status: 403 })
    await expect(desk.summary()).rejects.toMatchObject({ status: 403 })
    await expect(desk.decide(["d1"], "approve")).rejects.toMatchObject({ status: 403 })
  })
})
